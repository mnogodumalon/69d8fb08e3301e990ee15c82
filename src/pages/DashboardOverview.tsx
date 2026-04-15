import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBelegerfassung, enrichBelegpositionen } from '@/lib/enrich';
import type { EnrichedBelegerfassung, EnrichedBelegpositionen } from '@/types/enriched';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconFileInvoice,
  IconClockHour4, IconCheckbox, IconCircleCheck, IconBan,
  IconSearch, IconX, IconChevronRight, IconListCheck, IconCar,
  IconReceipt, IconEdit, IconClipboardCheck, IconCalculator, IconArrowRight,
  IconInfoCircle, IconReceipt2,
} from '@tabler/icons-react';

const APPGROUP_ID = '69d8fb08e3301e990ee15c82';
const REPAIR_ENDPOINT = '/claude/build/repair';

type VerarbeitungsStatus = 'neu' | 'in_bearbeitung' | 'geprueft' | 'freigegeben' | 'abgelehnt';

const STATUS_CONFIG: Record<VerarbeitungsStatus, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  neu: { label: 'Neu', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: <IconFileInvoice size={14} className="shrink-0" /> },
  in_bearbeitung: { label: 'In Bearbeitung', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: <IconClockHour4 size={14} className="shrink-0" /> },
  geprueft: { label: 'Geprüft', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', icon: <IconCheckbox size={14} className="shrink-0" /> },
  freigegeben: { label: 'Freigegeben', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: <IconCircleCheck size={14} className="shrink-0" /> },
  abgelehnt: { label: 'Abgelehnt', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: <IconBan size={14} className="shrink-0" /> },
};

const ALL_STATUSES: VerarbeitungsStatus[] = ['neu', 'in_bearbeitung', 'geprueft', 'freigegeben', 'abgelehnt'];

