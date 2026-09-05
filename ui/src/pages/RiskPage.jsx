import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Package,
  Factory,
  Anchor,
  Globe,
  Cpu,
  Warehouse,
  TrendingDown,
  AlertTriangle,
  Search,
  Share2,
  RefreshCw,
  CheckCircle2,
  Clock,
  BarChart3,
  SlidersHorizontal,
  Activity,
  Layers,
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
  Legend,
  Cell,
  CartesianGrid,
} from 'recharts';
import { fetchRisk, fetchRiskTop, fetchRiskEntities, fetchPredictions, fetchEvaluation } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';
import RippleAnalysisSection from '../components/RippleAnalysisSection.jsx';

const HIGH_DELAY_THRESHOLD = 7.0;

const TYPE_ICONS = {
  Supplier: Package,
  Manufacturer: Factory,
  Port: Anchor,
  Country: Globe,
  Product: Cpu,
  Warehouse: Warehouse,
};

function getEntityType(p) {
  if (p?.labels && p.labels.length > 0) return p.labels[0];
  if (p?.type) return p.type;
  return 'Unknown';
}

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
      {d?.level && (
        <div className="tooltip-row">
          <span className="tooltip-lbl">Level:</span>
          <span className="tooltip-val">{d?.level}</span>
        </div>
      )}
    </div>
  );
};

const DelayComparisonTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const actual = d?.actual_delay ?? 0;
  const pred = d?.predicted_delay ?? 0;
  const delta = Number((pred - actual).toFixed(2));
  const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <div className="custom-chart-tooltip" style={{ minWidth: 220 }}>
      <div className="tooltip-title">{d?.fullName || d?.name}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: 6 }}>
        Classification: <strong style={{ color: '#f8fafc' }}>{d?.type}</strong>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-lbl" style={{ color: '#38bdf8' }}>Actual Delay:</span>
        <span className="tooltip-val" style={{ color: '#38bdf8', fontWeight: 700 }}>
          {actual.toFixed(2)} days
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-lbl" style={{ color: '#c084fc' }}>Predicted Delay (days):</span>
        <span className="tooltip-val" style={{ color: '#c084fc', fontWeight: 700 }}>
          {pred.toFixed(2)} days
        </span>
      </div>
      <div
        className="tooltip-row"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 5,
          marginTop: 5,
        }}
      >
        <span className="tooltip-lbl">Variance (Delta):</span>
        <span
          className="tooltip-val"
          style={{
            color: Math.abs(delta) < 0.5 ? '#22c55e' : '#f59e0b',
            fontWeight: 700,
          }}
        >
          {deltaSign} days ({actual > 0 ? (100 - Math.min(100, (Math.abs(delta) / actual) * 100)).toFixed(1) : '100'}% match)
        </span>
      </div>
    </div>
  );
};

