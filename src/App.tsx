import { HashRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import Skr03KontenrahmenPage from '@/pages/Skr03KontenrahmenPage';
import ExportUndAusgabePage from '@/pages/ExportUndAusgabePage';
import BelegerfassungPage from '@/pages/BelegerfassungPage';
import KontierungUndPruefungPage from '@/pages/KontierungUndPruefungPage';
import BelegpositionenPage from '@/pages/BelegpositionenPage';

const BelegErfassungIntentPage = lazy(() => import('@/pages/intents/BelegErfassungPage'));
const ExportWorkflowPage = lazy(() => import('@/pages/intents/ExportWorkflowPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="skr03-kontenrahmen" element={<Skr03KontenrahmenPage />} />
              <Route path="export-und-ausgabe" element={<ExportUndAusgabePage />} />
              <Route path="belegerfassung" element={<BelegerfassungPage />} />
              <Route path="kontierung-und-pruefung" element={<KontierungUndPruefungPage />} />
              <Route path="belegpositionen" element={<BelegpositionenPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="intents/beleg-erfassung" element={<Suspense fallback={null}><BelegErfassungIntentPage /></Suspense>} />
              <Route path="intents/export-workflow" element={<Suspense fallback={null}><ExportWorkflowPage /></Suspense>} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
