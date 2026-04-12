import type { Belegerfassung, Belegpositionen, KontierungUndPruefung, Leasingfahrzeug, UstAbfuehrungLeasingfahrzeug } from './app';

export type EnrichedKontierungUndPruefung = KontierungUndPruefung & {
  position_referenzName: string;
  skr03_konto_referenzName: string;
};

export type EnrichedBelegerfassung = Belegerfassung & {
  belegpositionen_uebersichtName: string;
};

export type EnrichedBelegpositionen = Belegpositionen & {
  beleg_referenzName: string;
};

export type EnrichedLeasingfahrzeug = Leasingfahrzeug & {
  skr03_konto_leasingName: string;
  skr03_konto_ustName: string;
};

export type EnrichedUstAbfuehrungLeasingfahrzeug = UstAbfuehrungLeasingfahrzeug & {
  fahrzeug_referenzName: string;
  belegposition_referenzName: string;
};
