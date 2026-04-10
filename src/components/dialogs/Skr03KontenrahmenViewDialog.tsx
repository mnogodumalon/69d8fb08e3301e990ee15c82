import type { Skr03Kontenrahmen } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface Skr03KontenrahmenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Skr03Kontenrahmen | null;
  onEdit: (record: Skr03Kontenrahmen) => void;
}

export function Skr03KontenrahmenViewDialog({ open, onClose, record, onEdit }: Skr03KontenrahmenViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SKR03-Kontenrahmen anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontonummer (SKR03)</Label>
            <p className="text-sm">{record.fields.kontonummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontobezeichnung</Label>
            <p className="text-sm">{record.fields.kontobezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontenklasse</Label>
            <Badge variant="secondary">{record.fields.kontenklasse?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Steuerkennung</Label>
            <p className="text-sm">{record.fields.steuerkennung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hinweis / Beschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.skr03_hinweis ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}