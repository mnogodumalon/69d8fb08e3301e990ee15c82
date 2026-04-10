// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Belegerfassung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    belegtyp?: LookupValue;
    dokumentklassifikation?: LookupValue;
    ocr_status?: LookupValue;
    verarbeitungsstatus?: LookupValue;
    upload_datum?: string; // Format: YYYY-MM-DD oder ISO String
    beleg_bemerkung?: string;
    beleg_datei?: string;
  };
}

export interface ExportUndAusgabe {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    export_bezeichnung?: string;
    zeitraum_von?: string; // Format: YYYY-MM-DD oder ISO String
    zeitraum_bis?: string; // Format: YYYY-MM-DD oder ISO String
    exportformat?: LookupValue[];
    exportstatus?: LookupValue;
    exportdatum?: string; // Format: YYYY-MM-DD oder ISO String
    dateiname?: string;
    export_bemerkung?: string;
  };
}

export interface KontierungUndPruefung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    position_referenz?: string; // applookup -> URL zu 'Belegpositionen' Record
    skr03_konto_referenz?: string; // applookup -> URL zu 'Skr03Kontenrahmen' Record
    plausibilitaet?: LookupValue;
    konfidenz?: number;
    pruefhinweis?: string;
    manuell_korrigiert?: boolean;
    korrekturbemerkung?: string;
  };
}

export interface Skr03Kontenrahmen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kontonummer?: string;
    kontobezeichnung?: string;
    kontenklasse?: LookupValue;
    steuerkennung?: string;
    skr03_hinweis?: string;
  };
}

export interface Belegpositionen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    waehrung?: LookupValue;
    zahlungsart?: LookupValue;
    kartenart?: LookupValue;
    beleg_referenz?: string; // applookup -> URL zu 'Belegerfassung' Record
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    rechnungsnummer?: string;
    rechnungssteller?: string;
    adresse_strasse?: string;
    adresse_hausnummer?: string;
    adresse_plz?: string;
    adresse_ort?: string;
    ust_id?: string;
    artikel?: string;
    menge?: number;
    einheit?: string;
    einzelpreis?: number;
    betrag_netto?: number;
    mwst_satz?: LookupValue;
    mwst_betrag?: number;
    betrag_brutto?: number;
  };
}

