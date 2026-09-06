import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Zap,
  CheckCircle2,
  Package,
  Factory,
  Anchor,
  Globe,
  Cpu,
  Warehouse,
} from 'lucide-react';
import { fetchForecast } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';

const RISK_BADGE_COLORS = {
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.45)', text: '#ef4444' },
  HIGH:     { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.45)', text: '#f97316' },
  MEDIUM:   { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.45)', text: '#f59e0b' },
  LOW:      { bg: 'rgba(34, 197, 94, 0.15)',  border: 'rgba(34, 197, 94, 0.45)',  text: '#22c55e' },
};

const HORIZON_THEMES = {
  '30_days': {
    accent: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.25)',
    label: '30 DAYS',
    subtext: 'Immediate Shock & Buffer Depletion (Days 1–30)',
  },
  '60_days': {
    accent: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.25)',
    label: '60 DAYS',
    subtext: 'Mid-Tier Compound Delay & Assembly Starvation (Days 31–60)',
  },
  '90_days': {
    accent: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.25)',
    label: '90 DAYS',
    subtext: 'Systemic Network Penetration & Fulfillment Equilibrium (Days 61–90)',
  },
};

export default function ForecastSection({
  selectedShockNode = 'Rotterdam Port',
  realtimeResult = null,
}) {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Authoritative target shock node (strictly prioritizes currently selected shock node)
  const targetShockNode = useMemo(() => {
    return (
      selectedShockNode ||
      realtimeResult?.shock_origin ||
      realtimeResult?.ripple_origin ||
      'Rotterdam Port'
    );
  }, [selectedShockNode, realtimeResult]);

  const loadForecast = useCallback(async (nodeName) => {
    if (!nodeName) return;
    setLoading(true);
    setForecastData(null);
    setError(null);
    try {
      const res = await fetchForecast(nodeName);
      if (!res || !res.success) {
        throw new Error(res?.detail || 'Failed to generate 30/60/90-day forecast.');
      }
      setForecastData(res);
    } catch (err) {
      console.error('Forecast error:', err);
      setError(err.message || 'Unable to retrieve supply chain forecast.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForecast(targetShockNode);
  }, [targetShockNode, loadForecast]);

  const sourceNode = forecastData?.source_node;
  const forecast = forecastData?.forecast;

  return (
    <div
      className="dash-card supply-chain-forecast-wrapper"
      style={{
        marginBottom: 20,
        background: 'rgba(15, 23, 42, 0.78)',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.45)',
        borderRadius: 12,
        padding: '20px 22px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Calendar size={18} color="#38bdf8" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.2px' }}>
              Supply Chain Temporal Scenario Forecast: 30 / 60 / 90-Day Outlook
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 4,
                padding: '2px 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Deterministic Scenario Layer
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Projects temporal shock percolation over 30, 60, and 90-day operating horizons using trained GraphSAGE
            GNN predicted delays, Neo4j topology, and exponential decay ripple propagation.
          </div>
        </div>

        {/* Current Active Shock Badge & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {sourceNode && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: '11.5px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Simulating For:</span>
              <strong style={{ color: '#f8fafc' }}>{sourceNode.name}</strong>
              <span
                style={{
                  fontSize: '10px',
                  color: (nodeTypeColors[sourceNode.entity_type?.toLowerCase()]) || '#818cf8',
                  background: `${(nodeTypeColors[sourceNode.entity_type?.toLowerCase()]) || '#818cf8'}20`,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {sourceNode.entity_type}
              </span>
              <span style={{ color: '#64748b' }}>|</span>
              <span style={{ color: '#c084fc', fontWeight: 600 }}>
                GNN Delay: {Number(sourceNode.predicted_delay).toFixed(2)}d
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => loadForecast(targetShockNode)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              borderRadius: 6,
              padding: '5px 11px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Simulating...' : 'Recalculate'}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: '12px',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={16} color="#ef4444" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadForecast(targetShockNode)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !forecast && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#38bdf8' }} />
          <div style={{ fontSize: '13px' }}>Simulating temporal propagation for {targetShockNode}...</div>
        </div>
      )}

      {/* 30D / 60D / 90D Horizons Grid */}
      {forecast && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {['30_days', '60_days', '90_days'].map((key) => {
            const h = forecast[key];
            if (!h) return null;

            const theme = HORIZON_THEMES[key];
            const riskColors = RISK_BADGE_COLORS[h.risk_level] || RISK_BADGE_COLORS.MEDIUM;

            return (
              <div
                key={key}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: `1px solid ${theme.accent}35`,
                  borderRadius: 10,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: `0 4px 16px ${theme.glow}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top Glowing Edge Indicator */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${theme.accent}, transparent)`,
                  }}
                />

                {/* Horizon Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: theme.accent,
                        background: `${theme.accent}18`,
                        border: `1px solid ${theme.accent}45`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {theme.label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                      T+{h.horizon_days}d
                    </span>
                  </div>

                  {/* Risk Level Badge */}
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: riskColors.text,
                      background: riskColors.bg,
                      border: `1px solid ${riskColors.border}`,
                      borderRadius: 4,
                      padding: '2px 9px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    {h.risk_level} RISK
                  </span>
                </div>

                {/* Horizon Title */}
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>
                    {h.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {theme.subtext}
                  </div>
                </div>

                {/* Key Metrics Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 6,
                    padding: '8px 10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Expected Delay</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc' }}>
                      {h.average_delay_days.toFixed(2)}d <span style={{ fontSize: '10px', color: '#94a3b8' }}>avg</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Max Delay</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#f43f5e' }}>
                      {h.max_delay_days.toFixed(2)}d <span style={{ fontSize: '10px', color: '#94a3b8' }}>peak</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Max Propagation</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                      {h.max_propagation_depth === 0
                        ? '0 Hops (Local)'
                        : `${h.max_propagation_depth} Hop${h.max_propagation_depth > 1 ? 's' : ''}`}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Peak Ripple</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>
                      {(h.peak_ripple_score * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Affected Entities Count & Chips */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                      Affected Downstream Entities
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: h.affected_node_count > 0 ? '#38bdf8' : '#64748b',
                      }}
                    >
                      {h.affected_node_count} {h.affected_node_count === 1 ? 'Entity' : 'Entities'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 5,
                      maxHeight: 76,
                      overflowY: 'auto',
                    }}
                  >
                    {h.affected_entities && h.affected_entities.length > 0 ? (
                      h.affected_entities.map((ent, idx) => {
                        const entType = ent.entity_type || 'Unknown';
                        const c = (nodeTypeColors[entType.toLowerCase()]) || '#818cf8';
                        return (
                          <span
                            key={idx}
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: '#f8fafc',
                              background: `${c}15`,
                              border: `1px solid ${c}40`,
                              borderRadius: 4,
                              padding: '2px 6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
                            <span>{ent.name}</span>
                            <span style={{ fontSize: '9px', color: c, opacity: 0.85 }}>({entType})</span>
                            <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                              +{ent.hop}h • {Number(ent.predicted_delay || 0).toFixed(1)}d
                            </span>
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                        No downstream entities reached in this horizon.
                      </span>
                    )}
                  </div>
                </div>

                {/* Expected Impact Narrative */}
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#cbd5e1',
                    lineHeight: '1.45',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderLeft: `2px solid ${theme.accent}`,
                    padding: '7px 10px',
                    borderRadius: '0 4px 4px 0',
                  }}
                >
                  <strong style={{ color: '#f8fafc' }}>Impact: </strong>
                  {h.impact_summary}
                </div>

                {/* Actionable Mitigation Priority */}
                <div
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 7,
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: '11px',
                    color: '#94a3b8',
                  }}
                >
                  <ShieldAlert size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong style={{ color: '#f8fafc' }}>Mitigation: </strong>
                    <span>{h.mitigation_priority}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
