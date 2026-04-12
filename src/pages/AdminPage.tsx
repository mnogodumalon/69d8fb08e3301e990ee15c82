import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Skr03Kontenrahmen, KontierungUndPruefung, ExportUndAusgabe, Belegerfassung, Belegpositionen, Leasingfahrzeug, UstAbfuehrungLeasingfahrzeug } from '@/types/app';
import { LivingAppsService, extractRecordId, cleanFieldsForApi } from '@/services/livingAppsService';
import { Skr03KontenrahmenDialog } from '@/components/dialogs/Skr03KontenrahmenDialog';
import { Skr03KontenrahmenViewDialog } from '@/components/dialogs/Skr03KontenrahmenViewDialog';
import { KontierungUndPruefungDialog } from '@/components/dialogs/KontierungUndPruefungDialog';
import { KontierungUndPruefungViewDialog } from '@/components/dialogs/KontierungUndPruefungViewDialog';
import { ExportUndAusgabeDialog } from '@/components/dialogs/ExportUndAusgabeDialog';
import { ExportUndAusgabeViewDialog } from '@/components/dialogs/ExportUndAusgabeViewDialog';
import { BelegerfassungDialog } from '@/components/dialogs/BelegerfassungDialog';
import { BelegerfassungViewDialog } from '@/components/dialogs/BelegerfassungViewDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { BelegpositionenViewDialog } from '@/components/dialogs/BelegpositionenViewDialog';
import { LeasingfahrzeugDialog } from '@/components/dialogs/LeasingfahrzeugDialog';
import { LeasingfahrzeugViewDialog } from '@/components/dialogs/LeasingfahrzeugViewDialog';
import { UstAbfuehrungLeasingfahrzeugDialog } from '@/components/dialogs/UstAbfuehrungLeasingfahrzeugDialog';
import { UstAbfuehrungLeasingfahrzeugViewDialog } from '@/components/dialogs/UstAbfuehrungLeasingfahrzeugViewDialog';
import { BulkEditDialog } from '@/components/dialogs/BulkEditDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPencil, IconTrash, IconPlus, IconFilter, IconX, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconSearch, IconCopy, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

