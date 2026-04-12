import type { Leasingfahrzeug, Skr03Kontenrahmen } from '@/types/app';
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

interface LeasingfahrzeugViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Leasingfahrzeug | null;
  onEdit: (record: Leasingfahrzeug) => void;
  skr03_kontenrahmenList: Skr03Kontenrahmen[];
}

export function LeasingfahrzeugViewDialog({ open, onClose, record, onEdit, skr03_kontenrahmenList }: LeasingfahrzeugViewDialogProps) {
  function getSkr03KontenrahmenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return skr03_kontenrahmenList.find(r => r.record_id === id)?.fields.kontonummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leasingfahrzeug anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fahrzeugbezeichnung</Label>
            <p className="text-sm">{record.fields.fahrzeug_bezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kennzeichen</Label>
            <p className="text-sm">{record.fields.kennzeichen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingvertragsnummer</Label>
            <p className="text-sm">{record.fields.leasingvertrag_nummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingrate (brutto, EUR)</Label>
            <p className="text-sm">{record.fields.leasingrate_brutto ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingbeginn</Label>
            <p className="text-sm">{formatDate(record.fields.leasingbeginn)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingende</Label>
            <p className="text-sm">{formatDate(record.fields.leasingende)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Listenpreis (brutto, EUR)</Label>
            <p className="text-sm">{record.fields.listenpreis_brutto ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Private Nutzungsmethode</Label>
            <Badge variant="secondary">{record.fields.nutzungsart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto für Leasingrate</Label>
            <p className="text-sm">{getSkr03KontenrahmenDisplayName(record.fields.skr03_konto_leasing)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto für UST-Abführung</Label>
            <p className="text-sm">{getSkr03KontenrahmenDisplayName(record.fields.skr03_konto_ust)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}