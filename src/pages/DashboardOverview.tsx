import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBelegerfassung, enrichKontierungUndPruefung, enrichBelegpositionen } from '@/lib/enrich';
import type { EnrichedBelegerfassung, EnrichedBelegpositionen } from '@/types/enriched';
import type { Belegerfassung, Belegpositionen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconFileText,
  IconReceipt, IconArrowRight, IconFileExport,
  IconListCheck, IconCoins,
} from '@tabler/icons-react';

const APPGROUP_ID = '69d8fb08e3301e990ee15c82';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Status-Farben für Verarbeitungsstatus
const STATUS_COLORS: Record<string, string> = {
  neu: 'bg-blue-100 text-blue-700 border-blue-200',
  in_bearbeitung: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  geprueft: 'bg-purple-100 text-purple-700 border-purple-200',
  freigegeben: 'bg-green-100 text-green-700 border-green-200',
  abgelehnt: 'bg-red-100 text-red-700 border-red-200',
};

const PLAUSIB_COLORS: Record<string, string> = {
  plausibel: 'bg-green-100 text-green-700 border-green-200',
  pruefung_erforderlich: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  nicht_plausibel: 'bg-red-100 text-red-700 border-red-200',
  nicht_geprueft: 'bg-gray-100 text-gray-600 border-gray-200',
};

// Workflow-Phasen als Kanban-Spalten
const WORKFLOW_PHASES = [
  { key: 'neu', label: 'Neu', icon: IconFileText },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', icon: IconListCheck },
  { key: 'geprueft', label: 'Geprüft', icon: IconCheck },
  { key: 'freigegeben', label: 'Freigegeben', icon: IconFileExport },
];

type DialogMode =
  | { type: 'create-beleg' }
  | { type: 'edit-beleg'; record: EnrichedBelegerfassung }
  | { type: 'create-position'; belegId: string }
  | { type: 'edit-position'; record: EnrichedBelegpositionen }
  | null;

