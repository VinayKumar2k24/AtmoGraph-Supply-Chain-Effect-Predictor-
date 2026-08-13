import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Package,
  Factory,
  Anchor,
  Globe,
  TrendingDown,
  AlertTriangle,
  Search,
  Share2,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { fetchRisk, fetchRiskEntities } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';

const TYPE_ICONS = {
  Supplier: Package,
  Manufacturer: Factory,
  Port: Anchor,
  Country: Globe,
};

function RiskBadge({ level }) {
  const colors = {
    HIGH: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
    MEDIUM: { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    LOW: { text: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
    CRITICAL: { text: '#dc2626', bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.4)' },
  };
  const c = colors[level] || { text: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' };
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '9999px',
        padding: '2px 8px',
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
      }}
    >
      {level}
    </span>
  );
}

const RISK_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="custom-chart-tooltip">
      <div className="tooltip-title">{d?.fullName || d?.name}</div>
      <div className="tooltip-row">
        <span className="tooltip-lbl">Risk Score:</span>
        <span className="tooltip-val" style={{ color: RISK_COLORS[d?.level] || '#818cf8' }}>
          {((payload[0]?.value || 0) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-lbl">Level:</span>
        <span className="tooltip-val">{d?.level}</span>
      </div>
    </div>
  );
};

