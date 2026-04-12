import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Belegerfassung, UstAbfuehrungLeasingfahrzeug, ExportUndAusgabe, Skr03Kontenrahmen, Leasingfahrzeug, KontierungUndPruefung, Belegpositionen, Beleguebersicht } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [belegerfassung, setBelegerfassung] = useState<Belegerfassung[]>([]);
  const [ustAbfuehrungLeasingfahrzeug, setUstAbfuehrungLeasingfahrzeug] = useState<UstAbfuehrungLeasingfahrzeug[]>([]);
  const [exportUndAusgabe, setExportUndAusgabe] = useState<ExportUndAusgabe[]>([]);
  const [skr03Kontenrahmen, setSkr03Kontenrahmen] = useState<Skr03Kontenrahmen[]>([]);
  const [leasingfahrzeug, setLeasingfahrzeug] = useState<Leasingfahrzeug[]>([]);
  const [kontierungUndPruefung, setKontierungUndPruefung] = useState<KontierungUndPruefung[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [beleguebersicht, setBeleguebersicht] = useState<Beleguebersicht[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [belegerfassungData, ustAbfuehrungLeasingfahrzeugData, exportUndAusgabeData, skr03KontenrahmenData, leasingfahrzeugData, kontierungUndPruefungData, belegpositionenData, beleguebersichtData] = await Promise.all([
        LivingAppsService.getBelegerfassung(),
        LivingAppsService.getUstAbfuehrungLeasingfahrzeug(),
        LivingAppsService.getExportUndAusgabe(),
        LivingAppsService.getSkr03Kontenrahmen(),
        LivingAppsService.getLeasingfahrzeug(),
        LivingAppsService.getKontierungUndPruefung(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getBeleguebersicht(),
      ]);
      setBelegerfassung(belegerfassungData);
      setUstAbfuehrungLeasingfahrzeug(ustAbfuehrungLeasingfahrzeugData);
      setExportUndAusgabe(exportUndAusgabeData);
      setSkr03Kontenrahmen(skr03KontenrahmenData);
      setLeasingfahrzeug(leasingfahrzeugData);
      setKontierungUndPruefung(kontierungUndPruefungData);
      setBelegpositionen(belegpositionenData);
      setBeleguebersicht(beleguebersichtData);
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
        const [belegerfassungData, ustAbfuehrungLeasingfahrzeugData, exportUndAusgabeData, skr03KontenrahmenData, leasingfahrzeugData, kontierungUndPruefungData, belegpositionenData, beleguebersichtData] = await Promise.all([
          LivingAppsService.getBelegerfassung(),
          LivingAppsService.getUstAbfuehrungLeasingfahrzeug(),
          LivingAppsService.getExportUndAusgabe(),
          LivingAppsService.getSkr03Kontenrahmen(),
          LivingAppsService.getLeasingfahrzeug(),
          LivingAppsService.getKontierungUndPruefung(),
          LivingAppsService.getBelegpositionen(),
          LivingAppsService.getBeleguebersicht(),
        ]);
        setBelegerfassung(belegerfassungData);
        setUstAbfuehrungLeasingfahrzeug(ustAbfuehrungLeasingfahrzeugData);
        setExportUndAusgabe(exportUndAusgabeData);
        setSkr03Kontenrahmen(skr03KontenrahmenData);
        setLeasingfahrzeug(leasingfahrzeugData);
        setKontierungUndPruefung(kontierungUndPruefungData);
        setBelegpositionen(belegpositionenData);
        setBeleguebersicht(beleguebersichtData);
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

  const ustAbfuehrungLeasingfahrzeugMap = useMemo(() => {
    const m = new Map<string, UstAbfuehrungLeasingfahrzeug>();
    ustAbfuehrungLeasingfahrzeug.forEach(r => m.set(r.record_id, r));
    return m;
  }, [ustAbfuehrungLeasingfahrzeug]);

  const skr03KontenrahmenMap = useMemo(() => {
    const m = new Map<string, Skr03Kontenrahmen>();
    skr03Kontenrahmen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [skr03Kontenrahmen]);

  const leasingfahrzeugMap = useMemo(() => {
    const m = new Map<string, Leasingfahrzeug>();
    leasingfahrzeug.forEach(r => m.set(r.record_id, r));
    return m;
  }, [leasingfahrzeug]);

  const belegpositionenMap = useMemo(() => {
    const m = new Map<string, Belegpositionen>();
    belegpositionen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belegpositionen]);

  return { belegerfassung, setBelegerfassung, ustAbfuehrungLeasingfahrzeug, setUstAbfuehrungLeasingfahrzeug, exportUndAusgabe, setExportUndAusgabe, skr03Kontenrahmen, setSkr03Kontenrahmen, leasingfahrzeug, setLeasingfahrzeug, kontierungUndPruefung, setKontierungUndPruefung, belegpositionen, setBelegpositionen, beleguebersicht, setBeleguebersicht, loading, error, fetchAll, belegerfassungMap, ustAbfuehrungLeasingfahrzeugMap, skr03KontenrahmenMap, leasingfahrzeugMap, belegpositionenMap };
}