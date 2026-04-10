import type { EnrichedBelegerfassung, EnrichedBelegpositionen, EnrichedKontierungUndPruefung } from '@/types/enriched';
import type { Belegerfassung, Belegpositionen, KontierungUndPruefung, Skr03Kontenrahmen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface BelegerfassungMaps {
  belegpositionenMap: Map<string, Belegpositionen>;
}

export function enrichBelegerfassung(
  belegerfassung: Belegerfassung[],
  maps: BelegerfassungMaps
): EnrichedBelegerfassung[] {
  return belegerfassung.map(r => ({
    ...r,
    belegpositionen_uebersichtName: resolveDisplay(r.fields.belegpositionen_uebersicht, maps.belegpositionenMap, 'rechnungsnummer'),
  }));
}

interface KontierungUndPruefungMaps {
  belegpositionenMap: Map<string, Belegpositionen>;
  skr03KontenrahmenMap: Map<string, Skr03Kontenrahmen>;
}

export function enrichKontierungUndPruefung(
  kontierungUndPruefung: KontierungUndPruefung[],
  maps: KontierungUndPruefungMaps
): EnrichedKontierungUndPruefung[] {
  return kontierungUndPruefung.map(r => ({
    ...r,
    position_referenzName: resolveDisplay(r.fields.position_referenz, maps.belegpositionenMap, 'rechnungsnummer'),
    skr03_konto_referenzName: resolveDisplay(r.fields.skr03_konto_referenz, maps.skr03KontenrahmenMap, 'kontonummer'),
  }));
}

interface BelegpositionenMaps {
  belegerfassungMap: Map<string, Belegerfassung>;
}

export function enrichBelegpositionen(
  belegpositionen: Belegpositionen[],
  maps: BelegpositionenMaps
): EnrichedBelegpositionen[] {
  return belegpositionen.map(r => ({
    ...r,
    beleg_referenzName: resolveDisplay(r.fields.beleg_referenz, maps.belegerfassungMap, 'beleg_bemerkung'),
  }));
}
