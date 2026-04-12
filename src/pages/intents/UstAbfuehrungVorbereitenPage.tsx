import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Leasingfahrzeug, Belegpositionen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { LeasingfahrzeugDialog } from '@/components/dialogs/LeasingfahrzeugDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconCar,
  IconCalculator,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconCurrencyEuro,
  IconFileInvoice,
  IconAlertCircle,
} from '@tabler/icons-react';

const STEPS = [
  { label: 'Fahrzeug wählen' },
  { label: 'Zeitraum & Beleg' },
  { label: 'USt-Berechnung' },
  { label: 'Abschluss' },
];

const formatCurrency = (value: number | undefined | null) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
};

function parseUstSatzDecimal(key: string): number {
  // key like 'ust_19' → 0.19, 'ust_7' → 0.07
  const match = key.match(/(\d+)$/);
  if (!match) return 0;
  return Number(match[1]) / 100;
}

export default function UstAbfuehrungVorbereitenPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial fahrzeugId from URL for deep-linking
  const initialFahrzeugId = searchParams.get('fahrzeugId') ?? null;
  const initialStep = initialFahrzeugId ? 2 : (parseInt(searchParams.get('step') ?? '1', 10) || 1);

  const [currentStep, setCurrentStep] = useState(initialStep);

  // Step 1 state
  const [selectedFahrzeugId, setSelectedFahrzeugId] = useState<string | null>(initialFahrzeugId);
  const [fahrzeugDialogOpen, setFahrzeugDialogOpen] = useState(false);

  // Step 2 state
  const [ustZeitraum, setUstZeitraum] = useState('');
  const [selectedEigenanteilId, setSelectedEigenanteilId] = useState<string>('');
  const [selectedBelegpositionId, setSelectedBelegpositionId] = useState<string>('');

  // Step 3 state
  const [privatnutzungBetrag, setPrivatnutzungBetrag] = useState<string>('');
  const [bemessungsgrundlageNetto, setBemessungsgrundlageNetto] = useState<string>('');
  const [ustSatzKey, setUstSatzKey] = useState<string>('');
  const [ustBetrag, setUstBetrag] = useState<string>('');
  const [buchungstext, setBuchungstext] = useState<string>('');

  // Step 4 state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(null);

  const {
    leasingfahrzeug,
    belegpositionen,
    skr03Kontenrahmen,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedFahrzeugId) {
      params.set('fahrzeugId', selectedFahrzeugId);
    } else {
      params.delete('fahrzeugId');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedFahrzeugId, searchParams, setSearchParams]);

  // Auto-calculate USt-Betrag when bemessungsgrundlage or ust_satz changes
  useEffect(() => {
    if (bemessungsgrundlageNetto && ustSatzKey) {
      const base = parseFloat(bemessungsgrundlageNetto);
      const rate = parseUstSatzDecimal(ustSatzKey);
      if (!isNaN(base) && rate > 0) {
        setUstBetrag((base * rate).toFixed(2));
      }
    }
  }, [bemessungsgrundlageNetto, ustSatzKey]);

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const selectedFahrzeug: Leasingfahrzeug | undefined = leasingfahrzeug.find(
    (f) => f.record_id === selectedFahrzeugId
  );

  const handleFahrzeugSelect = (id: string) => {
    setSelectedFahrzeugId(id);
    setCurrentStep(2);
  };

  const handleFahrzeugDialogSubmit = async (fields: Leasingfahrzeug['fields']) => {
    const result = await LivingAppsService.createLeasingfahrzeugEntry(fields);
    await fetchAll();
    // Auto-select the newly created record
    if (result && typeof result === 'object') {
      const entries = Object.entries(result as Record<string, unknown>);
      if (entries.length > 0) {
        const newId = entries[0][0];
        setSelectedFahrzeugId(newId);
        setCurrentStep(2);
      }
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedFahrzeugId(null);
    setUstZeitraum('');
    setSelectedEigenanteilId('');
    setSelectedBelegpositionId('');
    setPrivatnutzungBetrag('');
    setBemessungsgrundlageNetto('');
    setUstSatzKey('');
    setUstBetrag('');
    setBuchungstext('');
    setSubmitError(null);
    setCreatedRecordId(null);
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fields: Record<string, unknown> = {
        fahrzeug_referenz: createRecordUrl(APP_IDS.LEASINGFAHRZEUG, selectedFahrzeugId!),
        ust_zeitraum: ustZeitraum,
        buchungsstatus: 'offen',
        belegposition_auto: false,
      };
      if (selectedEigenanteilId) {
        fields.belegposition_eigenanteil_referenz = createRecordUrl(
          APP_IDS.BELEGPOSITIONEN,
          selectedEigenanteilId
        );
      }
      if (selectedBelegpositionId) {
        fields.belegposition_referenz = createRecordUrl(
          APP_IDS.BELEGPOSITIONEN,
          selectedBelegpositionId
        );
      }
      if (privatnutzungBetrag) {
        fields.privatnutzung_betrag = parseFloat(privatnutzungBetrag);
      }
      if (bemessungsgrundlageNetto) {
        fields.bemessungsgrundlage_netto = parseFloat(bemessungsgrundlageNetto);
      }
      if (ustSatzKey) {
        fields.ust_satz = ustSatzKey;
      }
      if (ustBetrag) {
        fields.ust_betrag = parseFloat(ustBetrag);
      }
      if (buchungstext) {
        fields.buchungstext = buchungstext;
      }

      const result = await LivingAppsService.createUstAbfuehrungLeasingfahrzeugEntry(
        fields as Parameters<typeof LivingAppsService.createUstAbfuehrungLeasingfahrzeugEntry>[0]
      );
      await fetchAll();

      if (result && typeof result === 'object') {
        const entries = Object.entries(result as Record<string, unknown>);
        if (entries.length > 0) {
          setCreatedRecordId(entries[0][0]);
        }
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const ustSatzOptions = LOOKUP_OPTIONS['ust_abfuehrung_leasingfahrzeug']?.ust_satz ?? [];

  const selectedUstSatzLabel =
    ustSatzOptions.find((o) => o.key === ustSatzKey)?.label ?? ustSatzKey;

  const getBelegpositionLabel = (bp: Belegpositionen) => {
    const parts: string[] = [];
    if (bp.fields.rechnungsnummer) parts.push(bp.fields.rechnungsnummer);
    if (bp.fields.rechnungssteller) parts.push(bp.fields.rechnungssteller);
    if (bp.fields.betrag_brutto != null)
      parts.push(formatCurrency(bp.fields.betrag_brutto));
    return parts.join(' | ') || bp.record_id;
  };

  const selectedEigenanteilBeleg = belegpositionen.find(
    (bp) => bp.record_id === selectedEigenanteilId
  );
  const selectedBelegposition = belegpositionen.find(
    (bp) => bp.record_id === selectedBelegpositionId
  );

  return (
    <IntentWizardShell
      title="USt-Abführung vorbereiten"
      subtitle="Bereite die Umsatzsteuer-Abführung für ein Leasingfahrzeug vor"
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Fahrzeug wählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Fahrzeug wählen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle das Leasingfahrzeug, für das du die USt-Abführung vorbereiten möchtest.
            </p>
          </div>
          <EntitySelectStep
            items={leasingfahrzeug.map((f) => ({
              id: f.record_id,
              title: f.fields.fahrzeug_bezeichnung ?? 'Unbekanntes Fahrzeug',
              subtitle: f.fields.kennzeichen,
              status: f.fields.nutzungsart
                ? { key: f.fields.nutzungsart.key, label: f.fields.nutzungsart.label }
                : undefined,
              stats: f.fields.leasingrate_brutto != null
                ? [{ label: 'Leasingrate', value: formatCurrency(f.fields.leasingrate_brutto) + '/Monat' }]
                : [],
              icon: <IconCar size={20} className="text-primary" />,
            }))}
            onSelect={handleFahrzeugSelect}
            searchPlaceholder="Fahrzeug suchen..."
            emptyIcon={<IconCar size={32} />}
            emptyText="Keine Leasingfahrzeuge vorhanden. Erstelle zuerst ein Fahrzeug."
            createLabel="Neues Fahrzeug"
            onCreateNew={() => setFahrzeugDialogOpen(true)}
            createDialog={
              <LeasingfahrzeugDialog
                open={fahrzeugDialogOpen}
                onClose={() => setFahrzeugDialogOpen(false)}
                onSubmit={handleFahrzeugDialogSubmit}
                skr03_kontenrahmenList={skr03Kontenrahmen}
                enablePhotoScan={AI_PHOTO_SCAN['Leasingfahrzeug']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Leasingfahrzeug']}
              />
            }
          />
        </div>
      )}

      {/* Step 2: Zeitraum & Belegposition */}
      {currentStep === 2 && selectedFahrzeug && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Zeitraum & Belegposition</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gib den USt-Zeitraum an und verknüpfe die relevanten Belegpositionen.
            </p>
          </div>

          {/* Selected vehicle info card */}
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconCar size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {selectedFahrzeug.fields.fahrzeug_bezeichnung ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedFahrzeug.fields.kennzeichen ?? '—'}
                {selectedFahrzeug.fields.leasingrate_brutto != null && (
                  <span className="ml-2">
                    · {formatCurrency(selectedFahrzeug.fields.leasingrate_brutto)}/Monat
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => { setCurrentStep(1); setSelectedFahrzeugId(null); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Ändern
            </button>
          </div>

          <div className="space-y-4">
            {/* USt-Zeitraum */}
            <div className="space-y-2">
              <Label htmlFor="ust_zeitraum">USt-Zeitraum *</Label>
              <Input
                id="ust_zeitraum"
                type="date"
                value={ustZeitraum}
                onChange={(e) => setUstZeitraum(e.target.value)}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">Datum des Abrechnungszeitraums (Format: TT.MM.JJJJ)</p>
            </div>

            {/* Belegposition Eigenanteil */}
            <div className="space-y-2">
              <Label htmlFor="eigenanteil_select">Belegposition Eigenanteil (optional)</Label>
              <Select
                value={selectedEigenanteilId || 'none'}
                onValueChange={(v) => setSelectedEigenanteilId(v === 'none' ? '' : v)}
              >
                <SelectTrigger id="eigenanteil_select" className="w-full">
                  <SelectValue placeholder="Belegposition auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Keine Auswahl —</SelectItem>
                  {belegpositionen.map((bp) => (
                    <SelectItem key={bp.record_id} value={bp.record_id}>
                      {getBelegpositionLabel(bp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Belegposition für den Eigenanteil der Leasing-MwSt (belegposition_eigenanteil_referenz)
              </p>
            </div>

            {/* Belegposition Referenz */}
            <div className="space-y-2">
              <Label htmlFor="belegposition_select">Belegposition Referenz (optional)</Label>
              <Select
                value={selectedBelegpositionId || 'none'}
                onValueChange={(v) => setSelectedBelegpositionId(v === 'none' ? '' : v)}
              >
                <SelectTrigger id="belegposition_select" className="w-full">
                  <SelectValue placeholder="Belegposition auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Keine Auswahl —</SelectItem>
                  {belegpositionen.map((bp) => (
                    <SelectItem key={bp.record_id} value={bp.record_id}>
                      {getBelegpositionLabel(bp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Hauptbelegposition für die USt-Abführung (belegposition_referenz)
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              disabled={!ustZeitraum}
              className="gap-2"
            >
              Weiter
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: USt-Berechnung */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">USt-Berechnung</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gib die Berechnungsgrundlagen für die Umsatzsteuer ein.
            </p>
          </div>

          {/* Live calculation preview */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <IconCalculator size={16} className="text-primary" />
              Berechnungsvorschau
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground">Privatnutzung</p>
                <p className="font-semibold mt-1">
                  {privatnutzungBetrag ? formatCurrency(parseFloat(privatnutzungBetrag)) : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground">Bemessungsgrundlage</p>
                <p className="font-semibold mt-1">
                  {bemessungsgrundlageNetto ? formatCurrency(parseFloat(bemessungsgrundlageNetto)) : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-background border p-3">
                <p className="text-xs text-muted-foreground">
                  USt {selectedUstSatzLabel ? `(${selectedUstSatzLabel})` : ''}
                </p>
                <p className="font-semibold mt-1 text-primary">
                  {ustBetrag ? formatCurrency(parseFloat(ustBetrag)) : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Privatnutzung Betrag */}
            <div className="space-y-2">
              <Label htmlFor="privatnutzung_betrag">Privatnutzung Betrag (€)</Label>
              <div className="relative max-w-xs">
                <IconCurrencyEuro
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="privatnutzung_betrag"
                  type="number"
                  step="0.01"
                  min="0"
                  value={privatnutzungBetrag}
                  onChange={(e) => setPrivatnutzungBetrag(e.target.value)}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Bemessungsgrundlage netto */}
            <div className="space-y-2">
              <Label htmlFor="bemessungsgrundlage_netto">Bemessungsgrundlage netto (€)</Label>
              <div className="relative max-w-xs">
                <IconCurrencyEuro
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="bemessungsgrundlage_netto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bemessungsgrundlageNetto}
                  onChange={(e) => setBemessungsgrundlageNetto(e.target.value)}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* USt-Satz */}
            <div className="space-y-2">
              <Label htmlFor="ust_satz">USt-Satz</Label>
              <Select
                value={ustSatzKey || 'none'}
                onValueChange={(v) => setUstSatzKey(v === 'none' ? '' : v)}
              >
                <SelectTrigger id="ust_satz" className="max-w-xs">
                  <SelectValue placeholder="USt-Satz auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Auswählen —</SelectItem>
                  {ustSatzOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* USt-Betrag (auto-calculated, overridable) */}
            <div className="space-y-2">
              <Label htmlFor="ust_betrag">USt-Betrag (€)</Label>
              <div className="relative max-w-xs">
                <IconCurrencyEuro
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="ust_betrag"
                  type="number"
                  step="0.01"
                  min="0"
                  value={ustBetrag}
                  onChange={(e) => setUstBetrag(e.target.value)}
                  className="pl-9"
                  placeholder="Wird automatisch berechnet"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Wird automatisch aus Bemessungsgrundlage × USt-Satz berechnet. Du kannst den Wert manuell überschreiben.
              </p>
            </div>

            {/* Buchungstext */}
            <div className="space-y-2">
              <Label htmlFor="buchungstext">Buchungstext</Label>
              <Textarea
                id="buchungstext"
                value={buchungstext}
                onChange={(e) => setBuchungstext(e.target.value)}
                placeholder="z.B. USt-Abführung Leasingfahrzeug Januar 2026"
                rows={3}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              className="gap-2"
            >
              Weiter
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Abschluss */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {createdRecordId ? (
            /* Success state */
            <div className="space-y-6">
              <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto">
                  <IconCheck size={28} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-300">
                    USt-Abführung wurde angelegt!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    Der Datensatz wurde erfolgreich erstellt.
                  </p>
                </div>

                {/* Summary of created record */}
                <div className="rounded-lg bg-white dark:bg-background border border-green-200 dark:border-green-800 p-4 text-left space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fahrzeug</span>
                    <span className="font-medium truncate ml-4">
                      {selectedFahrzeug?.fields.fahrzeug_bezeichnung ?? '—'}
                    </span>
                  </div>
                  {selectedFahrzeug?.fields.kennzeichen && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kennzeichen</span>
                      <span className="font-medium">{selectedFahrzeug.fields.kennzeichen}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USt-Zeitraum</span>
                    <span className="font-medium">{ustZeitraum}</span>
                  </div>
                  {ustSatzKey && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">USt-Satz</span>
                      <span className="font-medium">{selectedUstSatzLabel}</span>
                    </div>
                  )}
                  {ustBetrag && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">USt-Betrag</span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(parseFloat(ustBetrag))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Offen
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline" className="gap-2 flex-1">
                  <IconCar size={16} />
                  Weiteres anlegen
                </Button>
                <Button asChild className="gap-2 flex-1">
                  <a href="#/">
                    <IconCheck size={16} />
                    Zum Dashboard
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            /* Summary + Create state */
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">USt-Abführung anlegen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Prüfe alle Angaben und lege die USt-Abführung an.
                </p>
              </div>

              {/* Full summary */}
              <div className="rounded-xl border bg-card divide-y overflow-hidden">
                {/* Fahrzeug */}
                <div className="p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <IconCar size={14} />
                    Fahrzeug
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bezeichnung</span>
                    <span className="font-medium truncate ml-4">
                      {selectedFahrzeug?.fields.fahrzeug_bezeichnung ?? '—'}
                    </span>
                  </div>
                  {selectedFahrzeug?.fields.kennzeichen && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kennzeichen</span>
                      <span className="font-medium">{selectedFahrzeug.fields.kennzeichen}</span>
                    </div>
                  )}
                  {selectedFahrzeug?.fields.leasingrate_brutto != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Leasingrate</span>
                      <span className="font-medium">
                        {formatCurrency(selectedFahrzeug.fields.leasingrate_brutto)}/Monat
                      </span>
                    </div>
                  )}
                </div>

                {/* Zeitraum & Belegpositionen */}
                <div className="p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <IconFileInvoice size={14} />
                    Zeitraum & Belegpositionen
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">USt-Zeitraum</span>
                    <span className="font-medium">{ustZeitraum || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Eigenanteil-Belegposition</span>
                    <span className="font-medium truncate ml-4">
                      {selectedEigenanteilBeleg
                        ? getBelegpositionLabel(selectedEigenanteilBeleg)
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Belegposition Referenz</span>
                    <span className="font-medium truncate ml-4">
                      {selectedBelegposition
                        ? getBelegpositionLabel(selectedBelegposition)
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* USt-Berechnung */}
                <div className="p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <IconCalculator size={14} />
                    USt-Berechnung
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Privatnutzung Betrag</span>
                    <span className="font-medium">
                      {privatnutzungBetrag ? formatCurrency(parseFloat(privatnutzungBetrag)) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bemessungsgrundlage netto</span>
                    <span className="font-medium">
                      {bemessungsgrundlageNetto ? formatCurrency(parseFloat(bemessungsgrundlageNetto)) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">USt-Satz</span>
                    <span className="font-medium">{selectedUstSatzLabel || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">USt-Betrag</span>
                    <span className="font-semibold text-primary">
                      {ustBetrag ? formatCurrency(parseFloat(ustBetrag)) : '—'}
                    </span>
                  </div>
                  {buchungstext && (
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-muted-foreground shrink-0">Buchungstext</span>
                      <span className="font-medium text-right">{buchungstext}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Buchungsstatus</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Offen
                    </span>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                  <IconAlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Fehler beim Anlegen</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="gap-2"
                  disabled={submitting}
                >
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !selectedFahrzeugId || !ustZeitraum}
                  className="gap-2 flex-1"
                >
                  {submitting ? (
                    <>Wird angelegt...</>
                  ) : (
                    <>
                      <IconCheck size={16} />
                      Jetzt anlegen
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
