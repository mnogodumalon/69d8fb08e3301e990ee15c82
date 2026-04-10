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

const KLAR_BASE = 'http://localhost:8000/claude';

async function submitPublicForm(fields: Record<string, unknown>) {
  const res = await fetch(`${KLAR_BASE}/public/69d8fb08e3301e990ee15c82/69d8fae8bbe0c2d0fb5178fa/submit`, {
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

export default function PublicFormBelegpositionen() {
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
          <h1 className="text-2xl font-bold text-foreground">Belegpositionen — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="waehrung">Währung</Label>
            <Select
              value={lookupKey(fields.waehrung) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, waehrung: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="waehrung"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="eur">EUR – Euro</SelectItem>
                <SelectItem value="usd">USD – US-Dollar</SelectItem>
                <SelectItem value="chf">CHF – Schweizer Franken</SelectItem>
                <SelectItem value="gbp">GBP – Britisches Pfund</SelectItem>
                <SelectItem value="sonstige">Sonstige</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zahlungsart">Zahlungsart</Label>
            <Select
              value={lookupKey(fields.zahlungsart) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zahlungsart: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="zahlungsart"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="ueberweisung">Überweisung</SelectItem>
                <SelectItem value="lastschrift">Lastschrift</SelectItem>
                <SelectItem value="kreditkarte">Kreditkarte</SelectItem>
                <SelectItem value="ec_karte">EC-Karte</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="sonstige_zahlung">Sonstige</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kartenart">Kartenart</Label>
            <Select
              value={lookupKey(fields.kartenart) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, kartenart: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="kartenart"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="mastercard">Mastercard</SelectItem>
                <SelectItem value="amex">American Express</SelectItem>
                <SelectItem value="diners">Diners Club</SelectItem>
                <SelectItem value="sonstige_karte">Sonstige</SelectItem>
                <SelectItem value="nicht_zutreffend">Nicht zutreffend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rechnungsdatum">Datum</Label>
            <Input
              id="rechnungsdatum"
              type="date"
              value={fields.rechnungsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, rechnungsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rechnungsnummer">Rechnungsnummer</Label>
            <Input
              id="rechnungsnummer"
              value={fields.rechnungsnummer ?? ''}
              onChange={e => setFields(f => ({ ...f, rechnungsnummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rechnungssteller">Rechnungssteller</Label>
            <Input
              id="rechnungssteller"
              value={fields.rechnungssteller ?? ''}
              onChange={e => setFields(f => ({ ...f, rechnungssteller: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adresse_strasse">Straße</Label>
            <Input
              id="adresse_strasse"
              value={fields.adresse_strasse ?? ''}
              onChange={e => setFields(f => ({ ...f, adresse_strasse: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adresse_hausnummer">Hausnummer</Label>
            <Input
              id="adresse_hausnummer"
              value={fields.adresse_hausnummer ?? ''}
              onChange={e => setFields(f => ({ ...f, adresse_hausnummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adresse_plz">Postleitzahl</Label>
            <Input
              id="adresse_plz"
              value={fields.adresse_plz ?? ''}
              onChange={e => setFields(f => ({ ...f, adresse_plz: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adresse_ort">Ort</Label>
            <Input
              id="adresse_ort"
              value={fields.adresse_ort ?? ''}
              onChange={e => setFields(f => ({ ...f, adresse_ort: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ust_id">USt-ID</Label>
            <Input
              id="ust_id"
              value={fields.ust_id ?? ''}
              onChange={e => setFields(f => ({ ...f, ust_id: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="artikel">Artikel / Leistungsbeschreibung</Label>
            <Textarea
              id="artikel"
              value={fields.artikel ?? ''}
              onChange={e => setFields(f => ({ ...f, artikel: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menge">Menge</Label>
            <Input
              id="menge"
              type="number"
              value={fields.menge ?? ''}
              onChange={e => setFields(f => ({ ...f, menge: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="einheit">Einheit</Label>
            <Input
              id="einheit"
              value={fields.einheit ?? ''}
              onChange={e => setFields(f => ({ ...f, einheit: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="einzelpreis">Einzelpreis (EUR)</Label>
            <Input
              id="einzelpreis"
              type="number"
              value={fields.einzelpreis ?? ''}
              onChange={e => setFields(f => ({ ...f, einzelpreis: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="betrag_netto">Betrag netto (EUR)</Label>
            <Input
              id="betrag_netto"
              type="number"
              value={fields.betrag_netto ?? ''}
              onChange={e => setFields(f => ({ ...f, betrag_netto: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_satz">MwSt-Satz (%)</Label>
            <Select
              value={lookupKey(fields.mwst_satz) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, mwst_satz: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="mwst_satz"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="mwst_0">0 %</SelectItem>
                <SelectItem value="mwst_7">7 %</SelectItem>
                <SelectItem value="mwst_19">19 %</SelectItem>
                <SelectItem value="mwst_sonstig">Sonstiger Satz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_betrag">MwSt-Betrag (EUR)</Label>
            <Input
              id="mwst_betrag"
              type="number"
              value={fields.mwst_betrag ?? ''}
              onChange={e => setFields(f => ({ ...f, mwst_betrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="betrag_brutto">Betrag brutto (EUR)</Label>
            <Input
              id="betrag_brutto"
              type="number"
              value={fields.betrag_brutto ?? ''}
              onChange={e => setFields(f => ({ ...f, betrag_brutto: e.target.value ? Number(e.target.value) : undefined }))}
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
