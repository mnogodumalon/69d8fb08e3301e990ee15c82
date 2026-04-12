import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Belegerfassung, Belegpositionen, KontierungUndPruefung, Skr03Kontenrahmen, UstAbfuehrungLeasingfahrzeug } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconFileText,
  IconListCheck,
  IconReceipt,
  IconCircleCheck,
  IconPlus,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconAlertTriangle,
  IconPencil,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Beleg wählen' },
  { label: 'Positionen' },
  { label: 'Kontierung' },
  { label: 'Abschluss' },
];

const formatCurrency = (value: number | undefined) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value ?? 0);

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '–';
  try {
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

export default function BelegErfassenKontierenPage() {
  const [searchParams] = useSearchParams();

  // Data state
  const [belegerfassungList, setBelegerfassungList] = useState<Belegerfassung[]>([]);
  const [belegpositionenList, setBelegpositionenList] = useState<Belegpositionen[]>([]);
  const [kontierungList, setKontierungList] = useState<KontierungUndPruefung[]>([]);
  const [skr03List, setSkr03List] = useState<Skr03Kontenrahmen[]>([]);
  const [ustList, setUstList] = useState<UstAbfuehrungLeasingfahrzeug[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(null);

  // Dialog state
  const [belegDialogOpen, setBelegDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [kontierungDialogOpen, setKontierungDialogOpen] = useState(false);
  const [editKontierung, setEditKontierung] = useState<KontierungUndPruefung | null>(null);
  const [newKontierungPositionUrl, setNewKontierungPositionUrl] = useState<string | null>(null);

  // Step 4 state
  const [selectedVerarbeitungsstatus, setSelectedVerarbeitungsstatus] = useState<string>('');
  const [statusSaved, setStatusSaved] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [belegData, posData, kontData, skrData, ustData] = await Promise.all([
        LivingAppsService.getBelegerfassung(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getKontierungUndPruefung(),
        LivingAppsService.getSkr03Kontenrahmen(),
        LivingAppsService.getUstAbfuehrungLeasingfahrzeug(),
      ]);
      setBelegerfassungList(belegData);
      setBelegpositionenList(posData);
      setKontierungList(kontData);
      setSkr03List(skrData);
      setUstList(ustData);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Deep-link: read ?belegId= and ?step= from URL on mount (after data loads)
  useEffect(() => {
    if (loading) return;
    const urlBelegId = searchParams.get('belegId');
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    if (urlBelegId) {
      setSelectedBelegId(urlBelegId);
      if (!isNaN(urlStep) && urlStep >= 2 && urlStep <= 4) {
        setCurrentStep(urlStep);
      } else {
        setCurrentStep(2);
      }
    }
  }, [loading, searchParams]);

  // Derived data
  const selectedBeleg = belegerfassungList.find(b => b.record_id === selectedBelegId) ?? null;
  const selectedBelegUrl = selectedBelegId ? createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBelegId) : null;

  const filteredPositionen = belegpositionenList.filter(
    p => p.fields.beleg_referenz === selectedBelegUrl
  );

  const positionUrls = new Set(
    filteredPositionen.map(p => createRecordUrl(APP_IDS.BELEGPOSITIONEN, p.record_id))
  );

  const filteredKontierungen = kontierungList.filter(
    k => k.fields.position_referenz && positionUrls.has(k.fields.position_referenz)
  );

  const totalBrutto = filteredPositionen.reduce(
    (sum, p) => sum + (p.fields.betrag_brutto ?? 0),
    0
  );

  const plausibleCount = filteredKontierungen.filter(
    k => k.fields.plausibilitaet?.key === 'plausibel'
  ).length;

  const needsCorrectionCount = filteredKontierungen.filter(
    k => k.fields.plausibilitaet?.key !== 'plausibel' && k.fields.plausibilitaet?.key !== undefined
  ).length;

  // Skr03 name lookup helper
  const getSkr03Name = (url: string | undefined) => {
    if (!url) return '–';
    const id = extractRecordId(url);
    const record = skr03List.find(r => r.record_id === id);
    if (!record) return '–';
    return `${record.fields.kontonummer ?? ''} ${record.fields.kontobezeichnung ?? ''}`.trim() || '–';
  };

  // Step handlers
  const handleBelegSelect = (id: string) => {
    setSelectedBelegId(id);
    setCurrentStep(2);
    setStatusSaved(false);
    setSelectedVerarbeitungsstatus('');
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  // Step 1: Beleg auswählen
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Beleg auswählen oder neu erfassen</h2>
        <p className="text-sm text-muted-foreground">
          Wähle einen vorhandenen Beleg aus oder erfasse einen neuen.
        </p>
      </div>
      <EntitySelectStep
        items={belegerfassungList.map(b => ({
          id: b.record_id,
          title: b.fields.belegtyp?.label ?? 'Unbekannter Belegtyp',
          subtitle: b.fields.upload_datum ? `Hochgeladen: ${formatDate(b.fields.upload_datum)}` : undefined,
          status: b.fields.verarbeitungsstatus
            ? { key: b.fields.verarbeitungsstatus.key, label: b.fields.verarbeitungsstatus.label }
            : undefined,
          icon: <IconFileText size={18} className="text-primary" />,
        }))}
        onSelect={handleBelegSelect}
        searchPlaceholder="Beleg suchen..."
        emptyIcon={<IconFileText size={32} />}
        emptyText="Noch keine Belege vorhanden. Erstelle deinen ersten Beleg."
        createLabel="Neuen Beleg erfassen"
        onCreateNew={() => setBelegDialogOpen(true)}
        createDialog={
          <BelegerfassungDialog
            open={belegDialogOpen}
            onClose={() => setBelegDialogOpen(false)}
            onSubmit={async (fields) => {
              const result = await LivingAppsService.createBelegerfassungEntry(fields);
              await fetchAll();
              // Auto-select the newly created record
              const entries = Object.entries(result as Record<string, unknown>);
              if (entries.length > 0) {
                const [newId] = entries[0];
                setSelectedBelegId(newId);
                setCurrentStep(2);
              }
              setBelegDialogOpen(false);
            }}
            belegpositionenList={belegpositionenList}
            enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Belegerfassung']}
          />
        }
      />
    </div>
  );

  // Step 2: Positionen prüfen
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Positionen prüfen</h2>
        <p className="text-sm text-muted-foreground">
          Überprüfe die Positionen des ausgewählten Belegs und füge bei Bedarf neue hinzu.
        </p>
      </div>

      {selectedBeleg && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconFileText size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {selectedBeleg.fields.belegtyp?.label ?? 'Beleg'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {selectedBeleg.fields.upload_datum ? formatDate(selectedBeleg.fields.upload_datum) : '–'}
            </p>
          </div>
          {selectedBeleg.fields.verarbeitungsstatus && (
            <StatusBadge
              statusKey={selectedBeleg.fields.verarbeitungsstatus.key}
              label={selectedBeleg.fields.verarbeitungsstatus.label}
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">
          {filteredPositionen.length === 0
            ? 'Noch keine Positionen vorhanden'
            : `${filteredPositionen.length} Position${filteredPositionen.length !== 1 ? 'en' : ''}`}
        </p>
        <Button variant="outline" size="sm" onClick={() => setPositionDialogOpen(true)} className="gap-1.5">
          <IconPlus size={15} />
          Neue Position
        </Button>
      </div>

      {filteredPositionen.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rechnungssteller</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rechnungs-Nr.</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Brutto</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">MwSt.</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositionen.map((pos) => (
                <tr key={pos.record_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3 truncate max-w-[160px]">{pos.fields.rechnungssteller ?? '–'}</td>
                  <td className="py-2 px-3 truncate max-w-[120px] text-muted-foreground">{pos.fields.rechnungsnummer ?? '–'}</td>
                  <td className="py-2 px-3 text-right font-medium tabular-nums">{formatCurrency(pos.fields.betrag_brutto)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{pos.fields.mwst_satz?.label ?? '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t">
                <td colSpan={2} className="py-2 px-3 font-semibold">Gesamtbetrag</td>
                <td className="py-2 px-3 text-right font-bold tabular-nums text-primary">{formatCurrency(totalBrutto)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <BelegpositionenDialog
        open={positionDialogOpen}
        onClose={() => setPositionDialogOpen(false)}
        onSubmit={async (fields) => {
          await LivingAppsService.createBelegpositionenEntry(fields);
          await fetchAll();
          setPositionDialogOpen(false);
        }}
        defaultValues={
          selectedBelegId
            ? { beleg_referenz: createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBelegId) }
            : undefined
        }
        ust_abfuehrung_leasingfahrzeugList={ustList}
        belegerfassungList={belegerfassungList}
        enablePhotoScan={AI_PHOTO_SCAN['Belegpositionen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Belegpositionen']}
      />

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-1.5">
          <IconArrowLeft size={15} />
          Zurück
        </Button>
        <Button onClick={() => setCurrentStep(3)} className="gap-1.5">
          Weiter
          <IconArrowRight size={15} />
        </Button>
      </div>
    </div>
  );

  // Step 3: Kontierung prüfen & korrigieren
  const renderStep3 = () => {
    const getKontierungForPosition = (posId: string) => {
      const posUrl = createRecordUrl(APP_IDS.BELEGPOSITIONEN, posId);
      return filteredKontierungen.find(k => k.fields.position_referenz === posUrl) ?? null;
    };

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Kontierung prüfen & korrigieren</h2>
          <p className="text-sm text-muted-foreground">
            Prüfe die automatische Kontierung jeder Position und korrigiere sie bei Bedarf.
          </p>
        </div>

        {filteredPositionen.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-xl">
            <IconListCheck size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine Positionen vorhanden. Gehe zurück und füge Positionen hinzu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPositionen.map((pos) => {
              const kontierung = getKontierungForPosition(pos.record_id);
              const posUrl = createRecordUrl(APP_IDS.BELEGPOSITIONEN, pos.record_id);
              return (
                <div key={pos.record_id} className="rounded-xl border overflow-hidden">
                  <div className="flex items-start gap-3 p-3 bg-muted/20">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <IconReceipt size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pos.fields.rechnungssteller ?? '–'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(pos.fields.betrag_brutto)}
                        {pos.fields.mwst_satz?.label ? ` · ${pos.fields.mwst_satz.label}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 border-t">
                    {kontierung ? (
                      <div className="flex items-start gap-2 justify-between flex-wrap">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-muted-foreground">SKR03-Konto</p>
                          <p className="text-sm font-medium truncate">
                            {getSkr03Name(kontierung.fields.skr03_konto_referenz)}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {kontierung.fields.plausibilitaet && (
                              <StatusBadge
                                statusKey={kontierung.fields.plausibilitaet.key}
                                label={kontierung.fields.plausibilitaet.label}
                              />
                            )}
                            {kontierung.fields.konfidenz !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                Konfidenz: <span className="font-medium text-foreground">{kontierung.fields.konfidenz}%</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => {
                            setEditKontierung(kontierung);
                            setNewKontierungPositionUrl(null);
                            setKontierungDialogOpen(true);
                          }}
                        >
                          <IconPencil size={14} />
                          Korrigieren
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-amber-600">
                          <IconAlertTriangle size={15} className="shrink-0" />
                          <p className="text-xs font-medium">Keine Kontierung vorhanden</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => {
                            setEditKontierung(null);
                            setNewKontierungPositionUrl(posUrl);
                            setKontierungDialogOpen(true);
                          }}
                        >
                          <IconPlus size={14} />
                          Kontierung anlegen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredPositionen.length > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <IconCheck size={11} className="text-green-700" stroke={2.5} />
              </div>
              <span className="text-sm">
                <span className="font-semibold">{plausibleCount}</span>{' '}
                <span className="text-muted-foreground">plausibel</span>
              </span>
            </div>
            {needsCorrectionCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <IconAlertTriangle size={11} className="text-amber-700" />
                </div>
                <span className="text-sm">
                  <span className="font-semibold">{needsCorrectionCount}</span>{' '}
                  <span className="text-muted-foreground">Prüfung erforderlich</span>
                </span>
              </div>
            )}
          </div>
        )}

        <KontierungUndPruefungDialog
          open={kontierungDialogOpen}
          onClose={() => {
            setKontierungDialogOpen(false);
            setEditKontierung(null);
            setNewKontierungPositionUrl(null);
          }}
          onSubmit={async (fields) => {
            if (editKontierung) {
              await LivingAppsService.updateKontierungUndPruefungEntry(editKontierung.record_id, fields);
            } else {
              await LivingAppsService.createKontierungUndPruefungEntry(fields);
            }
            await fetchAll();
            setKontierungDialogOpen(false);
            setEditKontierung(null);
            setNewKontierungPositionUrl(null);
          }}
          defaultValues={
            editKontierung
              ? editKontierung.fields
              : newKontierungPositionUrl
              ? { position_referenz: newKontierungPositionUrl }
              : undefined
          }
          belegpositionenList={belegpositionenList}
          skr03_kontenrahmenList={skr03List}
          enablePhotoScan={AI_PHOTO_SCAN['KontierungUndPruefung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['KontierungUndPruefung']}
        />

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-1.5">
            <IconArrowLeft size={15} />
            Zurück
          </Button>
          <Button onClick={() => setCurrentStep(4)} className="gap-1.5">
            Weiter
            <IconArrowRight size={15} />
          </Button>
        </div>
      </div>
    );
  };

  // Step 4: Abschluss
  const renderStep4 = () => {
    const kontierungCount = filteredKontierungen.length;
    const verarbeitungsOptions = LOOKUP_OPTIONS['belegerfassung']?.['verarbeitungsstatus'] ?? [];

    const handleSaveStatus = async () => {
      if (!selectedBelegId || !selectedVerarbeitungsstatus) return;
      setStatusSaving(true);
      try {
        await LivingAppsService.updateBelegerfassungEntry(selectedBelegId, {
          verarbeitungsstatus: selectedVerarbeitungsstatus,
        });
        await fetchAll();
        setStatusSaved(true);
      } finally {
        setStatusSaving(false);
      }
    };

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Abschluss</h2>
          <p className="text-sm text-muted-foreground">
            Überblick über den verarbeiteten Beleg und abschließende Statusvergabe.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border p-4 space-y-1 overflow-hidden">
            <p className="text-xs text-muted-foreground">Belegtyp</p>
            <p className="font-semibold truncate">
              {selectedBeleg?.fields.belegtyp?.label ?? '–'}
            </p>
            {selectedBeleg?.fields.upload_datum && (
              <p className="text-xs text-muted-foreground">
                Hochgeladen: {formatDate(selectedBeleg.fields.upload_datum)}
              </p>
            )}
            {selectedBeleg?.fields.verarbeitungsstatus && (
              <StatusBadge
                statusKey={selectedBeleg.fields.verarbeitungsstatus.key}
                label={selectedBeleg.fields.verarbeitungsstatus.label}
              />
            )}
          </div>

          <div className="rounded-xl border p-4 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Positionen gesamt</p>
              <span className="font-bold text-lg">{filteredPositionen.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Gesamtbetrag (Brutto)</p>
              <span className="font-bold text-lg text-primary">{formatCurrency(totalBrutto)}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Kontierungen angelegt</p>
              <span className="font-bold text-lg">{kontierungCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Davon plausibel</p>
              <span className="font-bold text-lg text-green-700">{plausibleCount}</span>
            </div>
          </div>
        </div>

        {/* Status update */}
        <div className="rounded-xl border p-4 space-y-3 overflow-hidden">
          <p className="font-medium text-sm">Verarbeitungsstatus aktualisieren</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={selectedVerarbeitungsstatus}
              onValueChange={(val) => {
                setSelectedVerarbeitungsstatus(val);
                setStatusSaved(false);
              }}
            >
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue placeholder="Status wählen..." />
              </SelectTrigger>
              <SelectContent>
                {verarbeitungsOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSaveStatus}
              disabled={!selectedVerarbeitungsstatus || statusSaving}
              className="gap-1.5 shrink-0"
            >
              {statusSaving ? (
                <>Speichern...</>
              ) : (
                <>
                  <IconCheck size={15} stroke={2.5} />
                  Speichern
                </>
              )}
            </Button>
          </div>

          {statusSaved && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
              <IconCircleCheck size={16} className="shrink-0" />
              <p className="text-sm font-medium">Status erfolgreich gespeichert.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-1.5">
            <IconArrowLeft size={15} />
            Zurück
          </Button>
          <a href="#/">
            <Button variant="default" className="gap-1.5">
              <IconCircleCheck size={15} />
              Zum Dashboard
            </Button>
          </a>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  return (
    <IntentWizardShell
      title="Beleg erfassen & kontieren"
      subtitle="Erfasse einen Beleg, prüfe die Positionen und verifiziere die Kontierung."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {renderCurrentStep()}
    </IntentWizardShell>
  );
}
