import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { ExportUndAusgabeDialog } from '@/components/dialogs/ExportUndAusgabeDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { enrichBelegpositionen, enrichKontierungUndPruefung } from '@/lib/enrich';
import type { ExportUndAusgabe } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconCalendar,
  IconCheck,
  IconAlertTriangle,
  IconPlus,
  IconFileExport,
  IconRefresh,
  IconArrowRight,
  IconReceipt,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Zeitraum & Buchungen' },
  { label: 'Export konfigurieren' },
  { label: 'Export abgeschlossen' },
];

function getDefaultDateRange() {
  const now = new Date();
  const von = new Date(now.getFullYear(), now.getMonth(), 1);
  const bis = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { von: fmt(von), bis: fmt(bis) };
}

function formatCurrency(val: number | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function BuchungsExportPage() {
  const [searchParams] = useSearchParams();
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 3 ? s : 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);

  const defaults = getDefaultDateRange();
  const [zeitraumVon, setZeitraumVon] = useState(defaults.von);
  const [zeitraumBis, setZeitraumBis] = useState(defaults.bis);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [createdExportId, setCreatedExportId] = useState<string | null>(null);

  const {
    belegpositionen,
    kontierungUndPruefung,
    skr03Kontenrahmen,
    exportUndAusgabe,
    skr03KontenrahmenMap,
    belegerfassungMap,
    belegpositionenMap,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // Enriched data
  const enrichedPositionen = useMemo(
    () => enrichBelegpositionen(belegpositionen, { belegerfassungMap }),
    [belegpositionen, belegerfassungMap]
  );

  const enrichedKontierungen = useMemo(
    () => enrichKontierungUndPruefung(kontierungUndPruefung, { belegpositionenMap, skr03KontenrahmenMap }),
    [kontierungUndPruefung, belegpositionenMap, skr03KontenrahmenMap]
  );

  // Filter positions by date range
  const positionenInZeitraum = useMemo(() => {
    if (!zeitraumVon || !zeitraumBis) return enrichedPositionen;
    return enrichedPositionen.filter((pos) => {
      const datum = pos.fields.rechnungsdatum;
      if (!datum) return false;
      const d = datum.slice(0, 10);
      return d >= zeitraumVon && d <= zeitraumBis;
    });
  }, [enrichedPositionen, zeitraumVon, zeitraumBis]);

  // Map position_id -> kontierung
  const kontierungByPositionId = useMemo(() => {
    const m = new Map<string, typeof enrichedKontierungen[number]>();
    enrichedKontierungen.forEach((k) => {
      const posId = extractRecordId(k.fields.position_referenz);
      if (posId) m.set(posId, k);
    });
    return m;
  }, [enrichedKontierungen]);

  // Positions with plausible kontierung (plausibilitaet key === 'plausibel')
  const kontiertePositionen = useMemo(() => {
    return positionenInZeitraum.filter((pos) => {
      const k = kontierungByPositionId.get(pos.record_id);
      return k && k.fields.plausibilitaet?.key === 'plausibel';
    });
  }, [positionenInZeitraum, kontierungByPositionId]);

  const offenePositionen = useMemo(() => {
    return positionenInZeitraum.filter((pos) => {
      const k = kontierungByPositionId.get(pos.record_id);
      return !k || k.fields.plausibilitaet?.key !== 'plausibel';
    });
  }, [positionenInZeitraum, kontierungByPositionId]);

  const gesamtNetto = useMemo(
    () => kontiertePositionen.reduce((sum, p) => sum + (p.fields.betrag_netto ?? 0), 0),
    [kontiertePositionen]
  );

  const gesamtBrutto = useMemo(
    () => kontiertePositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0),
    [kontiertePositionen]
  );

  // Existing exports in zeitraum
  const exportsInZeitraum = useMemo(() => {
    return exportUndAusgabe.filter((ex) => {
      const von = ex.fields.zeitraum_von?.slice(0, 10);
      const bis = ex.fields.zeitraum_bis?.slice(0, 10);
      if (!von || !bis) return false;
      return von >= zeitraumVon && bis <= zeitraumBis;
    });
  }, [exportUndAusgabe, zeitraumVon, zeitraumBis]);

  // Created export record
  const createdExport = useMemo(() => {
    if (!createdExportId) return null;
    return exportUndAusgabe.find((ex) => ex.record_id === createdExportId) ?? null;
  }, [exportUndAusgabe, createdExportId]);

  // Export default values for dialog
  const exportDefaultValues: ExportUndAusgabe['fields'] = {
    zeitraum_von: zeitraumVon,
    zeitraum_bis: zeitraumBis,
  };

  async function handleExportSubmit(fields: ExportUndAusgabe['fields']) {
    const result = await LivingAppsService.createExportUndAusgabeEntry(fields);
    // API returns an object; extract the record_id from it
    const entries = Object.entries(result as Record<string, unknown>);
    const recordId = entries.length > 0 ? entries[0][0] : null;
    await fetchAll();
    if (recordId) {
      setCreatedExportId(recordId);
    }
    setCurrentStep(3);
  }

  function handleReset() {
    const d = getDefaultDateRange();
    setZeitraumVon(d.von);
    setZeitraumBis(d.bis);
    setCreatedExportId(null);
    setCurrentStep(1);
  }

  return (
    <IntentWizardShell
      title="Buchungsexport erstellen"
      subtitle="Exportiere kontierte Belegpositionen als DATEV/CSV-Datei"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Zeitraum & Buchungen prüfen ─────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Date range picker */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <IconCalendar size={18} className="text-muted-foreground shrink-0" />
              <h2 className="font-semibold text-base">Abrechnungszeitraum wählen</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="zeitraum-von">Von</Label>
                <Input
                  id="zeitraum-von"
                  type="date"
                  value={zeitraumVon}
                  onChange={(e) => setZeitraumVon(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zeitraum-bis">Bis</Label>
                <Input
                  id="zeitraum-bis"
                  type="date"
                  value={zeitraumBis}
                  onChange={(e) => setZeitraumBis(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Buchungsfähige Positionen</p>
              <p className="text-2xl font-bold text-foreground">{kontiertePositionen.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Gesamtbetrag Netto</p>
              <p className="text-lg font-bold text-foreground truncate">{formatCurrency(gesamtNetto)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Gesamtbetrag Brutto</p>
              <p className="text-lg font-bold text-foreground truncate">{formatCurrency(gesamtBrutto)}</p>
            </div>
            <div className={`border rounded-xl p-4 ${offenePositionen.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
              <p className={`text-xs mb-1 ${offenePositionen.length > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>Offene / nicht kontierte</p>
              <p className={`text-2xl font-bold ${offenePositionen.length > 0 ? 'text-amber-700' : 'text-foreground'}`}>{offenePositionen.length}</p>
            </div>
          </div>

          {/* Warning for incomplete positions */}
          {offenePositionen.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <IconAlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {offenePositionen.length} Position{offenePositionen.length !== 1 ? 'en' : ''} noch nicht kontiert
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Diese Positionen werden nicht exportiert. Prüfe sie zuerst unter "Belege verarbeiten".
                </p>
              </div>
            </div>
          )}

          {/* Table of exportable positions */}
          {kontiertePositionen.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-sm">Exportfähige Belegpositionen</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rechnungssteller</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Datum</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Brutto</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">SKR03 Konto</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Plausibilität</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kontiertePositionen.map((pos) => {
                      const kontierung = kontierungByPositionId.get(pos.record_id);
                      const skr03Id = extractRecordId(kontierung?.fields.skr03_konto_referenz);
                      const skr03 = skr03Id ? skr03KontenrahmenMap.get(skr03Id) : null;
                      return (
                        <tr key={pos.record_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 max-w-[140px]">
                            <span className="truncate block min-w-0">{pos.fields.rechnungssteller ?? '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {pos.fields.rechnungsdatum?.slice(0, 10) ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                            {formatCurrency(pos.fields.betrag_brutto)}
                          </td>
                          <td className="px-4 py-2.5 max-w-[160px]">
                            {skr03 ? (
                              <span className="truncate block min-w-0 text-xs">
                                <span className="font-medium">{skr03.fields.kontonummer}</span>
                                {skr03.fields.kontobezeichnung && (
                                  <span className="text-muted-foreground ml-1">{skr03.fields.kontobezeichnung}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge
                              statusKey={kontierung?.fields.plausibilitaet?.key}
                              label={kontierung?.fields.plausibilitaet?.label}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <IconReceipt size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Keine exportfähigen Positionen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Im gewählten Zeitraum gibt es keine Positionen mit abgeschlossener Kontierung.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={kontiertePositionen.length === 0}
              className="gap-2"
            >
              Weiter zur Exportkonfiguration
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Export konfigurieren ────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Summary from step 1 */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Zusammenfassung</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Zeitraum</p>
                <p className="text-sm font-medium">{zeitraumVon} – {zeitraumBis}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Positionen</p>
                <p className="text-sm font-bold">{kontiertePositionen.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Netto</p>
                <p className="text-sm font-medium truncate">{formatCurrency(gesamtNetto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Brutto</p>
                <p className="text-sm font-medium truncate">{formatCurrency(gesamtBrutto)}</p>
              </div>
            </div>
          </div>

          {/* Create export button */}
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <IconFileExport size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Export jetzt erstellen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Zeitraum und Statistiken werden automatisch vorausgefüllt.
              </p>
            </div>
            <Button onClick={() => setExportDialogOpen(true)} className="gap-2 w-full sm:w-auto">
              <IconPlus size={16} />
              Export jetzt erstellen
            </Button>
          </div>

          {/* Existing exports in zeitraum */}
          {exportsInZeitraum.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-sm">Vorhandene Exporte im Zeitraum</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Bezeichnung</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Format</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportsInZeitraum.map((ex) => {
                      const formatLabels = Array.isArray(ex.fields.exportformat)
                        ? ex.fields.exportformat.map((f) => (typeof f === 'object' && 'label' in f ? f.label : String(f))).join(', ')
                        : '—';
                      return (
                        <tr key={ex.record_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 max-w-[180px]">
                            <span className="truncate block min-w-0">{ex.fields.export_bezeichnung ?? '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatLabels}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge
                              statusKey={ex.fields.exportstatus?.key}
                              label={ex.fields.exportstatus?.label}
                            />
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {ex.fields.exportdatum?.slice(0, 10) ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
              Zurück
            </Button>
          </div>

          <ExportUndAusgabeDialog
            open={exportDialogOpen}
            onClose={() => setExportDialogOpen(false)}
            onSubmit={handleExportSubmit}
            defaultValues={exportDefaultValues}
          />
        </div>
      )}

      {/* ── STEP 3: Export abgeschlossen ────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <IconCheck size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-green-800">Export erfolgreich erstellt</h2>
              <p className="text-sm text-green-700 mt-1">
                Der Buchungsexport wurde angelegt und steht zur Verarbeitung bereit.
              </p>
            </div>
          </div>

          {/* Created export details */}
          {createdExport ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm">Exportdetails</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Bezeichnung</p>
                  <p className="font-medium truncate min-w-0">{createdExport.fields.export_bezeichnung ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Exportformat</p>
                  <p className="font-medium">
                    {Array.isArray(createdExport.fields.exportformat)
                      ? createdExport.fields.exportformat
                          .map((f) => (typeof f === 'object' && 'label' in f ? f.label : String(f)))
                          .join(', ')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge
                    statusKey={createdExport.fields.exportstatus?.key}
                    label={createdExport.fields.exportstatus?.label}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dateiname</p>
                  <p className="font-medium truncate min-w-0">{createdExport.fields.dateiname ?? '—'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm">Exportdetails</h3>
              <p className="text-sm text-muted-foreground">Export-Datensatz wird geladen...</p>
            </div>
          )}

          {/* Export summary */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Exportierte Daten</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Zeitraum</p>
                <p className="text-sm font-medium">{zeitraumVon} – {zeitraumBis}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Positionen</p>
                <p className="text-sm font-bold">{kontiertePositionen.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamtbetrag Netto</p>
                <p className="text-sm font-medium truncate">{formatCurrency(gesamtNetto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamtbetrag Brutto</p>
                <p className="text-sm font-medium truncate">{formatCurrency(gesamtBrutto)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline" className="gap-2 w-full sm:w-auto">
              <IconRefresh size={16} />
              Neuen Export erstellen
            </Button>
            <a href="#/intents/beleg-verarbeitung" className="w-full sm:w-auto">
              <Button variant="outline" className="gap-2 w-full">
                <IconReceipt size={16} />
                Belege verarbeiten
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
