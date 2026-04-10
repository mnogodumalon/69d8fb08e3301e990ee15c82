import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import Skr03KontenrahmenPage from '@/pages/Skr03KontenrahmenPage';
import BelegerfassungPage from '@/pages/BelegerfassungPage';
import BelegpositionenPage from '@/pages/BelegpositionenPage';
import KontierungUndPruefungPage from '@/pages/KontierungUndPruefungPage';
import ExportUndAusgabePage from '@/pages/ExportUndAusgabePage';
import PublicFormSkr03Kontenrahmen from '@/pages/public/PublicForm_Skr03Kontenrahmen';
import PublicFormBelegerfassung from '@/pages/public/PublicForm_Belegerfassung';
import PublicFormBelegpositionen from '@/pages/public/PublicForm_Belegpositionen';
import PublicFormKontierungUndPruefung from '@/pages/public/PublicForm_KontierungUndPruefung';
import PublicFormExportUndAusgabe from '@/pages/public/PublicForm_ExportUndAusgabe';

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route path="public/69d8fae09a27734ee7faa252" element={<PublicFormSkr03Kontenrahmen />} />
            <Route path="public/69d8fae8666f4fa5ddd1a8b6" element={<PublicFormBelegerfassung />} />
            <Route path="public/69d8fae8bbe0c2d0fb5178fa" element={<PublicFormBelegpositionen />} />
            <Route path="public/69d8faea4e6ba5c11bf424fd" element={<PublicFormKontierungUndPruefung />} />
            <Route path="public/69d8faea03592afd38c20888" element={<PublicFormExportUndAusgabe />} />
            <Route element={<Layout />}>
              <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
              <Route path="skr03-kontenrahmen" element={<Skr03KontenrahmenPage />} />
              <Route path="belegerfassung" element={<BelegerfassungPage />} />
              <Route path="belegpositionen" element={<BelegpositionenPage />} />
              <Route path="kontierung-und-pruefung" element={<KontierungUndPruefungPage />} />
              <Route path="export-und-ausgabe" element={<ExportUndAusgabePage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