export default function DashboardOverview() {
  const {
    belegerfassung, kontierungUndPruefung, belegpositionen,
    skr03KontenrahmenMap, belegerfassungMap, belegpositionenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBelegerfassung = enrichBelegerfassung(belegerfassung, { belegpositionenMap });
  const enrichedKontierungUndPruefung = enrichKontierungUndPruefung(kontierungUndPruefung, { belegpositionenMap, skr03KontenrahmenMap });
  const enrichedBelegpositionen = enrichBelegpositionen(belegpositionen, { belegerfassungMap });

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'beleg' | 'position'; id: string } | null>(null);
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(null);
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);

  // Positionen nach Beleg gruppiert
  const positionenByBeleg = useMemo(() => {
    const map = new Map<string, EnrichedBelegpositionen[]>();
    enrichedBelegpositionen.forEach(pos => {
      const belegId = extractRecordId(pos.fields.beleg_referenz);
      if (!belegId) return;
      if (!map.has(belegId)) map.set(belegId, []);
      map.get(belegId)!.push(pos);
    });
    return map;
  }, [enrichedBelegpositionen]);

  // KPIs
  const totalBrutto = useMemo(() =>
    enrichedBelegpositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0),
    [enrichedBelegpositionen]
  );
  const offeneKontierungen = useMemo(() =>
    enrichedKontierungUndPruefung.filter(k => k.fields.plausibilitaet?.key === 'pruefung_erforderlich' || k.fields.plausibilitaet?.key === 'nicht_geprueft').length,
    [enrichedKontierungUndPruefung]
  );
  const freigegebeneAnzahl = useMemo(() =>
    enrichedBelegerfassung.filter(b => b.fields.verarbeitungsstatus?.key === 'freigegeben').length,
    [enrichedBelegerfassung]
  );

  // Gefilterte Belege
  const filteredBelege = useMemo(() => {
    if (!activePhaseFilter) return enrichedBelegerfassung;
    return enrichedBelegerfassung.filter(b => b.fields.verarbeitungsstatus?.key === activePhaseFilter);
  }, [enrichedBelegerfassung, activePhaseFilter]);

  // Ausgewählter Beleg
  const selectedBeleg = useMemo(() =>
    selectedBelegId ? enrichedBelegerfassung.find(b => b.record_id === selectedBelegId) ?? null : null,
    [selectedBelegId, enrichedBelegerfassung]
  );
  const selectedPositionen = useMemo(() =>
    selectedBelegId ? (positionenByBeleg.get(selectedBelegId) ?? []) : [],
    [selectedBelegId, positionenByBeleg]
  );
  const selectedKontierungen = useMemo(() => {
    if (!selectedBelegId) return [];
    const posIds = new Set((positionenByBeleg.get(selectedBelegId) ?? []).map(p => p.record_id));
    return enrichedKontierungUndPruefung.filter(k => {
      const pid = extractRecordId(k.fields.position_referenz);
      return pid && posIds.has(pid);
    });
  }, [selectedBelegId, positionenByBeleg, enrichedKontierungUndPruefung]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'beleg') {
      await LivingAppsService.deleteBelegerfassungEntry(deleteTarget.id);
      if (selectedBelegId === deleteTarget.id) setSelectedBelegId(null);
    } else {
      await LivingAppsService.deleteBelegpositionenEntry(deleteTarget.id);
    }
    fetchAll();
    setDeleteTarget(null);
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* KPI-Zeile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Belege gesamt"
          value={String(enrichedBelegerfassung.length)}
          description="Erfasste Belege"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtvolumen"
          value={totalBrutto > 0 ? formatCurrency(totalBrutto) : '—'}
          description="Bruttobetrag aller Positionen"
          icon={<IconCoins size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offene Prüfungen"
          value={String(offeneKontierungen)}
          description="Kontierungen ausstehend"
          icon={<IconListCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Freigegeben"
          value={String(freigegebeneAnzahl)}
          description="Bereit für Export"
          icon={<IconFileExport size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Pipeline-Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Beleg-Pipeline</h2>
          <p className="text-sm text-muted-foreground">Belege nach Verarbeitungsstatus</p>
        </div>
        <Button size="sm" onClick={() => setDialogMode({ type: 'create-beleg' })}>
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Neuer Beleg
        </Button>
      </div>

      {/* Status-Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActivePhaseFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            !activePhaseFilter
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          Alle ({enrichedBelegerfassung.length})
        </button>
        {WORKFLOW_PHASES.map(phase => {
          const count = enrichedBelegerfassung.filter(b => b.fields.verarbeitungsstatus?.key === phase.key).length;
          return (
            <button
              key={phase.key}
              onClick={() => setActivePhaseFilter(activePhaseFilter === phase.key ? null : phase.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activePhaseFilter === phase.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {phase.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Hauptbereich: Belegliste + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        {/* Belegliste */}
        <div className="lg:col-span-2 space-y-2 overflow-x-auto">
          {filteredBelege.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-border">
              <IconReceipt size={40} stroke={1.5} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">Keine Belege vorhanden</p>
              <Button size="sm" variant="outline" onClick={() => setDialogMode({ type: 'create-beleg' })}>
                <IconPlus size={14} className="mr-1" />Beleg erfassen
              </Button>
            </div>
          ) : (
            filteredBelege.map(beleg => {
              const statusKey = beleg.fields.verarbeitungsstatus?.key ?? 'neu';
              const statusLabel = beleg.fields.verarbeitungsstatus?.label ?? 'Neu';
              const colorClass = STATUS_COLORS[statusKey] ?? STATUS_COLORS.neu;
              const posCount = positionenByBeleg.get(beleg.record_id)?.length ?? 0;
              const isSelected = selectedBelegId === beleg.record_id;
              return (
                <div
                  key={beleg.record_id}
                  onClick={() => setSelectedBelegId(isSelected ? null : beleg.record_id)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all overflow-hidden ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {beleg.fields.belegtyp?.label ?? 'Beleg'}
                        </span>
                        <Badge className={`text-xs border shrink-0 ${colorClass}`} variant="outline">
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {beleg.fields.beleg_bemerkung ?? '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>{formatDate(beleg.fields.upload_datum)}</span>
                        <span>{posCount} Position{posCount !== 1 ? 'en' : ''}</span>
                        {beleg.fields.dokumentklassifikation && (
                          <span className="truncate">{beleg.fields.dokumentklassifikation.label}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setDialogMode({ type: 'edit-beleg', record: beleg }); }}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        title="Bearbeiten"
                      >
                        <IconPencil size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'beleg', id: beleg.record_id }); }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Löschen"
                      >
                        <IconTrash size={14} className="text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center text-xs text-primary font-medium">
                      <span>Details anzeigen</span>
                      <IconArrowRight size={12} className="ml-1" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail-Panel */}
        <div className="lg:col-span-3">
          {!selectedBeleg ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] rounded-2xl border border-dashed border-border gap-3">
              <IconFileText size={40} stroke={1.5} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Wähle einen Beleg aus der Liste, um Details und Positionen anzuzeigen.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Beleg-Header */}
              <div className="px-5 py-4 border-b border-border bg-accent/20">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">
                        {selectedBeleg.fields.belegtyp?.label ?? 'Beleg'}
                      </h3>
                      <Badge
                        className={`text-xs border shrink-0 ${STATUS_COLORS[selectedBeleg.fields.verarbeitungsstatus?.key ?? 'neu'] ?? STATUS_COLORS.neu}`}
                        variant="outline"
                      >
                        {selectedBeleg.fields.verarbeitungsstatus?.label ?? 'Neu'}
                      </Badge>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Hochgeladen: {formatDate(selectedBeleg.fields.upload_datum)}</span>
                      {selectedBeleg.fields.ocr_status && (
                        <span>OCR: {selectedBeleg.fields.ocr_status.label}</span>
                      )}
                    </div>
                    {selectedBeleg.fields.beleg_bemerkung && (
                      <p className="text-sm text-foreground mt-1">{selectedBeleg.fields.beleg_bemerkung}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setDialogMode({ type: 'create-position', belegId: selectedBeleg.record_id })}
                  >
                    <IconPlus size={14} className="mr-1 shrink-0" />
                    Position
                  </Button>
                </div>
              </div>

              {/* Positionen */}
              <div className="p-4 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Belegpositionen ({selectedPositionen.length})
                </h4>
                {selectedPositionen.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2 rounded-xl border border-dashed border-border">
                    <IconReceipt size={28} stroke={1.5} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Noch keine Positionen</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialogMode({ type: 'create-position', belegId: selectedBeleg.record_id })}
                    >
                      <IconPlus size={13} className="mr-1" />Position hinzufügen
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left pb-2 font-medium">Rechnungssteller</th>
                          <th className="text-left pb-2 font-medium">Datum</th>
                          <th className="text-right pb-2 font-medium">Brutto</th>
                          <th className="text-left pb-2 font-medium">MwSt</th>
                          <th className="pb-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPositionen.map(pos => {
                          const kontierung = selectedKontierungen.find(k => extractRecordId(k.fields.position_referenz) === pos.record_id);
                          const plausKey = kontierung?.fields.plausibilitaet?.key ?? 'nicht_geprueft';
                          return (
                            <tr key={pos.record_id} className="border-b border-border/50 last:border-0 hover:bg-accent/20 transition-colors">
                              <td className="py-2 pr-2">
                                <div className="min-w-0">
                                  <p className="font-medium truncate max-w-[160px]">{pos.fields.rechnungssteller ?? '—'}</p>
                                  {pos.fields.rechnungsnummer && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{pos.fields.rechnungsnummer}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                                {formatDate(pos.fields.rechnungsdatum)}
                              </td>
                              <td className="py-2 pr-2 text-right font-medium whitespace-nowrap">
                                {pos.fields.betrag_brutto != null ? formatCurrency(pos.fields.betrag_brutto) : '—'}
                              </td>
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-1">
                                  {pos.fields.mwst_satz && (
                                    <span className="text-xs text-muted-foreground">{pos.fields.mwst_satz.label}</span>
                                  )}
                                  {kontierung && (
                                    <Badge
                                      className={`text-xs border ml-1 shrink-0 ${PLAUSIB_COLORS[plausKey] ?? PLAUSIB_COLORS.nicht_geprueft}`}
                                      variant="outline"
                                    >
                                      {kontierung.fields.plausibilitaet?.label ?? 'Nicht geprüft'}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setDialogMode({ type: 'edit-position', record: pos })}
                                    className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                                    title="Bearbeiten"
                                  >
                                    <IconPencil size={13} className="text-muted-foreground" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget({ type: 'position', id: pos.record_id })}
                                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                                    title="Löschen"
                                  >
                                    <IconTrash size={13} className="text-muted-foreground hover:text-destructive" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {selectedPositionen.length > 0 && (
                        <tfoot>
                          <tr className="border-t border-border">
                            <td colSpan={2} className="pt-2 text-xs text-muted-foreground font-medium">Gesamt</td>
                            <td className="pt-2 text-right font-semibold">
                              {formatCurrency(selectedPositionen.reduce((s, p) => s + (p.fields.betrag_brutto ?? 0), 0))}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>

              {/* Kontierungs-Zusammenfassung */}
              {selectedKontierungen.length > 0 && (
                <div className="px-5 pb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Kontierungen ({selectedKontierungen.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedKontierungen.map(k => (
                      <div key={k.record_id} className="flex items-center justify-between gap-2 text-sm bg-accent/30 rounded-lg px-3 py-2 flex-wrap">
                        <span className="text-muted-foreground truncate">
                          Konto: <span className="font-medium text-foreground">{k.skr03_konto_referenzName || '—'}</span>
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {k.fields.konfidenz != null && (
                            <span className="text-xs text-muted-foreground">
                              Konfidenz: {Math.round(k.fields.konfidenz * 100)}%
                            </span>
                          )}
                          {k.fields.plausibilitaet && (
                            <Badge
                              className={`text-xs border shrink-0 ${PLAUSIB_COLORS[k.fields.plausibilitaet.key] ?? PLAUSIB_COLORS.nicht_geprueft}`}
                              variant="outline"
                            >
                              {k.fields.plausibilitaet.label}
                            </Badge>
                          )}
                          {k.fields.manuell_korrigiert && (
                            <Badge className="text-xs border shrink-0 bg-blue-100 text-blue-700 border-blue-200" variant="outline">
                              Manuell
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialoge */}
      <BelegerfassungDialog
        open={dialogMode?.type === 'create-beleg' || dialogMode?.type === 'edit-beleg'}
        onClose={() => setDialogMode(null)}
        onSubmit={async (fields) => {
          if (dialogMode?.type === 'edit-beleg') {
            await LivingAppsService.updateBelegerfassungEntry(dialogMode.record.record_id, fields);
          } else {
            await LivingAppsService.createBelegerfassungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={dialogMode?.type === 'edit-beleg' ? dialogMode.record.fields : undefined}
        belegpositionenList={belegpositionen}
        enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Belegerfassung']}
      />

      <BelegpositionenDialog
        open={dialogMode?.type === 'create-position' || dialogMode?.type === 'edit-position'}
        onClose={() => setDialogMode(null)}
        onSubmit={async (fields) => {
          if (dialogMode?.type === 'edit-position') {
            await LivingAppsService.updateBelegpositionenEntry(dialogMode.record.record_id, fields);
          } else if (dialogMode?.type === 'create-position') {
            const belegUrl = createRecordUrl(APP_IDS.BELEGERFASSUNG, dialogMode.belegId);
            await LivingAppsService.createBelegpositionenEntry({ ...fields, beleg_referenz: belegUrl });
          }
          fetchAll();
        }}
        defaultValues={
          dialogMode?.type === 'edit-position'
            ? dialogMode.record.fields
            : dialogMode?.type === 'create-position'
            ? { beleg_referenz: createRecordUrl(APP_IDS.BELEGERFASSUNG, dialogMode.belegId) }
            : undefined
        }
        belegerfassungList={belegerfassung}
        enablePhotoScan={AI_PHOTO_SCAN['Belegpositionen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Belegpositionen']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'beleg' ? 'Beleg löschen' : 'Position löschen'}
        description={
          deleteTarget?.type === 'beleg'
            ? 'Diesen Beleg und alle zugehörigen Daten wirklich löschen?'
            : 'Diese Belegposition wirklich löschen?'
        }
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="lg:col-span-3">
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
