import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import InstancesPage from "./pages/InstancesPage";
import SettingsPage from "./pages/SettingsPage";
import WikiPage from "./pages/WikiPage";
import WebhooksPage from "./pages/WebhooksPage";
import AnalyticsPage from "./pages/AnalyticsPage";

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/instances" replace />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
            <Route path="/wiki" element={<WikiPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
