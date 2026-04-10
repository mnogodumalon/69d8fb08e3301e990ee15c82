import type { Belegpositionen, KontierungUndPruefung } from './app';

export type EnrichedBelegpositionen = Belegpositionen & {
  beleg_referenzName: string;
};

export type EnrichedKontierungUndPruefung = KontierungUndPruefung & {
  position_referenzName: string;
  skr03_konto_referenzName: string;
};
