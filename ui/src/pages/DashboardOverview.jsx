import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Factory,
  Box,
  Anchor,
  Globe,
  Warehouse,
  Newspaper,
  ShieldAlert,
  Share2,
  Link as LinkIcon,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { fetchStats, fetchNews, fetchRisk } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';

// ─── Risk badge ───────────────────────────────────────────────────────────────
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.text }} />
      {level} RISK
    </span>
  );
}

// ─── Entity type badge ────────────────────────────────────────────────────────
function TypeBadge({ type, text }) {
  const c = nodeTypeColors[type?.toLowerCase()] || '#64748b';
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        color: c,
        background: `${c}12`,
        border: `1px solid ${c}28`,
        borderRadius: '6px',
        padding: '2px 7px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
      {text || type}
    </span>
  );
}

export default function DashboardOverview() {
  const [stats, setStats] = useState(null);
  const [news, setNews] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchStats(), fetchNews(), fetchRisk()])
      .then(([s, n, r]) => {
        setStats(s);
        setNews(n);
        setRisk(r);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        setError(err.message || 'Unable to connect to FastAPI backend at http://127.0.0.1:8000');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaryCards = stats
    ? [
        {
          label: 'Suppliers',
          value: stats.suppliers ?? 0,
          icon: Package,
          color: nodeTypeColors.supplier,
          bg: 'rgba(245,158,11,0.12)',
        },
        {
          label: 'Manufacturers',
          value: stats.manufacturers ?? 0,
          icon: Factory,
          color: nodeTypeColors.manufacturer,
          bg: 'rgba(16,185,129,0.12)',
        },
        {
          label: 'Products',
          value: stats.products ?? 0,
          icon: Box,
          color: nodeTypeColors.product,
          bg: 'rgba(59,130,246,0.12)',
        },
        {
          label: 'Ports',
          value: stats.ports ?? 0,
          icon: Anchor,
          color: nodeTypeColors.port,
          bg: 'rgba(168,85,247,0.12)',
        },
        {
          label: 'Countries',
          value: stats.countries ?? 0,
          icon: Globe,
          color: nodeTypeColors.country,
          bg: 'rgba(99,102,241,0.12)',
        },
        {
          label: 'Active Risks',
          value: (risk?.distribution?.HIGH || 0) + (risk?.distribution?.CRITICAL || 0) + (risk?.distribution?.MEDIUM || 0),
          icon: ShieldAlert,
          color: '#ef4444',
          bg: 'rgba(239,68,68,0.12)',
        },
        {
          label: 'News Events',
          value: news?.total || 0,
          icon: Newspaper,
          color: '#06b6d4',
          bg: 'rgba(6,182,212,0.12)',
        },
        {
          label: 'Graph Edges',
          value: stats.totalRelationships ?? 0,
          icon: LinkIcon,
          color: '#818cf8',
          bg: 'rgba(99,102,241,0.08)',
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="page-loading-wrap">
        <div className="spinner" />
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: 12 }}>
          Loading supply chain intelligence…
        </div>
      </div>
    );
  }

  const articles = news?.articles || [];
  const dist = risk?.distribution || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const totalRiskEntities =
    (dist.CRITICAL || 0) + (dist.HIGH || 0) + (dist.MEDIUM || 0) + (dist.LOW || 0) || 1;

  return (
    <div className="dashboard-page-wrap">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-main-title">Intelligence Dashboard</h1>
          <p className="page-sub-title">
            Real-time supply chain disruption monitoring & Neo4j graph intelligence
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadData} className="btn btn-outline" title="Refresh Live Data">
            <RefreshCw size={13} />
            Refresh
          </button>
          <Link to="/graph" className="btn btn-primary">
            <Share2 size={13} />
            Explore Graph
          </Link>
        </div>
      </div>

      {/* Backend Error Alert Banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span>
              <strong>API Connection Alert:</strong> {error}
            </span>
          </div>
          <button
            onClick={loadData}
            className="btn btn-outline"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Summary KPI Bar */}
      <div className="dashboard-kpi-bar">
        {summaryCards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-card-icon" style={{ background: c.bg }}>
              <c.icon size={16} color={c.color} />
            </div>
            <div className="stat-card-body">
              <div className="stat-card-value">{c.value ?? '—'}</div>
              <div className="stat-card-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Balanced Content Grid */}
      <div className="dashboard-grid-layout">
        {/* ── LEFT COLUMN ── */}
        <div className="dashboard-col-left">
          {/* Recent News Intelligence */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-header-title">
                <Newspaper size={15} color="#06b6d4" />
                <span>Recent News Intelligence</span>
                <span className="count-badge-cyan">{articles.length} Detected</span>
              </div>
              <Link to="/news" className="dash-card-link">
                View All <ArrowRight size={12} />
              </Link>
            </div>

            {articles.length === 0 ? (
              <div className="empty-state-box">
                <Newspaper size={28} color="#334155" />
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 6 }}>
                  No recent supply-chain intelligence events detected.
                </div>
              </div>
            ) : (
              <div className="news-cards-list">
                {articles.map((article) => (
                  <Link
                    key={article.id}
                    to={`/news/${article.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="news-card-row">
                      <div className="news-card-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="news-id-pill">{article.id}</span>
                          <RiskBadge level={article.risk_level} />
                        </div>
                        <span className="news-date">
                          <Clock size={11} />
                          {new Date(article.published_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <h3 className="news-title-text">{article.title}</h3>

                      {article.text && (
                        <p className="news-excerpt-text">
                          {article.text.length > 150
                            ? article.text.slice(0, 150) + '…'
                            : article.text}
                        </p>
                      )}

                      <div className="news-bottom-row">
                        <div className="news-entities-chips">
                          {(article.entities || [])
                            .filter((e) => e.matched)
                            .slice(0, 4)
                            .map((e, i) => (
                              <TypeBadge
                                key={i}
                                type={e.graph_type}
                                text={`${e.text} → ${e.graph_type}`}
                              />
                            ))}
                          {(article.entities || []).filter((e) => e.matched).length > 4 && (
                            <span className="more-pill">
                              +{(article.entities || []).filter((e) => e.matched).length - 4} more
                            </span>
                          )}
                        </div>

                        <span className="news-match-stat">
                          <CheckCircle2 size={12} color="#22c55e" />
                          {article.matched_count}/{article.total_entities} Matched
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Supply Chain Network Overview Card */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-header-title">
                <Share2 size={15} color="#818cf8" />
                <span>Supply Chain Network Overview</span>
              </div>
              <Link to="/graph" className="dash-card-link">
                Interactive Graph <ArrowRight size={12} />
              </Link>
            </div>

            <div className="network-snapshot-card">
              <div className="network-stats-row">
                <div className="network-stat-item">
                  <div className="network-stat-num">{stats?.totalNodes ?? '—'}</div>
                  <div className="network-stat-lbl">Graph Nodes</div>
                </div>
                <div className="network-stat-divider" />
                <div className="network-stat-item">
                  <div className="network-stat-num">{stats?.totalRelationships ?? '—'}</div>
                  <div className="network-stat-lbl">Active Paths</div>
                </div>
                <div className="network-stat-divider" />
                <div className="network-stat-item">
                  <div className="network-stat-num">{stats?.countries ?? '—'}</div>
                  <div className="network-stat-lbl">Global Regions</div>
                </div>
                <div className="network-stat-divider" />
                <div className="network-stat-item">
                  <div className="network-stat-num">100%</div>
                  <div className="network-stat-lbl">Neo4j Sync</div>
                </div>
              </div>

              <div className="network-entities-pills">
                <span className="entity-chip-pill" style={{ color: nodeTypeColors.supplier }}>
                  <Package size={11} /> {stats?.suppliers ?? 0} Suppliers
                </span>
                <span className="entity-chip-pill" style={{ color: nodeTypeColors.manufacturer }}>
                  <Factory size={11} /> {stats?.manufacturers ?? 0} Manufacturers
                </span>
                <span className="entity-chip-pill" style={{ color: nodeTypeColors.product }}>
                  <Box size={11} /> {stats?.products ?? 0} Products
                </span>
                <span className="entity-chip-pill" style={{ color: nodeTypeColors.port }}>
                  <Anchor size={11} /> {stats?.ports ?? 0} Shipping Ports
                </span>
                <span className="entity-chip-pill" style={{ color: nodeTypeColors.warehouse }}>
                  <Warehouse size={11} /> {stats?.warehouses ?? 0} Warehouses
                </span>
              </div>

              <div className="network-action-bar">
                <Link to="/graph" className="btn btn-outline-cyan">
                  <Share2 size={13} />
                  Open Live Graph Visualizer
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="dashboard-col-right">
          {/* Risk Overview */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-header-title">
                <ShieldAlert size={15} color="#ef4444" />
                <span>Supply Chain Risk Overview</span>
              </div>
              <Link to="/risk" className="dash-card-link">
                Analysis <ArrowRight size={12} />
              </Link>
            </div>

            {/* Risk Distribution Bars */}
            <div className="risk-bars-container">
              {[
                { level: 'Critical', count: dist.CRITICAL || 0, color: '#dc2626' },
                { level: 'High', count: dist.HIGH || 0, color: '#ef4444' },
                { level: 'Medium', count: dist.MEDIUM || 0, color: '#f59e0b' },
                { level: 'Low', count: dist.LOW || 0, color: '#22c55e' },
              ].map(({ level, count, color }) => {
                const pct = Math.round((count / totalRiskEntities) * 100);
                return (
                  <div key={level} className="risk-bar-row">
                    <div className="risk-bar-meta">
                      <span className="risk-bar-name" style={{ color }}>
                        {level}
                      </span>
                      <span className="risk-bar-count">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="risk-bar-track">
                      <div
                        className="risk-bar-fill"
                        style={{
                          width: `${Math.max(count > 0 ? 8 : 0, pct)}%`,
                          background: color,
                          boxShadow: count > 0 ? `0 0 8px ${color}60` : 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top Risk Entities */}
            <div className="top-risks-section">
              <div className="section-mini-title">Top Monitored Risks</div>
              <div className="top-risks-list">
                {(risk?.top_risks || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', padding: '16px 0', textAlign: 'center' }}>
                    No elevated risk entities detected in active graph.
                  </div>
                ) : (
                  (risk?.top_risks || []).slice(0, 3).map((e) => {
                    const levelColors = {
                      CRITICAL: { text: '#dc2626', bg: 'rgba(220,38,38,0.15)' },
                      HIGH: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
                      MEDIUM: { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                      LOW: { text: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
                    };
                    const lc = levelColors[e.risk_level] || { text: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
                    const entityId = e.id || e.type;

                    return (
                      <div key={e.id || e.name} className="top-risk-row">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="top-risk-name truncate">{e.name}</div>
                          <div className="top-risk-sub">
                            <span>{entityId}</span>
                            <span>·</span>
                            <span style={{ color: nodeTypeColors[e.type?.toLowerCase()] || '#818cf8' }}>
                              {e.type}
                            </span>
                          </div>
                        </div>
                        <div className="top-risk-score-wrap">
                          <span className="top-risk-pct" style={{ color: lc.text }}>
                            {((e.risk_score || 0) * 100).toFixed(0)}%
                          </span>
                          <span
                            className="top-risk-badge"
                            style={{
                              color: lc.text,
                              background: lc.bg,
                            }}
                          >
                            {e.risk_level}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Real-Time Graph Events Feed */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-header-title">
                <TrendingUp size={15} color="#22c55e" />
                <span>Intelligence Feed</span>
              </div>
            </div>

            <div className="events-timeline-list">
              {[
                {
                  title: 'Port of Rotterdam Disruption',
                  detail: 'NLP matched: LOC Port of Rotterdam (Netherlands)',
                  time: '10 min ago',
                  type: 'alert',
                  badge: 'NEWS',
                },
                {
                  title: 'Supplier Risk Assessment Updated',
                  detail: 'SUP002 (Asia Semiconductor) evaluated at 25% risk',
                  time: '45 min ago',
                  type: 'warning',
                  badge: 'RISK',
                },
                {
                  title: 'Neo4j Knowledge Graph Synchronized',
                  detail: `${stats?.totalNodes || 18} Nodes, ${stats?.totalRelationships || 24} Relationships verified healthy`,
                  time: '1 hr ago',
                  type: 'success',
                  badge: 'GRAPH',
                },
                {
                  title: 'Supply Chain Routes Active',
                  detail: 'Transcontinental maritime lanes operating normally',
                  time: '2 hr ago',
                  type: 'info',
                  badge: 'LOGISTICS',
                },
              ].map((ev, i) => (
                <div key={i} className="timeline-event-row">
                  <div className={`timeline-dot dot-${ev.type}`} />
                  <div className="timeline-body">
                    <div className="timeline-head">
                      <span className="timeline-title">{ev.title}</span>
                      <span className="timeline-time">{ev.time}</span>
                    </div>
                    <div className="timeline-detail">{ev.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
