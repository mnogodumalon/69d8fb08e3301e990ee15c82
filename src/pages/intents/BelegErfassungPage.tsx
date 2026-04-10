import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Belegerfassung, Belegpositionen, KontierungUndPruefung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import { Button } from '@/components/ui/button';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconPlus,
  IconArrowRight,
  IconCheck,
  IconPencil,
  IconFileText,
  IconCurrencyEuro,
  IconAlertTriangle,
  IconCircleCheck,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Beleg auswählen' },
  { label: 'Positionen prüfen' },
  { label: 'Kontierung' },
  { label: 'Abschluss' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '–';
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function BelegErfassungPage() {
  const [searchParams] = useSearchParams();
  const { belegerfassung, belegpositionen, kontierungUndPruefung, skr03Kontenrahmen, loading, error, fetchAll } = useDashboardData();

  // Determine initial step from URL
  const initialBelegId = searchParams.get('belegId');
  const urlStep = parseInt(searchParams.get('step') ?? '', 10);
  const initialStep = initialBelegId ? 2 : (urlStep >= 1 && urlStep <= 4 ? urlStep : 1);

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(initialBelegId);

  // Dialog open states
  const [belegDialogOpen, setBelegDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [kontierungDialogOpen, setKontierungDialogOpen] = useState(false);
  const [editKontierung, setEditKontierung] = useState<KontierungUndPruefung | null>(null);

  // Completion state
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Sync belegId URL param on mount
  useEffect(() => {
    if (initialBelegId) {
      setSelectedBelegId(initialBelegId);
      setCurrentStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived: selected beleg record
  const selectedBeleg = useMemo(
    () => belegerfassung.find(b => b.record_id === selectedBelegId) ?? null,
    [belegerfassung, selectedBelegId]
  );

  // Derived: positions belonging to selected beleg
  const belegPositionen = useMemo((): Belegpositionen[] => {
    if (!selectedBelegId) return [];
    return belegpositionen.filter(pos => {
      const refId = extractRecordId(pos.fields.beleg_referenz);
      return refId === selectedBelegId;
    });
  }, [belegpositionen, selectedBelegId]);

  // Derived: position IDs set for quick lookup
  const positionIds = useMemo(
    () => new Set(belegPositionen.map(p => p.record_id)),
    [belegPositionen]
  );

  // Derived: kontierung records linked to any of the beleg's positions
  const belegKontierungen = useMemo((): KontierungUndPruefung[] => {
    return kontierungUndPruefung.filter(k => {
      const refId = extractRecordId(k.fields.position_referenz);
      return refId !== null && positionIds.has(refId);
    });
  }, [kontierungUndPruefung, positionIds]);

  // Running total of betrag_brutto
  const gesamtBetrag = useMemo(
    () => belegPositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0),
    [belegPositionen]
  );

  // Plausibility counts
  const plausibilitaetCounts = useMemo(() => {
    const counts = { plausibel: 0, pruefung_erforderlich: 0, nicht_plausibel: 0, nicht_geprueft: 0 };
    belegKontierungen.forEach(k => {
      const key = (k.fields.plausibilitaet as any)?.key ?? k.fields.plausibilitaet ?? 'nicht_geprueft';
      if (key in counts) counts[key as keyof typeof counts]++;
    });
    return counts;
  }, [belegKontierungen]);

  // Filter belege: exclude 'abgeschlossen'
  const offeneBelege = useMemo(
    () => belegerfassung.filter(b => {
      const statusKey = (b.fields.verarbeitungsstatus as any)?.key ?? b.fields.verarbeitungsstatus;
      return statusKey !== 'abgeschlossen';
    }),
    [belegerfassung]
  );

  function handleBelegSelect(id: string) {
    setSelectedBelegId(id);
    setCurrentStep(2);
  }

  async function handleBelegCreate(fields: Belegerfassung['fields']) {
    const result = await LivingAppsService.createBelegerfassungEntry(fields);
    await fetchAll();
    // Auto-select the newly created beleg
    if (result && typeof result === 'object') {
      const entries = Object.entries(result as Record<string, unknown>);
      const newId = entries[0]?.[0];
      if (newId) {
        setSelectedBelegId(newId);
        setCurrentStep(2);
      }
    }
  }

  async function handlePositionCreate(fields: Belegpositionen['fields']) {
    await LivingAppsService.createBelegpositionenEntry(fields);
    await fetchAll();
  }

  async function handleKontierungSubmit(fields: KontierungUndPruefung['fields']) {
    if (editKontierung) {
      await LivingAppsService.updateKontierungUndPruefungEntry(editKontierung.record_id, fields);
    } else {
      await LivingAppsService.createKontierungUndPruefungEntry(fields);
    }
    setEditKontierung(null);
    await fetchAll();
  }

  async function handleAbschliessen() {
    if (!selectedBelegId) return;
    setCompleting(true);
    try {
      await LivingAppsService.updateBelegerfassungEntry(selectedBelegId, {
        verarbeitungsstatus: 'abgeschlossen',
      });
      await fetchAll();
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  }

  function handleReset() {
    setSelectedBelegId(null);
    setCurrentStep(1);
    setCompleted(false);
  }

  // Beleg positionen dialog default values (pre-fill beleg_referenz)
  const positionDefaultValues = useMemo((): Belegpositionen['fields'] | undefined => {
    if (!selectedBelegId) return undefined;
    return {
      beleg_referenz: createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBelegId),
    };
  }, [selectedBelegId]);

  return (
    <>
      <IntentWizardShell
        title="Beleg erfassen & kontieren"
        subtitle="Erfasse einen Beleg, prüfe die Positionen und schließe die Kontierung ab."
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        {/* ── STEP 1: Beleg auswählen ── */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Beleg auswählen oder neu erfassen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Wähle einen vorhandenen Beleg aus oder lege einen neuen an.
              </p>
            </div>
            <EntitySelectStep
              items={offeneBelege.map(b => {
                const belegtyp = (b.fields.belegtyp as any)?.label ?? '–';
                const verarbStatus = b.fields.verarbeitungsstatus as any;
                const ocrStatus = b.fields.ocr_status as any;
                return {
                  id: b.record_id,
                  title: belegtyp,
                  subtitle: `Hochgeladen: ${formatDate(b.fields.upload_datum)}`,
                  status: verarbStatus ? { key: verarbStatus.key ?? verarbStatus, label: verarbStatus.label ?? verarbStatus } : undefined,
                  stats: [
                    { label: 'OCR', value: ocrStatus?.label ?? '–' },
                  ],
                  icon: <IconFileText size={18} className="text-primary" />,
                };
              })}
              onSelect={handleBelegSelect}
              searchPlaceholder="Beleg suchen..."
              emptyText="Keine offenen Belege gefunden."
              emptyIcon={<IconFileText size={32} />}
              createLabel="Neuen Beleg erfassen"
              onCreateNew={() => setBelegDialogOpen(true)}
              createDialog={
                <BelegerfassungDialog
                  open={belegDialogOpen}
                  onClose={() => setBelegDialogOpen(false)}
                  onSubmit={handleBelegCreate}
                  belegpositionenList={belegpositionen}
                  enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
                  enablePhotoLocation={AI_PHOTO_LOCATION['Belegerfassung']}
                />
              }
            />
          </div>
        )}

        {/* ── STEP 2: Belegpositionen prüfen ── */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Belegpositionen prüfen</h2>
                {selectedBeleg && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {(selectedBeleg.fields.belegtyp as any)?.label ?? 'Beleg'} &mdash; hochgeladen am {formatDate(selectedBeleg.fields.upload_datum)}
                  </p>
                )}
              </div>
              {/* Running total */}
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 shrink-0">
                <IconCurrencyEuro size={18} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Gesamtbetrag (brutto)</p>
                  <p className="text-base font-bold text-primary">{formatCurrency(gesamtBetrag)}</p>
                </div>
              </div>
            </div>

            {/* Position cards */}
            {belegPositionen.length === 0 ? (
              <div className="text-center py-10 border rounded-xl bg-muted/30">
                <IconFileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">Noch keine Positionen vorhanden.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {belegPositionen.map(pos => (
                  <div key={pos.record_id} className="border rounded-xl bg-card p-4 overflow-hidden">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{pos.fields.rechnungssteller ?? '–'}</p>
                        <p className="text-xs text-muted-foreground truncate">{pos.fields.rechnungsnummer ?? 'Keine Rechnungsnummer'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatCurrency(pos.fields.betrag_brutto)}</p>
                        <p className="text-xs text-muted-foreground">
                          {(pos.fields.mwst_satz as any)?.label ?? '–'} MwSt.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {pos.fields.rechnungsdatum && (
                        <span>Datum: <span className="text-foreground font-medium">{formatDate(pos.fields.rechnungsdatum)}</span></span>
                      )}
                      {pos.fields.artikel && (
                        <span className="truncate max-w-xs">Artikel: <span className="text-foreground font-medium">{pos.fields.artikel}</span></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add position button */}
            <Button variant="outline" className="w-full gap-2" onClick={() => setPositionDialogOpen(true)}>
              <IconPlus size={16} />
              Neue Position hinzufügen
            </Button>

            <BelegpositionenDialog
              open={positionDialogOpen}
              onClose={() => setPositionDialogOpen(false)}
              onSubmit={handlePositionCreate}
              defaultValues={positionDefaultValues}
              belegerfassungList={belegerfassung}
              enablePhotoScan={AI_PHOTO_SCAN['Belegpositionen']}
              enablePhotoLocation={AI_PHOTO_LOCATION['Belegpositionen']}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="gap-2">
                Weiter zur Kontierung
                <IconArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Kontierung prüfen & korrigieren ── */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Kontierung prüfen & korrigieren</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Überprüfe die automatisch zugewiesenen Konten und korrigiere sie bei Bedarf.
              </p>
            </div>

            {/* Plausibility summary */}
            {belegKontierungen.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center overflow-hidden">
                  <p className="text-2xl font-bold text-green-700">{plausibilitaetCounts.plausibel}</p>
                  <p className="text-xs text-green-600 mt-0.5">Plausibel</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center overflow-hidden">
                  <p className="text-2xl font-bold text-amber-700">{plausibilitaetCounts.pruefung_erforderlich}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Prüfung nötig</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center overflow-hidden">
                  <p className="text-2xl font-bold text-red-700">{plausibilitaetCounts.nicht_plausibel}</p>
                  <p className="text-xs text-red-600 mt-0.5">Nicht plausibel</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center overflow-hidden">
                  <p className="text-2xl font-bold text-gray-600">{plausibilitaetCounts.nicht_geprueft}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Nicht geprüft</p>
                </div>
              </div>
            )}

            {/* Kontierung cards */}
            {belegKontierungen.length === 0 ? (
              <div className="text-center py-10 border rounded-xl bg-muted/30">
                <IconRefresh size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">Keine Kontierungen für diesen Beleg gefunden.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {belegKontierungen.map(k => {
                  const plausibilitaet = k.fields.plausibilitaet as any;
                  const plausKey = plausibilitaet?.key ?? plausibilitaet ?? 'nicht_geprueft';
                  const plausLabel = plausibilitaet?.label ?? plausibilitaet ?? 'Nicht geprüft';
                  const konfidenz = k.fields.konfidenz;
                  // Find linked skr03 konto
                  const kontoRefId = extractRecordId(k.fields.skr03_konto_referenz);
                  const konto = kontoRefId ? skr03Kontenrahmen.find(s => s.record_id === kontoRefId) : null;

                  return (
                    <div key={k.record_id} className="border rounded-xl bg-card p-4 overflow-hidden">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge statusKey={plausKey} label={plausLabel} />
                            {konfidenz !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                Konfidenz: <span className="font-medium text-foreground">{konfidenz}%</span>
                              </span>
                            )}
                            {k.fields.manuell_korrigiert && (
                              <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                Manuell korrigiert
                              </span>
                            )}
                          </div>
                          {konto && (
                            <p className="text-sm font-medium truncate">
                              SKR03: {konto.fields.kontonummer} – {konto.fields.kontobezeichnung}
                            </p>
                          )}
                          {k.fields.pruefhinweis && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{k.fields.pruefhinweis}</p>
                          )}
                          {k.fields.korrekturbemerkung && (
                            <p className="text-xs text-amber-700 line-clamp-2">Korrektur: {k.fields.korrekturbemerkung}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => {
                            setEditKontierung(k);
                            setKontierungDialogOpen(true);
                          }}
                        >
                          <IconPencil size={14} />
                          Korrigieren
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <KontierungUndPruefungDialog
              open={kontierungDialogOpen}
              onClose={() => {
                setKontierungDialogOpen(false);
                setEditKontierung(null);
              }}
              onSubmit={handleKontierungSubmit}
              defaultValues={editKontierung?.fields}
              belegpositionenList={belegpositionen}
              skr03_kontenrahmenList={skr03Kontenrahmen}
              enablePhotoScan={AI_PHOTO_SCAN['KontierungUndPruefung']}
              enablePhotoLocation={AI_PHOTO_LOCATION['KontierungUndPruefung']}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="gap-2">
                Kontierung abschließen
                <IconArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Abschluss & Zusammenfassung ── */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {completed ? (
              /* Success state */
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold">Beleg abgeschlossen!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Der Beleg wurde erfolgreich als abgeschlossen markiert.
                  </p>
                </div>
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <IconFileText size={16} />
                  Neuen Beleg erfassen
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-semibold">Abschluss & Zusammenfassung</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Überprüfe alle Angaben und schließe den Beleg ab.
                  </p>
                </div>

                {/* Summary card */}
                <div className="border rounded-xl bg-card overflow-hidden">
                  <div className="bg-muted/40 px-4 py-3 border-b">
                    <p className="text-sm font-semibold">Belegübersicht</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedBeleg && (
                      <>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">Belegtyp</span>
                          <span className="text-sm font-medium">
                            {(selectedBeleg.fields.belegtyp as any)?.label ?? '–'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">Upload-Datum</span>
                          <span className="text-sm font-medium">{formatDate(selectedBeleg.fields.upload_datum)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">OCR-Status</span>
                          <StatusBadge
                            statusKey={(selectedBeleg.fields.ocr_status as unknown as { key: string })?.key ?? ''}
                            label={(selectedBeleg.fields.ocr_status as unknown as { label: string })?.label}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">Verarbeitungsstatus</span>
                          <StatusBadge
                            statusKey={(selectedBeleg.fields.verarbeitungsstatus as unknown as { key: string })?.key ?? ''}
                            label={(selectedBeleg.fields.verarbeitungsstatus as unknown as { label: string })?.label}
                          />
                        </div>
                      </>
                    )}
                    <div className="border-t pt-3 mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Anzahl Positionen</span>
                      <span className="text-sm font-bold">{belegPositionen.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Gesamtbetrag (brutto)</span>
                      <span className="text-base font-bold text-primary">{formatCurrency(gesamtBetrag)}</span>
                    </div>
                  </div>
                </div>

                {/* Kontierung summary */}
                <div className="border rounded-xl bg-card overflow-hidden">
                  <div className="bg-muted/40 px-4 py-3 border-b">
                    <p className="text-sm font-semibold">Kontierungsstatus</p>
                  </div>
                  <div className="p-4">
                    {belegKontierungen.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine Kontierungen vorhanden.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center overflow-hidden">
                          <p className="text-xl font-bold text-green-700">{plausibilitaetCounts.plausibel}</p>
                          <p className="text-xs text-green-600 mt-0.5">Plausibel</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center overflow-hidden">
                          <p className="text-xl font-bold text-amber-700">{plausibilitaetCounts.pruefung_erforderlich}</p>
                          <p className="text-xs text-amber-600 mt-0.5">Prüfung nötig</p>
                        </div>
                        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center overflow-hidden">
                          <p className="text-xl font-bold text-red-700">{plausibilitaetCounts.nicht_plausibel}</p>
                          <p className="text-xs text-red-600 mt-0.5">Nicht plausibel</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center overflow-hidden">
                          <p className="text-xl font-bold text-gray-600">{plausibilitaetCounts.nicht_geprueft}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Nicht geprüft</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Warning if unresolved issues */}
                {(plausibilitaetCounts.pruefung_erforderlich > 0 || plausibilitaetCounts.nicht_plausibel > 0) && (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
                    <IconAlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Es gibt noch Kontierungen, die eine Prüfung erfordern oder nicht plausibel sind. Du kannst den Beleg trotzdem abschließen.
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                    Zurück
                  </Button>
                  <Button
                    onClick={handleAbschliessen}
                    disabled={completing}
                    className="gap-2"
                  >
                    {completing ? (
                      <>
                        <IconRefresh size={16} className="animate-spin" />
                        Wird abgeschlossen...
                      </>
                    ) : (
                      <>
                        <IconCheck size={16} />
                        Beleg als abgeschlossen markieren
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </IntentWizardShell>
    </>
  );
}
