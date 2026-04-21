import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
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
import PublicFormBelegerfassung from '@/pages/public/PublicForm_Belegerfassung';
import PublicFormExportUndAusgabe from '@/pages/public/PublicForm_ExportUndAusgabe';
import PublicFormLeasingfahrzeug from '@/pages/public/PublicForm_Leasingfahrzeug';
import PublicFormKontierungUndPruefung from '@/pages/public/PublicForm_KontierungUndPruefung';
import PublicFormSkr03Kontenrahmen from '@/pages/public/PublicForm_Skr03Kontenrahmen';
import PublicFormUstAbfuehrungLeasingfahrzeug from '@/pages/public/PublicForm_UstAbfuehrungLeasingfahrzeug';
import PublicFormBelegpositionen from '@/pages/public/PublicForm_Belegpositionen';
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/69d8fae8666f4fa5ddd1a8b6" element={<PublicFormBelegerfassung />} />
              <Route path="public/69d8faea03592afd38c20888" element={<PublicFormExportUndAusgabe />} />
              <Route path="public/69db659e5fd46be27d40b8da" element={<PublicFormLeasingfahrzeug />} />
              <Route path="public/69d8faea4e6ba5c11bf424fd" element={<PublicFormKontierungUndPruefung />} />
              <Route path="public/69d8fae09a27734ee7faa252" element={<PublicFormSkr03Kontenrahmen />} />
              <Route path="public/69db65a253c3e15463e34826" element={<PublicFormUstAbfuehrungLeasingfahrzeug />} />
              <Route path="public/69d8fae8bbe0c2d0fb5178fa" element={<PublicFormBelegpositionen />} />
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
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