export const APP_IDS = {
  BELEGERFASSUNG: '69d8fae8666f4fa5ddd1a8b6',
  EXPORT_UND_AUSGABE: '69d8faea03592afd38c20888',
  KONTIERUNG_UND_PRUEFUNG: '69d8faea4e6ba5c11bf424fd',
  SKR03_KONTENRAHMEN: '69d8fae09a27734ee7faa252',
  BELEGPOSITIONEN: '69d8fae8bbe0c2d0fb5178fa',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'belegerfassung': {
    belegtyp: [{ key: "eingangsrechnung", label: "Eingangsrechnung" }, { key: "ausgangsrechnung", label: "Ausgangsrechnung" }, { key: "gutschrift", label: "Gutschrift" }, { key: "kassenbon", label: "Kassenbon" }, { key: "reisekostenbeleg", label: "Reisekostenbeleg" }, { key: "sonstiger_beleg", label: "Sonstiger Beleg" }],
    dokumentklassifikation: [{ key: "rechnung", label: "Rechnung" }, { key: "gutschrift_klass", label: "Gutschrift" }, { key: "mahnung", label: "Mahnung" }, { key: "lieferschein", label: "Lieferschein" }, { key: "vertrag", label: "Vertrag" }, { key: "sonstiges", label: "Sonstiges" }],
    ocr_status: [{ key: "ausstehend", label: "Ausstehend" }, { key: "in_verarbeitung", label: "In Verarbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "fehler", label: "Fehler" }],
    verarbeitungsstatus: [{ key: "neu", label: "Neu" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "geprueft", label: "Geprüft" }, { key: "freigegeben", label: "Freigegeben" }, { key: "abgelehnt", label: "Abgelehnt" }],
  },
  'export_und_ausgabe': {
    exportformat: [{ key: "csv", label: "CSV-Datei" }, { key: "elster_extf", label: "ELSTER / DATEV EXTF" }],
    exportstatus: [{ key: "ausstehend", label: "Ausstehend" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "fehler", label: "Fehler" }],
  },
  'kontierung_und_pruefung': {
    plausibilitaet: [{ key: "pruefung_erforderlich", label: "Prüfung erforderlich" }, { key: "nicht_plausibel", label: "Nicht plausibel" }, { key: "nicht_geprueft", label: "Nicht geprüft" }, { key: "plausibel", label: "Plausibel" }],
  },
  'skr03_kontenrahmen': {
    kontenklasse: [{ key: "klasse_0", label: "Klasse 0 – Anlagevermögen" }, { key: "klasse_1", label: "Klasse 1 – Umlaufvermögen" }, { key: "klasse_2", label: "Klasse 2 – Eigenkapital" }, { key: "klasse_3", label: "Klasse 3 – Fremdkapital" }, { key: "klasse_4", label: "Klasse 4 – Betriebliche Aufwendungen" }, { key: "klasse_5", label: "Klasse 5 – Betriebliche Erträge" }, { key: "klasse_6", label: "Klasse 6 – Weitere Aufwendungen" }, { key: "klasse_7", label: "Klasse 7 – Weitere Erträge" }, { key: "klasse_8", label: "Klasse 8 – Abschlusskonten" }, { key: "klasse_9", label: "Klasse 9 – Vortragskonten" }],
  },
  'belegpositionen': {
    waehrung: [{ key: "eur", label: "EUR – Euro" }, { key: "usd", label: "USD – US-Dollar" }, { key: "chf", label: "CHF – Schweizer Franken" }, { key: "gbp", label: "GBP – Britisches Pfund" }, { key: "sonstige", label: "Sonstige" }],
    zahlungsart: [{ key: "ueberweisung", label: "Überweisung" }, { key: "lastschrift", label: "Lastschrift" }, { key: "kreditkarte", label: "Kreditkarte" }, { key: "ec_karte", label: "EC-Karte" }, { key: "bar", label: "Bar" }, { key: "paypal", label: "PayPal" }, { key: "sonstige_zahlung", label: "Sonstige" }],
    kartenart: [{ key: "visa", label: "Visa" }, { key: "mastercard", label: "Mastercard" }, { key: "amex", label: "American Express" }, { key: "diners", label: "Diners Club" }, { key: "sonstige_karte", label: "Sonstige" }, { key: "nicht_zutreffend", label: "Nicht zutreffend" }],
    mwst_satz: [{ key: "mwst_0", label: "0 %" }, { key: "mwst_7", label: "7 %" }, { key: "mwst_19", label: "19 %" }, { key: "mwst_sonstig", label: "Sonstiger Satz" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'belegerfassung': {
    'belegtyp': 'lookup/select',
    'dokumentklassifikation': 'lookup/select',
    'ocr_status': 'lookup/select',
    'verarbeitungsstatus': 'lookup/select',
    'upload_datum': 'date/datetimeminute',
    'beleg_bemerkung': 'string/textarea',
    'beleg_datei': 'file',
  },
  'export_und_ausgabe': {
    'export_bezeichnung': 'string/text',
    'zeitraum_von': 'date/date',
    'zeitraum_bis': 'date/date',
    'exportformat': 'multiplelookup/checkbox',
    'exportstatus': 'lookup/select',
    'exportdatum': 'date/datetimeminute',
    'dateiname': 'string/text',
    'export_bemerkung': 'string/textarea',
  },
  'kontierung_und_pruefung': {
    'position_referenz': 'applookup/select',
    'skr03_konto_referenz': 'applookup/select',
    'plausibilitaet': 'lookup/select',
    'konfidenz': 'number',
    'pruefhinweis': 'string/textarea',
    'manuell_korrigiert': 'bool',
    'korrekturbemerkung': 'string/textarea',
  },
  'skr03_kontenrahmen': {
    'kontonummer': 'string/text',
    'kontobezeichnung': 'string/text',
    'kontenklasse': 'lookup/select',
    'steuerkennung': 'string/text',
    'skr03_hinweis': 'string/textarea',
  },
  'belegpositionen': {
    'waehrung': 'lookup/select',
    'zahlungsart': 'lookup/select',
    'kartenart': 'lookup/select',
    'beleg_referenz': 'applookup/select',
    'rechnungsdatum': 'date/date',
    'rechnungsnummer': 'string/text',
    'rechnungssteller': 'string/text',
    'adresse_strasse': 'string/text',
    'adresse_hausnummer': 'string/text',
    'adresse_plz': 'string/text',
    'adresse_ort': 'string/text',
    'ust_id': 'string/text',
    'artikel': 'string/textarea',
    'menge': 'number',
    'einheit': 'string/text',
    'einzelpreis': 'number',
    'betrag_netto': 'number',
    'mwst_satz': 'lookup/select',
    'mwst_betrag': 'number',
    'betrag_brutto': 'number',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBelegerfassung = StripLookup<Belegerfassung['fields']>;
export type CreateExportUndAusgabe = StripLookup<ExportUndAusgabe['fields']>;
export type CreateKontierungUndPruefung = StripLookup<KontierungUndPruefung['fields']>;
export type CreateSkr03Kontenrahmen = StripLookup<Skr03Kontenrahmen['fields']>;
export type CreateBelegpositionen = StripLookup<Belegpositionen['fields']>;