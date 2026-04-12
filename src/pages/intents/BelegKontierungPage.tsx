import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Belegerfassung, Belegpositionen, KontierungUndPruefung, Skr03Kontenrahmen } from '@/types/app';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/formatters';
import {
  IconFileText,
  IconList,
  IconCheck,
  IconPlus,
  IconPencil,
  IconCircleCheck,
  IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Beleg auswählen' },
  { label: 'Positionen prüfen' },
  { label: 'Kontierung' },
  { label: 'Abschluss' },
];

export default function BelegKontierungPage() {
  const [searchParams] = useSearchParams();
  const belegIdParam = searchParams.get('belegId');
  const stepParam = parseInt(searchParams.get('step') ?? '', 10);

  const { belegerfassung, belegpositionen, kontierungUndPruefung, skr03Kontenrahmen, loading, error, fetchAll } =
    useDashboardData();

  // Determine initial step: if belegIdParam is given, start at step 2
  const initialStep = belegIdParam ? 2 : (!isNaN(stepParam) && stepParam >= 1 && stepParam <= 4 ? stepParam : 1);

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(belegIdParam);

  // Dialog open states
  const [belegDialogOpen, setBelegDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [kontierungDialogOpen, setKontierungDialogOpen] = useState(false);
  const [kontierungEditPosition, setKontierungEditPosition] = useState<string | null>(null);
  const [kontierungDefaultValues, setKontierungDefaultValues] = useState<KontierungUndPruefung['fields'] | undefined>(undefined);

  // Finalize state
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  // Sync selectedBelegId from URL param after data loads
  useEffect(() => {
    if (belegIdParam && !selectedBelegId) {
      setSelectedBelegId(belegIdParam);
    }
  }, [belegIdParam, selectedBelegId]);

  // Derived: selected Beleg record
  const selectedBeleg = useMemo<Belegerfassung | null>(
    () => belegerfassung.find(b => b.record_id === selectedBelegId) ?? null,
    [belegerfassung, selectedBelegId]
  );

  // Derived: URL of selected Beleg
  const selectedBelegUrl = useMemo<string | null>(
    () => selectedBelegId ? createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBelegId) : null,
    [selectedBelegId]
  );

  // Derived: Positionen for selected Beleg
  const selectedPositionen = useMemo<Belegpositionen[]>(
    () => belegpositionen.filter(p => p.fields.beleg_referenz === selectedBelegUrl),
    [belegpositionen, selectedBelegUrl]
  );

  // Derived: Kontierungen for each position
  const kontierungByPositionId = useMemo<Map<string, KontierungUndPruefung>>(() => {
    const map = new Map<string, KontierungUndPruefung>();
    for (const k of kontierungUndPruefung) {
      const posId = extractRecordId(k.fields.position_referenz);
      if (posId) map.set(posId, k);
    }
    return map;
  }, [kontierungUndPruefung]);

  // Derived: SKR03 map for lookup by record_id
  const skr03Map = useMemo<Map<string, Skr03Kontenrahmen>>(() => {
    const map = new Map<string, Skr03Kontenrahmen>();
    for (const k of skr03Kontenrahmen) map.set(k.record_id, k);
    return map;
  }, [skr03Kontenrahmen]);

  // Running total
  const totalBrutto = useMemo(
    () => selectedPositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0),
    [selectedPositionen]
  );

  const kontierteCount = useMemo(
    () => selectedPositionen.filter(p => kontierungByPositionId.has(p.record_id)).length,
    [selectedPositionen, kontierungByPositionId]
  );

  // EntitySelectStep items for Belege
  const belegeItems = useMemo(() => belegerfassung.map(b => {
    const posCount = belegpositionen.filter(p => p.fields.beleg_referenz === createRecordUrl(APP_IDS.BELEGERFASSUNG, b.record_id)).length;
    return {
      id: b.record_id,
      title: b.fields.belegtyp?.label ?? 'Unbekannter Belegtyp',
      subtitle: [
        b.fields.upload_datum ? `Hochgeladen: ${formatDate(b.fields.upload_datum)}` : null,
      ].filter(Boolean).join(' · '),
      status: b.fields.verarbeitungsstatus
        ? { key: b.fields.verarbeitungsstatus.key, label: b.fields.verarbeitungsstatus.label }
        : undefined,
      stats: [
        { label: 'Positionen', value: posCount },
        ...(b.fields.ocr_status ? [{ label: 'OCR', value: b.fields.ocr_status.label }] : []),
      ],
      icon: <IconFileText size={20} className="text-primary/70" />,
    };
  }), [belegerfassung, belegpositionen]);

  function handleBelegSelect(id: string) {
    setSelectedBelegId(id);
    setFinalized(false);
    setCurrentStep(2);
  }

  function handleReset() {
    setSelectedBelegId(null);
    setFinalized(false);
    setCurrentStep(1);
  }

  async function handleFinalize() {
    if (!selectedBelegId) return;
    setFinalizing(true);
    try {
      await LivingAppsService.updateBelegerfassungEntry(selectedBelegId, { verarbeitungsstatus: 'abgeschlossen' });
      await fetchAll();
      setFinalized(true);
    } catch (err) {
      console.error('Fehler beim Abschliessen:', err);
    } finally {
      setFinalizing(false);
    }
  }

  function openKontierungDialog(positionId: string) {
    const existing = kontierungByPositionId.get(positionId);
    setKontierungEditPosition(positionId);
    if (existing) {
      setKontierungDefaultValues(existing.fields);
    } else {
      setKontierungDefaultValues({
        position_referenz: createRecordUrl(APP_IDS.BELEGPOSITIONEN, positionId),
      });
    }
    setKontierungDialogOpen(true);
  }

  // Render step content
  function renderStep() {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Beleg auswählen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Wähle einen vorhandenen Beleg aus oder erfasse einen neuen, um den Kontierungsworkflow zu starten.
              </p>
            </div>
            <EntitySelectStep
              items={belegeItems}
              onSelect={handleBelegSelect}
              searchPlaceholder="Belege durchsuchen..."
              emptyIcon={<IconFileText size={40} />}
              emptyText="Noch keine Belege vorhanden. Erstelle deinen ersten Beleg."
              createLabel="Neuen Beleg erfassen"
              onCreateNew={() => setBelegDialogOpen(true)}
              createDialog={
                <BelegerfassungDialog
                  open={belegDialogOpen}
                  onClose={() => setBelegDialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createBelegerfassungEntry(fields);
                    await fetchAll();
                  }}
                  belegpositionenList={belegpositionen}
                />
              }
            />
          </div>
        );

      case 2: {
        if (!selectedBeleg) {
          return (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Kein Beleg ausgewählt. Bitte gehe zurück zu Schritt 1.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCurrentStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {/* Beleg Info */}
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">
                      {selectedBeleg.fields.belegtyp?.label ?? 'Beleg'}
                    </span>
                    {selectedBeleg.fields.verarbeitungsstatus && (
                      <StatusBadge
                        statusKey={selectedBeleg.fields.verarbeitungsstatus.key}
                        label={selectedBeleg.fields.verarbeitungsstatus.label}
                      />
                    )}
                    {selectedBeleg.fields.ocr_status && (
                      <StatusBadge
                        statusKey={selectedBeleg.fields.ocr_status.key}
                        label={`OCR: ${selectedBeleg.fields.ocr_status.label}`}
                      />
                    )}
                  </div>
                  {selectedBeleg.fields.upload_datum && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Hochgeladen: {formatDate(selectedBeleg.fields.upload_datum)}
                    </p>
                  )}
                  {selectedBeleg.fields.beleg_bemerkung && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {selectedBeleg.fields.beleg_bemerkung}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
                  Anderer Beleg
                </Button>
              </div>
            </div>

            {/* Running total */}
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Gesamtbetrag (brutto)</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(totalBrutto)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedPositionen.length} {selectedPositionen.length === 1 ? 'Position' : 'Positionen'}
              </p>
            </div>

            {/* Positionen Tabelle */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Belegpositionen</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPositionDialogOpen(true)}
                  className="gap-1.5"
                >
                  <IconPlus size={14} />
                  Neue Position
                </Button>
              </div>

              {selectedPositionen.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed text-muted-foreground">
                  <IconList size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Noch keine Positionen vorhanden.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => setPositionDialogOpen(true)}
                  >
                    <IconPlus size={14} />
                    Erste Position anlegen
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="text-left p-3 font-medium whitespace-nowrap">Rechnungsnummer</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap">Rechnungssteller</th>
                        <th className="text-right p-3 font-medium whitespace-nowrap">Betrag brutto</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap">MwSt</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap">Währung</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap">Datum</th>
                        <th className="text-left p-3 font-medium whitespace-nowrap">Kontierung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPositionen.map((pos, idx) => {
                        const kontierung = kontierungByPositionId.get(pos.record_id);
                        return (
                          <tr key={pos.record_id} className={`border-b last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                            <td className="p-3 font-mono text-xs truncate max-w-[120px]">
                              {pos.fields.rechnungsnummer ?? '—'}
                            </td>
                            <td className="p-3 truncate max-w-[150px]">
                              {pos.fields.rechnungssteller ?? '—'}
                            </td>
                            <td className="p-3 text-right font-semibold whitespace-nowrap">
                              {formatCurrency(pos.fields.betrag_brutto)}
                            </td>
                            <td className="p-3 whitespace-nowrap text-muted-foreground">
                              {pos.fields.mwst_satz?.label ?? '—'}
                            </td>
                            <td className="p-3 whitespace-nowrap text-muted-foreground">
                              {pos.fields.waehrung?.label ?? '—'}
                            </td>
                            <td className="p-3 whitespace-nowrap text-muted-foreground">
                              {pos.fields.rechnungsdatum ? formatDate(pos.fields.rechnungsdatum) : '—'}
                            </td>
                            <td className="p-3">
                              {kontierung ? (
                                <StatusBadge
                                  statusKey={kontierung.fields.plausibilitaet?.key}
                                  label={kontierung.fields.plausibilitaet?.label ?? 'Kontiert'}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">Nicht kontiert</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <BelegpositionenDialog
              open={positionDialogOpen}
              onClose={() => setPositionDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.createBelegpositionenEntry({
                  ...fields,
                  beleg_referenz: selectedBelegUrl ?? undefined,
                });
                await fetchAll();
              }}
              defaultValues={selectedBelegUrl ? { beleg_referenz: selectedBelegUrl } : undefined}
              belegerfassungList={belegerfassung}
            />

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="gap-1.5">
                Weiter zur Kontierung
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        );
      }

      case 3: {
        if (!selectedBeleg) {
          return (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Kein Beleg ausgewählt.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCurrentStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Kontierung zuweisen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Weise jeder Belegposition ein SKR03-Konto zu und prüfe die Plausibilität.
              </p>
            </div>

            {/* Progress indicator */}
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Fortschritt</span>
                <span className="text-sm font-semibold">
                  {kontierteCount} von {selectedPositionen.length} kontiert
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    kontierteCount === selectedPositionen.length && selectedPositionen.length > 0
                      ? 'bg-green-500'
                      : 'bg-primary'
                  }`}
                  style={{
                    width: selectedPositionen.length > 0
                      ? `${(kontierteCount / selectedPositionen.length) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            {selectedPositionen.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed text-muted-foreground">
                <IconList size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Keine Positionen vorhanden. Gehe zurück und füge Positionen hinzu.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedPositionen.map((pos) => {
                  const kontierung = kontierungByPositionId.get(pos.record_id);
                  const skr03Id = extractRecordId(kontierung?.fields.skr03_konto_referenz);
                  const skr03Konto = skr03Id ? skr03Map.get(skr03Id) : null;

                  return (
                    <div
                      key={pos.record_id}
                      className="rounded-xl border bg-card p-4 space-y-3 overflow-hidden"
                    >
                      {/* Position header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">
                              {pos.fields.rechnungssteller ?? pos.fields.rechnungsnummer ?? 'Position'}
                            </span>
                            {kontierung?.fields.plausibilitaet && (
                              <StatusBadge
                                statusKey={kontierung.fields.plausibilitaet.key}
                                label={kontierung.fields.plausibilitaet.label}
                              />
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {pos.fields.rechnungsnummer && (
                              <span>Nr.: <span className="font-mono">{pos.fields.rechnungsnummer}</span></span>
                            )}
                            {pos.fields.rechnungsdatum && (
                              <span>Datum: {formatDate(pos.fields.rechnungsdatum)}</span>
                            )}
                            <span className="font-semibold text-foreground">
                              {formatCurrency(pos.fields.betrag_brutto)}
                            </span>
                            {pos.fields.mwst_satz && (
                              <span>{pos.fields.mwst_satz.label}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant={kontierung ? 'outline' : 'default'}
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => openKontierungDialog(pos.record_id)}
                        >
                          {kontierung ? (
                            <>
                              <IconPencil size={14} />
                              Kontierung bearbeiten
                            </>
                          ) : (
                            <>
                              <IconPlus size={14} />
                              Kontierung erstellen
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Existing Kontierung Info */}
                      {kontierung && (
                        <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-xs">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {skr03Konto && (
                              <span>
                                <span className="text-muted-foreground">SKR03-Konto: </span>
                                <span className="font-mono font-semibold">
                                  {skr03Konto.fields.kontonummer}
                                </span>
                                {skr03Konto.fields.kontobezeichnung && (
                                  <span className="text-muted-foreground ml-1">
                                    – {skr03Konto.fields.kontobezeichnung}
                                  </span>
                                )}
                              </span>
                            )}
                            {kontierung.fields.konfidenz != null && (
                              <span>
                                <span className="text-muted-foreground">Konfidenz: </span>
                                <span className="font-semibold">{kontierung.fields.konfidenz}%</span>
                              </span>
                            )}
                            {kontierung.fields.manuell_korrigiert && (
                              <span className="text-amber-600 font-medium">Manuell korrigiert</span>
                            )}
                          </div>
                          {kontierung.fields.pruefhinweis && (
                            <p className="text-muted-foreground line-clamp-2">
                              Hinweis: {kontierung.fields.pruefhinweis}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <KontierungUndPruefungDialog
              open={kontierungDialogOpen}
              onClose={() => {
                setKontierungDialogOpen(false);
                setKontierungEditPosition(null);
                setKontierungDefaultValues(undefined);
              }}
              onSubmit={async (fields) => {
                const existingKontierung = kontierungEditPosition
                  ? kontierungByPositionId.get(kontierungEditPosition)
                  : null;
                if (existingKontierung) {
                  await LivingAppsService.updateKontierungUndPruefungEntry(existingKontierung.record_id, fields);
                } else {
                  await LivingAppsService.createKontierungUndPruefungEntry({
                    ...fields,
                    position_referenz: kontierungEditPosition
                      ? createRecordUrl(APP_IDS.BELEGPOSITIONEN, kontierungEditPosition)
                      : undefined,
                  });
                }
                await fetchAll();
              }}
              defaultValues={kontierungDefaultValues}
              belegpositionenList={belegpositionen}
              skr03_kontenrahmenList={skr03Kontenrahmen}
            />

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="gap-1.5">
                Weiter zur Zusammenfassung
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        );
      }

      case 4: {
        if (!selectedBeleg) {
          return (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Kein Beleg ausgewählt.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCurrentStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </div>
          );
        }

        if (finalized) {
          return (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCircleCheck size={32} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Beleg erfolgreich abgeschlossen!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Der Beleg wurde als geprüft markiert und ist nun abgeschlossen.
                  </p>
                </div>
                <Button onClick={handleReset} className="gap-1.5">
                  <IconRefresh size={16} />
                  Weiteren Beleg bearbeiten
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Zusammenfassung und Abschluss</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Prüfe die vollständige Übersicht und schliesse die Bearbeitung ab.
              </p>
            </div>

            {/* Beleg Summary */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Beleg-Informationen</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs block">Belegtyp</span>
                  <span className="font-medium">{selectedBeleg.fields.belegtyp?.label ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">Status</span>
                  {selectedBeleg.fields.verarbeitungsstatus ? (
                    <StatusBadge
                      statusKey={selectedBeleg.fields.verarbeitungsstatus.key}
                      label={selectedBeleg.fields.verarbeitungsstatus.label}
                    />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">Upload-Datum</span>
                  <span>{selectedBeleg.fields.upload_datum ? formatDate(selectedBeleg.fields.upload_datum) : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">OCR-Status</span>
                  {selectedBeleg.fields.ocr_status ? (
                    <StatusBadge
                      statusKey={selectedBeleg.fields.ocr_status.key}
                      label={selectedBeleg.fields.ocr_status.label}
                    />
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold">{formatCurrency(totalBrutto)}</p>
                <p className="text-xs text-muted-foreground mt-1">Gesamtbetrag (brutto)</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold">{selectedPositionen.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Positionen gesamt</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className={`text-2xl font-bold ${kontierteCount === selectedPositionen.length && selectedPositionen.length > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  {kontierteCount}/{selectedPositionen.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Positionen kontiert</p>
              </div>
            </div>

            {/* Positionen Detail */}
            {selectedPositionen.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Positionen im Detail</h3>
                {selectedPositionen.map((pos) => {
                  const kontierung = kontierungByPositionId.get(pos.record_id);
                  const skr03Id = extractRecordId(kontierung?.fields.skr03_konto_referenz);
                  const skr03Konto = skr03Id ? skr03Map.get(skr03Id) : null;

                  return (
                    <div
                      key={pos.record_id}
                      className="rounded-xl border bg-card p-3 flex items-center gap-3 overflow-hidden"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${kontierung ? 'bg-green-100' : 'bg-amber-100'}`}>
                        {kontierung ? (
                          <IconCheck size={14} className="text-green-600" />
                        ) : (
                          <span className="text-amber-600 text-xs font-bold">!</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {pos.fields.rechnungssteller ?? pos.fields.rechnungsnummer ?? 'Position'}
                          </span>
                          <span className="text-sm font-semibold shrink-0">
                            {formatCurrency(pos.fields.betrag_brutto)}
                          </span>
                        </div>
                        {skr03Konto ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            SKR03: <span className="font-mono font-semibold text-foreground">{skr03Konto.fields.kontonummer}</span>
                            {skr03Konto.fields.kontobezeichnung && (
                              <span> – {skr03Konto.fields.kontobezeichnung}</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 mt-0.5">Kein SKR03-Konto zugewiesen</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                Zurück zur Kontierung
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Anderer Beleg
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="gap-1.5"
                >
                  {finalizing ? (
                    <>
                      <IconRefresh size={16} className="animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <IconCircleCheck size={16} />
                      Beleg als geprüft markieren
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <IntentWizardShell
      title="Beleg kontieren und prüfen"
      subtitle="Erfasse Belege, prüfe Positionen und weise SKR03-Konten zu."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {renderStep()}
    </IntentWizardShell>
  );
}