// Field metadata per entity for bulk edit and column filters
const SKR03KONTENRAHMEN_FIELDS = [
  { key: 'kontonummer', label: 'Kontonummer (SKR03)', type: 'string/text' },
  { key: 'kontobezeichnung', label: 'Kontobezeichnung', type: 'string/text' },
  { key: 'kontenklasse', label: 'Kontenklasse', type: 'lookup/select', options: [{ key: 'klasse_1', label: 'Klasse 1 – Umlaufvermögen' }, { key: 'klasse_2', label: 'Klasse 2 – Eigenkapital' }, { key: 'klasse_3', label: 'Klasse 3 – Fremdkapital' }, { key: 'klasse_4', label: 'Klasse 4 – Betriebliche Aufwendungen' }, { key: 'klasse_5', label: 'Klasse 5 – Betriebliche Erträge' }, { key: 'klasse_6', label: 'Klasse 6 – Weitere Aufwendungen' }, { key: 'klasse_7', label: 'Klasse 7 – Weitere Erträge' }, { key: 'klasse_8', label: 'Klasse 8 – Abschlusskonten' }, { key: 'klasse_9', label: 'Klasse 9 – Vortragskonten' }, { key: 'klasse_0', label: 'Klasse 0 – Anlagevermögen' }] },
  { key: 'steuerkennung', label: 'Steuerkennung', type: 'string/text' },
  { key: 'skr03_hinweis', label: 'Hinweis / Beschreibung', type: 'string/textarea' },
];
const KONTIERUNGUNDPRUEFUNG_FIELDS = [
  { key: 'position_referenz', label: 'Belegposition', type: 'applookup/select', targetEntity: 'belegpositionen', targetAppId: 'BELEGPOSITIONEN', displayField: 'rechnungsnummer' },
  { key: 'skr03_konto_referenz', label: 'SKR03-Konto', type: 'applookup/select', targetEntity: 'skr03_kontenrahmen', targetAppId: 'SKR03_KONTENRAHMEN', displayField: 'kontonummer' },
  { key: 'plausibilitaet', label: 'Plausibilität', type: 'lookup/select', options: [{ key: 'pruefung_erforderlich', label: 'Prüfung erforderlich' }, { key: 'nicht_plausibel', label: 'Nicht plausibel' }, { key: 'nicht_geprueft', label: 'Nicht geprüft' }, { key: 'plausibel', label: 'Plausibel' }] },
  { key: 'konfidenz', label: 'Konfidenz (%)', type: 'number' },
  { key: 'pruefhinweis', label: 'Prüfhinweis', type: 'string/textarea' },
  { key: 'manuell_korrigiert', label: 'Manuell korrigiert', type: 'bool' },
  { key: 'korrekturbemerkung', label: 'Korrekturbemerkung', type: 'string/textarea' },
];
const EXPORTUNDAUSGABE_FIELDS = [
  { key: 'export_bezeichnung', label: 'Exportbezeichnung', type: 'string/text' },
  { key: 'zeitraum_von', label: 'Zeitraum von', type: 'date/date' },
  { key: 'zeitraum_bis', label: 'Zeitraum bis', type: 'date/date' },
  { key: 'exportformat', label: 'Exportformat', type: 'multiplelookup/checkbox', options: [{ key: 'csv', label: 'CSV-Datei' }, { key: 'elster_extf', label: 'ELSTER / DATEV EXTF' }] },
  { key: 'exportstatus', label: 'Exportstatus', type: 'lookup/select', options: [{ key: 'ausstehend', label: 'Ausstehend' }, { key: 'in_bearbeitung', label: 'In Bearbeitung' }, { key: 'abgeschlossen', label: 'Abgeschlossen' }, { key: 'fehler', label: 'Fehler' }] },
  { key: 'exportdatum', label: 'Exportdatum', type: 'date/datetimeminute' },
  { key: 'dateiname', label: 'Dateiname', type: 'string/text' },
  { key: 'export_bemerkung', label: 'Bemerkungen zum Export', type: 'string/textarea' },
];
const BELEGERFASSUNG_FIELDS = [
  { key: 'belegtyp', label: 'Belegtyp', type: 'lookup/select', options: [{ key: 'eingangsrechnung', label: 'Eingangsrechnung' }, { key: 'ausgangsrechnung', label: 'Ausgangsrechnung' }, { key: 'gutschrift', label: 'Gutschrift' }, { key: 'kassenbon', label: 'Kassenbon' }, { key: 'reisekostenbeleg', label: 'Reisekostenbeleg' }, { key: 'sonstiger_beleg', label: 'Sonstiger Beleg' }] },
  { key: 'dokumentklassifikation', label: 'Dokumentklassifikation', type: 'lookup/select', options: [{ key: 'rechnung', label: 'Rechnung' }, { key: 'gutschrift_klass', label: 'Gutschrift' }, { key: 'mahnung', label: 'Mahnung' }, { key: 'lieferschein', label: 'Lieferschein' }, { key: 'vertrag', label: 'Vertrag' }, { key: 'sonstiges', label: 'Sonstiges' }] },
  { key: 'ocr_status', label: 'OCR-Status', type: 'lookup/select', options: [{ key: 'ausstehend', label: 'Ausstehend' }, { key: 'in_verarbeitung', label: 'In Verarbeitung' }, { key: 'abgeschlossen', label: 'Abgeschlossen' }, { key: 'fehler', label: 'Fehler' }] },
  { key: 'verarbeitungsstatus', label: 'Verarbeitungsstatus', type: 'lookup/select', options: [{ key: 'neu', label: 'Neu' }, { key: 'in_bearbeitung', label: 'In Bearbeitung' }, { key: 'geprueft', label: 'Geprüft' }, { key: 'freigegeben', label: 'Freigegeben' }, { key: 'abgelehnt', label: 'Abgelehnt' }] },
  { key: 'upload_datum', label: 'Upload-Datum', type: 'date/datetimeminute' },
  { key: 'beleg_bemerkung', label: 'Bemerkungen zum Beleg', type: 'string/textarea' },
  { key: 'beleg_datei', label: 'Beleg-Datei (PDF / JPG / PNG)', type: 'file' },
  { key: 'belegpositionen_uebersicht', label: 'Belegpositionen', type: 'applookup/select', targetEntity: 'belegpositionen', targetAppId: 'BELEGPOSITIONEN', displayField: 'rechnungsnummer' },
];
const BELEGPOSITIONEN_FIELDS = [
  { key: 'waehrung', label: 'Währung', type: 'lookup/select', options: [{ key: 'eur', label: 'EUR – Euro' }, { key: 'usd', label: 'USD – US-Dollar' }, { key: 'chf', label: 'CHF – Schweizer Franken' }, { key: 'gbp', label: 'GBP – Britisches Pfund' }, { key: 'sonstige', label: 'Sonstige' }] },
  { key: 'zahlungsart', label: 'Zahlungsart', type: 'lookup/select', options: [{ key: 'ueberweisung', label: 'Überweisung' }, { key: 'lastschrift', label: 'Lastschrift' }, { key: 'kreditkarte', label: 'Kreditkarte' }, { key: 'ec_karte', label: 'EC-Karte' }, { key: 'bar', label: 'Bar' }, { key: 'paypal', label: 'PayPal' }, { key: 'sonstige_zahlung', label: 'Sonstige' }] },
  { key: 'kartenart', label: 'Kartenart', type: 'lookup/select', options: [{ key: 'visa', label: 'Visa' }, { key: 'mastercard', label: 'Mastercard' }, { key: 'amex', label: 'American Express' }, { key: 'diners', label: 'Diners Club' }, { key: 'sonstige_karte', label: 'Sonstige' }, { key: 'nicht_zutreffend', label: 'Nicht zutreffend' }] },
  { key: 'beleg_referenz', label: 'Zugehöriger Beleg', type: 'applookup/select', targetEntity: 'belegerfassung', targetAppId: 'BELEGERFASSUNG', displayField: 'beleg_bemerkung' },
  { key: 'rechnungsdatum', label: 'Datum', type: 'date/date' },
  { key: 'rechnungsnummer', label: 'Rechnungsnummer', type: 'string/text' },
  { key: 'rechnungssteller', label: 'Rechnungssteller', type: 'string/text' },
  { key: 'adresse_strasse', label: 'Straße', type: 'string/text' },
  { key: 'adresse_hausnummer', label: 'Hausnummer', type: 'string/text' },
  { key: 'adresse_plz', label: 'Postleitzahl', type: 'string/text' },
  { key: 'adresse_ort', label: 'Ort', type: 'string/text' },
  { key: 'ust_id', label: 'USt-ID', type: 'string/text' },
  { key: 'artikel', label: 'Artikel / Leistungsbeschreibung', type: 'string/textarea' },
  { key: 'menge', label: 'Menge', type: 'number' },
  { key: 'einheit', label: 'Einheit', type: 'string/text' },
  { key: 'einzelpreis', label: 'Einzelpreis (EUR)', type: 'number' },
  { key: 'betrag_netto', label: 'Betrag netto (EUR)', type: 'number' },
  { key: 'mwst_satz', label: 'MwSt-Satz (%)', type: 'lookup/select', options: [{ key: 'mwst_0', label: '0 %' }, { key: 'mwst_7', label: '7 %' }, { key: 'mwst_19', label: '19 %' }, { key: 'mwst_sonstig', label: 'Sonstiger Satz' }] },
  { key: 'mwst_betrag', label: 'MwSt-Betrag (EUR)', type: 'number' },
  { key: 'betrag_brutto', label: 'Betrag brutto (EUR)', type: 'number' },
];
const LEASINGFAHRZEUG_FIELDS = [
  { key: 'fahrzeug_bezeichnung', label: 'Fahrzeugbezeichnung', type: 'string/text' },
  { key: 'kennzeichen', label: 'Kennzeichen', type: 'string/text' },
  { key: 'leasingvertrag_nummer', label: 'Leasingvertragsnummer', type: 'string/text' },
  { key: 'leasingrate_brutto', label: 'Leasingrate (brutto, EUR)', type: 'number' },
  { key: 'leasingbeginn', label: 'Leasingbeginn', type: 'date/date' },
  { key: 'leasingende', label: 'Leasingende', type: 'date/date' },
  { key: 'listenpreis_brutto', label: 'Listenpreis (brutto, EUR)', type: 'number' },
  { key: 'nutzungsart', label: 'Private Nutzungsmethode', type: 'lookup/select', options: [{ key: 'fahrtenbuch', label: 'Fahrtenbuch' }, { key: 'ein_prozent_regel', label: '1%-Regel' }] },
  { key: 'skr03_konto_leasing', label: 'SKR03-Konto für Leasingrate', type: 'applookup/select', targetEntity: 'skr03_kontenrahmen', targetAppId: 'SKR03_KONTENRAHMEN', displayField: 'kontonummer' },
  { key: 'skr03_konto_ust', label: 'SKR03-Konto für UST-Abführung', type: 'applookup/select', targetEntity: 'skr03_kontenrahmen', targetAppId: 'SKR03_KONTENRAHMEN', displayField: 'kontonummer' },
];
const USTABFUEHRUNGLEASINGFAHRZEUG_FIELDS = [
  { key: 'fahrzeug_referenz', label: 'Leasingfahrzeug', type: 'applookup/select', targetEntity: 'leasingfahrzeug', targetAppId: 'LEASINGFAHRZEUG', displayField: 'fahrzeug_bezeichnung' },
  { key: 'ust_zeitraum', label: 'Monat/Jahr', type: 'date/date' },
  { key: 'privatnutzung_betrag', label: 'Privatnutzungsbetrag (EUR)', type: 'number' },
  { key: 'bemessungsgrundlage_netto', label: 'Bemessungsgrundlage netto (EUR)', type: 'number' },
  { key: 'ust_satz', label: 'UST-Satz (%)', type: 'lookup/select', options: [{ key: 'ust_19', label: '19 %' }, { key: 'ust_7', label: '7 %' }] },
  { key: 'ust_betrag', label: 'UST-Betrag (EUR)', type: 'number' },
  { key: 'buchungstext', label: 'Buchungstext', type: 'string/textarea' },
  { key: 'belegposition_referenz', label: 'Belegposition (Buchhaltung)', type: 'applookup/select', targetEntity: 'belegpositionen', targetAppId: 'BELEGPOSITIONEN', displayField: 'rechnungsnummer' },
  { key: 'buchungsstatus', label: 'Buchungsstatus', type: 'lookup/select', options: [{ key: 'offen', label: 'Offen' }, { key: 'gebucht', label: 'Gebucht' }, { key: 'exportiert', label: 'Exportiert' }] },
  { key: 'ust_bemerkung', label: 'Bemerkungen', type: 'string/textarea' },
];

