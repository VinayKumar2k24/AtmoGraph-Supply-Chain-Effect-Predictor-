import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import DashboardOverview from './pages/DashboardOverview.jsx';
import GraphPage from './pages/GraphPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import NewsDetailPage from './pages/NewsDetailPage.jsx';
import RiskPage from './pages/RiskPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import { fetchHealth } from './services/api.js';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    fetchHealth()
      .then((r) => setBackendStatus(r.connected ? 'online' : 'offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Header backendStatus={backendStatus} />
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/graph"     element={<GraphPage />} />
            <Route path="/news"      element={<NewsPage />} />
            <Route path="/news/:id"  element={<NewsDetailPage />} />
            <Route path="/risk"      element={<RiskPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
