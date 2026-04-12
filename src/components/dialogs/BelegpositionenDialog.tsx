import { useState, useEffect, useRef, useCallback } from 'react';
import type { Belegpositionen, Belegerfassung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconArrowBigDownLinesFilled, IconCamera, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

interface BelegpositionenDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Belegpositionen['fields']) => Promise<void>;
  defaultValues?: Belegpositionen['fields'];
  belegerfassungList: Belegerfassung[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function BelegpositionenDialog({ open, onClose, onSubmit, defaultValues, belegerfassungList, enablePhotoScan = true, enablePhotoLocation = true }: BelegpositionenDialogProps) {
  const [fields, setFields] = useState<Partial<Belegpositionen['fields']>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    if (open) {
      setFields(defaultValues ?? {});
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
    }
  }, [open, defaultValues]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = cleanFieldsForApi({ ...fields }, 'belegpositionen');
      await onSubmit(clean as Belegpositionen['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="beleg_referenz" entity="Belegerfassung">\n${JSON.stringify(belegerfassungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "waehrung": LookupValue | null, // Währung (select one key: "eur" | "usd" | "chf" | "gbp" | "sonstige") mapping: eur=EUR – Euro, usd=USD – US-Dollar, chf=CHF – Schweizer Franken, gbp=GBP – Britisches Pfund, sonstige=Sonstige\n  "zahlungsart": LookupValue | null, // Zahlungsart (select one key: "ueberweisung" | "lastschrift" | "kreditkarte" | "ec_karte" | "bar" | "paypal" | "sonstige_zahlung") mapping: ueberweisung=Überweisung, lastschrift=Lastschrift, kreditkarte=Kreditkarte, ec_karte=EC-Karte, bar=Bar, paypal=PayPal, sonstige_zahlung=Sonstige\n  "kartenart": LookupValue | null, // Kartenart (select one key: "visa" | "mastercard" | "amex" | "diners" | "sonstige_karte" | "nicht_zutreffend") mapping: visa=Visa, mastercard=Mastercard, amex=American Express, diners=Diners Club, sonstige_karte=Sonstige, nicht_zutreffend=Nicht zutreffend\n  "beleg_referenz": string | null, // Display name from Belegerfassung (see <available-records>)\n  "rechnungsdatum": string | null, // YYYY-MM-DD\n  "rechnungsnummer": string | null, // Rechnungsnummer\n  "rechnungssteller": string | null, // Rechnungssteller\n  "adresse_strasse": string | null, // Straße\n  "adresse_hausnummer": string | null, // Hausnummer\n  "adresse_plz": string | null, // Postleitzahl\n  "adresse_ort": string | null, // Ort\n  "ust_id": string | null, // USt-ID\n  "artikel": string | null, // Artikel / Leistungsbeschreibung\n  "menge": number | null, // Menge\n  "einheit": string | null, // Einheit\n  "einzelpreis": number | null, // Einzelpreis (EUR)\n  "betrag_netto": number | null, // Betrag netto (EUR)\n  "mwst_satz": LookupValue | null, // MwSt-Satz (%) (select one key: "mwst_0" | "mwst_7" | "mwst_19" | "mwst_sonstig") mapping: mwst_0=0 %, mwst_7=7 %, mwst_19=19 %, mwst_sonstig=Sonstiger Satz\n  "mwst_betrag": number | null, // MwSt-Betrag (EUR)\n  "betrag_brutto": number | null, // Betrag brutto (EUR)\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["beleg_referenz"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const beleg_referenzName = raw['beleg_referenz'] as string | null;
        if (beleg_referenzName) {
          const beleg_referenzMatch = belegerfassungList.find(r => matchName(beleg_referenzName!, [String(r.fields.beleg_bemerkung ?? '')]));
          if (beleg_referenzMatch) merged['beleg_referenz'] = createRecordUrl(APP_IDS.BELEGERFASSUNG, beleg_referenzMatch.record_id);
        }
        return merged as Partial<Belegpositionen['fields']>;
      });
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Belegpositionen bearbeiten' : 'Belegpositionen hinzufügen';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_INTENT}</DialogTitle>
        </DialogHeader>

        {enablePhotoScan && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <IconSparkles className="h-4 w-4 text-primary" />
                KI-Assistent
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            </div>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
            <div className="flex justify-center pt-1">
              <IconArrowBigDownLinesFilled className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="beleg_referenz">Zugehöriger Beleg</Label>
            <Select
              value={extractRecordId(fields.beleg_referenz) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, beleg_referenz: v === 'none' ? undefined : createRecordUrl(APP_IDS.BELEGERFASSUNG, v) }))}
            >
              <SelectTrigger id="beleg_referenz"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
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