const ENTITY_TABS = [
  { key: 'skr03_kontenrahmen', label: 'SKR03-Kontenrahmen', pascal: 'Skr03Kontenrahmen' },
  { key: 'kontierung_und_pruefung', label: 'Kontierung und Prüfung', pascal: 'KontierungUndPruefung' },
  { key: 'export_und_ausgabe', label: 'Export und Ausgabe', pascal: 'ExportUndAusgabe' },
  { key: 'belegerfassung', label: 'Belegerfassung', pascal: 'Belegerfassung' },
  { key: 'belegpositionen', label: 'Belegpositionen', pascal: 'Belegpositionen' },
  { key: 'leasingfahrzeug', label: 'Leasingfahrzeug', pascal: 'Leasingfahrzeug' },
  { key: 'ust_abfuehrung_leasingfahrzeug', label: 'UST-Abführung Leasingfahrzeug', pascal: 'UstAbfuehrungLeasingfahrzeug' },
] as const;

type EntityKey = typeof ENTITY_TABS[number]['key'];

export default function AdminPage() {
  const data = useDashboardData();
  const { loading, error, fetchAll } = data;

  const [activeTab, setActiveTab] = useState<EntityKey>('skr03_kontenrahmen');
  const [selectedIds, setSelectedIds] = useState<Record<EntityKey, Set<string>>>(() => ({
    'skr03_kontenrahmen': new Set(),
    'kontierung_und_pruefung': new Set(),
    'export_und_ausgabe': new Set(),
    'belegerfassung': new Set(),
    'belegpositionen': new Set(),
    'leasingfahrzeug': new Set(),
    'ust_abfuehrung_leasingfahrzeug': new Set(),
  }));
  const [filters, setFilters] = useState<Record<EntityKey, Record<string, string>>>(() => ({
    'skr03_kontenrahmen': {},
    'kontierung_und_pruefung': {},
    'export_und_ausgabe': {},
    'belegerfassung': {},
    'belegpositionen': {},
    'leasingfahrzeug': {},
    'ust_abfuehrung_leasingfahrzeug': {},
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [dialogState, setDialogState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [createEntity, setCreateEntity] = useState<EntityKey | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<{ entity: EntityKey; ids: string[] } | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState<EntityKey | null>(null);
  const [viewState, setViewState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const getRecords = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'skr03_kontenrahmen': return (data as any).skr03Kontenrahmen as Skr03Kontenrahmen[] ?? [];
      case 'kontierung_und_pruefung': return (data as any).kontierungUndPruefung as KontierungUndPruefung[] ?? [];
      case 'export_und_ausgabe': return (data as any).exportUndAusgabe as ExportUndAusgabe[] ?? [];
      case 'belegerfassung': return (data as any).belegerfassung as Belegerfassung[] ?? [];
      case 'belegpositionen': return (data as any).belegpositionen as Belegpositionen[] ?? [];
      case 'leasingfahrzeug': return (data as any).leasingfahrzeug as Leasingfahrzeug[] ?? [];
      case 'ust_abfuehrung_leasingfahrzeug': return (data as any).ustAbfuehrungLeasingfahrzeug as UstAbfuehrungLeasingfahrzeug[] ?? [];
      default: return [];
    }
  }, [data]);

  const getLookupLists = useCallback((entity: EntityKey) => {
    const lists: Record<string, any[]> = {};
    switch (entity) {
      case 'kontierung_und_pruefung':
        lists.belegpositionenList = (data as any).belegpositionen ?? [];
        lists.skr03_kontenrahmenList = (data as any).skr03Kontenrahmen ?? [];
        break;
      case 'belegerfassung':
        lists.belegpositionenList = (data as any).belegpositionen ?? [];
        break;
      case 'belegpositionen':
        lists.belegerfassungList = (data as any).belegerfassung ?? [];
        break;
      case 'leasingfahrzeug':
        lists.skr03_kontenrahmenList = (data as any).skr03Kontenrahmen ?? [];
        break;
      case 'ust_abfuehrung_leasingfahrzeug':
        lists.leasingfahrzeugList = (data as any).leasingfahrzeug ?? [];
        lists.belegpositionenList = (data as any).belegpositionen ?? [];
        break;
    }
    return lists;
  }, [data]);

  const getApplookupDisplay = useCallback((entity: EntityKey, fieldKey: string, url?: unknown) => {
    if (!url) return '—';
    const id = extractRecordId(url);
    if (!id) return '—';
    const lists = getLookupLists(entity);
    void fieldKey; // ensure used for noUnusedParameters
    if (entity === 'kontierung_und_pruefung' && fieldKey === 'position_referenz') {
      const match = (lists.belegpositionenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.rechnungsnummer ?? '—';
    }
    if (entity === 'kontierung_und_pruefung' && fieldKey === 'skr03_konto_referenz') {
      const match = (lists.skr03_kontenrahmenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.kontonummer ?? '—';
    }
    if (entity === 'belegerfassung' && fieldKey === 'belegpositionen_uebersicht') {
      const match = (lists.belegpositionenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.rechnungsnummer ?? '—';
    }
    if (entity === 'belegpositionen' && fieldKey === 'beleg_referenz') {
      const match = (lists.belegerfassungList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.beleg_bemerkung ?? '—';
    }
    if (entity === 'leasingfahrzeug' && fieldKey === 'skr03_konto_leasing') {
      const match = (lists.skr03_kontenrahmenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.kontonummer ?? '—';
    }
    if (entity === 'leasingfahrzeug' && fieldKey === 'skr03_konto_ust') {
      const match = (lists.skr03_kontenrahmenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.kontonummer ?? '—';
    }
    if (entity === 'ust_abfuehrung_leasingfahrzeug' && fieldKey === 'fahrzeug_referenz') {
      const match = (lists.leasingfahrzeugList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.fahrzeug_bezeichnung ?? '—';
    }
    if (entity === 'ust_abfuehrung_leasingfahrzeug' && fieldKey === 'belegposition_referenz') {
      const match = (lists.belegpositionenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.rechnungsnummer ?? '—';
    }
    return String(url);
  }, [getLookupLists]);

  const getFieldMeta = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'skr03_kontenrahmen': return SKR03KONTENRAHMEN_FIELDS;
      case 'kontierung_und_pruefung': return KONTIERUNGUNDPRUEFUNG_FIELDS;
      case 'export_und_ausgabe': return EXPORTUNDAUSGABE_FIELDS;
      case 'belegerfassung': return BELEGERFASSUNG_FIELDS;
      case 'belegpositionen': return BELEGPOSITIONEN_FIELDS;
      case 'leasingfahrzeug': return LEASINGFAHRZEUG_FIELDS;
      case 'ust_abfuehrung_leasingfahrzeug': return USTABFUEHRUNGLEASINGFAHRZEUG_FIELDS;
      default: return [];
    }
  }, []);

  const getFilteredRecords = useCallback((entity: EntityKey) => {
    const records = getRecords(entity);
    const s = search.toLowerCase();
    const searched = !s ? records : records.filter((r: any) => {
      return Object.values(r.fields).some((v: any) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.some((item: any) => typeof item === 'object' && item !== null && 'label' in item ? String((item as any).label).toLowerCase().includes(s) : String(item).toLowerCase().includes(s));
        if (typeof v === 'object' && 'label' in (v as any)) return String((v as any).label).toLowerCase().includes(s);
        return String(v).toLowerCase().includes(s);
      });
    });
    const entityFilters = filters[entity] ?? {};
    const fieldMeta = getFieldMeta(entity);
    return searched.filter((r: any) => {
      return fieldMeta.every((fm: any) => {
        const fv = entityFilters[fm.key];
        if (!fv || fv === '') return true;
        const val = r.fields?.[fm.key];
        if (fm.type === 'bool') {
          if (fv === 'true') return val === true;
          if (fv === 'false') return val !== true;
          return true;
        }
        if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
          const label = val && typeof val === 'object' && 'label' in val ? val.label : '';
          return String(label).toLowerCase().includes(fv.toLowerCase());
        }
        if (fm.type.includes('multiplelookup')) {
          if (!Array.isArray(val)) return false;
          return val.some((item: any) => String(item?.label ?? '').toLowerCase().includes(fv.toLowerCase()));
        }
        if (fm.type.includes('applookup')) {
          const display = getApplookupDisplay(entity, fm.key, val);
          return String(display).toLowerCase().includes(fv.toLowerCase());
        }
        return String(val ?? '').toLowerCase().includes(fv.toLowerCase());
      });
    });
  }, [getRecords, filters, getFieldMeta, getApplookupDisplay, search]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(''); setSortDir('asc'); }
    } else { setSortKey(key); setSortDir('asc'); }
  }

  function sortRecords<T extends { fields: Record<string, any> }>(recs: T[]): T[] {
    if (!sortKey) return recs;
    return [...recs].sort((a, b) => {
      let va: any = a.fields[sortKey], vb: any = b.fields[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'object' && 'label' in va) va = va.label;
      if (typeof vb === 'object' && 'label' in vb) vb = vb.label;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const toggleSelect = useCallback((entity: EntityKey, id: string) => {
    setSelectedIds(prev => {
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (next[entity].has(id)) next[entity].delete(id);
      else next[entity].add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((entity: EntityKey) => {
    const filtered = getFilteredRecords(entity);
    setSelectedIds(prev => {
      const allSelected = filtered.every((r: any) => prev[entity].has(r.record_id));
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (allSelected) {
        filtered.forEach((r: any) => next[entity].delete(r.record_id));
      } else {
        filtered.forEach((r: any) => next[entity].add(r.record_id));
      }
      return next;
    });
  }, [getFilteredRecords]);

  const clearSelection = useCallback((entity: EntityKey) => {
    setSelectedIds(prev => ({ ...prev, [entity]: new Set() }));
  }, []);

  const getServiceMethods = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'skr03_kontenrahmen': return {
        create: (fields: any) => LivingAppsService.createSkr03KontenrahmenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateSkr03KontenrahmenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteSkr03KontenrahmenEntry(id),
      };
      case 'kontierung_und_pruefung': return {
        create: (fields: any) => LivingAppsService.createKontierungUndPruefungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateKontierungUndPruefungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteKontierungUndPruefungEntry(id),
      };
      case 'export_und_ausgabe': return {
        create: (fields: any) => LivingAppsService.createExportUndAusgabeEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateExportUndAusgabeEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteExportUndAusgabeEntry(id),
      };
      case 'belegerfassung': return {
        create: (fields: any) => LivingAppsService.createBelegerfassungEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateBelegerfassungEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteBelegerfassungEntry(id),
      };
      case 'belegpositionen': return {
        create: (fields: any) => LivingAppsService.createBelegpositionenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateBelegpositionenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteBelegpositionenEntry(id),
      };
      case 'leasingfahrzeug': return {
        create: (fields: any) => LivingAppsService.createLeasingfahrzeugEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateLeasingfahrzeugEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteLeasingfahrzeugEntry(id),
      };
      case 'ust_abfuehrung_leasingfahrzeug': return {
        create: (fields: any) => LivingAppsService.createUstAbfuehrungLeasingfahrzeugEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateUstAbfuehrungLeasingfahrzeugEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteUstAbfuehrungLeasingfahrzeugEntry(id),
      };
      default: return null;
    }
  }, []);

  async function handleCreate(entity: EntityKey, fields: any) {
    const svc = getServiceMethods(entity);
    if (!svc) return;
    await svc.create(fields);
    fetchAll();
    setCreateEntity(null);
  }

  async function handleUpdate(fields: any) {
    if (!dialogState) return;
    const svc = getServiceMethods(dialogState.entity);
    if (!svc) return;
    await svc.update(dialogState.record.record_id, fields);
    fetchAll();
    setDialogState(null);
  }

  async function handleBulkDelete() {
    if (!deleteTargets) return;
    const svc = getServiceMethods(deleteTargets.entity);
    if (!svc) return;
    setBulkLoading(true);
    try {
      for (const id of deleteTargets.ids) {
        await svc.remove(id);
      }
      clearSelection(deleteTargets.entity);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setDeleteTargets(null);
    }
  }

  async function handleBulkClone() {
    const svc = getServiceMethods(activeTab);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const records = getRecords(activeTab);
      const ids = Array.from(selectedIds[activeTab]);
      for (const id of ids) {
        const rec = records.find((r: any) => r.record_id === id);
        if (!rec) continue;
        const clean = cleanFieldsForApi(rec.fields, activeTab);
        await svc.create(clean as any);
      }
      clearSelection(activeTab);
      fetchAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkEdit(fieldKey: string, value: any) {
    if (!bulkEditOpen) return;
    const svc = getServiceMethods(bulkEditOpen);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds[bulkEditOpen]);
      for (const id of ids) {
        await svc.update(id, { [fieldKey]: value });
      }
      clearSelection(bulkEditOpen);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setBulkEditOpen(null);
    }
  }

  function updateFilter(entity: EntityKey, fieldKey: string, value: string) {
    setFilters(prev => ({
      ...prev,
      [entity]: { ...prev[entity], [fieldKey]: value },
    }));
  }

  function clearEntityFilters(entity: EntityKey) {
    setFilters(prev => ({ ...prev, [entity]: {} }));
  }

  const activeFilterCount = useMemo(() => {
    const f = filters[activeTab] ?? {};
    return Object.values(f).filter(v => v && v !== '').length;
  }, [filters, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive">{error.message}</p>
        <Button onClick={fetchAll}>Erneut versuchen</Button>
      </div>
    );
  }

  const filtered = getFilteredRecords(activeTab);
  const sel = selectedIds[activeTab];
  const allFiltered = filtered.every((r: any) => sel.has(r.record_id)) && filtered.length > 0;
  const fieldMeta = getFieldMeta(activeTab);

  return (
    <PageShell
      title="Verwaltung"
      subtitle="Alle Daten verwalten"
      action={
        <Button onClick={() => setCreateEntity(activeTab)} className="shrink-0">
          <IconPlus className="h-4 w-4 mr-2" /> Hinzufügen
        </Button>
      }
    >
      <div className="flex gap-2 flex-wrap">
        {ENTITY_TABS.map(tab => {
          const count = getRecords(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setSortKey(''); setSortDir('asc'); fetchAll(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="gap-2">
            <IconFilter className="h-4 w-4" />
            Filtern
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearEntityFilters(activeTab)}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
        {sel.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-muted/60 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{sel.size} ausgewählt</span>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(activeTab)}>
              <IconPencil className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Feld bearbeiten</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkClone()}>
              <IconCopy className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Kopieren</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteTargets({ entity: activeTab, ids: Array.from(sel) })}>
              <IconTrash className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Ausgewählte löschen</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => clearSelection(activeTab)}>
              <IconX className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Auswahl aufheben</span>
            </Button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
          {fieldMeta.map((fm: any) => (
            <div key={fm.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{fm.label}</label>
              {fm.type === 'bool' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="true">Ja</SelectItem>
                    <SelectItem value="false">Nein</SelectItem>
                  </SelectContent>
                </Select>
              ) : fm.type === 'lookup/select' || fm.type === 'lookup/radio' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {fm.options?.map((o: any) => (
                      <SelectItem key={o.key} value={o.label}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder="Filtern..."
                  value={filters[activeTab]?.[fm.key] ?? ''}
                  onChange={e => updateFilter(activeTab, fm.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[27px] bg-card shadow-lg overflow-x-auto">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="w-10 px-6">
                <Checkbox
                  checked={allFiltered}
                  onCheckedChange={() => toggleSelectAll(activeTab)}
                />
              </TableHead>
              {fieldMeta.map((fm: any) => (
                <TableHead key={fm.key} className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(fm.key)}>
                  <span className="inline-flex items-center gap-1">
                    {fm.label}
                    {sortKey === fm.key ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map((record: any) => (
              <TableRow key={record.record_id} className={`transition-colors cursor-pointer ${sel.has(record.record_id) ? "bg-primary/5" : "hover:bg-muted/50"}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewState({ entity: activeTab, record }); }}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(record.record_id)}
                    onCheckedChange={() => toggleSelect(activeTab, record.record_id)}
                  />
                </TableCell>
                {fieldMeta.map((fm: any) => {
                  const val = record.fields?.[fm.key];
                  if (fm.type === 'bool') {
                    return (
                      <TableCell key={fm.key}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          val ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {val ? 'Ja' : 'Nein'}
                        </span>
                      </TableCell>
                    );
                  }
                  if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{val?.label ?? '—'}</span></TableCell>;
                  }
                  if (fm.type.includes('multiplelookup')) {
                    return <TableCell key={fm.key}>{Array.isArray(val) ? val.map((v: any) => v?.label ?? v).join(', ') : '—'}</TableCell>;
                  }
                  if (fm.type.includes('applookup')) {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, val)}</span></TableCell>;
                  }
                  if (fm.type.includes('date')) {
                    return <TableCell key={fm.key} className="text-muted-foreground">{fmtDate(val)}</TableCell>;
                  }
                  if (fm.type.startsWith('file')) {
                    return (
                      <TableCell key={fm.key}>
                        {val ? (
                          <div className="relative h-8 w-8 rounded bg-muted overflow-hidden">
                            <img src={val} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type === 'string/textarea') {
                    return <TableCell key={fm.key} className="max-w-xs"><span className="truncate block">{val ?? '—'}</span></TableCell>;
                  }
                  if (fm.type === 'geo') {
                    return (
                      <TableCell key={fm.key} className="max-w-[200px]">
                        <span className="truncate block" title={val ? `${val.lat}, ${val.long}` : undefined}>
                          {val?.info ?? (val ? `${val.lat?.toFixed(4)}, ${val.long?.toFixed(4)}` : '—')}
                        </span>
                      </TableCell>
                    );
                  }
                  return <TableCell key={fm.key}>{val ?? '—'}</TableCell>;
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialogState({ entity: activeTab, record })}>
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTargets({ entity: activeTab, ids: [record.record_id] })}>
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={fieldMeta.length + 2} className="text-center py-16 text-muted-foreground">
                  Keine Ergebnisse gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(createEntity === 'skr03_kontenrahmen' || dialogState?.entity === 'skr03_kontenrahmen') && (
        <Skr03KontenrahmenDialog
          open={createEntity === 'skr03_kontenrahmen' || dialogState?.entity === 'skr03_kontenrahmen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'skr03_kontenrahmen' ? handleUpdate : (fields: any) => handleCreate('skr03_kontenrahmen', fields)}
          defaultValues={dialogState?.entity === 'skr03_kontenrahmen' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Skr03Kontenrahmen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Skr03Kontenrahmen']}
        />
      )}
      {(createEntity === 'kontierung_und_pruefung' || dialogState?.entity === 'kontierung_und_pruefung') && (
        <KontierungUndPruefungDialog
          open={createEntity === 'kontierung_und_pruefung' || dialogState?.entity === 'kontierung_und_pruefung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'kontierung_und_pruefung' ? handleUpdate : (fields: any) => handleCreate('kontierung_und_pruefung', fields)}
          defaultValues={dialogState?.entity === 'kontierung_und_pruefung' ? dialogState.record?.fields : undefined}
          belegpositionenList={(data as any).belegpositionen ?? []}
          skr03_kontenrahmenList={(data as any).skr03Kontenrahmen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['KontierungUndPruefung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['KontierungUndPruefung']}
        />
      )}
      {(createEntity === 'export_und_ausgabe' || dialogState?.entity === 'export_und_ausgabe') && (
        <ExportUndAusgabeDialog
          open={createEntity === 'export_und_ausgabe' || dialogState?.entity === 'export_und_ausgabe'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'export_und_ausgabe' ? handleUpdate : (fields: any) => handleCreate('export_und_ausgabe', fields)}
          defaultValues={dialogState?.entity === 'export_und_ausgabe' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['ExportUndAusgabe']}
          enablePhotoLocation={AI_PHOTO_LOCATION['ExportUndAusgabe']}
        />
      )}
      {(createEntity === 'belegerfassung' || dialogState?.entity === 'belegerfassung') && (
        <BelegerfassungDialog
          open={createEntity === 'belegerfassung' || dialogState?.entity === 'belegerfassung'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'belegerfassung' ? handleUpdate : (fields: any) => handleCreate('belegerfassung', fields)}
          defaultValues={dialogState?.entity === 'belegerfassung' ? dialogState.record?.fields : undefined}
          belegpositionenList={(data as any).belegpositionen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Belegerfassung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Belegerfassung']}
        />
      )}
      {(createEntity === 'belegpositionen' || dialogState?.entity === 'belegpositionen') && (
        <BelegpositionenDialog
          open={createEntity === 'belegpositionen' || dialogState?.entity === 'belegpositionen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'belegpositionen' ? handleUpdate : (fields: any) => handleCreate('belegpositionen', fields)}
          defaultValues={dialogState?.entity === 'belegpositionen' ? dialogState.record?.fields : undefined}
          belegerfassungList={(data as any).belegerfassung ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Belegpositionen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Belegpositionen']}
        />
      )}
      {(createEntity === 'leasingfahrzeug' || dialogState?.entity === 'leasingfahrzeug') && (
        <LeasingfahrzeugDialog
          open={createEntity === 'leasingfahrzeug' || dialogState?.entity === 'leasingfahrzeug'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'leasingfahrzeug' ? handleUpdate : (fields: any) => handleCreate('leasingfahrzeug', fields)}
          defaultValues={dialogState?.entity === 'leasingfahrzeug' ? dialogState.record?.fields : undefined}
          skr03_kontenrahmenList={(data as any).skr03Kontenrahmen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Leasingfahrzeug']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Leasingfahrzeug']}
        />
      )}
      {(createEntity === 'ust_abfuehrung_leasingfahrzeug' || dialogState?.entity === 'ust_abfuehrung_leasingfahrzeug') && (
        <UstAbfuehrungLeasingfahrzeugDialog
          open={createEntity === 'ust_abfuehrung_leasingfahrzeug' || dialogState?.entity === 'ust_abfuehrung_leasingfahrzeug'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'ust_abfuehrung_leasingfahrzeug' ? handleUpdate : (fields: any) => handleCreate('ust_abfuehrung_leasingfahrzeug', fields)}
          defaultValues={dialogState?.entity === 'ust_abfuehrung_leasingfahrzeug' ? dialogState.record?.fields : undefined}
          leasingfahrzeugList={(data as any).leasingfahrzeug ?? []}
          belegpositionenList={(data as any).belegpositionen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['UstAbfuehrungLeasingfahrzeug']}
          enablePhotoLocation={AI_PHOTO_LOCATION['UstAbfuehrungLeasingfahrzeug']}
        />
      )}
      {viewState?.entity === 'skr03_kontenrahmen' && (
        <Skr03KontenrahmenViewDialog
          open={viewState?.entity === 'skr03_kontenrahmen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'skr03_kontenrahmen', record: r }); }}
        />
      )}
      {viewState?.entity === 'kontierung_und_pruefung' && (
        <KontierungUndPruefungViewDialog
          open={viewState?.entity === 'kontierung_und_pruefung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'kontierung_und_pruefung', record: r }); }}
          belegpositionenList={(data as any).belegpositionen ?? []}
          skr03_kontenrahmenList={(data as any).skr03Kontenrahmen ?? []}
        />
      )}
      {viewState?.entity === 'export_und_ausgabe' && (
        <ExportUndAusgabeViewDialog
          open={viewState?.entity === 'export_und_ausgabe'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'export_und_ausgabe', record: r }); }}
        />
      )}
      {viewState?.entity === 'belegerfassung' && (
        <BelegerfassungViewDialog
          open={viewState?.entity === 'belegerfassung'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'belegerfassung', record: r }); }}
          belegpositionenList={(data as any).belegpositionen ?? []}
        />
      )}
      {viewState?.entity === 'belegpositionen' && (
        <BelegpositionenViewDialog
          open={viewState?.entity === 'belegpositionen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'belegpositionen', record: r }); }}
          belegerfassungList={(data as any).belegerfassung ?? []}
        />
      )}
      {viewState?.entity === 'leasingfahrzeug' && (
        <LeasingfahrzeugViewDialog
          open={viewState?.entity === 'leasingfahrzeug'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'leasingfahrzeug', record: r }); }}
          skr03_kontenrahmenList={(data as any).skr03Kontenrahmen ?? []}
        />
      )}
      {viewState?.entity === 'ust_abfuehrung_leasingfahrzeug' && (
        <UstAbfuehrungLeasingfahrzeugViewDialog
          open={viewState?.entity === 'ust_abfuehrung_leasingfahrzeug'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'ust_abfuehrung_leasingfahrzeug', record: r }); }}
          leasingfahrzeugList={(data as any).leasingfahrzeug ?? []}
          belegpositionenList={(data as any).belegpositionen ?? []}
        />
      )}

      <BulkEditDialog
        open={!!bulkEditOpen}
        onClose={() => setBulkEditOpen(null)}
        onApply={handleBulkEdit}
        fields={bulkEditOpen ? getFieldMeta(bulkEditOpen) : []}
        selectedCount={bulkEditOpen ? selectedIds[bulkEditOpen].size : 0}
        loading={bulkLoading}
        lookupLists={bulkEditOpen ? getLookupLists(bulkEditOpen) : {}}
      />

      <ConfirmDialog
        open={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        onConfirm={handleBulkDelete}
        title="Ausgewählte löschen"
        description={`Sollen ${deleteTargets?.ids.length ?? 0} Einträge wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
    </PageShell>
  );
}