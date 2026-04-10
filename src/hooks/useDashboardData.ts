import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Belegerfassung, ExportUndAusgabe, KontierungUndPruefung, Skr03Kontenrahmen, Belegpositionen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [belegerfassung, setBelegerfassung] = useState<Belegerfassung[]>([]);
  const [exportUndAusgabe, setExportUndAusgabe] = useState<ExportUndAusgabe[]>([]);
  const [kontierungUndPruefung, setKontierungUndPruefung] = useState<KontierungUndPruefung[]>([]);
  const [skr03Kontenrahmen, setSkr03Kontenrahmen] = useState<Skr03Kontenrahmen[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [belegerfassungData, exportUndAusgabeData, kontierungUndPruefungData, skr03KontenrahmenData, belegpositionenData] = await Promise.all([
        LivingAppsService.getBelegerfassung(),
        LivingAppsService.getExportUndAusgabe(),
        LivingAppsService.getKontierungUndPruefung(),
        LivingAppsService.getSkr03Kontenrahmen(),
        LivingAppsService.getBelegpositionen(),
      ]);
      setBelegerfassung(belegerfassungData);
      setExportUndAusgabe(exportUndAusgabeData);
      setKontierungUndPruefung(kontierungUndPruefungData);
      setSkr03Kontenrahmen(skr03KontenrahmenData);
      setBelegpositionen(belegpositionenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [belegerfassungData, exportUndAusgabeData, kontierungUndPruefungData, skr03KontenrahmenData, belegpositionenData] = await Promise.all([
          LivingAppsService.getBelegerfassung(),
          LivingAppsService.getExportUndAusgabe(),
          LivingAppsService.getKontierungUndPruefung(),
          LivingAppsService.getSkr03Kontenrahmen(),
          LivingAppsService.getBelegpositionen(),
        ]);
        setBelegerfassung(belegerfassungData);
        setExportUndAusgabe(exportUndAusgabeData);
        setKontierungUndPruefung(kontierungUndPruefungData);
        setSkr03Kontenrahmen(skr03KontenrahmenData);
        setBelegpositionen(belegpositionenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const belegerfassungMap = useMemo(() => {
    const m = new Map<string, Belegerfassung>();
    belegerfassung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belegerfassung]);

  const skr03KontenrahmenMap = useMemo(() => {
    const m = new Map<string, Skr03Kontenrahmen>();
    skr03Kontenrahmen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [skr03Kontenrahmen]);

  const belegpositionenMap = useMemo(() => {
    const m = new Map<string, Belegpositionen>();
    belegpositionen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belegpositionen]);

  return { belegerfassung, setBelegerfassung, exportUndAusgabe, setExportUndAusgabe, kontierungUndPruefung, setKontierungUndPruefung, skr03Kontenrahmen, setSkr03Kontenrahmen, belegpositionen, setBelegpositionen, loading, error, fetchAll, belegerfassungMap, skr03KontenrahmenMap, belegpositionenMap };
}