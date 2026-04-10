import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBelegpositionen, enrichKontierungUndPruefung } from '@/lib/enrich';
import type { Belegerfassung, Belegpositionen, KontierungUndPruefung, ExportUndAusgabe } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconReceipt, IconFileSearch, IconListCheck, IconFileExport, IconPlus, IconPencil, IconTrash, IconChevronRight, IconClock, IconAlertTriangle, IconCircleCheck, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import { ExportUndAusgabeDialog } from '@/components/dialogs/ExportUndAusgabeDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { ShareFormLink } from '@/components/ShareFormLink';

type ActiveTab = 'belege' | 'positionen' | 'kontierung' | 'export';
type DialogState<T> = { open: boolean; record?: T };

function getVerarbeitungsstatusColor(key: string | undefined): string {
  switch (key) {
    case 'neu': return 'bg-blue-100 text-blue-700';
    case 'in_bearbeitung': return 'bg-yellow-100 text-yellow-700';
    case 'geprueft': return 'bg-indigo-100 text-indigo-700';
    case 'freigegeben': return 'bg-green-100 text-green-700';
    case 'abgelehnt': return 'bg-red-100 text-red-700';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getOcrStatusIcon(key: string | undefined) {
  switch (key) {
    case 'abgeschlossen': return <IconCircleCheck size={14} className="text-green-600 shrink-0" />;
    case 'in_verarbeitung': return <IconClock size={14} className="text-yellow-600 shrink-0" />;
    case 'fehler': return <IconAlertTriangle size={14} className="text-red-600 shrink-0" />;
    default: return <IconClock size={14} className="text-muted-foreground shrink-0" />;
  }
}

function getPlausibilitaetColor(key: string | undefined): string {
  switch (key) {
    case 'plausibel': return 'bg-green-100 text-green-700';
    case 'nicht_plausibel': return 'bg-red-100 text-red-700';
    case 'pruefung_erforderlich': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getExportstatusColor(key: string | undefined): string {
  switch (key) {
    case 'abgeschlossen': return 'bg-green-100 text-green-700';
    case 'in_bearbeitung': return 'bg-yellow-100 text-yellow-700';
    case 'fehler': return 'bg-red-100 text-red-700';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function DashboardOverview() {
  const {
    skr03Kontenrahmen, belegerfassung, belegpositionen, kontierungUndPruefung, exportUndAusgabe,
    belegerfassungMap, belegpositionenMap, skr03KontenrahmenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBelegpositionen = enrichBelegpositionen(belegpositionen, { belegerfassungMap });
  const enrichedKontierungUndPruefung = enrichKontierungUndPruefung(kontierungUndPruefung, { belegpositionenMap, skr03KontenrahmenMap });

  const [activeTab, setActiveTab] = useState<ActiveTab>('belege');
  const [belegDialog, setBelegDialog] = useState<DialogState<Belegerfassung>>({ open: false });
  const [positionDialog, setPositionDialog] = useState<DialogState<Belegpositionen>>({ open: false });
  const [kontierungDialog, setKontierungDialog] = useState<DialogState<KontierungUndPruefung>>({ open: false });
  const [exportDialog, setExportDialog] = useState<DialogState<ExportUndAusgabe>>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<{ entity: ActiveTab; id: string } | null>(null);
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(null);

  const kpiData = useMemo(() => {
    const offene = belegerfassung.filter(b => b.fields.verarbeitungsstatus?.key === 'neu' || b.fields.verarbeitungsstatus?.key === 'in_bearbeitung').length;
    const zuPruefen = kontierungUndPruefung.filter(k => k.fields.plausibilitaet?.key === 'pruefung_erforderlich').length;
    const gesamtBrutto = belegpositionen.reduce((sum, p) => sum + (p.fields.betrag_brutto ?? 0), 0);
    const exportiert = exportUndAusgabe.filter(e => e.fields.exportstatus?.key === 'abgeschlossen').length;
    return { offene, zuPruefen, gesamtBrutto, exportiert };
  }, [belegerfassung, belegpositionen, kontierungUndPruefung, exportUndAusgabe]);

  const filteredPositionen = useMemo(() => {
    if (!selectedBelegId) return enrichedBelegpositionen;
    return enrichedBelegpositionen.filter(p => {
      const id = extractRecordId(p.fields.beleg_referenz);
      return id === selectedBelegId;
    });
  }, [enrichedBelegpositionen, selectedBelegId]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.entity === 'belege') await LivingAppsService.deleteBelegerfassungEntry(deleteTarget.id);
    else if (deleteTarget.entity === 'positionen') await LivingAppsService.deleteBelegpositionenEntry(deleteTarget.id);
    else if (deleteTarget.entity === 'kontierung') await LivingAppsService.deleteKontierungUndPruefungEntry(deleteTarget.id);
    else if (deleteTarget.entity === 'export') await LivingAppsService.deleteExportUndAusgabeEntry(deleteTarget.id);
    setDeleteTarget(null);
    fetchAll();
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'belege', label: 'Belege', icon: <IconReceipt size={16} className="shrink-0" />, count: belegerfassung.length },
    { id: 'positionen', label: 'Positionen', icon: <IconFileSearch size={16} className="shrink-0" />, count: belegpositionen.length },
    { id: 'kontierung', label: 'Kontierung', icon: <IconListCheck size={16} className="shrink-0" />, count: kontierungUndPruefung.length },
    { id: 'export', label: 'Export', icon: <IconFileExport size={16} className="shrink-0" />, count: exportUndAusgabe.length },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Offene Belege"
          value={String(kpiData.offene)}
          description="Neu & in Bearbeitung"
          icon={<IconReceipt size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Zu prüfen"
          value={String(kpiData.zuPruefen)}
          description="Kontierungen"
          icon={<IconAlertTriangle size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtvolumen"
          value={formatCurrency(kpiData.gesamtBrutto)}
          description="Brutto aller Positionen"
          icon={<IconListCheck size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Exporte"
          value={String(kpiData.exportiert)}
          description="Abgeschlossen"
          icon={<IconFileExport size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Workflow Pipeline */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Pipeline header with step indicators */}
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab, i) => (
              <div key={tab.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${activeTab === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {tab.count}
                  </span>
                </button>
                {i < tabs.length - 1 && <IconChevronRight size={14} className="text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {/* BELEGE TAB */}
          {activeTab === 'belege' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-foreground">Belegerfassung</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <ShareFormLink appId={APP_IDS.BELEGERFASSUNG} label="Beleglink teilen" variant="icon" />
                  <Button size="sm" onClick={() => setBelegDialog({ open: true })}>
                    <IconPlus size={15} className="shrink-0 mr-1" />
                    Beleg erfassen
                  </Button>
                </div>
              </div>

              {belegerfassung.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <IconReceipt size={48} stroke={1.5} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Noch keine Belege erfasst</p>
                  <Button size="sm" variant="outline" onClick={() => setBelegDialog({ open: true })}>
                    <IconPlus size={14} className="mr-1" />Ersten Beleg erfassen
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left pb-2 pr-3 font-medium">Typ</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">Klassifikation</th>
                        <th className="text-left pb-2 pr-3 font-medium">Status</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">OCR</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden lg:table-cell">Datum</th>
                        <th className="text-left pb-2 font-medium">Bemerkung</th>
                        <th className="pb-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {belegerfassung.map(b => (
                        <tr key={b.record_id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${selectedBelegId === b.record_id ? 'bg-primary/5' : ''}`}
                          onClick={() => {
                            setSelectedBelegId(selectedBelegId === b.record_id ? null : b.record_id);
                            if (selectedBelegId !== b.record_id) setActiveTab('positionen');
                          }}
                        >
                          <td className="py-2 pr-3">
                            <span className="truncate max-w-[120px] block">{b.fields.belegtyp?.label ?? '—'}</span>
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground">
                            {b.fields.dokumentklassifikation?.label ?? '—'}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getVerarbeitungsstatusColor(b.fields.verarbeitungsstatus?.key)}`}>
                              {b.fields.verarbeitungsstatus?.label ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell">
                            <span className="flex items-center gap-1">
                              {getOcrStatusIcon(b.fields.ocr_status?.key)}
                              <span className="text-xs text-muted-foreground hidden lg:inline">{b.fields.ocr_status?.label ?? '—'}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-3 hidden lg:table-cell text-muted-foreground text-xs">
                            {b.fields.upload_datum ? formatDate(b.fields.upload_datum) : '—'}
                          </td>
                          <td className="py-2 pr-3 min-w-0">
                            <span className="truncate block max-w-[160px] text-muted-foreground text-xs">{b.fields.beleg_bemerkung ?? '—'}</span>
                          </td>
                          <td className="py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 justify-end">
                              <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setBelegDialog({ open: true, record: b })}>
                                <IconPencil size={14} />
                              </button>
                              <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => setDeleteTarget({ entity: 'belege', id: b.record_id })}>
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* POSITIONEN TAB */}
          {activeTab === 'positionen' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-semibold text-foreground">Belegpositionen</h2>
                  {selectedBelegId && (
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {belegerfassungMap.get(selectedBelegId)?.fields.beleg_bemerkung ?? 'Beleg gefiltert'}
                      </Badge>
                      <button onClick={() => setSelectedBelegId(null)} className="p-0.5 rounded hover:bg-accent">
                        <IconX size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <Button size="sm" onClick={() => setPositionDialog({ open: true })}>
                  <IconPlus size={15} className="shrink-0 mr-1" />
                  Position hinzufügen
                </Button>
              </div>

              {filteredPositionen.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <IconFileSearch size={48} stroke={1.5} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Keine Positionen vorhanden</p>
                  <Button size="sm" variant="outline" onClick={() => setPositionDialog({ open: true })}>
                    <IconPlus size={14} className="mr-1" />Position hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left pb-2 pr-3 font-medium">Rechnungssteller</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">Rechnungsnr.</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">Datum</th>
                        <th className="text-left pb-2 pr-3 font-medium">Brutto</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden lg:table-cell">MwSt.</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">Währung</th>
                        <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">Beleg</th>
                        <th className="pb-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPositionen.map(p => (
                        <tr key={p.record_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3">
                            <span className="truncate block max-w-[140px] font-medium">{p.fields.rechnungssteller ?? '—'}</span>
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell text-muted-foreground text-xs">
                            {p.fields.rechnungsnummer ?? '—'}
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground text-xs">
                            {p.fields.rechnungsdatum ? formatDate(p.fields.rechnungsdatum) : '—'}
                          </td>
                          <td className="py-2 pr-3 font-semibold">
                            {p.fields.betrag_brutto != null ? formatCurrency(p.fields.betrag_brutto) : '—'}
                          </td>
                          <td className="py-2 pr-3 hidden lg:table-cell text-muted-foreground text-xs">
                            {p.fields.mwst_satz?.label ?? '—'}
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell text-muted-foreground text-xs">
                            {p.fields.waehrung?.label ?? 'EUR'}
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground text-xs">
                            <span className="truncate block max-w-[120px]">{p.beleg_referenzName || '—'}</span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setPositionDialog({ open: true, record: p })}>
                                <IconPencil size={14} />
                              </button>
                              <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => setDeleteTarget({ entity: 'positionen', id: p.record_id })}>
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* KONTIERUNG TAB */}
          {activeTab === 'kontierung' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-foreground">Kontierung & Prüfung</h2>
                <Button size="sm" onClick={() => setKontierungDialog({ open: true })}>
                  <IconPlus size={15} className="shrink-0 mr-1" />
                  Kontierung anlegen
                </Button>
              </div>

              {enrichedKontierungUndPruefung.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <IconListCheck size={48} stroke={1.5} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Keine Kontierungen vorhanden</p>
                  <Button size="sm" variant="outline" onClick={() => setKontierungDialog({ open: true })}>
                    <IconPlus size={14} className="mr-1" />Kontierung anlegen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary bar */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(['plausibel', 'pruefung_erforderlich', 'nicht_plausibel', 'nicht_geprueft'] as const).map(key => {
                      const opt = LOOKUP_OPTIONS.kontierung_und_pruefung?.plausibilitaet?.find(o => o.key === key);
                      const cnt = enrichedKontierungUndPruefung.filter(k => k.fields.plausibilitaet?.key === key).length;
                      if (cnt === 0) return null;
                      return (
                        <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getPlausibilitaetColor(key)}`}>
                          {opt?.label ?? key}: {cnt}
                        </span>
                      );
                    })}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left pb-2 pr-3 font-medium">Plausibilität</th>
                          <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">Position</th>
                          <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">SKR03-Konto</th>
                          <th className="text-left pb-2 pr-3 font-medium hidden lg:table-cell">Konfidenz</th>
                          <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">Korrigiert</th>
                          <th className="text-left pb-2 font-medium">Hinweis</th>
                          <th className="pb-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrichedKontierungUndPruefung.map(k => (
                          <tr key={k.record_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPlausibilitaetColor(k.fields.plausibilitaet?.key)}`}>
                                {k.fields.plausibilitaet?.label ?? '—'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 hidden sm:table-cell text-muted-foreground text-xs">
                              <span className="truncate block max-w-[120px]">{k.position_referenzName || '—'}</span>
                            </td>
                            <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground text-xs font-mono">
                              {k.skr03_konto_referenzName || '—'}
                            </td>
                            <td className="py-2 pr-3 hidden lg:table-cell">
                              {k.fields.konfidenz != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${k.fields.konfidenz * 100}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground">{Math.round(k.fields.konfidenz * 100)}%</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3 hidden md:table-cell">
                              {k.fields.manuell_korrigiert ? (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                  <IconCheck size={12} />Ja
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 min-w-0">
                              <span className="truncate block max-w-[180px] text-xs text-muted-foreground">{k.fields.pruefhinweis ?? '—'}</span>
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => setKontierungDialog({ open: true, record: k })}>
                                  <IconPencil size={14} />
                                </button>
                                <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => setDeleteTarget({ entity: 'kontierung', id: k.record_id })}>
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPORT TAB */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-foreground">Export & Ausgabe</h2>
                <Button size="sm" onClick={() => setExportDialog({ open: true })}>
                  <IconPlus size={15} className="shrink-0 mr-1" />
                  Export erstellen
                </Button>
              </div>

              {exportUndAusgabe.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <IconFileExport size={48} stroke={1.5} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Noch keine Exporte erstellt</p>
                  <Button size="sm" variant="outline" onClick={() => setExportDialog({ open: true })}>
                    <IconPlus size={14} className="mr-1" />Export erstellen
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {exportUndAusgabe.map(e => (
                    <div key={e.record_id} className="rounded-xl border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{e.fields.export_bezeichnung ?? 'Unbenannter Export'}</p>
                          <p className="text-xs text-muted-foreground">{e.fields.dateiname ?? '—'}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getExportstatusColor(e.fields.exportstatus?.key)}`}>
                          {e.fields.exportstatus?.label ?? '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(e.fields.exportformat) && e.fields.exportformat.map(f => (
                          <span key={f.key} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground font-mono">
                            {f.label}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {e.fields.zeitraum_von ? formatDate(e.fields.zeitraum_von) : ''}
                          {e.fields.zeitraum_von && e.fields.zeitraum_bis ? ' – ' : ''}
                          {e.fields.zeitraum_bis ? formatDate(e.fields.zeitraum_bis) : ''}
                          {!e.fields.zeitraum_von && !e.fields.zeitraum_bis ? 'Kein Zeitraum' : ''}
                        </span>
                        <span>{e.fields.exportdatum ? formatDate(e.fields.exportdatum) : '—'}</span>
                      </div>
                      {e.fields.export_bemerkung && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{e.fields.export_bemerkung}</p>
                      )}
                      <div className="flex items-center gap-1 pt-1 border-t">
                        <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setExportDialog({ open: true, record: e })}>
                          <IconPencil size={14} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => setDeleteTarget({ entity: 'export', id: e.record_id })}>
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <BelegerfassungDialog
        open={belegDialog.open}
        onClose={() => setBelegDialog({ open: false })}
        onSubmit={async (fields) => {
          if (belegDialog.record) {
            await LivingAppsService.updateBelegerfassungEntry(belegDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createBelegerfassungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={belegDialog.record?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
      />

      <BelegpositionenDialog
        open={positionDialog.open}
        onClose={() => setPositionDialog({ open: false })}
        onSubmit={async (fields) => {
          if (positionDialog.record) {
            await LivingAppsService.updateBelegpositionenEntry(positionDialog.record.record_id, fields);
          } else {
            const posFields = selectedBelegId
              ? { ...fields, beleg_referenz: createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBelegId) }
              : fields;
            await LivingAppsService.createBelegpositionenEntry(posFields);
          }
          fetchAll();
        }}
        defaultValues={positionDialog.record
          ? positionDialog.record.fields
          : selectedBelegId
            ? { beleg_referenz: createRecordUrl(APP_IDS.BELEGERFASSUNG, selectedBelegId) }
            : undefined}
        belegerfassungList={belegerfassung}
        enablePhotoScan={AI_PHOTO_SCAN['Belegpositionen']}
      />

      <KontierungUndPruefungDialog
        open={kontierungDialog.open}
        onClose={() => setKontierungDialog({ open: false })}
        onSubmit={async (fields) => {
          if (kontierungDialog.record) {
            await LivingAppsService.updateKontierungUndPruefungEntry(kontierungDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createKontierungUndPruefungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={kontierungDialog.record?.fields}
        belegpositionenList={belegpositionen}
        skr03_kontenrahmenList={skr03Kontenrahmen}
        enablePhotoScan={AI_PHOTO_SCAN['KontierungUndPruefung']}
      />

      <ExportUndAusgabeDialog
        open={exportDialog.open}
        onClose={() => setExportDialog({ open: false })}
        onSubmit={async (fields) => {
          if (exportDialog.record) {
            await LivingAppsService.updateExportUndAusgabeEntry(exportDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createExportUndAusgabeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={exportDialog.record?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['ExportUndAusgabe']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description="Dieser Eintrag wird unwiderruflich gelöscht. Fortfahren?"
        onConfirm={handleDelete}
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
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const APPGROUP_ID = '69d8fb08e3301e990ee15c82';
  const REPAIR_ENDPOINT = '/claude/build/repair';

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
