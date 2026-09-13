import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Activity,
  RefreshCw,
  Bell,
  LogOut,
  Globe,
  Building,
  ChevronDown,
  User,
} from 'lucide-react';
import { fetchHealth, fetchStats } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ backendStatus }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [localStatus, setLocalStatus] = useState(backendStatus || 'checking');
  const [graphMetrics, setGraphMetrics] = useState({ totalNodes: 18, totalRelationships: 24 });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'EA';

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchStats();
      if (s && typeof s.totalNodes === 'number') {
        setGraphMetrics({
          totalNodes: s.totalNodes,
          totalRelationships: s.totalRelationships ?? 24,
        });
      }
    } catch {
      // Retain baseline verified graph counts if fetch fails
    }
  }, []);

  useEffect(() => {
    setLocalStatus(backendStatus || 'checking');
  }, [backendStatus]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [r] = await Promise.allSettled([fetchHealth(), loadStats()]);
      if (r.status === 'fulfilled') {
        setLocalStatus(r.value.connected ? 'online' : 'offline');
      } else {
        setLocalStatus('offline');
      }
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
          <span>Neo4j Graph · {graphMetrics.totalNodes} Nodes · {graphMetrics.totalRelationships} Edges</span>
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

        <div className="header-user-wrapper" ref={menuRef}>
          <div
            className="header-user-badge"
            onClick={() => setMenuOpen(!menuOpen)}
            title="User Profile & Settings"
          >
            <div className="header-avatar">{initials}</div>
            <span className="header-user-name">{user?.full_name || 'Enterprise Admin'}</span>
            <ChevronDown size={12} color="#94a3b8" />
          </div>

          {menuOpen && (
            <div className="header-user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-dropdown-name">{user?.full_name || 'Enterprise Admin'}</div>
                <div className="user-dropdown-email">{user?.email || 'demo@atmograph.ai'}</div>
                <div className="user-dropdown-org">{user?.organization || 'Global Logistics Corp'}</div>
              </div>

              <Link
                to="/"
                className="user-dropdown-item"
                onClick={() => setMenuOpen(false)}
              >
                <Globe size={14} color="#06b6d4" />
                <span>Public Website</span>
              </Link>

              <button
                type="button"
                className="user-dropdown-item danger"
                onClick={handleSignOut}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        <span className="header-week-badge">v2.0 Enterprise</span>
      </div>
    </header>
  );
}
