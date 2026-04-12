import { useState, useEffect } from 'react';
import type { Beleguebersicht, Belegerfassung, Belegpositionen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface BeleguebersichtDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Beleguebersicht['fields']) => Promise<void>;
  defaultValues?: Beleguebersicht['fields'];
  belegerfassungList: Belegerfassung[];
  belegpositionenList: Belegpositionen[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function BeleguebersichtDialog({ open, onClose, onSubmit, defaultValues, belegerfassungList, belegpositionenList, enablePhotoScan: _enablePhotoScan = true, enablePhotoLocation: _enablePhotoLocation = true }: BeleguebersichtDialogProps) {
  const [fields, setFields] = useState<Partial<Beleguebersicht['fields']>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFields(defaultValues ?? {});
  }, [open, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = cleanFieldsForApi({ ...fields }, 'beleguebersicht');
      await onSubmit(clean as Beleguebersicht['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const DIALOG_INTENT = defaultValues ? 'Belegübersicht bearbeiten' : 'Belegübersicht hinzufügen';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_INTENT}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="beleg_liste">Belegliste</Label>
            <Select
              value={extractRecordId(fields.beleg_liste) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, beleg_liste: v === 'none' ? undefined : createRecordUrl(APP_IDS.BELEGERFASSUNG, v) }))}
            >
              <SelectTrigger id="beleg_liste"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {belegerfassungList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.beleg_bemerkung ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="positionen_liste">Belegpositionen zum Beleg</Label>
            <Select
              value={extractRecordId(fields.positionen_liste) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, positionen_liste: v === 'none' ? undefined : createRecordUrl(APP_IDS.BELEGPOSITIONEN, v) }))}
            >
              <SelectTrigger id="positionen_liste"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {belegpositionenList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.rechnungsnummer ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}