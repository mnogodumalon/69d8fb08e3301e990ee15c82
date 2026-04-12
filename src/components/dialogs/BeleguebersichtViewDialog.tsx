import type { Beleguebersicht, Belegerfassung, Belegpositionen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface BeleguebersichtViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Beleguebersicht | null;
  onEdit: (record: Beleguebersicht) => void;
  belegerfassungList: Belegerfassung[];
  belegpositionenList: Belegpositionen[];
}

export function BeleguebersichtViewDialog({ open, onClose, record, onEdit, belegerfassungList, belegpositionenList }: BeleguebersichtViewDialogProps) {
  function getBelegerfassungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return belegerfassungList.find(r => r.record_id === id)?.fields.beleg_bemerkung ?? '—';
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
          <DialogTitle>Belegübersicht anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Belegliste</Label>
            <p className="text-sm">{getBelegerfassungDisplayName(record.fields.beleg_liste)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Belegpositionen zum Beleg</Label>
            <p className="text-sm">{getBelegpositionenDisplayName(record.fields.positionen_liste)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}