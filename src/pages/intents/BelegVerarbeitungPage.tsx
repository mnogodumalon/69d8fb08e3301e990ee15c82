import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Belegerfassung, Belegpositionen, KontierungUndPruefung, Skr03Kontenrahmen } from '@/types/app';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import { Button } from '@/components/ui/button';
import {
  IconPlus,
  IconFileInvoice,
  IconCheckbox,
  IconArrowRight,
  IconCircleCheck,
  IconAlertTriangle,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Beleg auswählen' },
  { label: 'Positionen erfassen' },
  { label: 'Kontierung prüfen' },
  { label: 'Abschluss' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(amount: number | undefined, currency?: string): string {
  if (amount === undefined || amount === null) return '—';
  const sym = currency ?? 'EUR';
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;
}

export default function BelegVerarbeitungPage() {
  const [searchParams] = useSearchParams();
  const {
    belegerfassung,
    belegpositionen,
    kontierungUndPruefung,
    skr03Kontenrahmen,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // Wizard step: 1-based
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedBeleg, setSelectedBeleg] = useState<Belegerfassung | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  // Dialog states
  const [belegDialogOpen, setBelegDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [kontierungDialogOpen, setKontierungDialogOpen] = useState(false);

  // Deep-link: read ?belegId and ?step on mount
  useEffect(() => {
    const belegId = searchParams.get('belegId');
    const stepParam = parseInt(searchParams.get('step') ?? '', 10);

    if (belegId && !loading) {
      const found = belegerfassung.find(b => b.record_id === belegId);
      if (found) {
        setSelectedBeleg(found);
        const targetStep = stepParam >= 1 && stepParam <= 4 ? stepParam : 2;
        setCurrentStep(targetStep);
      }
    } else if (stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Positions linked to the selected beleg
  const linkedPositionen: Belegpositionen[] = useMemo(() => {
    if (!selectedBeleg) return [];
    const belegUrl = createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBeleg.record_id);
    return belegpositionen.filter(p => p.fields.beleg_referenz === belegUrl);
  }, [selectedBeleg, belegpositionen]);

  // Kontierungen linked to linked positions
  const linkedKontierungen: KontierungUndPruefung[] = useMemo(() => {
    const positionUrls = new Set(
      linkedPositionen.map(p => createRecordUrl(APP_IDS.BELEGPOSITIONEN, p.record_id))
    );
    return kontierungUndPruefung.filter(k => {
      const ref = k.fields.position_referenz;
      return ref ? positionUrls.has(ref) : false;
    });
  }, [linkedPositionen, kontierungUndPruefung]);

  // Running total
  const totalBrutto = useMemo(() => {
    return linkedPositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0);
  }, [linkedPositionen]);

  // SKR03 lookup map: record_id -> record
  const skr03Map = useMemo(() => {
    const m = new Map<string, Skr03Kontenrahmen>();
    skr03Kontenrahmen.forEach(k => m.set(k.record_id, k));
    return m;
  }, [skr03Kontenrahmen]);

  // Kontierung map: position record_id -> KontierungUndPruefung
  const kontierungByPosition = useMemo(() => {
    const m = new Map<string, KontierungUndPruefung>();
    linkedKontierungen.forEach(k => {
      const posId = extractRecordId(k.fields.position_referenz);
      if (posId) m.set(posId, k);
    });
    return m;
  }, [linkedKontierungen]);

  const kontiertCount = linkedPositionen.filter(p => kontierungByPosition.has(p.record_id)).length;

  function handleBelegSelect(id: string) {
    const found = belegerfassung.find(b => b.record_id === id) ?? null;
    setSelectedBeleg(found);
    setCurrentStep(2);
  }

  async function handleBelegCreate(fields: Belegerfassung['fields']) {
    const result = await LivingAppsService.createBelegerfassungEntry(fields);
    await fetchAll();
    // Auto-select newly created record
    if (result) {
      const newId = Object.keys(result)[0];
      if (newId) {
        const refreshed = await LivingAppsService.getBelegerfassungEntry(newId);
        if (refreshed) {
          setSelectedBeleg(refreshed);
          setCurrentStep(2);
        }
      }
    }
  }

  async function handlePositionCreate(fields: Belegpositionen['fields']) {
    await LivingAppsService.createBelegpositionenEntry(fields);
    await fetchAll();
  }

  async function handleKontierungCreate(fields: KontierungUndPruefung['fields']) {
    await LivingAppsService.createKontierungUndPruefungEntry(fields);
    await fetchAll();
  }

  function handleReset() {
    setSelectedBeleg(null);
    setCurrentStep(1);
    setSelectedPositionId(null);
  }

  // Build defaultValues for new Belegposition with pre-filled beleg_referenz
  const positionDefaultValues: Belegpositionen['fields'] | undefined = selectedBeleg
    ? { beleg_referenz: createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBeleg.record_id) }
    : undefined;

  // Build defaultValues for Kontierung with pre-filled position_referenz
  const kontierungDefaultValues: KontierungUndPruefung['fields'] | undefined = selectedPositionId
    ? { position_referenz: createRecordUrl(APP_IDS.BELEGPOSITIONEN, selectedPositionId) }
    : undefined;

  return (
    <IntentWizardShell
      title="Beleg verarbeiten"
      subtitle="Erfasse und verbuche Belege Schritt für Schritt"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Step 1: Beleg auswählen ─── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wähle einen vorhandenen Beleg aus oder erfasse einen neuen.
          </p>
          <EntitySelectStep
            items={belegerfassung.map(b => ({
              id: b.record_id,
              title:
                b.fields.belegtyp?.label ??
                b.record_id,
              subtitle: b.fields.upload_datum
                ? `Hochgeladen am ${formatDate(b.fields.upload_datum)}`
                : 'Kein Datum',
              status: b.fields.verarbeitungsstatus
                ? { key: b.fields.verarbeitungsstatus.key, label: b.fields.verarbeitungsstatus.label }
                : undefined,
              stats: [
                ...(b.fields.belegtyp ? [{ label: 'Typ', value: b.fields.belegtyp.label }] : []),
                ...(b.fields.ocr_status ? [{ label: 'OCR', value: b.fields.ocr_status.label }] : []),
              ],
              icon: <IconFileInvoice size={18} className="text-primary" />,
            }))}
            onSelect={handleBelegSelect}
            searchPlaceholder="Beleg suchen..."
            emptyIcon={<IconFileInvoice size={32} />}
            emptyText="Noch keine Belege vorhanden. Erstelle den ersten Beleg."
            createLabel="Neuen Beleg erfassen"
            onCreateNew={() => setBelegDialogOpen(true)}
            createDialog={
              <BelegerfassungDialog
                open={belegDialogOpen}
                onClose={() => setBelegDialogOpen(false)}
                onSubmit={handleBelegCreate}
              />
            }
          />
        </div>
      )}

      {/* ─── Step 2: Positionen erfassen ─── */}
      {currentStep === 2 && selectedBeleg && (
        <div className="space-y-5">
          {/* Beleg-Info-Karte */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h2 className="font-semibold text-base truncate">
                  {selectedBeleg.fields.belegtyp?.label ?? 'Beleg'}
                </h2>
                {selectedBeleg.fields.upload_datum && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hochgeladen: {formatDate(selectedBeleg.fields.upload_datum)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap shrink-0">
                {selectedBeleg.fields.verarbeitungsstatus && (
                  <StatusBadge
                    statusKey={selectedBeleg.fields.verarbeitungsstatus.key}
                    label={selectedBeleg.fields.verarbeitungsstatus.label}
                  />
                )}
                {selectedBeleg.fields.ocr_status && (
                  <StatusBadge
                    statusKey={selectedBeleg.fields.ocr_status.key}
                    label={selectedBeleg.fields.ocr_status.label}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Laufende Summe */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Gesamtbetrag (brutto)
              </p>
              <p className="text-2xl font-bold text-foreground mt-0.5">
                {formatCurrency(totalBrutto)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Positionen</p>
              <p className="text-2xl font-bold text-primary">{linkedPositionen.length}</p>
            </div>
          </div>

          {/* Positionen-Liste */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-sm">Belegpositionen</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPositionDialogOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <IconPlus size={15} />
                Neue Position hinzufügen
              </Button>
            </div>

            {linkedPositionen.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground">
                <IconFileInvoice size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Positionen erfasst.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPositionDialogOpen(true)}
                  className="mt-3 gap-1.5"
                >
                  <IconPlus size={14} />
                  Erste Position anlegen
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rechnungssteller</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Datum</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Brutto</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Währung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedPositionen.map((pos, idx) => (
                      <tr key={pos.record_id} className={idx < linkedPositionen.length - 1 ? 'border-b' : ''}>
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="truncate block">{pos.fields.rechnungssteller ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(pos.fields.rechnungsdatum)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                          {pos.fields.betrag_brutto !== undefined
                            ? pos.fields.betrag_brutto.toLocaleString('de-DE', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pos.fields.waehrung?.label ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dialog */}
          <BelegpositionenDialog
            open={positionDialogOpen}
            onClose={() => setPositionDialogOpen(false)}
            onSubmit={handlePositionCreate}
            defaultValues={positionDefaultValues}
            belegerfassungList={belegerfassung}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              className="gap-2"
              disabled={linkedPositionen.length === 0}
            >
              Weiter zur Kontierung
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Kontierung prüfen ─── */}
      {currentStep === 3 && selectedBeleg && (
        <div className="space-y-5">
          {/* Status-Übersicht */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Positionen gesamt
              </p>
              <p className="text-2xl font-bold mt-1">{linkedPositionen.length}</p>
            </div>
            <div className={`rounded-xl p-4 border ${kontiertCount === linkedPositionen.length && linkedPositionen.length > 0 ? 'bg-green-50 border-green-200' : 'bg-card border-border'}`}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Kontiert
              </p>
              <p className={`text-2xl font-bold mt-1 ${kontiertCount === linkedPositionen.length && linkedPositionen.length > 0 ? 'text-green-700' : 'text-foreground'}`}>
                {kontiertCount} / {linkedPositionen.length}
              </p>
            </div>
          </div>

          {/* Positionen mit Kontierung */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Positionen &amp; Kontierungen</h3>

            {linkedPositionen.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground">
                <p className="text-sm">Keine Positionen vorhanden. Gehe zurück zu Schritt 2.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedPositionen.map(pos => {
                  const kontierung = kontierungByPosition.get(pos.record_id);
                  const skr03Id = kontierung
                    ? extractRecordId(kontierung.fields.skr03_konto_referenz)
                    : null;
                  const skr03 = skr03Id ? skr03Map.get(skr03Id) : undefined;

                  return (
                    <div
                      key={pos.record_id}
                      className="bg-card border border-border rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {pos.fields.rechnungssteller ?? '(kein Rechnungssteller)'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(pos.fields.rechnungsdatum)}
                            {pos.fields.betrag_brutto !== undefined && (
                              <span className="ml-2 font-medium text-foreground">
                                {formatCurrency(pos.fields.betrag_brutto, pos.fields.waehrung?.key?.toUpperCase())}
                              </span>
                            )}
                          </p>
                        </div>
                        {kontierung ? (
                          <IconCircleCheck size={20} className="text-green-600 shrink-0" />
                        ) : (
                          <IconAlertTriangle size={20} className="text-amber-500 shrink-0" />
                        )}
                      </div>

                      {kontierung ? (
                        <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            {skr03 ? (
                              <p className="text-xs font-medium truncate">
                                {skr03.fields.kontonummer} – {skr03.fields.kontobezeichnung}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Konto zugewiesen</p>
                            )}
                          </div>
                          {kontierung.fields.plausibilitaet && (
                            <StatusBadge
                              statusKey={kontierung.fields.plausibilitaet.key}
                              label={kontierung.fields.plausibilitaet.label}
                            />
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => {
                            setSelectedPositionId(pos.record_id);
                            setKontierungDialogOpen(true);
                          }}
                        >
                          <IconPlus size={14} />
                          Kontierung anlegen
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dialog */}
          <KontierungUndPruefungDialog
            open={kontierungDialogOpen}
            onClose={() => {
              setKontierungDialogOpen(false);
              setSelectedPositionId(null);
            }}
            onSubmit={handleKontierungCreate}
            defaultValues={kontierungDefaultValues}
            belegpositionenList={belegpositionen}
            skr03_kontenrahmenList={skr03Kontenrahmen}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              className="gap-2"
            >
              Abschließen
              <IconCheckbox size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Abschluss ─── */}
      {currentStep === 4 && selectedBeleg && (
        <div className="space-y-5">
          {/* Erfolgskarte */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <IconCircleCheck size={28} className="text-green-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-green-800">Beleg erfolgreich verarbeitet</h2>
            <p className="text-sm text-green-700">
              Alle Schritte wurden durchgeführt. Du kannst den Beleg jetzt exportieren.
            </p>
          </div>

          {/* Zusammenfassung */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-base">Zusammenfassung</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Belegtyp</p>
                <p className="font-medium">{selectedBeleg.fields.belegtyp?.label ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Verarbeitungsstatus</p>
                <div>
                  {selectedBeleg.fields.verarbeitungsstatus ? (
                    <StatusBadge
                      statusKey={selectedBeleg.fields.verarbeitungsstatus.key}
                      label={selectedBeleg.fields.verarbeitungsstatus.label}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Upload-Datum</p>
                <p className="font-medium">{formatDate(selectedBeleg.fields.upload_datum)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">OCR-Status</p>
                <div>
                  {selectedBeleg.fields.ocr_status ? (
                    <StatusBadge
                      statusKey={selectedBeleg.fields.ocr_status.key}
                      label={selectedBeleg.fields.ocr_status.label}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Anzahl Positionen</p>
                <p className="text-2xl font-bold">{linkedPositionen.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Gesamtbetrag (brutto)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBrutto)}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Kontiert</p>
                <p className="font-medium">
                  {kontiertCount} von {linkedPositionen.length} Positionen
                  {kontiertCount === linkedPositionen.length && linkedPositionen.length > 0 && (
                    <span className="ml-2 text-green-600 font-semibold">✓ Vollständig</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Aktionen */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="gap-2 flex-1"
              onClick={handleReset}
            >
              <IconRefresh size={16} />
              Neuen Beleg verarbeiten
            </Button>
            <a
              href="#/intents/buchungs-export"
              className="flex-1"
            >
              <Button className="w-full gap-2">
                Zum Export
                <IconArrowRight size={16} />
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Fallback: kein Beleg gewählt aber Schritt > 1 */}
      {currentStep > 1 && !selectedBeleg && (
        <div className="text-center py-12 text-muted-foreground space-y-3">
          <p className="text-sm">Kein Beleg ausgewählt. Bitte starte von vorne.</p>
          <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
            Zurück zu Schritt 1
          </Button>
        </div>
      )}
    </IntentWizardShell>
  );
}
