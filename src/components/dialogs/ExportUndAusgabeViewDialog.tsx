import type { ExportUndAusgabe } from '@/types/app';
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

interface ExportUndAusgabeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: ExportUndAusgabe | null;
  onEdit: (record: ExportUndAusgabe) => void;
}

export function ExportUndAusgabeViewDialog({ open, onClose, record, onEdit }: ExportUndAusgabeViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export und Ausgabe anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Exportbezeichnung</Label>
            <p className="text-sm">{record.fields.export_bezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zeitraum von</Label>
            <p className="text-sm">{formatDate(record.fields.zeitraum_von)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zeitraum bis</Label>
            <p className="text-sm">{formatDate(record.fields.zeitraum_bis)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Exportformat</Label>
            <p className="text-sm">{Array.isArray(record.fields.exportformat) ? record.fields.exportformat.map((v: any) => v?.label ?? v).join(', ') : '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Exportstatus</Label>
            <Badge variant="secondary">{record.fields.exportstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Exportdatum</Label>
            <p className="text-sm">{formatDate(record.fields.exportdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dateiname</Label>
            <p className="text-sm">{record.fields.dateiname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen zum Export</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.export_bemerkung ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}