export default function RiskPage() {
  const [riskData, setRiskData] = useState(null);
  const [topRisks, setTopRisks] = useState([]);
  const [entitiesList, setEntitiesList] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('predicted_delay_desc');
  const [chartScope, setChartScope] = useState('top10');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetchRisk().catch((err) => {
        console.warn('Risk overview fetch fallback:', err);
        return null;
      }),
      fetchRiskTop(10).catch(() => null),
      fetchRiskEntities().catch(() => null),
      fetchEvaluation().catch((err) => {
        console.warn('fetchEvaluation fallback to fetchPredictions:', err);
        return fetchPredictions();
      }),
    ])
      .then(([rData, topData, eData, predData]) => {
        if (!predData || !Array.isArray(predData.predictions)) {
          throw new Error('GNN prediction service unavailable. Please ensure the FastAPI backend is running.');
        }
        setRiskData(rData);
        setTopRisks(topData?.risks || rData?.top_risks || []);
        setEntitiesList(eData?.entities || rData?.top_risks || []);
        setPredictions(predData.predictions || []);
        setTotalNodes(predData.total_nodes || predData.predictions.length || 0);
        if (predData.metrics) {
          setMetrics(predData.metrics);
        }
      })
      .catch((err) => {
        console.error('Failed to load GNN prediction data:', err);
        setError('GNN prediction service unavailable. Please ensure the FastAPI backend is running.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived GNN delay statistics across the 18 nodes
  const predictionStats = useMemo(() => {
    if (!predictions || predictions.length === 0) {
      return {
        total: 0,
        maxPredictedDelay: 0,
        maxDelayNode: null,
        avgPredictedDelay: 0,
        avgActualDelay: 0,
        highDelayCount: 0,
        meanError: 0,
      };
    }

    let sumPred = 0;
    let sumActual = 0;
    let sumAbsError = 0;
    let maxPred = -Infinity;
    let maxNode = null;
    let highCount = 0;

    predictions.forEach((p) => {
      const pred = p.predicted_delay ?? 0;
      const actual = p.actual_delay ?? 0;
      sumPred += pred;
      sumActual += actual;
      sumAbsError += Math.abs(pred - actual);

      if (pred > maxPred) {
        maxPred = pred;
        maxNode = p;
      }
      if (pred >= HIGH_DELAY_THRESHOLD) {
        highCount++;
      }
    });

    const total = predictions.length;
    return {
      total,
      maxPredictedDelay: Number(maxPred.toFixed(2)),
      maxDelayNode: maxNode,
      avgPredictedDelay: Number((sumPred / total).toFixed(2)),
      avgActualDelay: Number((sumActual / total).toFixed(2)),
      highDelayCount: highCount,
      meanError: Number((sumAbsError / total).toFixed(2)),
    };
  }, [predictions]);

  // Top Predicted Delays sorted by predicted_delay descending (Requirement 12)
  const topPredictedDelays = useMemo(() => {
    return [...predictions].sort(
      (a, b) => (b.predicted_delay ?? 0) - (a.predicted_delay ?? 0)
    );
  }, [predictions]);

  // Comparison visualization data: Actual Delay vs Predicted Delay (Requirement 13)
  const comparisonChartData = useMemo(() => {
    const list =
      chartScope === 'top10'
        ? topPredictedDelays.slice(0, 10)
        : topPredictedDelays;

    return list.map((p) => {
      const actual = Number((p.actual_delay ?? 0).toFixed(2));
      const pred = Number((p.predicted_delay ?? 0).toFixed(2));
      const delta = Number((pred - actual).toFixed(2));
      return {
        name: p.name,
        fullName: p.name,
        shortName: p.name.length > 15 ? `${p.name.slice(0, 13)}…` : p.name,
        type: getEntityType(p),
        actual_delay: actual,
        predicted_delay: pred,
        delta,
        risk: p.risk,
      };
    });
  }, [topPredictedDelays, chartScope]);

  // Filtered and sorted predictions for comprehensive table
  const filteredPredictions = useMemo(() => {
    const q = search.toLowerCase().trim();

    return predictions
      .filter((p) => {
        const type = getEntityType(p);
        const matchSearch =
          !q ||
          p.name?.toLowerCase().includes(q) ||
          type.toLowerCase().includes(q) ||
          String(p.node_index).includes(q);

        const matchType =
          typeFilter === 'ALL' || type.toLowerCase() === typeFilter.toLowerCase();

        return matchSearch && matchType;
      })
      .sort((a, b) => {
        if (sortBy === 'predicted_delay_desc') {
          return (b.predicted_delay ?? 0) - (a.predicted_delay ?? 0);
        }
        if (sortBy === 'predicted_delay_asc') {
          return (a.predicted_delay ?? 0) - (b.predicted_delay ?? 0);
        }
        if (sortBy === 'actual_delay_desc') {
          return (b.actual_delay ?? 0) - (a.actual_delay ?? 0);
        }
        if (sortBy === 'risk_desc') {
          return (b.risk ?? 0) - (a.risk ?? 0);
        }
        if (sortBy === 'disruption_desc') {
          return (b.disruption ?? 0) - (a.disruption ?? 0);
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [predictions, search, typeFilter, sortBy]);

  // Radar chart data for multi-dimensional risk vector
  const dist = riskData?.distribution || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const totalEntitiesWithRisk = riskData?.total_entities_with_risk || 1;
  const portRisk = riskData?.by_entity_type?.find((b) => b.type === 'Port')?.avg_risk ?? 0.28;
  const supplierRisk = riskData?.by_entity_type?.find((b) => b.type === 'Supplier')?.avg_risk ?? 0.35;
  const countryRisk = riskData?.by_entity_type?.find((b) => b.type === 'Country')?.avg_risk ?? 0.18;
  const overallAvg = riskData?.summary?.overall_average_risk ?? 0.3;
  const criticalRatio = (dist.CRITICAL || 0) / totalEntitiesWithRisk;
  const highRatio = (dist.HIGH || 0) / totalEntitiesWithRisk;

  const radarData = [
    { subject: 'Supplier Risk', A: Number(supplierRisk.toFixed(2)) },
    { subject: 'Port Congestion', A: Number(portRisk.toFixed(2)) },
    { subject: 'Geopolitical', A: Number(countryRisk.toFixed(2)) },
    { subject: 'Critical Ratio', A: Number(criticalRatio.toFixed(2)) },
    { subject: 'High Disruption', A: Number(highRatio.toFixed(2)) },
    { subject: 'Overall Severity', A: Number(overallAvg.toFixed(2)) },
  ];

  if (loading) {
    return (
      <div className="page-loading-wrap">
        <div className="spinner" />
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: 12, fontWeight: 500 }}>
          Calculating GNN delay predictions & multi-tier risk metrics…
        </div>
      </div>
    );
  }

  return (
    <div className="page-full-scroll">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="title-icon-badge"
              style={{
                background: 'rgba(168,85,247,0.15)',
                borderColor: 'rgba(168,85,247,0.35)',
              }}
            >
              <Cpu size={16} color="#a855f7" />
            </div>
            <h1 className="page-main-title">Supply Chain Risk Analytics & GNN Predictions</h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56,189,248,0.12)',
                border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: '9999px',
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                }}
              />
              {totalNodes || predictions.length} Nodes Predicted
            </span>
          </div>
          <p className="page-sub-title">
            Multi-tier supply chain risk scoring & Graph Neural Network delay predictions across suppliers, shipping ports, warehouses & products
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-outline"
            onClick={loadData}
            title="Fetch latest GNN predictions and risk scores"
          >
            <RefreshCw size={13} />
            Refresh Predictions
          </button>
        </div>
      </div>

      {/* Backend Connection Alert */}
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

      {/* Empty State Alert */}
      {!loading && !error && predictions.length === 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(100,116,139,0.12)',
            border: '1px solid rgba(100,116,139,0.3)',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '16px',
            color: '#94a3b8',
            fontSize: '13px',
          }}
        >
          <Activity size={16} color="#94a3b8" />
          <span>No GNN predictions available.</span>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="risk-kpi-grid">
        {/* Total Predicted Nodes */}
        <div
          className="risk-kpi-card"
          style={{ borderColor: 'rgba(129,140,248,0.3)', background: 'rgba(129,140,248,0.06)' }}
        >
          <div className="risk-kpi-top">
            <span className="risk-kpi-lbl" style={{ color: '#818cf8' }}>
              TOTAL PREDICTED NODES
            </span>
            <Cpu size={16} color="#818cf8" />
          </div>
          <div className="risk-kpi-number" style={{ color: '#818cf8' }}>
            {predictionStats.total}
          </div>
          <div className="risk-kpi-desc">GNN graph-wide node regression</div>
        </div>

        {/* Top Predicted Delay */}
        <div
          className="risk-kpi-card"
          style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}
        >
          <div className="risk-kpi-top">
            <span className="risk-kpi-lbl" style={{ color: '#ef4444' }}>
              TOP PREDICTED DELAY
            </span>
            <Clock size={16} color="#ef4444" />
          </div>
          <div className="risk-kpi-number" style={{ color: '#ef4444' }}>
            {predictionStats.maxPredictedDelay}d
          </div>
          <div className="risk-kpi-desc">
            {predictionStats.maxDelayNode?.name || '—'}
          </div>
        </div>

        {/* Average Predicted Delay */}
        <div
          className="risk-kpi-card"
          style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}
        >
          <div className="risk-kpi-top">
            <span className="risk-kpi-lbl" style={{ color: '#f59e0b' }}>
              AVG PREDICTED DELAY
            </span>
            <TrendingDown size={16} color="#f59e0b" />
          </div>
          <div className="risk-kpi-number" style={{ color: '#f59e0b' }}>
            {predictionStats.avgPredictedDelay}d
          </div>
          <div className="risk-kpi-desc">
            Network mean latency (Actual: {predictionStats.avgActualDelay}d)
          </div>
        </div>

        {/* High Delay Impact */}
        <div
          className="risk-kpi-card"
          style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)' }}
        >
          <div className="risk-kpi-top">
            <span className="risk-kpi-lbl" style={{ color: '#dc2626' }}>
              HIGH DELAY NODES
            </span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div className="risk-kpi-number" style={{ color: '#dc2626' }}>
            {predictionStats.highDelayCount}
          </div>
          <div className="risk-kpi-desc">Entities with ≥ {HIGH_DELAY_THRESHOLD} days predicted delay</div>
        </div>
      </div>

      {/* GNN Prediction & Comparison Section (Requirements 12 & 13) */}
      <div className="risk-charts-grid" style={{ marginBottom: 16 }}>
        {/* Actual Delay vs Predicted Delay Comparison Chart (Requirement 13) */}
        <div className="dash-card">
          <div className="dash-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="dash-card-header-title">
              <BarChart3 size={15} color="#38bdf8" />
              <span>Actual Delay vs Predicted Delay (days)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className={`filter-btn-pill ${chartScope === 'top10' ? 'active' : ''}`}
                onClick={() => setChartScope('top10')}
                style={{ fontSize: '10.5px', padding: '2px 8px' }}
              >
                Top 10 Entities
              </button>
              <button
                className={`filter-btn-pill ${chartScope === 'all18' ? 'active' : ''}`}
                onClick={() => setChartScope('all18')}
                style={{ fontSize: '10.5px', padding: '2px 8px' }}
              >
                All 18 Nodes
              </button>
            </div>
          </div>

          <div style={{ height: 210, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonChartData}
                margin={{ top: 10, right: 10, left: -18, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={40}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit="d"
                />
                <Tooltip
                  content={<DelayComparisonTooltip />}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 6, fontSize: '11px' }}
                />
                <Bar
                  dataKey="actual_delay"
                  name="Actual Delay (days)"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="predicted_delay"
                  name="Predicted Delay (days)"
                  fill="#a855f7"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* GNN Model Evaluation (Dynamic metrics from /api/prediction/evaluation) */}
          <div
            style={{
              marginTop: 10,
              padding: '9px 12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} color="#a855f7" />
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#f1f5f9',
                    letterSpacing: '0.2px',
                  }}
                >
                  GNN Model Evaluation
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                GraphSAGE Delay Regression Metrics
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.07)',
                  border: '1px solid rgba(56, 189, 248, 0.22)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>MAE (days)</div>
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    marginTop: 2,
                  }}
                >
                  {metrics?.mae !== undefined ? `${metrics.mae} days` : (predictionStats.meanError ? `${predictionStats.meanError} days` : '—')}
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: 1 }}>Mean Absolute Error</div>
              </div>

              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.07)',
                  border: '1px solid rgba(168, 85, 247, 0.22)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>RMSE (days)</div>
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#c084fc',
                    fontFamily: 'monospace',
                    marginTop: 2,
                  }}
                >
                  {metrics?.rmse !== undefined ? `${metrics.rmse} days` : '—'}
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: 1 }}>Root Mean Squared Error</div>
              </div>

              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.07)',
                  border: '1px solid rgba(34, 197, 94, 0.22)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>R²</div>
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#4ade80',
                    fontFamily: 'monospace',
                    marginTop: 2,
                  }}
                >
                  {metrics?.r2 !== undefined ? metrics.r2 : '—'}
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: 1 }}>Coefficient of Determination</div>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '11px',
              color: '#64748b',
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Regression Evaluation Metrics: {metrics?.mae !== undefined ? `MAE: ${metrics.mae} days · RMSE: ${metrics.rmse} days` : `±${predictionStats.meanError} days`}
            </span>
            <span>GNN Delay Regression</span>
          </div>
        </div>

        {/* Top Predicted Delays Leaderboard (Requirement 12) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <Clock size={15} color="#a855f7" />
              <span>Top Predicted Delays</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#94a3b8',
                background: 'rgba(255,255,255,0.04)',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Sorted by predicted_delay desc
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 10 }}>
            {topPredictedDelays.slice(0, 5).map((p, idx) => {
              const type = getEntityType(p);
              const c = nodeTypeColors[type.toLowerCase()] || '#818cf8';
              const Icon = TYPE_ICONS[type] || Globe;
              const actual = p.actual_delay ?? 0;
              const pred = p.predicted_delay ?? 0;
              const delta = Number((pred - actual).toFixed(2));
              const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;

              return (
                <div
                  key={p.neo4j_id || p.node_index || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background:
                      idx === 0
                        ? 'rgba(168,85,247,0.08)'
                        : 'rgba(255,255,255,0.02)',
                    border:
                      idx === 0
                        ? '1px solid rgba(168,85,247,0.25)'
                        : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background:
                          idx === 0
                            ? '#a855f7'
                            : idx === 1
                            ? '#6366f1'
                            : 'rgba(255,255,255,0.08)',
                        color: idx < 2 ? '#fff' : '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      #{idx + 1}
                    </div>
                    <div
                      className="table-icon-box"
                      style={{
                        width: 26,
                        height: 26,
                        background: `${c}15`,
                        border: `1px solid ${c}30`,
                        color: c,
                      }}
                    >
                      <Icon size={13} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: '#f8fafc',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <span style={{ fontSize: '10px', color: c, fontWeight: 600 }}>
                          {type}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>•</span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          Actual: <strong style={{ color: '#cbd5e1' }}>{actual.toFixed(1)}d</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#f3e8ff',
                        background: 'rgba(168,85,247,0.2)',
                        border: '1px solid rgba(168,85,247,0.4)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontFamily: 'monospace',
                      }}
                      title="Predicted Delay (days)"
                    >
                      <Clock size={11} color="#c084fc" />
                      {pred.toFixed(2)} days
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 3 }}>
                      Diff:{' '}
                      <span
                        style={{
                          color: Math.abs(delta) < 0.5 ? '#22c55e' : '#f59e0b',
                          fontWeight: 600,
                        }}
                      >
                        {deltaSign}d
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Supply Chain Ripple Effect Propagation (Week 3 Feature) */}
      <RippleAnalysisSection />

      {/* Multi-Dimensional Risk Radar & Breakdown Row */}
      <div className="risk-charts-grid" style={{ marginBottom: 16 }}>
        {/* Radar Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <ShieldAlert size={14} color="#818cf8" />
              <span>Multi-Dimensional Risk Vector</span>
            </div>
          </div>
          <div style={{ height: 220, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Radar
                  name="Risk Index"
                  dataKey="A"
                  stroke="#818cf8"
                  fill="#6366f1"
                  fillOpacity={0.28}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution & Health Summary */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-header-title">
              <Activity size={14} color="#10b981" />
              <span>Topology Health & Risk Distribution</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {[
              { level: 'CRITICAL', count: dist.CRITICAL || 0, color: '#dc2626', desc: 'Immediate intervention recommended' },
              { level: 'HIGH', count: dist.HIGH || 0, color: '#ef4444', desc: 'Significant bottleneck exposure' },
              { level: 'MEDIUM', count: dist.MEDIUM || 0, color: '#f59e0b', desc: 'Operating with monitored buffer capacity' },
              { level: 'LOW', count: dist.LOW || 0, color: '#22c55e', desc: 'Within stable baseline parameters' },
            ].map((item) => (
              <div
                key={item.level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiskBadge level={item.level} />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.desc}</span>
                </div>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: item.color,
                  }}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comprehensive Monitored Entities — GNN Prediction & Risk Table (Requirements 10, 11, 13) */}
      <div className="dash-card">
        <div className="dash-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="dash-card-header-title">
            <ShieldAlert size={15} color="#818cf8" />
            <span>
              Monitored Supply Chain Entities ({filteredPredictions.length} / {totalNodes || predictions.length} Nodes Predicted)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ width: 220 }}>
              <Search size={13} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder={`Search ${totalNodes || predictions.length || ''} nodes…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-pill-group">
              <span className="filter-label-text">Type:</span>
              {['ALL', 'Supplier', 'Manufacturer', 'Port', 'Warehouse', 'Product', 'Country'].map((t) => (
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
              <span className="filter-label-text">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-default)',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="predicted_delay_desc">Predicted Delay (High → Low)</option>
                <option value="predicted_delay_asc">Predicted Delay (Low → High)</option>
                <option value="actual_delay_desc">Actual Delay (High → Low)</option>
                <option value="risk_desc">Risk Score (High → Low)</option>
                <option value="disruption_desc">Disruption (High → Low)</option>
                <option value="name_asc">Name (A → Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="risk-entities-table-wrap">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>Node Name & ID</th>
                <th>Entity Type</th>
                <th>Risk</th>
                <th>Disruption</th>
                <th>Capacity</th>
                <th>Actual Delay</th>
                <th>Predicted Delay (days)</th>
                <th>Variance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPredictions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    <ShieldAlert size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                    <div>{predictions.length === 0 ? 'No GNN predictions available.' : 'No entities matched your search and filter criteria.'}</div>
                  </td>
                </tr>
              ) : (
                filteredPredictions.map((p, idx) => {
                  const type = getEntityType(p);
                  const c = nodeTypeColors[type.toLowerCase()] || '#64748b';
                  const Icon = TYPE_ICONS[type] || Globe;
                  const actual = p.actual_delay ?? 0;
                  const pred = p.predicted_delay ?? 0;
                  const delta = Number((pred - actual).toFixed(2));
                  const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;
                  const riskPct = Math.round((p.risk ?? 0) * 100);
                  const capacityPct = Math.round((p.capacity ?? 0) * 100);

                  return (
                    <tr key={p.neo4j_id || p.node_index || idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="table-icon-box"
                            style={{ background: `${c}15`, border: `1px solid ${c}30`, color: c }}
                          >
                            <Icon size={14} />
                          </div>
                          <div>
                            <div className="table-row-name">{p.name}</div>
                            <div className="table-row-mono-id">
                              Node #{p.node_index ?? idx} • {p.neo4j_id ? p.neo4j_id.slice(-6) : type}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="table-type-badge" style={{ color: c, borderColor: `${c}30` }}>
                          {type}
                        </span>
                      </td>

                      <td>
                        <div className="table-risk-score-cell">
                          <span
                            className="table-score-num"
                            style={{
                              color:
                                p.risk >= 0.4
                                  ? '#ef4444'
                                  : p.risk > 0.1
                                  ? '#f59e0b'
                                  : '#22c55e',
                            }}
                          >
                            {(p.risk ?? 0).toFixed(2)} ({riskPct}%)
                          </span>
                          <div className="table-score-bar-track">
                            <div
                              className="table-score-bar-fill"
                              style={{
                                width: `${Math.max(4, riskPct)}%`,
                                background:
                                  p.risk >= 0.4
                                    ? '#ef4444'
                                    : p.risk > 0.1
                                    ? '#f59e0b'
                                    : '#22c55e',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background:
                              p.disruption > 0.4
                                ? 'rgba(239,68,68,0.15)'
                                : p.disruption > 0
                                ? 'rgba(245,158,11,0.15)'
                                : 'rgba(34,197,94,0.1)',
                            color:
                              p.disruption > 0.4
                                ? '#fca5a5'
                                : p.disruption > 0
                                ? '#fcd34d'
                                : '#86efac',
                            border: `1px solid ${
                              p.disruption > 0.4
                                ? 'rgba(239,68,68,0.3)'
                                : p.disruption > 0
                                ? 'rgba(245,158,11,0.3)'
                                : 'rgba(34,197,94,0.2)'
                            }`,
                          }}
                        >
                          {(p.disruption ?? 0).toFixed(2)}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                          <span style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                            {capacityPct}%
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              background: 'rgba(255,255,255,0.06)',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${capacityPct}%`,
                                height: '100%',
                                background: '#38bdf8',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#38bdf8',
                          }}
                        >
                          {actual.toFixed(1)} days
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#f3e8ff',
                            background: 'rgba(168,85,247,0.18)',
                            border: '1px solid rgba(168,85,247,0.35)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                          }}
                        >
                          <Clock size={11} color="#c084fc" />
                          {pred.toFixed(2)} days
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: Math.abs(delta) < 0.5 ? '#22c55e' : '#f59e0b',
                          }}
                        >
                          {deltaSign}d
                        </span>
                      </td>

                      <td>
                        <Link
                          to={`/graph?filter=${type.toLowerCase()}`}
                          className="table-graph-link"
                          title="Locate entity in Knowledge Graph"
                        >
                          <Share2 size={12} /> View Graph
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
