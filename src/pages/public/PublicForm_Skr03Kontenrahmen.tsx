import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { lookupKey } from '@/lib/formatters';

const KLAR_BASE = 'https://my.living-apps.de/claude';

async function submitPublicForm(fields: Record<string, unknown>) {
  const res = await fetch(`${KLAR_BASE}/public/69d8fb08e3301e990ee15c82/69d8fae09a27734ee7faa252/submit`, {
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

export default function PublicFormSkr03Kontenrahmen() {
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
          <h1 className="text-2xl font-bold text-foreground">SKR03-Kontenrahmen — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="kontonummer">Kontonummer (SKR03)</Label>
            <Input
              id="kontonummer"
              value={fields.kontonummer ?? ''}
              onChange={e => setFields(f => ({ ...f, kontonummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontobezeichnung">Kontobezeichnung</Label>
            <Input
              id="kontobezeichnung"
              value={fields.kontobezeichnung ?? ''}
              onChange={e => setFields(f => ({ ...f, kontobezeichnung: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontenklasse">Kontenklasse</Label>
            <Select
              value={lookupKey(fields.kontenklasse) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, kontenklasse: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="kontenklasse"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="klasse_0">Klasse 0 – Anlagevermögen</SelectItem>
                <SelectItem value="klasse_1">Klasse 1 – Umlaufvermögen</SelectItem>
                <SelectItem value="klasse_2">Klasse 2 – Eigenkapital</SelectItem>
                <SelectItem value="klasse_3">Klasse 3 – Fremdkapital</SelectItem>
                <SelectItem value="klasse_4">Klasse 4 – Betriebliche Aufwendungen</SelectItem>
                <SelectItem value="klasse_5">Klasse 5 – Betriebliche Erträge</SelectItem>
                <SelectItem value="klasse_6">Klasse 6 – Weitere Aufwendungen</SelectItem>
                <SelectItem value="klasse_7">Klasse 7 – Weitere Erträge</SelectItem>
                <SelectItem value="klasse_8">Klasse 8 – Abschlusskonten</SelectItem>
                <SelectItem value="klasse_9">Klasse 9 – Vortragskonten</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="steuerkennung">Steuerkennung</Label>
            <Input
              id="steuerkennung"
              value={fields.steuerkennung ?? ''}
              onChange={e => setFields(f => ({ ...f, steuerkennung: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skr03_hinweis">Hinweis / Beschreibung</Label>
            <Textarea
              id="skr03_hinweis"
              value={fields.skr03_hinweis ?? ''}
              onChange={e => setFields(f => ({ ...f, skr03_hinweis: e.target.value }))}
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
