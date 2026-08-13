import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Share2,
  Package,
  Factory,
  Anchor,
  Globe,
  Newspaper,
  ShieldAlert,
  BarChart3,
  Settings,
  Database,
  Activity,
  Layers,
} from 'lucide-react';
import { graphStats, nodeTypeColors } from '../data/graphData.js';
import { fetchStats } from '../services/api.js';

export default function Sidebar() {
  const location = useLocation();
  const [stats, setStats] = useState(graphStats);

  useEffect(() => {
    fetchStats()
      .then((data) => {
        if (data && data.totalNodes) setStats(data);
      })
      .catch(() => {});
  }, []);

  const navSections = [
    {
      label: 'PLATFORM',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/graph', label: 'Supply Chain Graph', icon: Share2 },
      ],
    },
    {
      label: 'INTELLIGENCE',
      items: [
        { to: '/news', label: 'News Intelligence', icon: Newspaper, badge: '1' },
        { to: '/risk', label: 'Risk Analysis', icon: ShieldAlert },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      label: 'ENTITIES',
      items: [
        {
          to: '/graph?filter=supplier',
          label: 'Suppliers',
          icon: Package,
          count: stats.suppliers,
          color: nodeTypeColors.supplier,
          activeWhen: location.pathname === '/graph' && location.search.includes('supplier'),
        },
        {
          to: '/graph?filter=manufacturer',
          label: 'Manufacturers',
          icon: Factory,
          count: stats.manufacturers,
          color: nodeTypeColors.manufacturer,
          activeWhen: location.pathname === '/graph' && location.search.includes('manufacturer'),
        },
        {
          to: '/graph?filter=port',
          label: 'Ports & Countries',
          icon: Anchor,
          count: (stats.ports || 5) + (stats.countries || 5),
          color: nodeTypeColors.port,
          activeWhen: location.pathname === '/graph' && location.search.includes('port'),
        },
      ],
    },
  ];

  return (
    <aside className="app-sidebar">
      {navSections.map(({ label, items }) => (
        <div className="sidebar-section" key={label}>
          <div className="sidebar-label">{label}</div>
          {items.map(({ to, label: itemLabel, icon: Icon, badge, count, color, activeWhen }) => {
            const isEntityFilter = to.includes('?filter=');
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => {
                  if (isEntityFilter) {
                    return `sidebar-nav-item ${activeWhen ? 'active' : ''}`;
                  }
                  return `sidebar-nav-item ${isActive && !location.search ? 'active' : ''}`;
                }}
                end={to === '/dashboard'}
              >
                <Icon
                  size={15}
                  style={color ? { color } : {}}
                  className="sidebar-item-icon"
                />
                <span className="sidebar-item-label">{itemLabel}</span>

                {badge && (
                  <span className="sidebar-badge-red">
                    {badge}
                  </span>
                )}

                {count !== undefined && (
                  <span className="sidebar-count-badge">
                    {count}
                  </span>
                )}
              </NavLink>
            );
          })}
          <div className="sidebar-divider" />
        </div>
      ))}

      {/* Settings / Version at bottom */}
      <div className="sidebar-bottom-wrap">
        <NavLink
          to="/analytics"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={15} />
          <span>System Topology</span>
        </NavLink>

        <div className="sidebar-stats-box">
          <div className="sidebar-stats-head">
            <Database size={11} color="#818cf8" />
            <span>Neo4j Graph Engine</span>
          </div>
          <div className="sidebar-stats-row">
            <div className="stat-pill-box">
              <span className="stat-pill-num">{stats.totalNodes || 21}</span>
              <span className="stat-pill-lbl">Nodes</span>
            </div>
            <div className="stat-pill-box">
              <span className="stat-pill-num">{stats.totalRelationships || 29}</span>
              <span className="stat-pill-lbl">Edges</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
