import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import Skr03KontenrahmenPage from '@/pages/Skr03KontenrahmenPage';
import KontierungUndPruefungPage from '@/pages/KontierungUndPruefungPage';
import ExportUndAusgabePage from '@/pages/ExportUndAusgabePage';
import BelegerfassungPage from '@/pages/BelegerfassungPage';
import BelegpositionenPage from '@/pages/BelegpositionenPage';
import LeasingfahrzeugPage from '@/pages/LeasingfahrzeugPage';
import UstAbfuehrungLeasingfahrzeugPage from '@/pages/UstAbfuehrungLeasingfahrzeugPage';

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
              <Route path="skr03-kontenrahmen" element={<Skr03KontenrahmenPage />} />
              <Route path="kontierung-und-pruefung" element={<KontierungUndPruefungPage />} />
              <Route path="export-und-ausgabe" element={<ExportUndAusgabePage />} />
              <Route path="belegerfassung" element={<BelegerfassungPage />} />
              <Route path="belegpositionen" element={<BelegpositionenPage />} />
              <Route path="leasingfahrzeug" element={<LeasingfahrzeugPage />} />
              <Route path="ust-abfuehrung-leasingfahrzeug" element={<UstAbfuehrungLeasingfahrzeugPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
