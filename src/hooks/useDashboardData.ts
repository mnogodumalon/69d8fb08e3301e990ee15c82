import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Skr03Kontenrahmen, KontierungUndPruefung, ExportUndAusgabe, Belegerfassung, Belegpositionen, Leasingfahrzeug, UstAbfuehrungLeasingfahrzeug } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [skr03Kontenrahmen, setSkr03Kontenrahmen] = useState<Skr03Kontenrahmen[]>([]);
  const [kontierungUndPruefung, setKontierungUndPruefung] = useState<KontierungUndPruefung[]>([]);
  const [exportUndAusgabe, setExportUndAusgabe] = useState<ExportUndAusgabe[]>([]);
  const [belegerfassung, setBelegerfassung] = useState<Belegerfassung[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [leasingfahrzeug, setLeasingfahrzeug] = useState<Leasingfahrzeug[]>([]);
  const [ustAbfuehrungLeasingfahrzeug, setUstAbfuehrungLeasingfahrzeug] = useState<UstAbfuehrungLeasingfahrzeug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [skr03KontenrahmenData, kontierungUndPruefungData, exportUndAusgabeData, belegerfassungData, belegpositionenData, leasingfahrzeugData, ustAbfuehrungLeasingfahrzeugData] = await Promise.all([
        LivingAppsService.getSkr03Kontenrahmen(),
        LivingAppsService.getKontierungUndPruefung(),
        LivingAppsService.getExportUndAusgabe(),
        LivingAppsService.getBelegerfassung(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getLeasingfahrzeug(),
        LivingAppsService.getUstAbfuehrungLeasingfahrzeug(),
      ]);
      setSkr03Kontenrahmen(skr03KontenrahmenData);
      setKontierungUndPruefung(kontierungUndPruefungData);
      setExportUndAusgabe(exportUndAusgabeData);
      setBelegerfassung(belegerfassungData);
      setBelegpositionen(belegpositionenData);
      setLeasingfahrzeug(leasingfahrzeugData);
      setUstAbfuehrungLeasingfahrzeug(ustAbfuehrungLeasingfahrzeugData);
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
        const [skr03KontenrahmenData, kontierungUndPruefungData, exportUndAusgabeData, belegerfassungData, belegpositionenData, leasingfahrzeugData, ustAbfuehrungLeasingfahrzeugData] = await Promise.all([
          LivingAppsService.getSkr03Kontenrahmen(),
          LivingAppsService.getKontierungUndPruefung(),
          LivingAppsService.getExportUndAusgabe(),
          LivingAppsService.getBelegerfassung(),
          LivingAppsService.getBelegpositionen(),
          LivingAppsService.getLeasingfahrzeug(),
          LivingAppsService.getUstAbfuehrungLeasingfahrzeug(),
        ]);
        setSkr03Kontenrahmen(skr03KontenrahmenData);
        setKontierungUndPruefung(kontierungUndPruefungData);
        setExportUndAusgabe(exportUndAusgabeData);
        setBelegerfassung(belegerfassungData);
        setBelegpositionen(belegpositionenData);
        setLeasingfahrzeug(leasingfahrzeugData);
        setUstAbfuehrungLeasingfahrzeug(ustAbfuehrungLeasingfahrzeugData);
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

  const leasingfahrzeugMap = useMemo(() => {
    const m = new Map<string, Leasingfahrzeug>();
    leasingfahrzeug.forEach(r => m.set(r.record_id, r));
    return m;
  }, [leasingfahrzeug]);

  return { skr03Kontenrahmen, setSkr03Kontenrahmen, kontierungUndPruefung, setKontierungUndPruefung, exportUndAusgabe, setExportUndAusgabe, belegerfassung, setBelegerfassung, belegpositionen, setBelegpositionen, leasingfahrzeug, setLeasingfahrzeug, ustAbfuehrungLeasingfahrzeug, setUstAbfuehrungLeasingfahrzeug, loading, error, fetchAll, skr03KontenrahmenMap, belegerfassungMap, belegpositionenMap, leasingfahrzeugMap };
}