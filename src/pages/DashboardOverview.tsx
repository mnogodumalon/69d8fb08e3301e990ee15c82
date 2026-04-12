import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBelegerfassung } from '@/lib/enrich';
import type { EnrichedBelegerfassung } from '@/types/enriched';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconFileInvoice,
  IconClockHour4, IconCheckbox, IconCircleCheck, IconBan,
  IconSearch, IconReceipt2, IconCar, IconArrowRight,
} from '@tabler/icons-react';
import type { KontierungUndPruefung } from '@/types/app';

const APPGROUP_ID = '69d8fb08e3301e990ee15c82';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  neu:           { label: 'Neu',          icon: <IconClockHour4 size={14} className="shrink-0" />,  color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  in_bearbeitung:{ label: 'In Bearbeitung',icon: <IconSearch size={14} className="shrink-0" />,     color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  geprueft:      { label: 'Geprüft',      icon: <IconCheckbox size={14} className="shrink-0" />,    color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-200' },
  freigegeben:   { label: 'Freigegeben',  icon: <IconCircleCheck size={14} className="shrink-0" />, color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200' },
  abgelehnt:     { label: 'Abgelehnt',    icon: <IconBan size={14} className="shrink-0" />,         color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200' },
};

const STATUS_ORDER = ['neu', 'in_bearbeitung', 'geprueft', 'freigegeben', 'abgelehnt'];

const BELEGTYP_ICONS: Record<string, React.ReactNode> = {
  eingangsrechnung: <IconFileInvoice size={14} className="shrink-0 text-blue-500" />,
  ausgangsrechnung: <IconReceipt2 size={14} className="shrink-0 text-green-500" />,
  gutschrift:       <IconArrowRight size={14} className="shrink-0 text-violet-500" />,
};

export default function DashboardOverview() {
  const {
    belegerfassung, belegpositionen, leasingfahrzeug, kontierungUndPruefung,
    belegpositionenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  // All hooks BEFORE early returns
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBeleg, setEditBeleg] = useState<EnrichedBelegerfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedBelegerfassung | null>(null);
  const [kontierungDialogOpen, setKontierungDialogOpen] = useState(false);
  const [editKontierung, setEditKontierung] = useState<KontierungUndPruefung | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterTyp, setFilterTyp] = useState<string | null>(null);

  const enrichedBelege = useMemo(
    () => enrichBelegerfassung(belegerfassung, { belegpositionenMap }),
    [belegerfassung, belegpositionenMap]
  );

  // KPI calculations
  const totalBelege = enrichedBelege.length;
  const offeneBelege = enrichedBelege.filter(b => b.fields.verarbeitungsstatus?.key === 'neu' || b.fields.verarbeitungsstatus?.key === 'in_bearbeitung').length;
  const gesamtBrutto = belegpositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0);
  const pruefungOffenCount = kontierungUndPruefung.filter(k => k.fields.plausibilitaet?.key === 'pruefung_erforderlich' || k.fields.plausibilitaet?.key === 'nicht_geprueft').length;

  // Grouping
  const grouped = useMemo(() => {
    const filtered = enrichedBelege.filter(b => {
      if (filterStatus && b.fields.verarbeitungsstatus?.key !== filterStatus) return false;
      if (filterTyp && b.fields.belegtyp?.key !== filterTyp) return false;
      return true;
    });
    const map: Record<string, EnrichedBelegerfassung[]> = {};
    STATUS_ORDER.forEach(s => { map[s] = []; });
    filtered.forEach(b => {
      const key = b.fields.verarbeitungsstatus?.key ?? 'neu';
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [enrichedBelege, filterStatus, filterTyp]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteBelegerfassungEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  const belegTypen = Array.from(new Set(enrichedBelege.map(b => b.fields.belegtyp?.key).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Belege gesamt"
          value={String(totalBelege)}
          description="Erfasste Dokumente"
          icon={<IconFileInvoice size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={String(offeneBelege)}
          description="Neu & in Bearbeitung"
          icon={<IconClockHour4 size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Belegvolumen"
          value={formatCurrency(gesamtBrutto)}
          description="Summe Brutto"
          icon={<IconReceipt2 size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Zu prüfen"
          value={String(pruefungOffenCount)}
          description="Kontierung ausstehend"
          icon={<IconCheckbox size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-foreground mr-2">Belegworkflow</h2>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          <button
            onClick={() => setFilterStatus(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${filterStatus === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-accent'}`}
          >
            Alle
          </button>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = grouped[s]?.length ?? 0;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1 ${filterStatus === s ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'bg-background text-muted-foreground border-border hover:bg-accent'}`}
              >
                {cfg.icon}{cfg.label} <span className="font-bold">{count}</span>
              </button>
            );
          })}
        </div>
        {belegTypen.length > 0 && (
          <select
            value={filterTyp ?? ''}
            onChange={e => setFilterTyp(e.target.value || null)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Alle Typen</option>
            {belegTypen.map(t => (
              <option key={t} value={t}>{enrichedBelege.find(b => b.fields.belegtyp?.key === t)?.fields.belegtyp?.label ?? t}</option>
            ))}
          </select>
        )}
        <Button size="sm" onClick={() => { setEditBeleg(null); setDialogOpen(true); }} className="ml-auto shrink-0">
          <IconPlus size={15} className="mr-1 shrink-0" />
          <span className="hidden sm:inline">Beleg erfassen</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {/* Kanban Board */}
      {filterStatus ? (
        // Single-column filtered view
        <div className="space-y-2">
          {(grouped[filterStatus] ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-border bg-muted/30">
              <IconFileInvoice size={36} stroke={1.5} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Keine Belege in diesem Status</p>
              <Button variant="outline" size="sm" onClick={() => { setEditBeleg(null); setDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1" />Beleg erfassen
              </Button>
            </div>
          ) : (
            (grouped[filterStatus] ?? []).map(beleg => (
              <BelegCard
                key={beleg.record_id}
                beleg={beleg}
                onEdit={() => { setEditBeleg(beleg); setDialogOpen(true); }}
                onDelete={() => setDeleteTarget(beleg)}
              />
            ))
          )}
        </div>
      ) : (
        // Full kanban view
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STATUS_ORDER.map(status => {
              const cfg = STATUS_CONFIG[status];
              const cards = grouped[status] ?? [];
              return (
                <div key={status} className="w-72 shrink-0 flex flex-col gap-3">
                  {/* Column header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cards.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="flex flex-col gap-2 min-h-[120px]">
                    {cards.length === 0 ? (
                      <div className={`rounded-xl border border-dashed ${cfg.border} p-4 text-center`}>
                        <p className="text-xs text-muted-foreground">Keine Belege</p>
                      </div>
                    ) : (
                      cards.map(beleg => (
                        <BelegCard
                          key={beleg.record_id}
                          beleg={beleg}
                          onEdit={() => { setEditBeleg(beleg); setDialogOpen(true); }}
                          onDelete={() => setDeleteTarget(beleg)}
                        />
                      ))
                    )}
                    {status === 'neu' && (
                      <button
                        onClick={() => { setEditBeleg(null); setDialogOpen(true); }}
                        className="w-full rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                      >
                        <IconPlus size={13} />Beleg hinzufügen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leasing section */}
      {leasingfahrzeug.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconCar size={16} className="text-muted-foreground shrink-0" />
            <h2 className="text-base font-semibold text-foreground">Leasingfahrzeuge</h2>
            <Badge variant="secondary" className="text-xs">{leasingfahrzeug.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {leasingfahrzeug.map(fz => (
              <div key={fz.record_id} className="rounded-2xl border border-border bg-card p-4 space-y-2 overflow-hidden">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{fz.fields.fahrzeug_bezeichnung ?? '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{fz.fields.kennzeichen ?? ''}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{fz.fields.nutzungsart?.label ?? '—'}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Leasingrate</p>
                    <p className="font-medium text-foreground">{formatCurrency(fz.fields.leasingrate_brutto)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vertragsende</p>
                    <p className="font-medium text-foreground">{formatDate(fz.fields.leasingende)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kontierung section */}
      {kontierungUndPruefung.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconCheckbox size={16} className="text-muted-foreground shrink-0" />
            <h2 className="text-base font-semibold text-foreground">Kontierung &amp; Prüfung</h2>
            {pruefungOffenCount > 0 && (
              <Badge variant="destructive" className="text-xs">{pruefungOffenCount} offen</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => { setEditKontierung(null); setKontierungDialogOpen(true); }}
            >
              <IconPlus size={14} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Kontierung</span>
            </Button>
          </div>
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Position</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Konto</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Plausibilität</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Konfidenz</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {kontierungUndPruefung.slice(0, 10).map(k => {
                    const plaus = k.fields.plausibilitaet?.key;
                    const plausLabel = k.fields.plausibilitaet?.label ?? '—';
                    const konfidenz = k.fields.konfidenz ?? null;
                    return (
                      <tr key={k.record_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-foreground truncate max-w-[140px]">
                          {k.fields.position_referenz ? k.record_id.slice(-6) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground truncate max-w-[100px]">
                          {k.fields.skr03_konto_referenz ? k.fields.skr03_konto_referenz.toString().slice(-6) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            plaus === 'plausibel' ? 'bg-green-100 text-green-700' :
                            plaus === 'nicht_plausibel' ? 'bg-red-100 text-red-700' :
                            plaus === 'pruefung_erforderlich' ? 'bg-amber-100 text-amber-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {plausLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground">
                          {konfidenz !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${konfidenz >= 80 ? 'bg-green-500' : konfidenz >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(100, konfidenz)}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground">{konfidenz}%</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => { setEditKontierung(k); setKontierungDialogOpen(true); }}
                          >
                            <IconPencil size={13} className="shrink-0" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <BelegerfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditBeleg(null); }}
        onSubmit={async (fields) => {
          if (editBeleg) {
            await LivingAppsService.updateBelegerfassungEntry(editBeleg.record_id, fields);
          } else {
            await LivingAppsService.createBelegerfassungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editBeleg?.fields}
        belegpositionenList={belegpositionen}
        enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Belegerfassung']}
      />

      <KontierungUndPruefungDialog
        open={kontierungDialogOpen}
        onClose={() => { setKontierungDialogOpen(false); setEditKontierung(null); }}
        onSubmit={async (fields) => {
          if (editKontierung) {
            await LivingAppsService.updateKontierungUndPruefungEntry(editKontierung.record_id, fields);
          } else {
            await LivingAppsService.createKontierungUndPruefungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editKontierung?.fields}
        belegpositionenList={belegpositionen}
        skr03_kontenrahmenList={[]}
        enablePhotoScan={AI_PHOTO_SCAN['KontierungUndPruefung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['KontierungUndPruefung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Beleg löschen"
        description={`Beleg vom ${formatDate(deleteTarget?.fields.upload_datum)} wirklich löschen?`}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

interface BelegCardProps {
  beleg: EnrichedBelegerfassung;
  onEdit: () => void;
  onDelete: () => void;
}

function BelegCard({ beleg, onEdit, onDelete }: BelegCardProps) {
  const typKey = beleg.fields.belegtyp?.key ?? '';
  const ocrKey = beleg.fields.ocr_status?.key ?? '';

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5 shrink-0">{BELEGTYP_ICONS[typKey] ?? <IconFileInvoice size={14} className="text-muted-foreground" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{beleg.fields.belegtyp?.label ?? 'Beleg'}</p>
          <p className="text-xs text-muted-foreground truncate">{formatDate(beleg.fields.upload_datum)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <IconPencil size={12} />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <IconTrash size={12} />
          </button>
        </div>
      </div>
      {beleg.fields.beleg_bemerkung && (
        <p className="text-xs text-muted-foreground line-clamp-2">{beleg.fields.beleg_bemerkung}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {beleg.fields.dokumentklassifikation && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{beleg.fields.dokumentklassifikation.label}</Badge>
        )}
        {ocrKey && (
          <span className={`text-[10px] px-1.5 py-0 h-4 inline-flex items-center rounded-full border font-medium ${
            ocrKey === 'abgeschlossen' ? 'bg-green-50 text-green-600 border-green-200' :
            ocrKey === 'fehler' ? 'bg-red-50 text-red-600 border-red-200' :
            ocrKey === 'in_verarbeitung' ? 'bg-amber-50 text-amber-600 border-amber-200' :
            'bg-muted text-muted-foreground border-border'
          }`}>
            OCR: {beleg.fields.ocr_status?.label}
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
      <div className="flex gap-4 overflow-hidden">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-64 w-72 rounded-2xl shrink-0" />)}
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
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
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
        <p className="text-sm text-muted-foreground max-w-xs">{repairing ? repairStatus : error.message}</p>
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
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen.</p>}
    </div>
  );
}
