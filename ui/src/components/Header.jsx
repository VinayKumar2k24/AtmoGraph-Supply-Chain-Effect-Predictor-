import { useEffect, useState } from 'react';
import { GitBranch, Activity, RefreshCw, Bell, ShieldCheck, Sparkles } from 'lucide-react';
import { fetchHealth } from '../services/api.js';

export default function Header({ backendStatus }) {
  const [refreshing, setRefreshing] = useState(false);
  const [localStatus, setLocalStatus] = useState(backendStatus || 'checking');

  useEffect(() => {
    setLocalStatus(backendStatus || 'checking');
  }, [backendStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetchHealth();
      setLocalStatus(r.connected ? 'online' : 'offline');
    } catch {
      setLocalStatus('offline');
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  const isOnline = localStatus === 'online';
  const statusColor = isOnline ? '#22c55e' : localStatus === 'offline' ? '#ef4444' : '#f59e0b';
  const statusText = isOnline ? 'Systems Online' : localStatus === 'offline' ? 'Backend Offline' : 'Connecting…';

  return (
    <header className="app-header">
      {/* Brand */}
      <div className="header-brand">
        <div className="header-logo">
          <GitBranch size={19} color="#fff" strokeWidth={2.4} />
        </div>
        <div className="header-title-block">
          <span className="header-title">AtmoGraph</span>
          <span className="header-subtitle">Supply Chain Intelligence Platform</span>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="header-center">
        <div
          className="header-badge"
          style={{
            background: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${statusColor}40`,
            color: statusColor,
          }}
        >
          <span
            className="header-badge-dot"
            style={{
              background: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
            }}
          />
          <span>{statusText}</span>
        </div>

        <div className="header-meta-stat">
          <Activity size={13} color="#818cf8" />
          <span>Neo4j Graph · 21 Nodes · 29 Edges</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="header-right">
        <button
          className="header-action-btn"
          onClick={handleRefresh}
          title="Refresh intelligence and verify backend connection"
        >
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          <span>Refresh</span>
        </button>

        <button className="header-icon-btn" title="Intelligence Alerts (1 Active)">
          <Bell size={14} />
          <span className="header-notification-dot" />
        </button>

        <div className="header-user-badge" title="Authenticated User: Lead Engineer">
          <div className="header-avatar">AG</div>
          <span className="header-user-name">Demo User</span>
        </div>

        <span className="header-week-badge">v2.0 Enterprise</span>
      </div>
    </header>
  );
}
