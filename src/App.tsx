import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import BelegerfassungPage from '@/pages/BelegerfassungPage';
import UstAbfuehrungLeasingfahrzeugPage from '@/pages/UstAbfuehrungLeasingfahrzeugPage';
import ExportUndAusgabePage from '@/pages/ExportUndAusgabePage';
import Skr03KontenrahmenPage from '@/pages/Skr03KontenrahmenPage';
import LeasingfahrzeugPage from '@/pages/LeasingfahrzeugPage';
import KontierungUndPruefungPage from '@/pages/KontierungUndPruefungPage';
import BelegpositionenPage from '@/pages/BelegpositionenPage';
import BeleguebersichtPage from '@/pages/BeleguebersichtPage';

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
              <Route path="belegerfassung" element={<BelegerfassungPage />} />
              <Route path="ust-abfuehrung-leasingfahrzeug" element={<UstAbfuehrungLeasingfahrzeugPage />} />
              <Route path="export-und-ausgabe" element={<ExportUndAusgabePage />} />
              <Route path="skr03-kontenrahmen" element={<Skr03KontenrahmenPage />} />
              <Route path="leasingfahrzeug" element={<LeasingfahrzeugPage />} />
              <Route path="kontierung-und-pruefung" element={<KontierungUndPruefungPage />} />
              <Route path="belegpositionen" element={<BelegpositionenPage />} />
              <Route path="beleguebersicht" element={<BeleguebersichtPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