export default function RiskPage() {
  const [riskData, setRiskData] = useState(null);
  const [entitiesList, setEntitiesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchRisk(), fetchRiskEntities()])
      .then(([rData, eData]) => {
        setRiskData(rData);
        setEntitiesList(eData?.entities || rData?.top_risks || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="page-loading-wrap">
        <div className="spinner" />
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: 12 }}>
          Calculating multi-tier risk metrics…
        </div>
      </div>
    );
  }

  const dist = riskData?.distribution || { CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 9 };
  const topRisks = riskData?.top_risks || [];

  // Multi-tier radar categories
  const radarData = [
    { subject: 'Supplier Risk', A: 0.35 },
    { subject: 'Port Congestion', A: 0.28 },
    { subject: 'Geopolitical', A: 0.18 },
    { subject: 'News Shock', A: 0.40 },
    { subject: 'Logistics Buffer', A: 0.15 },
    { subject: 'Lead Time Variance', A: 0.22 },
  ];

  // Bar chart data
  const barData = topRisks.slice(0, 6).map((e) => ({
    name: e.id,
    fullName: e.name,
    risk: e.risk_score || 0,
    level: e.risk_level,
  }));

  const filteredEntities = entitiesList.filter((e) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      e.name?.toLowerCase().includes(q) ||
      e.id?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q);

    const matchType = typeFilter === 'ALL' || e.type?.toLowerCase() === typeFilter.toLowerCase();
    const matchLevel = levelFilter === 'ALL' || e.risk_level === levelFilter;

    return matchSearch && matchType && matchLevel;
  });

  return (
    <div className="page-full-scroll">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="title-icon-badge" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }}>
              <ShieldAlert size={16} color="#ef4444" />
            </div>
            <h1 className="page-main-title">Supply Chain Risk Analytics</h1>
          </div>
          <p className="page-sub-title">
            Multi-tier supply chain risk scoring across suppliers, shipping ports, countries & products
          </p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadData} title="Recalculate risk scores">
            <RefreshCw size={13} />
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* Top 4 Risk KPI Cards */}
      <div className="risk-kpi-grid">
        {[
          { level: 'CRITICAL', count: dist.CRITICAL || 0, color: '#dc2626', icon: AlertTriangle, desc: 'Immediate intervention required' },
          { level: 'HIGH', count: dist.HIGH || 0, color: '#ef4444', icon: TrendingDown, desc: 'High disruption exposure' },
          { level: 'MEDIUM', count: dist.MEDIUM || 0, color: '#f59e0b', icon: ShieldAlert, desc: 'Monitored with buffer capacity' },
          { level: 'LOW', count: dist.LOW || 0, color: '#22c55e', icon: CheckCircle2, desc: 'Operating in normal parameters' },
        ].map(({ level, count, color, icon: Icon, desc }) => (
          <div key={level} className="risk-kpi-card" style={{ borderColor: `${color}35`, background: `${color}0c` }}>
            <div className="risk-kpi-top">
              <span className="risk-kpi-lbl" style={{ color }}>
                {level} RISKS
              </span>
              <Icon size={16} color={color} />
            </div>
            <div className="risk-kpi-number" style={{ color }}>
              {count}
            </div>
            <div className="risk-kpi-desc">{desc}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="risk-charts-grid">
        {/* Radar Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <ShieldAlert size={14} color="#818cf8" />
              <span>Multi-Dimensional Risk Vector</span>
            </div>
          </div>
          <div style={{ height: 230, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Radar name="Risk Index" dataKey="A" stroke="#818cf8" fill="#6366f1" fillOpacity={0.28} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <TrendingDown size={14} color="#f59e0b" />
              <span>Top Entity Risk Scores</span>
            </div>
          </div>
          <div style={{ height: 230, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 0.4]}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={RISK_COLORS[entry.level] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Risk Entity Table */}
      <div className="dash-card" style={{ marginTop: 16 }}>
        <div className="dash-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="dash-card-header-title">
            <ShieldAlert size={15} color="#818cf8" />
            <span>Monitored Supply Chain Entities ({filteredEntities.length})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ width: 220 }}>
              <Search size={13} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Filter entities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-pill-group">
              <span className="filter-label-text">Type:</span>
              {['ALL', 'Supplier', 'Manufacturer', 'Port'].map((t) => (
                <button
                  key={t}
                  className={`filter-btn-pill ${typeFilter === t ? 'active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="filter-pill-group">
              <span className="filter-label-text">Risk:</span>
              {['ALL', 'MEDIUM', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  className={`filter-btn-pill ${levelFilter === lvl ? 'active' : ''}`}
                  onClick={() => setLevelFilter(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="risk-entities-table-wrap">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>Entity Name & ID</th>
                <th>Classification</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Operating Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map((e, idx) => {
                const c = nodeTypeColors[e.type?.toLowerCase()] || '#64748b';
                const Icon = TYPE_ICONS[e.type] || Globe;
                const score = e.risk_score ?? 0;
                const scorePct = (score * 100).toFixed(0);

                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          className="table-icon-box"
                          style={{ background: `${c}15`, border: `1px solid ${c}30`, color: c }}
                        >
                          <Icon size={14} />
                        </div>
                        <div>
                          <div className="table-row-name">{e.name}</div>
                          <div className="table-row-mono-id">{e.id}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="table-type-badge" style={{ color: c, borderColor: `${c}30` }}>
                        {e.type}
                      </span>
                    </td>

                    <td>
                      <div className="table-risk-score-cell">
                        <span className="table-score-num" style={{ color: RISK_COLORS[e.risk_level] || '#94a3b8' }}>
                          {scorePct}%
                        </span>
                        <div className="table-score-bar-track">
                          <div
                            className="table-score-bar-fill"
                            style={{
                              width: `${Math.max(4, score * 100)}%`,
                              background: RISK_COLORS[e.risk_level] || '#6366f1',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <RiskBadge level={e.risk_level} />
                    </td>

                    <td>
                      <span className="table-status-pill">
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: e.status === 'NORMAL' || e.status === 'OPERATIONAL' ? '#22c55e' : '#ef4444',
                            boxShadow: `0 0 6px ${e.status === 'NORMAL' || e.status === 'OPERATIONAL' ? '#22c55e' : '#ef4444'}`,
                          }}
                        />
                        {e.status || 'NORMAL'}
                      </span>
                    </td>

                    <td>
                      <Link
                        to={`/graph?filter=${e.type?.toLowerCase()}`}
                        className="table-graph-link"
                        title="Locate entity in Knowledge Graph"
                      >
                        <Share2 size={12} /> View Graph
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
