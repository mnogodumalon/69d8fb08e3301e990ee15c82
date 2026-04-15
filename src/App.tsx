import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import BelegerfassungPage from '@/pages/BelegerfassungPage';
import ExportUndAusgabePage from '@/pages/ExportUndAusgabePage';
import LeasingfahrzeugPage from '@/pages/LeasingfahrzeugPage';
import KontierungUndPruefungPage from '@/pages/KontierungUndPruefungPage';
import Skr03KontenrahmenPage from '@/pages/Skr03KontenrahmenPage';
import UstAbfuehrungLeasingfahrzeugPage from '@/pages/UstAbfuehrungLeasingfahrzeugPage';
import BelegpositionenPage from '@/pages/BelegpositionenPage';
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="belegerfassung" element={<BelegerfassungPage />} />
              <Route path="export-und-ausgabe" element={<ExportUndAusgabePage />} />
              <Route path="leasingfahrzeug" element={<LeasingfahrzeugPage />} />
              <Route path="kontierung-und-pruefung" element={<KontierungUndPruefungPage />} />
              <Route path="skr03-kontenrahmen" element={<Skr03KontenrahmenPage />} />
              <Route path="ust-abfuehrung-leasingfahrzeug" element={<UstAbfuehrungLeasingfahrzeugPage />} />
              <Route path="belegpositionen" element={<BelegpositionenPage />} />
              <Route path="admin" element={<AdminPage />} />
              {/* <custom:routes> */}
              {/* </custom:routes> */}
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
