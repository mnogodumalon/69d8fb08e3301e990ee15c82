import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, getYear } from 'date-fns';
import { de } from 'date-fns/locale';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { StatusBadge } from '@/components/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Leasingfahrzeug, UstAbfuehrungLeasingfahrzeug, ExportUndAusgabe } from '@/types/app';
import { LeasingfahrzeugDialog } from '@/components/dialogs/LeasingfahrzeugDialog';
import { UstAbfuehrungLeasingfahrzeugDialog } from '@/components/dialogs/UstAbfuehrungLeasingfahrzeugDialog';
import { ExportUndAusgabeDialog } from '@/components/dialogs/ExportUndAusgabeDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { IconCar, IconReceipt, IconDownload, IconCheck, IconPlus, IconRefresh, IconExternalLink } from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Fahrzeug' },
  { label: 'UST-Abführungen' },
  { label: 'Export' },
  { label: 'Zusammenfassung' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '–';
  try {
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de });
  } catch {
    return dateStr;
  }
};

const formatMonthYear = (dateStr: string | undefined) => {
  if (!dateStr) return '–';
  try {
    return format(new Date(dateStr), 'MMMM yyyy', { locale: de });
  } catch {
    return dateStr;
  }
};

export default function LeasingAbrechnungPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);

  const {
    leasingfahrzeug,
    ustAbfuehrungLeasingfahrzeug,
    exportUndAusgabe,
    skr03Kontenrahmen,
    belegpositionen,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  const [selectedFahrzeug, setSelectedFahrzeug] = useState<Leasingfahrzeug | null>(null);
  const [lastCreatedExport, setLastCreatedExport] = useState<ExportUndAusgabe | null>(null);

  const [fahrzeugDialogOpen, setFahrzeugDialogOpen] = useState(false);
  const [ustDialogOpen, setUstDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Stable "now" reference — computed once per mount
  const now = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => format(startOfMonth(now), 'yyyy-MM-dd'), [now]);
  const currentMonthEnd = useMemo(() => format(endOfMonth(now), 'yyyy-MM-dd'), [now]);
  const currentMonthLabel = useMemo(() => format(now, 'MMMM yyyy', { locale: de }), [now]);

  // Deep-link: read fahrzeugId and step from URL on mount
  useEffect(() => {
    const fahrzeugIdParam = searchParams.get('fahrzeugId');
    const stepParam = parseInt(searchParams.get('step') ?? '', 10);

    if (fahrzeugIdParam && !loading) {
      const found = leasingfahrzeug.find(f => f.record_id === fahrzeugIdParam);
      if (found) {
        setSelectedFahrzeug(found);
        if (stepParam >= 2 && stepParam <= 4) {
          setCurrentStep(stepParam);
        } else {
          setCurrentStep(2);
        }
      }
    } else if (stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Sync URL params when step or vehicle changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedFahrzeug) {
      params.set('fahrzeugId', selectedFahrzeug.record_id);
    } else {
      params.delete('fahrzeugId');
    }
    setSearchParams(params, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, selectedFahrzeug]);

  // UST-Abführungen for selected vehicle
  const fahrzeugUstAbfuehrungen = useMemo<UstAbfuehrungLeasingfahrzeug[]>(() => {
    if (!selectedFahrzeug) return [];
    const vehicleUrl = createRecordUrl(APP_IDS.LEASINGFAHRZEUG, selectedFahrzeug.record_id);
    return ustAbfuehrungLeasingfahrzeug.filter(u => u.fields.fahrzeug_referenz === vehicleUrl);
  }, [selectedFahrzeug, ustAbfuehrungLeasingfahrzeug]);

  // Current month UST entries
  const currentMonthUst = useMemo(() => {
    return fahrzeugUstAbfuehrungen.filter(u => {
      if (!u.fields.ust_zeitraum) return false;
      const entryDate = new Date(u.fields.ust_zeitraum);
      return (
        entryDate.getMonth() === now.getMonth() &&
        entryDate.getFullYear() === now.getFullYear()
      );
    });
  }, [fahrzeugUstAbfuehrungen, now]);

  // Annual booked total (privatnutzung_betrag for current year)
  const annualBookedTotal = useMemo(() => {
    return fahrzeugUstAbfuehrungen
      .filter(u => {
        if (!u.fields.ust_zeitraum) return false;
        return getYear(new Date(u.fields.ust_zeitraum)) === getYear(now);
      })
      .reduce((sum, u) => sum + (u.fields.privatnutzung_betrag ?? 0), 0);
  }, [fahrzeugUstAbfuehrungen, now]);

  // Total UST-Betrag across all entries
  const totalUstBetrag = useMemo(() => {
    return fahrzeugUstAbfuehrungen.reduce((sum, u) => sum + (u.fields.ust_betrag ?? 0), 0);
  }, [fahrzeugUstAbfuehrungen]);

  // Current month UST total
  const currentMonthUstTotal = useMemo(() => {
    return currentMonthUst.reduce((sum, u) => sum + (u.fields.ust_betrag ?? 0), 0);
  }, [currentMonthUst]);

  // Annual budget = leasingrate_brutto * 12
  const annualBudget = selectedFahrzeug ? (selectedFahrzeug.fields.leasingrate_brutto ?? 0) * 12 : 0;

  // Default values for the UST dialog (pre-fill fahrzeug_referenz and current month)
  const ustDialogDefaults = useMemo<UstAbfuehrungLeasingfahrzeug['fields'] | undefined>(() => {
    if (!selectedFahrzeug) return undefined;
    return {
      fahrzeug_referenz: createRecordUrl(APP_IDS.LEASINGFAHRZEUG, selectedFahrzeug.record_id),
      ust_zeitraum: currentMonthStart,
      buchungsstatus: undefined,
    };
  }, [selectedFahrzeug, currentMonthStart]);

  // Default values for the Export dialog
  const exportDialogDefaults = useMemo<ExportUndAusgabe['fields'] | undefined>(() => {
    if (!selectedFahrzeug) return undefined;
    return {
      export_bezeichnung: `UST-Abführung ${selectedFahrzeug.fields.fahrzeug_bezeichnung ?? ''} ${currentMonthLabel}`,
      zeitraum_von: currentMonthStart,
      zeitraum_bis: currentMonthEnd,
      exportstatus: undefined,
    };
  }, [selectedFahrzeug, currentMonthStart, currentMonthEnd, currentMonthLabel]);

  function handleSelectFahrzeug(id: string) {
    const found = leasingfahrzeug.find(f => f.record_id === id);
    if (found) {
      setSelectedFahrzeug(found);
      setCurrentStep(2);
    }
  }

  function handleReset() {
    setSelectedFahrzeug(null);
    setLastCreatedExport(null);
    setCurrentStep(1);
  }

  return (
    <IntentWizardShell
      title="Leasing UST-Abrechnung"
      subtitle="Monatliche Umsatzsteuer-Abführung für Leasingfahrzeuge erfassen und exportieren"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Fahrzeug auswählen ──────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconCar size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Fahrzeug auswählen</h2>
              <p className="text-xs text-muted-foreground">Wähle das Leasingfahrzeug für die Abrechnung</p>
            </div>
          </div>

          <EntitySelectStep
            items={leasingfahrzeug.map(f => ({
              id: f.record_id,
              title: f.fields.fahrzeug_bezeichnung ?? '(kein Name)',
              subtitle: [f.fields.kennzeichen, f.fields.leasingvertrag_nummer]
                .filter(Boolean)
                .join(' · '),
              status: f.fields.nutzungsart
                ? { key: f.fields.nutzungsart.key, label: f.fields.nutzungsart.label }
                : undefined,
              stats: [
                {
                  label: 'Leasingrate brutto',
                  value: f.fields.leasingrate_brutto != null
                    ? formatCurrency(f.fields.leasingrate_brutto)
                    : '–',
                },
              ],
              icon: <IconCar size={18} className="text-primary" />,
            }))}
            onSelect={handleSelectFahrzeug}
            searchPlaceholder="Fahrzeug suchen..."
            emptyIcon={<IconCar size={32} />}
            emptyText="Noch keine Leasingfahrzeuge vorhanden."
            createLabel="Neues Fahrzeug"
            onCreateNew={() => setFahrzeugDialogOpen(true)}
            createDialog={
              <LeasingfahrzeugDialog
                open={fahrzeugDialogOpen}
                onClose={() => setFahrzeugDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createLeasingfahrzeugEntry(fields);
                  await fetchAll();
                }}
                skr03_kontenrahmenList={skr03Kontenrahmen}
                enablePhotoScan={AI_PHOTO_SCAN['Leasingfahrzeug']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Leasingfahrzeug']}
              />
            }
          />
        </div>
      )}

      {/* ── STEP 2: UST-Abführungen prüfen und erfassen ─────────────────── */}
      {currentStep === 2 && selectedFahrzeug && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconReceipt size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">UST-Abführungen prüfen und erfassen</h2>
              <p className="text-xs text-muted-foreground">Prüfe bestehende Einträge und erfasse neue UST-Abführungen</p>
            </div>
          </div>

          {/* Vehicle detail card */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {selectedFahrzeug.fields.fahrzeug_bezeichnung ?? '–'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {selectedFahrzeug.fields.kennzeichen ?? '–'}
                  {selectedFahrzeug.fields.leasingvertrag_nummer
                    ? ` · Vertrag: ${selectedFahrzeug.fields.leasingvertrag_nummer}`
                    : ''}
                </p>
              </div>
              {selectedFahrzeug.fields.nutzungsart && (
                <StatusBadge
                  statusKey={selectedFahrzeug.fields.nutzungsart.key}
                  label={selectedFahrzeug.fields.nutzungsart.label}
                />
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Leasingrate</p>
                <p className="font-semibold">
                  {selectedFahrzeug.fields.leasingrate_brutto != null
                    ? formatCurrency(selectedFahrzeug.fields.leasingrate_brutto)
                    : '–'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Leasingbeginn</p>
                <p className="font-semibold">{formatDate(selectedFahrzeug.fields.leasingbeginn)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Leasingende</p>
                <p className="font-semibold">{formatDate(selectedFahrzeug.fields.leasingende)}</p>
              </div>
            </div>
          </div>

          {/* Annual budget tracker */}
          <BudgetTracker
            budget={annualBudget}
            booked={annualBookedTotal}
            label={`Jahres-Leasingkosten ${getYear(now)}`}
            showRemaining={true}
          />

          {/* Running total UST */}
          <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gesamt UST-Betrag (alle Einträge)</span>
            <span className="font-bold text-base">{formatCurrency(totalUstBetrag)}</span>
          </div>

          {/* UST-Abführungen table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">
                Abführungen ({fahrzeugUstAbfuehrungen.length})
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUstDialogOpen(true)}
                className="gap-1.5"
              >
                <IconPlus size={15} />
                Neue UST-Abführung
              </Button>
            </div>

            {fahrzeugUstAbfuehrungen.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed">
                <IconReceipt size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Noch keine UST-Abführungen für dieses Fahrzeug.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUstDialogOpen(true)}
                  className="mt-3 gap-1.5"
                >
                  <IconPlus size={14} />
                  Erste Abführung erfassen
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Zeitraum</th>
                      <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Privatnutzung</th>
                      <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">UST-Betrag</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fahrzeugUstAbfuehrungen.map((u, i) => (
                      <tr key={u.record_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {formatMonthYear(u.fields.ust_zeitraum)}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium">
                          {u.fields.privatnutzung_betrag != null
                            ? formatCurrency(u.fields.privatnutzung_betrag)
                            : '–'}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">
                          {u.fields.ust_betrag != null
                            ? formatCurrency(u.fields.ust_betrag)
                            : '–'}
                        </td>
                        <td className="px-3 py-2.5">
                          {u.fields.buchungsstatus ? (
                            <StatusBadge
                              statusKey={u.fields.buchungsstatus.key}
                              label={u.fields.buchungsstatus.label}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <UstAbfuehrungLeasingfahrzeugDialog
            open={ustDialogOpen}
            onClose={() => setUstDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createUstAbfuehrungLeasingfahrzeugEntry(fields);
              await fetchAll();
            }}
            defaultValues={ustDialogDefaults}
            leasingfahrzeugList={leasingfahrzeug}
            belegpositionenList={belegpositionen}
            enablePhotoScan={AI_PHOTO_SCAN['UstAbfuehrungLeasingfahrzeug']}
            enablePhotoLocation={AI_PHOTO_LOCATION['UstAbfuehrungLeasingfahrzeug']}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Weiter zum Export
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Export erstellen ─────────────────────────────────────── */}
      {currentStep === 3 && selectedFahrzeug && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconDownload size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Export erstellen</h2>
              <p className="text-xs text-muted-foreground">Erstelle einen DATEV-Export für die UST-Abführungen</p>
            </div>
          </div>

          {/* Export summary info */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold">Export-Zusammenfassung</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Fahrzeug</p>
                <p className="font-medium truncate">{selectedFahrzeug.fields.fahrzeug_bezeichnung ?? '–'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Kennzeichen</p>
                <p className="font-medium">{selectedFahrzeug.fields.kennzeichen ?? '–'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Zeitraum</p>
                <p className="font-medium">{currentMonthLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">UST-Abführungen</p>
                <p className="font-medium">{fahrzeugUstAbfuehrungen.length} Einträge gesamt</p>
              </div>
            </div>
          </div>

          {/* Existing exports table */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Vorhandene Exporte ({exportUndAusgabe.length})
            </p>
            {exportUndAusgabe.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-dashed">
                <IconDownload size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Noch keine Exporte vorhanden.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Bezeichnung</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Von</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Bis</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Format</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportUndAusgabe.map((ex, i) => (
                      <tr key={ex.record_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <span className="truncate block">{ex.fields.export_bezeichnung ?? '–'}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(ex.fields.zeitraum_von)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(ex.fields.zeitraum_bis)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {ex.fields.exportformat && ex.fields.exportformat.length > 0
                            ? ex.fields.exportformat.map(f => f.label).join(', ')
                            : '–'}
                        </td>
                        <td className="px-3 py-2.5">
                          {ex.fields.exportstatus ? (
                            <StatusBadge
                              statusKey={ex.fields.exportstatus.key}
                              label={ex.fields.exportstatus.label}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Export format info */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Verfügbare Exportformate</p>
            <div className="flex flex-wrap gap-2">
              {(LOOKUP_OPTIONS['export_und_ausgabe']?.exportformat ?? []).map(opt => (
                <span
                  key={opt.key}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg border bg-card text-xs font-medium"
                >
                  {opt.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Das Format wählst du im folgenden Dialog aus.
            </p>
          </div>

          {/* Create export button */}
          <Button
            className="w-full gap-2"
            onClick={() => setExportDialogOpen(true)}
          >
            <IconDownload size={16} />
            Export erstellen
          </Button>

          <ExportUndAusgabeDialog
            open={exportDialogOpen}
            onClose={() => setExportDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createExportUndAusgabeEntry(fields);
              // Find the newly created export after refresh
              await fetchAll();
              // Mark as created and advance
              setLastCreatedExport({ record_id: 'new', createdat: new Date().toISOString(), updatedat: null, fields });
              setCurrentStep(4);
            }}
            defaultValues={exportDialogDefaults}
            enablePhotoScan={AI_PHOTO_SCAN['ExportUndAusgabe']}
            enablePhotoLocation={AI_PHOTO_LOCATION['ExportUndAusgabe']}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button variant="outline" onClick={() => setCurrentStep(4)}>
              Weiter zur Zusammenfassung
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Zusammenfassung ──────────────────────────────────────── */}
      {currentStep === 4 && selectedFahrzeug && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
              <IconCheck size={18} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Abrechnung abgeschlossen</h2>
              <p className="text-xs text-muted-foreground">Übersicht der abgeschlossenen Abrechnung</p>
            </div>
          </div>

          {/* Summary card */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Fahrzeug</p>
              <div className="space-y-1">
                <p className="font-semibold">
                  {selectedFahrzeug.fields.fahrzeug_bezeichnung ?? '–'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedFahrzeug.fields.kennzeichen ?? '–'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selectedFahrzeug.fields.leasingbeginn)}
                  {' – '}
                  {formatDate(selectedFahrzeug.fields.leasingende)}
                </p>
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Abführungen gesamt</p>
                <p className="text-xl font-bold">{fahrzeugUstAbfuehrungen.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Abführungen {currentMonthLabel}</p>
                <p className="text-xl font-bold">{currentMonthUst.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">UST-Betrag {currentMonthLabel}</p>
                <p className="text-xl font-bold">{formatCurrency(currentMonthUstTotal)}</p>
              </div>
            </div>

            {lastCreatedExport && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Erstellter Export</p>
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
                  <p className="text-sm font-medium text-green-800">
                    {lastCreatedExport.fields.export_bezeichnung ?? 'Export erstellt'}
                  </p>
                  <p className="text-xs text-green-600">
                    {formatDate(lastCreatedExport.fields.zeitraum_von)}
                    {' bis '}
                    {formatDate(lastCreatedExport.fields.zeitraum_bis)}
                  </p>
                  {lastCreatedExport.fields.exportstatus && (
                    <StatusBadge
                      statusKey={lastCreatedExport.fields.exportstatus.key}
                      label={lastCreatedExport.fields.exportstatus.label}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Annual budget recap */}
          <BudgetTracker
            budget={annualBudget}
            booked={annualBookedTotal}
            label={`Jahres-Leasingkosten ${getYear(now)}`}
            showRemaining={true}
          />

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 gap-2"
              onClick={handleReset}
            >
              <IconRefresh size={16} />
              Neue Abrechnung starten
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              asChild
            >
              <a href="#/leasingfahrzeug">
                <IconExternalLink size={16} />
                Fahrzeug verwalten
              </a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
