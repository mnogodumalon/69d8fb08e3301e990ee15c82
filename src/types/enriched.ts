import type { Belegerfassung, Belegpositionen, KontierungUndPruefung } from './app';

export type EnrichedBelegerfassung = Belegerfassung & {
  belegpositionen_uebersichtName: string;
};

export type EnrichedKontierungUndPruefung = KontierungUndPruefung & {
  position_referenzName: string;
  skr03_konto_referenzName: string;
};

export type EnrichedBelegpositionen = Belegpositionen & {
  beleg_referenzName: string;
};
