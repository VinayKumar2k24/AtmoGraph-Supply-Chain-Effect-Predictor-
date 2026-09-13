import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import DashboardOverview from './pages/DashboardOverview.jsx';
import GraphPage from './pages/GraphPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import NewsDetailPage from './pages/NewsDetailPage.jsx';
import RiskPage from './pages/RiskPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LiveWebSocketProvider } from './context/LiveWebSocketContext.jsx';
import { fetchHealth } from './services/api.js';
import RealtimeEventIndicator from './components/RealtimeEventIndicator.jsx';

function PlatformShell({ backendStatus }) {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Header backendStatus={backendStatus} />
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
        <RealtimeEventIndicator />
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    fetchHealth()
      .then((r) => setBackendStatus(r.connected ? 'online' : 'offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <LiveWebSocketProvider>
          <Routes>
            {/* ─── Public Routes ─────────────────────────────────────────── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* ─── Protected Platform Routes ─────────────────────────────── */}
            <Route element={<PlatformShell backendStatus={backendStatus} />}>
              <Route path="/dashboard" element={<DashboardOverview />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/news/:id" element={<NewsDetailPage />} />
              <Route path="/nlp-inspect/:id" element={<NewsDetailPage />} />
              <Route path="/nlp-inspect" element={<NewsDetailPage />} />
              <Route path="/risk" element={<RiskPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>

            {/* ─── Fallback ──────────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LiveWebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
