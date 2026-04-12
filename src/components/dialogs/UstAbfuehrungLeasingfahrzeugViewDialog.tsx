import type { UstAbfuehrungLeasingfahrzeug, Leasingfahrzeug, Belegpositionen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface UstAbfuehrungLeasingfahrzeugViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: UstAbfuehrungLeasingfahrzeug | null;
  onEdit: (record: UstAbfuehrungLeasingfahrzeug) => void;
  leasingfahrzeugList: Leasingfahrzeug[];
  belegpositionenList: Belegpositionen[];
}

export function UstAbfuehrungLeasingfahrzeugViewDialog({ open, onClose, record, onEdit, leasingfahrzeugList, belegpositionenList }: UstAbfuehrungLeasingfahrzeugViewDialogProps) {
  function getLeasingfahrzeugDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return leasingfahrzeugList.find(r => r.record_id === id)?.fields.fahrzeug_bezeichnung ?? '—';
  }

  function getBelegpositionenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return belegpositionenList.find(r => r.record_id === id)?.fields.rechnungsnummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>UST-Abführung Leasingfahrzeug anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingfahrzeug</Label>
            <p className="text-sm">{getLeasingfahrzeugDisplayName(record.fields.fahrzeug_referenz)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Monat/Jahr</Label>
            <p className="text-sm">{formatDate(record.fields.ust_zeitraum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Privatnutzungsbetrag (EUR)</Label>
            <p className="text-sm">{record.fields.privatnutzung_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemessungsgrundlage netto (EUR)</Label>
            <p className="text-sm">{record.fields.bemessungsgrundlage_netto ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">UST-Satz (%)</Label>
            <Badge variant="secondary">{record.fields.ust_satz?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">UST-Betrag (EUR)</Label>
            <p className="text-sm">{record.fields.ust_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buchungstext</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.buchungstext ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Belegposition (Buchhaltung)</Label>
            <p className="text-sm">{getBelegpositionenDisplayName(record.fields.belegposition_referenz)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buchungsstatus</Label>
            <Badge variant="secondary">{record.fields.buchungsstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.ust_bemerkung ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}