export default function DashboardOverview() {
  const {
    belegerfassung, belegpositionen,
    belegpositionenMap, ustAbfuehrungLeasingfahrzeugMap, belegerfassungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  // All hooks BEFORE early returns
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<EnrichedBelegerfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedBelegerfassung | null>(null);
  const [activeStatus, setActiveStatus] = useState<VerarbeitungsStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(null);

  const enrichedBelegerfassung = useMemo(
    () => enrichBelegerfassung(belegerfassung, { belegpositionenMap }),
    [belegerfassung, belegpositionenMap]
  );

  const enrichedBelegpositionen = useMemo(
    () => enrichBelegpositionen(belegpositionen, { ustAbfuehrungLeasingfahrzeugMap, belegerfassungMap }),
    [belegpositionen, ustAbfuehrungLeasingfahrzeugMap, belegerfassungMap]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of enrichedBelegerfassung) {
      const key = b.fields.verarbeitungsstatus?.key ?? 'neu';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [enrichedBelegerfassung]);

  const totalBrutto = useMemo(
    () => enrichedBelegpositionen.reduce((s, p) => s + (p.fields.betrag_brutto ?? 0), 0),
    [enrichedBelegpositionen]
  );

  const totalNetto = useMemo(
    () => enrichedBelegpositionen.reduce((s, p) => s + (p.fields.betrag_netto ?? 0), 0),
    [enrichedBelegpositionen]
  );

  const filtered = useMemo(() => {
    let list = enrichedBelegerfassung;
    if (activeStatus) {
      list = list.filter(b => (b.fields.verarbeitungsstatus?.key ?? 'neu') === activeStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        (b.fields.belegtyp?.label ?? '').toLowerCase().includes(q) ||
        (b.fields.beleg_bemerkung ?? '').toLowerCase().includes(q) ||
        (b.fields.verarbeitungsstatus?.label ?? '').toLowerCase().includes(q) ||
        (b.fields.upload_datum ?? '').includes(q)
      );
    }
    return list.sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''));
  }, [enrichedBelegerfassung, activeStatus, searchQuery]);

  const selectedBeleg = useMemo(
    () => enrichedBelegerfassung.find(b => b.record_id === selectedBelegId) ?? null,
    [enrichedBelegerfassung, selectedBelegId]
  );

  const selectedPositionen = useMemo((): EnrichedBelegpositionen[] => {
    if (!selectedBelegId) return [];
    return enrichedBelegpositionen.filter(
      p => extractRecordId(p.fields.beleg_referenz) === selectedBelegId
    );
  }, [enrichedBelegpositionen, selectedBelegId]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteBelegerfassungEntry(deleteTarget.record_id);
    if (selectedBelegId === deleteTarget.record_id) setSelectedBelegId(null);
    setDeleteTarget(null);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      {/* Workflow-Prozesse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Workflow 1: Belegerfassung */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconListCheck size={18} className="text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Beleg erfassen &amp; kontieren</span>
          </div>
          <div className="flex flex-col gap-1">
            <ProcessStep
              label="Beleg erfassen"
              href="#/belegerfassung"
              icon={<IconReceipt size={14} className="shrink-0" />}
              hasArrow
            />
            <ProcessStep
              label="Positionen überarbeiten oder neu erfassen"
              href="#/belegpositionen"
              icon={<IconEdit size={14} className="shrink-0" />}
              hasArrow
            />
            <ProcessStep
              label="Kontierung prüfen"
              href="#/kontierung-und-pruefung"
              icon={<IconClipboardCheck size={14} className="shrink-0" />}
            />
          </div>
        </div>

        {/* Workflow 2: KFZ Leasing */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconCar size={18} className="text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">KFZ Leasing bearbeiten</span>
          </div>
          <div className="flex flex-col gap-1">
            <ProcessStep
              label="KFZ Leasing bearbeiten"
              href="#/leasingfahrzeug"
              icon={<IconCar size={14} className="shrink-0" />}
              hasArrow
            />
            <ProcessStep
              label="Positionen überarbeiten oder neu erfassen"
              href="#/belegpositionen"
              icon={<IconEdit size={14} className="shrink-0" />}
              hasArrow
            />
            <ProcessStep
              label="Berechnung des UST-Betrages für die UST-Voranmeldung"
              href="#/ust-abfuehrung-leasingfahrzeug"
              icon={<IconCalculator size={14} className="shrink-0" />}
              hasArrow
            />
            <ProcessStep
              label="Berechnung der zu zahlenden UST des Eigenanteils wg. 1%-Regel"
              href="#/ust-abfuehrung-leasingfahrzeug"
              icon={<IconCalculator size={14} className="shrink-0" />}
            />
          </div>
        </div>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title="Belege gesamt"
          value={String(enrichedBelegerfassung.length)}
          description="Erfasste Belege"
          icon={<IconFileInvoice size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtvolumen brutto"
          value={totalBrutto > 0 ? formatCurrency(totalBrutto) : '—'}
          description="Brutto aller Positionen"
          icon={<IconReceipt2 size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtvolumen netto"
          value={totalNetto > 0 ? formatCurrency(totalNetto) : '—'}
          description="Netto aller Positionen"
          icon={<IconCalculator size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Status-Pipeline */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Verarbeitungs-Pipeline</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStatus(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              activeStatus === null
                ? 'bg-foreground text-background border-foreground'
                : 'bg-muted text-muted-foreground border-border hover:bg-accent'
            }`}
          >
            Alle
            <span className="font-bold">{enrichedBelegerfassung.length}</span>
          </button>
          {ALL_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status];
            const count = statusCounts[status] ?? 0;
            const isActive = activeStatus === status;
            return (
              <button
                key={status}
                onClick={() => setActiveStatus(isActive ? null : status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  isActive
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                }`}
              >
                {cfg.icon}
                {cfg.label}
                <span className={`font-bold ${isActive ? cfg.color : ''}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split-Panel: Belegliste + Detail/Positionen */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground shrink-0">
            Belege
            {activeStatus && (
              <span className={`ml-2 text-xs font-normal ${STATUS_CONFIG[activeStatus].color}`}>
                — {STATUS_CONFIG[activeStatus].label}
              </span>
            )}
          </h2>
          <div className="flex gap-2 flex-wrap items-center min-w-0">
            <div className="relative flex items-center min-w-0">
              <IconSearch size={14} className="absolute left-2.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 text-muted-foreground hover:text-foreground">
                  <IconX size={12} />
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Beleg erfassen</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          </div>
        </div>

        {/* Split layout */}
        <div className="flex min-h-0" style={{ height: filtered.length === 0 ? undefined : '480px' }}>
          {/* Linke Spalte: Belegliste */}
          <div className={`flex flex-col overflow-y-auto border-r border-border ${selectedBelegId ? 'w-2/5 min-w-0' : 'w-full'}`}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <IconFileInvoice size={48} stroke={1.5} />
                <p className="text-sm">
                  {searchQuery || activeStatus ? 'Keine Belege gefunden.' : 'Noch keine Belege erfasst.'}
                </p>
                {!searchQuery && !activeStatus && (
                  <Button size="sm" variant="outline" onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
                    <IconPlus size={14} className="mr-1" /> Ersten Beleg erfassen
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(beleg => {
                  const statusKey = (beleg.fields.verarbeitungsstatus?.key ?? 'neu') as VerarbeitungsStatus;
                  const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.neu;
                  const isSelected = beleg.record_id === selectedBelegId;

                  return (
                    <div
                      key={beleg.record_id}
                      onClick={() => setSelectedBelegId(isSelected ? null : beleg.record_id)}
                      className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/8 border-l-2 border-primary' : 'hover:bg-muted/40'
                      }`}
                    >
                      {/* Status-Indikator */}
                      <div className={`mt-0.5 flex items-center justify-center w-6 h-6 rounded-md border shrink-0 ${cfg.bg}`}>
                        <span className={cfg.color}>{cfg.icon}</span>
                      </div>

                      {/* Inhalt */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {beleg.fields.beleg_bemerkung
                              ? beleg.fields.beleg_bemerkung
                              : <span className="text-muted-foreground font-normal italic">Keine Bemerkung</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground truncate">
                            {beleg.fields.belegtyp?.label ?? '—'}
                          </span>
                          {beleg.fields.upload_datum && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatDate(beleg.fields.upload_datum)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Aktionen */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setEditRecord(beleg); setDialogOpen(true); }}
                          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Bearbeiten"
                        >
                          <IconPencil size={12} className="shrink-0" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(beleg); }}
                          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Löschen"
                        >
                          <IconTrash size={12} className="shrink-0" />
                        </button>
                        <IconChevronRight size={12} className={`shrink-0 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rechte Spalte: Positionen oder Belegdetails */}
          {selectedBelegId && selectedBeleg && (
            <div className="flex-1 min-w-0 overflow-y-auto">
              {selectedPositionen.length > 0 ? (
                /* Positionen */
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconReceipt2 size={15} className="text-primary shrink-0" />
                    <h3 className="text-xs font-semibold text-foreground">
                      Positionen ({selectedPositionen.length})
                    </h3>
                    <span className="text-[11px] text-muted-foreground truncate">
                      — {selectedBeleg.fields.beleg_bemerkung ?? selectedBeleg.fields.belegtyp?.label ?? 'Beleg'}
                    </span>
                  </div>
                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {selectedPositionen.map((pos, idx) => (
                      <div key={pos.record_id} className="px-3 py-2.5 hover:bg-muted/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] text-muted-foreground font-medium">#{idx + 1}</span>
                              {pos.fields.rechnungssteller && (
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {pos.fields.rechnungssteller}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {pos.fields.rechnungsdatum && (
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDate(pos.fields.rechnungsdatum)}
                                </span>
                              )}
                              {pos.fields.rechnungsnummer && (
                                <span className="text-[11px] text-muted-foreground">
                                  Nr. {pos.fields.rechnungsnummer}
                                </span>
                              )}
                              {pos.fields.artikel && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {pos.fields.artikel}
                                </span>
                              )}
                              {pos.fields.mwst_satz?.label && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  MwSt: {pos.fields.mwst_satz.label}
                                </Badge>
                              )}
                              {pos.fields.zahlungsart?.label && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  {pos.fields.zahlungsart.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {pos.fields.betrag_brutto != null && (
                              <span className="text-xs font-bold text-foreground">
                                {formatCurrency(pos.fields.betrag_brutto)}
                              </span>
                            )}
                            {pos.fields.betrag_netto != null && (
                              <div className="text-[10px] text-muted-foreground">
                                Netto: {formatCurrency(pos.fields.betrag_netto)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">Summe Brutto</div>
                      <div className="text-sm font-bold text-foreground">
                        {formatCurrency(selectedPositionen.reduce((s, p) => s + (p.fields.betrag_brutto ?? 0), 0))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Belegdetails (keine Positionen) */
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconInfoCircle size={15} className="text-primary shrink-0" />
                    <h3 className="text-xs font-semibold text-foreground">Belegdetails</h3>
                  </div>
                  <div className="space-y-2 rounded-xl border border-border overflow-hidden">
                    {[
                      { label: 'Belegtyp', value: selectedBeleg.fields.belegtyp?.label },
                      { label: 'Dokumentklasse', value: selectedBeleg.fields.dokumentklassifikation?.label },
                      { label: 'Status', value: selectedBeleg.fields.verarbeitungsstatus?.label },
                      { label: 'Uploaddatum', value: selectedBeleg.fields.upload_datum ? formatDate(selectedBeleg.fields.upload_datum) : undefined },
                      { label: 'Bemerkung', value: selectedBeleg.fields.beleg_bemerkung },
                      { label: 'OCR-Status', value: selectedBeleg.fields.ocr_status?.label },
                    ].filter(r => r.value).map(row => (
                      <div key={row.label} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-0">
                        <span className="text-[11px] text-muted-foreground w-28 shrink-0">{row.label}</span>
                        <span className="text-xs text-foreground font-medium">{row.value}</span>
                      </div>
                    ))}
                    <div className="px-3 py-2 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-28 shrink-0">Positionen</span>
                      <span className="text-[11px] text-amber-600 font-medium italic">Noch keine Positionen erfasst</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <a
                      href="#/belegpositionen"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                    >
                      <IconPlus size={13} className="shrink-0" />
                      Position erfassen
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Placeholder wenn nichts ausgewählt */}
          {!selectedBelegId && filtered.length > 0 && (
            <div className="hidden sm:flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2 p-8">
              <IconFileInvoice size={32} stroke={1.5} />
              <p className="text-xs text-center">Beleg auswählen, um<br />Positionen anzuzeigen</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialoge */}
      <BelegerfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateBelegerfassungEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createBelegerfassungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord?.fields}
        belegpositionenList={belegpositionen}
        enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Beleg löschen"
        description={`Soll der Beleg "${deleteTarget?.fields.belegtyp?.label ?? 'dieser Beleg'}" wirklich gelöscht werden?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ProcessStep({ label, href, icon, hasArrow }: {
  label: string;
  href: string;
  icon: React.ReactNode;
  hasArrow?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <a
        href={href}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/5 transition-colors group text-foreground hover:text-primary"
      >
        <span className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">{icon}</span>
        <span className="text-xs font-medium flex-1 min-w-0 truncate">{label}</span>
        <IconChevronRight size={12} className="text-muted-foreground group-hover:text-primary shrink-0" />
      </a>
      {hasArrow && (
        <div className="flex justify-center py-0.5">
          <IconArrowRight size={11} className="text-muted-foreground rotate-90" />
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
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
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
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
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
