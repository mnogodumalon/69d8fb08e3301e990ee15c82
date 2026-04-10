import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Skr03Kontenrahmen, Belegerfassung, Belegpositionen, KontierungUndPruefung, ExportUndAusgabe } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [skr03Kontenrahmen, setSkr03Kontenrahmen] = useState<Skr03Kontenrahmen[]>([]);
  const [belegerfassung, setBelegerfassung] = useState<Belegerfassung[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [kontierungUndPruefung, setKontierungUndPruefung] = useState<KontierungUndPruefung[]>([]);
  const [exportUndAusgabe, setExportUndAusgabe] = useState<ExportUndAusgabe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [skr03KontenrahmenData, belegerfassungData, belegpositionenData, kontierungUndPruefungData, exportUndAusgabeData] = await Promise.all([
        LivingAppsService.getSkr03Kontenrahmen(),
        LivingAppsService.getBelegerfassung(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getKontierungUndPruefung(),
        LivingAppsService.getExportUndAusgabe(),
      ]);
      setSkr03Kontenrahmen(skr03KontenrahmenData);
      setBelegerfassung(belegerfassungData);
      setBelegpositionen(belegpositionenData);
      setKontierungUndPruefung(kontierungUndPruefungData);
      setExportUndAusgabe(exportUndAusgabeData);
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
        const [skr03KontenrahmenData, belegerfassungData, belegpositionenData, kontierungUndPruefungData, exportUndAusgabeData] = await Promise.all([
          LivingAppsService.getSkr03Kontenrahmen(),
          LivingAppsService.getBelegerfassung(),
          LivingAppsService.getBelegpositionen(),
          LivingAppsService.getKontierungUndPruefung(),
          LivingAppsService.getExportUndAusgabe(),
        ]);
        setSkr03Kontenrahmen(skr03KontenrahmenData);
        setBelegerfassung(belegerfassungData);
        setBelegpositionen(belegpositionenData);
        setKontierungUndPruefung(kontierungUndPruefungData);
        setExportUndAusgabe(exportUndAusgabeData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const skr03KontenrahmenMap = useMemo(() => {
    const m = new Map<string, Skr03Kontenrahmen>();
    skr03Kontenrahmen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [skr03Kontenrahmen]);

  const belegerfassungMap = useMemo(() => {
    const m = new Map<string, Belegerfassung>();
    belegerfassung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belegerfassung]);

  const belegpositionenMap = useMemo(() => {
    const m = new Map<string, Belegpositionen>();
    belegpositionen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belegpositionen]);

  return { skr03Kontenrahmen, setSkr03Kontenrahmen, belegerfassung, setBelegerfassung, belegpositionen, setBelegpositionen, kontierungUndPruefung, setKontierungUndPruefung, exportUndAusgabe, setExportUndAusgabe, loading, error, fetchAll, skr03KontenrahmenMap, belegerfassungMap, belegpositionenMap };
}