import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupKey, lookupKeys } from '@/lib/formatters';

const KLAR_BASE = 'https://my.living-apps.de/claude';

async function submitPublicForm(fields: Record<string, unknown>) {
  const res = await fetch(`${KLAR_BASE}/public/69d8fb08e3301e990ee15c82/69d8faea03592afd38c20888/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormExportUndAusgabe() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields));
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Export und Ausgabe — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="export_bezeichnung">Exportbezeichnung</Label>
            <Input
              id="export_bezeichnung"
              value={fields.export_bezeichnung ?? ''}
              onChange={e => setFields(f => ({ ...f, export_bezeichnung: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zeitraum_von">Zeitraum von</Label>
            <Input
              id="zeitraum_von"
              type="date"
              value={fields.zeitraum_von ?? ''}
              onChange={e => setFields(f => ({ ...f, zeitraum_von: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zeitraum_bis">Zeitraum bis</Label>
            <Input
              id="zeitraum_bis"
              type="date"
              value={fields.zeitraum_bis ?? ''}
              onChange={e => setFields(f => ({ ...f, zeitraum_bis: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exportformat">Exportformat</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exportformat_csv"
                  checked={lookupKeys(fields.exportformat).includes('csv')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.exportformat);
                      const next = checked ? [...current, 'csv'] : current.filter(k => k !== 'csv');
                      return { ...f, exportformat: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="exportformat_csv" className="font-normal">CSV-Datei</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exportformat_elster_extf"
                  checked={lookupKeys(fields.exportformat).includes('elster_extf')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.exportformat);
                      const next = checked ? [...current, 'elster_extf'] : current.filter(k => k !== 'elster_extf');
                      return { ...f, exportformat: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="exportformat_elster_extf" className="font-normal">ELSTER / DATEV EXTF</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exportstatus">Exportstatus</Label>
            <Select
              value={lookupKey(fields.exportstatus) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, exportstatus: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="exportstatus"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="ausstehend">Ausstehend</SelectItem>
                <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                <SelectItem value="fehler">Fehler</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exportdatum">Exportdatum</Label>
            <Input
              id="exportdatum"
              type="datetime-local"
              step="60"
              value={fields.exportdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, exportdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateiname">Dateiname</Label>
            <Input
              id="dateiname"
              value={fields.dateiname ?? ''}
              onChange={e => setFields(f => ({ ...f, dateiname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="export_bemerkung">Bemerkungen zum Export</Label>
            <Textarea
              id="export_bemerkung"
              value={fields.export_bemerkung ?? ''}
              onChange={e => setFields(f => ({ ...f, export_bemerkung: e.target.value }))}
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
