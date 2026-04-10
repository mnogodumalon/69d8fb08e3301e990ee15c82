import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { ExportUndAusgabeDialog } from '@/components/dialogs/ExportUndAusgabeDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { ExportUndAusgabe, Belegerfassung } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IconDownload,
  IconCalendar,
  IconFileText,
  IconCheck,
  IconRefresh,
  IconAlertTriangle,
  IconClockHour4,
  IconCircleCheck,
  IconEdit,
  IconPlus,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Konfigurieren' },
  { label: 'Belege prüfen' },
  { label: 'Abschließen' },
];

const EXPORTFORMAT_OPTIONS = LOOKUP_OPTIONS['export_und_ausgabe']?.exportformat ?? [
  { key: 'csv', label: 'CSV-Datei' },
  { key: 'elster_extf', label: 'ELSTER / DATEV EXTF' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isDateInRange(dateStr: string | undefined, von: string, bis: string): boolean {
  if (!dateStr) return false;
  const date = dateStr.slice(0, 10); // normalize to YYYY-MM-DD
  return date >= von && date <= bis;
}

export default function ExportWorkflowPage() {
  const [searchParams] = useSearchParams();

  // Step state — read from URL on mount via IntentWizardShell
  const initialStep = parseInt(searchParams.get('step') ?? '1', 10);
  const [step, setStep] = useState(isNaN(initialStep) || initialStep < 1 || initialStep > 3 ? 1 : initialStep);

  // Step 1 form state
  const [bezeichnung, setBezeichnung] = useState('');
  const [zeitraumVon, setZeitraumVon] = useState('');
  const [zeitraumBis, setZeitraumBis] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 state
  const [proceedWithWarning, setProceedWithWarning] = useState(false);

  // Step 3 state
  const [createdExport, setCreatedExport] = useState<ExportUndAusgabe | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { exportUndAusgabe, belegerfassung, loading, error, fetchAll } = useDashboardData();

  // Belege filtered by date range
  const filteredBelege = useMemo<Belegerfassung[]>(() => {
    if (!zeitraumVon || !zeitraumBis) return [];
    return belegerfassung.filter(b => isDateInRange(b.fields.upload_datum, zeitraumVon, zeitraumBis));
  }, [belegerfassung, zeitraumVon, zeitraumBis]);

  const belegeAbgeschlossen = filteredBelege.filter(
    b => b.fields.verarbeitungsstatus?.key === 'abgeschlossen'
  ).length;
  const belegeInBearbeitung = filteredBelege.length - belegeAbgeschlossen;
  const hasUnfinishedBelege = belegeInBearbeitung > 0;

  // Recent exports (last 5)
  const recentExports = useMemo<ExportUndAusgabe[]>(() => {
    return [...exportUndAusgabe]
      .sort((a, b) => {
        const ta = a.createdat ?? '';
        const tb = b.createdat ?? '';
        return tb.localeCompare(ta);
      })
      .slice(0, 5);
  }, [exportUndAusgabe]);

  function toggleFormat(key: string) {
    setSelectedFormats(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  function handleStep1Next() {
    setStep1Error(null);
    if (!bezeichnung.trim()) {
      setStep1Error('Bitte gib eine Exportbezeichnung ein.');
      return;
    }
    if (!zeitraumVon || !zeitraumBis) {
      setStep1Error('Bitte wähle einen Zeitraum aus.');
      return;
    }
    if (zeitraumVon > zeitraumBis) {
      setStep1Error('"Zeitraum von" darf nicht nach "Zeitraum bis" liegen.');
      return;
    }
    if (selectedFormats.length === 0) {
      setStep1Error('Bitte wähle mindestens ein Exportformat aus.');
      return;
    }
    setStep(2);
  }

  async function handleCreateExport() {
    setCreating(true);
    setCreateError(null);
    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const exportdatum = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

      await LivingAppsService.createExportUndAusgabeEntry({
        export_bezeichnung: bezeichnung,
        zeitraum_von: zeitraumVon,
        zeitraum_bis: zeitraumBis,
        exportformat: selectedFormats,
        exportstatus: 'in_bearbeitung',
        exportdatum,
      });

      await fetchAll();

      // Find the just-created record (most recent)
      const refreshed = await LivingAppsService.getExportUndAusgabe();
      const sorted = [...refreshed].sort((a, b) =>
        (b.createdat ?? '').localeCompare(a.createdat ?? '')
      );
      const found = sorted.find(e => e.fields.export_bezeichnung === bezeichnung) ?? sorted[0] ?? null;
      setCreatedExport(found);
      setStep(3);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Export konnte nicht erstellt werden.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(status: 'abgeschlossen' | 'fehler') {
    if (!createdExport) return;
    setUpdatingStatus(true);
    try {
      await LivingAppsService.updateExportUndAusgabeEntry(createdExport.record_id, {
        exportstatus: status,
      });
      await fetchAll();
      setCreatedExport(prev => prev ? {
        ...prev,
        fields: { ...prev.fields, exportstatus: { key: status, label: status === 'abgeschlossen' ? 'Abgeschlossen' : 'Fehler' } },
      } : prev);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function handleReset() {
    setBezeichnung('');
    setZeitraumVon('');
    setZeitraumBis('');
    setSelectedFormats([]);
    setStep1Error(null);
    setProceedWithWarning(false);
    setCreatedExport(null);
    setCreateError(null);
    setStep(1);
  }

  return (
    <IntentWizardShell
      title="Export erstellen"
      subtitle="Buchhaltungsdaten exportieren – Schritt für Schritt"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Konfigurieren ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Config card */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-secondary/30">
              <div className="flex items-center gap-2">
                <IconDownload size={18} className="text-primary shrink-0" stroke={2} />
                <h2 className="font-semibold text-foreground">Export konfigurieren</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Lege Bezeichnung, Zeitraum und Format für deinen Export fest.
              </p>
            </div>
            <div className="p-5 space-y-5">
              {/* Bezeichnung */}
              <div className="space-y-1.5">
                <Label htmlFor="export_bezeichnung">Exportbezeichnung</Label>
                <Input
                  id="export_bezeichnung"
                  placeholder="z. B. Buchhaltung Q1 2026"
                  value={bezeichnung}
                  onChange={e => setBezeichnung(e.target.value)}
                />
              </div>

              {/* Zeitraum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="zeitraum_von">
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={14} stroke={2} />
                      Zeitraum von
                    </span>
                  </Label>
                  <Input
                    id="zeitraum_von"
                    type="date"
                    value={zeitraumVon}
                    onChange={e => setZeitraumVon(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zeitraum_bis">
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={14} stroke={2} />
                      Zeitraum bis
                    </span>
                  </Label>
                  <Input
                    id="zeitraum_bis"
                    type="date"
                    value={zeitraumBis}
                    onChange={e => setZeitraumBis(e.target.value)}
                  />
                </div>
              </div>

              {/* Exportformat */}
              <div className="space-y-2">
                <Label>Exportformat</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXPORTFORMAT_OPTIONS.map(opt => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-3 rounded-xl border bg-secondary/20 px-4 py-3 cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedFormats.includes(opt.key)}
                        onCheckedChange={() => toggleFormat(opt.key)}
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Validation error */}
              {step1Error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <IconAlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" stroke={2} />
                  <p className="text-sm text-destructive">{step1Error}</p>
                </div>
              )}

              <Button className="w-full" onClick={handleStep1Next}>
                Weiter zu Schritt 2
              </Button>
            </div>
          </div>

          {/* Recent exports reference */}
          {recentExports.length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-sm text-foreground">Zuletzt erstellte Exporte</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Zur Orientierung – diese Exporte wurden bereits erstellt.</p>
              </div>
              <ul className="divide-y">
                {recentExports.map(exp => (
                  <li key={exp.record_id} className="flex items-center gap-3 px-5 py-3 min-w-0">
                    <IconFileText size={16} className="text-muted-foreground shrink-0" stroke={1.5} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {exp.fields.export_bezeichnung ?? '–'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(exp.fields.zeitraum_von)} – {formatDate(exp.fields.zeitraum_bis)}
                      </p>
                    </div>
                    <StatusBadge
                      statusKey={exp.fields.exportstatus?.key}
                      label={exp.fields.exportstatus?.label}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Belege prüfen ── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary header */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-secondary/30">
              <div className="flex items-center gap-2">
                <IconFileText size={18} className="text-primary shrink-0" stroke={2} />
                <h2 className="font-semibold text-foreground">Belege prüfen</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Zeitraum: {formatDate(zeitraumVon)} – {formatDate(zeitraumBis)}
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-secondary/30 px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{filteredBelege.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Belege gefunden</p>
                </div>
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{belegeAbgeschlossen}</p>
                  <p className="text-xs text-green-600 mt-0.5">Abgeschlossen</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{belegeInBearbeitung}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Noch in Bearbeitung</p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning for unfinished belege */}
          {hasUnfinishedBelege && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-3">
              <div className="flex items-start gap-2">
                <IconAlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" stroke={2} />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {belegeInBearbeitung} {belegeInBearbeitung === 1 ? 'Beleg ist' : 'Belege sind'} noch nicht abgeschlossen
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Du kannst trotzdem fortfahren, aber der Export enthält möglicherweise unvollständige Daten.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={proceedWithWarning}
                  onCheckedChange={v => setProceedWithWarning(!!v)}
                />
                <span className="text-sm text-amber-800">Trotzdem fortfahren</span>
              </label>
            </div>
          )}

          {/* Belege list */}
          {filteredBelege.length === 0 ? (
            <div className="rounded-2xl border bg-card shadow-sm px-5 py-10 text-center">
              <IconFileText size={32} className="text-muted-foreground mx-auto mb-3" stroke={1} />
              <p className="font-medium text-foreground">Keine Belege im Zeitraum gefunden</p>
              <p className="text-sm text-muted-foreground mt-1">
                Im gewählten Zeitraum wurden keine Belegerfassungen mit einem Upload-Datum gefunden.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h3 className="font-semibold text-sm">{filteredBelege.length} Belege im Zeitraum</h3>
              </div>
              <ul className="divide-y max-h-80 overflow-y-auto">
                {filteredBelege.map(beleg => (
                  <li key={beleg.record_id} className="flex items-start gap-3 px-5 py-3 min-w-0">
                    <IconFileText size={16} className="text-muted-foreground shrink-0 mt-0.5" stroke={1.5} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {beleg.fields.belegtyp?.label ?? 'Unbekannter Belegtyp'}
                        </p>
                        <StatusBadge
                          statusKey={beleg.fields.verarbeitungsstatus?.key}
                          label={beleg.fields.verarbeitungsstatus?.label}
                        />
                        <StatusBadge
                          statusKey={beleg.fields.ocr_status?.key}
                          label={beleg.fields.ocr_status?.label}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload: {formatDate(beleg.fields.upload_datum)}
                      </p>
                    </div>
                    {beleg.fields.verarbeitungsstatus?.key === 'abgeschlossen' ? (
                      <IconCircleCheck size={16} className="text-green-500 shrink-0 mt-0.5" stroke={2} />
                    ) : (
                      <IconClockHour4 size={16} className="text-amber-500 shrink-0 mt-0.5" stroke={2} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Zurück
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateExport}
              disabled={creating || (hasUnfinishedBelege && !proceedWithWarning)}
            >
              {creating ? (
                <>
                  <IconRefresh size={16} className="mr-2 animate-spin" stroke={2} />
                  Export wird erstellt...
                </>
              ) : (
                <>
                  <IconDownload size={16} className="mr-2" stroke={2} />
                  Export erstellen
                </>
              )}
            </Button>
          </div>

          {createError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-2">
              <IconAlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" stroke={2} />
              <p className="text-sm text-destructive">{createError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Abschließen ── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="rounded-2xl border bg-green-50 border-green-200 shadow-sm overflow-hidden">
            <div className="px-5 py-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <IconCheck size={20} className="text-green-600" stroke={2.5} />
              </div>
              <div>
                <p className="font-semibold text-green-800">Export erfolgreich erstellt!</p>
                <p className="text-sm text-green-600 mt-0.5">
                  Der Export wurde angelegt und kann jetzt weiterverarbeitet werden.
                </p>
              </div>
            </div>
          </div>

          {/* Export details */}
          {createdExport && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-secondary/30">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground truncate">
                    {createdExport.fields.export_bezeichnung ?? bezeichnung}
                  </h2>
                  <StatusBadge
                    statusKey={createdExport.fields.exportstatus?.key}
                    label={createdExport.fields.exportstatus?.label}
                  />
                </div>
              </div>
              <dl className="divide-y">
                <div className="flex items-center gap-4 px-5 py-3 min-w-0">
                  <dt className="text-sm text-muted-foreground w-32 shrink-0">Zeitraum</dt>
                  <dd className="text-sm font-medium truncate">
                    {formatDate(createdExport.fields.zeitraum_von)} – {formatDate(createdExport.fields.zeitraum_bis)}
                  </dd>
                </div>
                <div className="flex items-center gap-4 px-5 py-3 min-w-0">
                  <dt className="text-sm text-muted-foreground w-32 shrink-0">Exportformat</dt>
                  <dd className="flex flex-wrap gap-1">
                    {Array.isArray(createdExport.fields.exportformat)
                      ? createdExport.fields.exportformat.map(f => (
                          <span key={typeof f === 'string' ? f : f.key} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border">
                            {typeof f === 'string' ? f : f.label}
                          </span>
                        ))
                      : selectedFormats.map(k => {
                          const opt = EXPORTFORMAT_OPTIONS.find(o => o.key === k);
                          return (
                            <span key={k} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border">
                              {opt?.label ?? k}
                            </span>
                          );
                        })
                    }
                  </dd>
                </div>
                <div className="flex items-center gap-4 px-5 py-3 min-w-0">
                  <dt className="text-sm text-muted-foreground w-32 shrink-0">Exportdatum</dt>
                  <dd className="text-sm font-medium truncate">
                    {formatDateTime(createdExport.fields.exportdatum)}
                  </dd>
                </div>
                <div className="flex items-center gap-4 px-5 py-3 min-w-0">
                  <dt className="text-sm text-muted-foreground w-32 shrink-0">Belege</dt>
                  <dd className="text-sm font-medium">
                    {filteredBelege.length} Belege im Zeitraum
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Status update */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">Exportstatus aktualisieren</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Markiere den Export als abgeschlossen oder fehlgeschlagen.
              </p>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                disabled={updatingStatus || createdExport?.fields.exportstatus?.key === 'abgeschlossen'}
                onClick={() => handleUpdateStatus('abgeschlossen')}
              >
                <IconCircleCheck size={16} className="mr-2" stroke={2} />
                Als abgeschlossen markieren
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                disabled={updatingStatus || createdExport?.fields.exportstatus?.key === 'fehler'}
                onClick={() => handleUpdateStatus('fehler')}
              >
                <IconAlertTriangle size={16} className="mr-2" stroke={2} />
                Als fehlgeschlagen markieren
              </Button>
            </div>
          </div>

          {/* Edit dialog button */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Details bearbeiten</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Öffne den vollständigen Export-Editor, um alle Felder zu bearbeiten.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => setEditDialogOpen(true)}
                disabled={!createdExport}
              >
                <IconEdit size={16} className="mr-2" stroke={2} />
                Export bearbeiten
              </Button>
            </div>
          </div>

          {/* Reset button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              <IconPlus size={16} className="mr-2" stroke={2} />
              Neuen Export starten
            </Button>
          </div>

          {/* Edit dialog */}
          {createdExport && (
            <ExportUndAusgabeDialog
              open={editDialogOpen}
              onClose={() => setEditDialogOpen(false)}
              onSubmit={async (fields) => {
                await LivingAppsService.updateExportUndAusgabeEntry(createdExport.record_id, fields);
                await fetchAll();
                const refreshed = await LivingAppsService.getExportUndAusgabeEntry(createdExport.record_id);
                if (refreshed) setCreatedExport(refreshed);
                setEditDialogOpen(false);
              }}
              defaultValues={createdExport.fields}
            />
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
