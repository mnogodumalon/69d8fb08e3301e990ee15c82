import type { KontierungUndPruefung, Belegpositionen, Skr03Kontenrahmen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface KontierungUndPruefungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: KontierungUndPruefung | null;
  onEdit: (record: KontierungUndPruefung) => void;
  belegpositionenList: Belegpositionen[];
  skr03_kontenrahmenList: Skr03Kontenrahmen[];
}

export function KontierungUndPruefungViewDialog({ open, onClose, record, onEdit, belegpositionenList, skr03_kontenrahmenList }: KontierungUndPruefungViewDialogProps) {
  function getBelegpositionenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return belegpositionenList.find(r => r.record_id === id)?.fields.rechnungsnummer ?? '—';
  }

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
          <DialogTitle>Kontierung und Prüfung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Belegposition</Label>
            <p className="text-sm">{getBelegpositionenDisplayName(record.fields.position_referenz)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto</Label>
            <p className="text-sm">{getSkr03KontenrahmenDisplayName(record.fields.skr03_konto_referenz)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Plausibilität</Label>
            <Badge variant="secondary">{record.fields.plausibilitaet?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Konfidenz (%)</Label>
            <p className="text-sm">{record.fields.konfidenz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prüfhinweis</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.pruefhinweis ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Manuell korrigiert</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.manuell_korrigiert ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.manuell_korrigiert ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Korrekturbemerkung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.korrekturbemerkung ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}