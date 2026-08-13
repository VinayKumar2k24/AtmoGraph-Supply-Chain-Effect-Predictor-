import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Package,
  Factory,
  Anchor,
  Globe,
  Box,
  Warehouse,
  Share2,
  Link as LinkIcon,
  RefreshCw,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { fetchStats } from '../services/api.js';
import { graphStats, nodeTypeColors, edgeTypeInfo } from '../data/graphData.js';

const TYPE_ICONS = {
  country: Globe,
  supplier: Package,
  manufacturer: Factory,
  product: Box,
  port: Anchor,
  warehouse: Warehouse,
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="custom-chart-tooltip">
      <div className="tooltip-title">{d?.name || d?.payload?.type}</div>
      <div className="tooltip-row">
        <span className="tooltip-lbl">Count:</span>
        <span className="tooltip-val" style={{ color: d?.payload?.color || '#818cf8' }}>
          {d?.value} Entities
        </span>
      </div>
    </div>
  );
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState(graphStats);
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchStats()
      .then((data) => {
        if (data && data.totalNodes) setStats(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const pieData = [
    { name: 'Suppliers', value: stats.suppliers, color: nodeTypeColors.supplier, type: 'supplier' },
    { name: 'Manufacturers', value: stats.manufacturers, color: nodeTypeColors.manufacturer, type: 'manufacturer' },
    { name: 'Products', value: stats.products, color: nodeTypeColors.product, type: 'product' },
    { name: 'Ports', value: stats.ports, color: nodeTypeColors.port, type: 'port' },
    { name: 'Countries', value: stats.countries, color: nodeTypeColors.country, type: 'country' },
    { name: 'Warehouses', value: stats.warehouses, color: nodeTypeColors.warehouse, type: 'warehouse' },
  ];

  const byRel = stats.byRelType || graphStats.byRelType;
  const relBarData = Object.entries(byRel).map(([type, count]) => ({
    type,
    count,
    color: edgeTypeInfo[type]?.stroke || '#818cf8',
  }));

  const totalNodes = stats.totalNodes || 21;
  const totalEdges = stats.totalRelationships || 29;

  return (
    <div className="page-full-scroll">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="title-icon-badge" style={{ background: 'rgba(129,140,248,0.15)', borderColor: 'rgba(129,140,248,0.3)' }}>
              <BarChart3 size={16} color="#818cf8" />
            </div>
            <h1 className="page-main-title">Graph Analytics & Topology</h1>
          </div>
          <p className="page-sub-title">
            Structural knowledge graph decomposition, entity distribution & relationship density
          </p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadData} title="Refresh graph metrics">
            <RefreshCw size={13} />
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon-wrap" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            <Share2 size={18} />
          </div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-number">{totalNodes}</div>
            <div className="analytics-kpi-label">Total Graph Entities</div>
            <div className="analytics-kpi-sub">Across 5 sovereign regions</div>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon-wrap" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
            <LinkIcon size={18} />
          </div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-number">{totalEdges}</div>
            <div className="analytics-kpi-label">Active Relationships</div>
            <div className="analytics-kpi-sub">5 directional edge categories</div>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon-wrap" style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee' }}>
            <Layers size={18} />
          </div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-number">6</div>
            <div className="analytics-kpi-label">Entity Classifications</div>
            <div className="analytics-kpi-sub">Heterogeneous node schema</div>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon-wrap" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
            <Activity size={18} />
          </div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-number">1.38</div>
            <div className="analytics-kpi-label">Average Node Degree</div>
            <div className="analytics-kpi-sub">High connectivity index</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts-grid">
        {/* Donut Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <Share2 size={14} color="#818cf8" />
              <span>Entity Classification Distribution</span>
            </div>
          </div>

          <div style={{ height: 260, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <LinkIcon size={14} color="#06b6d4" />
              <span>Relationship Type Distribution</span>
            </div>
          </div>

          <div style={{ height: 260, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={relBarData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="type" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {relBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Entity Breakdown Grid */}
      <div className="dash-card" style={{ marginTop: 16 }}>
        <div className="dash-card-header">
          <div className="dash-card-header-title">
            <Layers size={15} color="#818cf8" />
            <span>Entity Type Breakdown</span>
          </div>
          <Link to="/graph" className="dash-card-link">
            Open in Graph <ArrowRight size={12} />
          </Link>
        </div>

        <div className="entity-breakdown-grid">
          {pieData.map(({ name, value, color, type }) => {
            const Icon = TYPE_ICONS[type] || Globe;
            const pct = Math.round((value / totalNodes) * 100);

            return (
              <Link
                key={name}
                to={`/graph?filter=${type}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="entity-breakdown-card" style={{ borderColor: `${color}30` }}>
                  <div className="breakdown-card-icon" style={{ background: `${color}18`, color }}>
                    <Icon size={18} />
                  </div>
                  <div className="breakdown-card-content">
                    <div className="breakdown-card-top">
                      <span className="breakdown-card-name">{name}</span>
                      <span className="breakdown-card-pct">{pct}%</span>
                    </div>
                    <div className="breakdown-card-num" style={{ color }}>
                      {value}
                    </div>
                    <div className="breakdown-card-bar">
                      <div
                        className="breakdown-card-fill"
                        style={{
                          width: `${pct}%`,
                          background: color,
                          boxShadow: `0 0 6px ${color}60`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
