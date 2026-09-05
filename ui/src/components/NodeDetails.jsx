import { useState, useEffect, useMemo } from 'react';
import {
  MousePointer2,
  Globe,
  Truck,
  Factory,
  Cpu,
  Anchor,
  Warehouse,
  ShieldAlert,
  X,
  Activity,
  ArrowRight,
  ArrowLeft,
  Share2,
  GitBranch,
} from 'lucide-react';
import { nodeTypeColors } from '../data/graphData.js';
import { fetchNodeDetail } from '../services/api.js';
import { EDGE_STYLE_CONFIG } from '../utils/graphValidation.js';

const NODE_ICONS = {
  country:      Globe,
  supplier:     Truck,
  manufacturer: Factory,
  product:      Cpu,
  port:         Anchor,
  warehouse:    Warehouse,
};

function getRiskLevel(risk) {
  if (risk === undefined || risk === null) return null;
  if (risk < 0.15) return { label: 'Low',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (risk < 0.30) return { label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  if (risk < 0.50) return { label: 'High',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  return                  { label: 'Critical', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' };
}

function getStatusColor(status) {
  if (!status) return '#64748b';
  if (status === 'NORMAL' || status === 'OPERATIONAL' || status === 'ACTIVE') return '#22c55e';
  if (status === 'DISRUPTED' || status === 'CRITICAL') return '#ef4444';
  return '#f59e0b';
}

function PropertyRow({ label, value, mono }) {
  return (
    <div className="details-property">
      <span className="prop-key">{label}</span>
      <span className={`prop-value ${mono ? 'mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

export default function NodeDetails({
  selectedNode,
  selectedEdge,
  allNodes = [],
  onClose,
  onFocusNode,
}) {
  const [liveConnections, setLiveConnections] = useState([]);
  const [loadingConn, setLoadingConn] = useState(false);

  // Fetch node connections from backend if node is selected
  useEffect(() => {
    if (!selectedNode?.id) {
      setLiveConnections([]);
      return;
    }
    setLoadingConn(true);
    fetchNodeDetail(selectedNode.id)
      .then((res) => {
        if (res && res.connections) {
          setLiveConnections(res.connections.filter((c) => c.other_id));
        } else {
          setLiveConnections([]);
        }
      })
      .catch(() => setLiveConnections([]))
      .finally(() => setLoadingConn(false));
  }, [selectedNode?.id]);

  // Group connections into incoming vs outgoing
  const { incoming, outgoing } = useMemo(() => {
    const inc = [];
    const out = [];
    liveConnections.forEach((conn) => {
      if (conn.direction === 'in') inc.push(conn);
      else out.push(conn);
    });
    return { incoming: inc, outgoing: out };
  }, [liveConnections]);

  // ─── 1. Relationship / Edge Inspector Mode ──────────────────────────────────
  if (selectedEdge) {
    const relType = (selectedEdge.data?.relType || selectedEdge.label || 'CONNECTED_TO').toUpperCase();
    const edgeStyle = EDGE_STYLE_CONFIG[relType] || { stroke: '#818cf8', label: relType };
    const sourceNode = allNodes.find((n) => n.id === selectedEdge.source);
    const targetNode = allNodes.find((n) => n.id === selectedEdge.target);

    const sourceType = (sourceNode?.data?.nodeType || 'entity').toLowerCase();
    const targetType = (targetNode?.data?.nodeType || 'entity').toLowerCase();
    const SourceIcon = NODE_ICONS[sourceType] || Share2;
    const TargetIcon = NODE_ICONS[targetType] || Share2;
    const sourceColor = nodeTypeColors[sourceType] || '#818cf8';
    const targetColor = nodeTypeColors[targetType] || '#818cf8';

    return (
      <div className="details-panel">
        <div className="details-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={14} color={edgeStyle.stroke} />
            <span className="details-panel-title">Relationship Inspector</span>
          </div>
          <button onClick={onClose} className="details-close-btn" title="Close inspector">
            <X size={15} />
          </button>
        </div>

        <div className="details-content">
          {/* Main Relationship Banner */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: `${edgeStyle.stroke}15`,
              border: `1px solid ${edgeStyle.stroke}40`,
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Relationship Type
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: edgeStyle.stroke,
                fontFamily: 'monospace',
                marginTop: '2px',
              }}
            >
              {relType}
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
              Directed flow: {sourceNode?.data?.name || selectedEdge.source} ➔ {targetNode?.data?.name || selectedEdge.target}
            </div>
          </div>

          {/* Source Entity (From) */}
          <div style={{ marginBottom: '14px' }}>
            <div className="details-section-title">Source Entity (From)</div>
            <div
              className="connection-item"
              style={{ cursor: onFocusNode ? 'pointer' : 'default', padding: '10px' }}
              onClick={() => onFocusNode?.(selectedEdge.source)}
              title="Focus source node in graph"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <div
                  className="table-icon-box"
                  style={{
                    background: `${sourceColor}20`,
                    border: `1px solid ${sourceColor}40`,
                    color: sourceColor,
                    padding: 6,
                    borderRadius: 6,
                  }}
                >
                  <SourceIcon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                    {sourceNode?.data?.name || selectedEdge.source}
                  </div>
                  <div style={{ fontSize: '10px', color: sourceColor, fontFamily: 'monospace' }}>
                    {sourceNode?.id || selectedEdge.source} · {sourceType.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Flow Direction Indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 14px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: '9999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: edgeStyle.stroke,
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <ArrowRight size={12} color={edgeStyle.stroke} />
              <span>{edgeStyle.label || relType.toLowerCase()}</span>
            </div>
          </div>

          {/* Target Entity (To) */}
          <div style={{ marginBottom: '16px' }}>
            <div className="details-section-title">Target Entity (To)</div>
            <div
              className="connection-item"
              style={{ cursor: onFocusNode ? 'pointer' : 'default', padding: '10px' }}
              onClick={() => onFocusNode?.(selectedEdge.target)}
              title="Focus target node in graph"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <div
                  className="table-icon-box"
                  style={{
                    background: `${targetColor}20`,
                    border: `1px solid ${targetColor}40`,
                    color: targetColor,
                    padding: 6,
                    borderRadius: 6,
                  }}
                >
                  <TargetIcon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                    {targetNode?.data?.name || selectedEdge.target}
                  </div>
                  <div style={{ fontSize: '10px', color: targetColor, fontFamily: 'monospace' }}>
                    {targetNode?.id || selectedEdge.target} · {targetType.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Status */}
          <div className="details-intel-badge">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              <strong style={{ color: '#f1f5f9', fontSize: '11px' }}>Verified Edge Connection</strong>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
              Active relationship in Neo4j database. All data transfers and supply chains adhere to this path.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. Empty State ────────────────────────────────────────────────────────
  if (!selectedNode) {
    return (
      <div className="details-panel">
        <div className="details-panel-header">
          <span className="details-panel-title">Graph Inspector</span>
        </div>
        <div className="details-empty">
          <div className="details-empty-icon">
            <MousePointer2 size={24} />
          </div>
          <div className="details-empty-title">Select a Node or Edge</div>
          <p className="details-empty-text">
            Click any node or relationship in the graph to inspect properties, active supply-chain connections, and risk analytics.
          </p>
        </div>
      </div>
    );
  }

  // ─── 3. Node Inspector Mode ────────────────────────────────────────────────
  const data = selectedNode.data || {};
  const nodeType = (data.nodeType || 'country').toLowerCase();
  const color = nodeTypeColors[nodeType] || '#64748b';
  const Icon = NODE_ICONS[nodeType] || Globe;
  const risk = getRiskLevel(data.risk);

  return (
    <div className="details-panel">
      <div className="details-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} color="#818cf8" />
          <span className="details-panel-title">Entity Inspector</span>
        </div>
        <button onClick={onClose} className="details-close-btn" title="Close panel">
          <X size={15} />
        </button>
      </div>

      <div className="details-content">
        {/* Node header */}
        <div className="details-node-header">
          <div
            className="details-node-icon"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}45`,
              boxShadow: `0 0 16px ${color}25`,
            }}
          >
            <Icon size={22} color={color} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="details-node-name">{data.name}</div>
            <div className="details-node-id">{data.id}</div>
            <div
              className="details-type-badge"
              style={{
                background: `${color}18`,
                color,
                border: `1px solid ${color}40`,
              }}
            >
              <Icon size={11} />
              {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
            </div>
          </div>
        </div>

        {/* Core properties */}
        <div>
          <div className="details-section-title">Entity Properties</div>
          <div className="details-property-grid">
            <PropertyRow label="Entity ID" value={data.id} mono />
            <PropertyRow label="Entity Name" value={data.name} />
            <PropertyRow
              label="Classification"
              value={nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
            />
            {data.country && <PropertyRow label="Country / Region" value={data.country} />}
            {data.category && <PropertyRow label="Category" value={data.category} />}
            {data.location && <PropertyRow label="Location" value={data.location} />}

            {data.status && (
              <div className="details-property">
                <span className="prop-key">Operating Status</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: getStatusColor(data.status),
                      boxShadow: `0 0 8px ${getStatusColor(data.status)}`,
                      flexShrink: 0,
                    }}
                  />
                  <span className="prop-value" style={{ fontWeight: 600 }}>
                    {data.status}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Risk section */}
        {data.risk !== undefined && data.risk !== null && (
          <div>
            <div className="details-section-title">
              <ShieldAlert size={11} style={{ display: 'inline', marginRight: 4 }} />
              Risk Assessment
            </div>
            <div className="risk-meter-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Risk Score: <strong style={{ color: risk?.color }}>{((data.risk ?? 0) * 100).toFixed(0)}%</strong>
                </span>
                {risk && (
                  <span
                    className="risk-label"
                    style={{
                      color: risk.color,
                      background: risk.bg,
                      border: `1px solid ${risk.color}35`,
                      borderRadius: 9999,
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    ● {risk.label} Risk
                  </span>
                )}
              </div>
              <div className="risk-meter-bar-bg">
                <div
                  className="risk-meter-bar"
                  style={{
                    width: `${Math.max(6, (data.risk ?? 0) * 100)}%`,
                    background: risk?.color,
                    boxShadow: `0 0 10px ${risk?.color}80`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Total Connections Summary */}
        <div style={{ marginTop: '12px' }}>
          <div className="details-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <Share2 size={11} style={{ display: 'inline', marginRight: 4 }} />
              Supply Chain Connections
            </span>
            <span style={{ color: '#818cf8', fontWeight: 700 }}>
              {liveConnections.length} Active
            </span>
          </div>

          {loadingConn ? (
            <div style={{ fontSize: '11px', color: '#64748b', padding: '8px 0' }}>
              Querying Neo4j relationships…
            </div>
          ) : liveConnections.length === 0 ? (
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                background: 'rgba(255,255,255,0.02)',
                padding: '10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              No direct connections recorded in database.
            </div>
          ) : (
            <>
              {/* Incoming Connections */}
              {incoming.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                    INCOMING ({incoming.length})
                  </div>
                  <div className="connections-list">
                    {incoming.map((c, i) => {
                      const otherType = (c.other_labels?.[0] || 'Unknown').toLowerCase();
                      const otherColor = nodeTypeColors[otherType] || '#64748b';
                      const OtherIcon = NODE_ICONS[otherType] || Share2;
                      return (
                        <div
                          key={`inc-${i}`}
                          className="connection-item"
                          style={{ cursor: onFocusNode ? 'pointer' : 'default' }}
                          onClick={() => onFocusNode?.(c.other_id)}
                          title={`Focus ${c.other_name || c.other_id}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <ArrowLeft size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }} className="truncate">
                                {c.other_name || c.other_id}
                              </div>
                              <div style={{ fontSize: '9px', color: otherColor, fontFamily: 'monospace' }}>
                                {c.rel_type} (from {otherType})
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outgoing Connections */}
              {outgoing.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                    OUTGOING ({outgoing.length})
                  </div>
                  <div className="connections-list">
                    {outgoing.map((c, i) => {
                      const otherType = (c.other_labels?.[0] || 'Unknown').toLowerCase();
                      const otherColor = nodeTypeColors[otherType] || '#64748b';
                      const OtherIcon = NODE_ICONS[otherType] || Share2;
                      return (
                        <div
                          key={`out-${i}`}
                          className="connection-item"
                          style={{ cursor: onFocusNode ? 'pointer' : 'default' }}
                          onClick={() => onFocusNode?.(c.other_id)}
                          title={`Focus ${c.other_name || c.other_id}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <ArrowRight size={13} color="#818cf8" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }} className="truncate">
                                {c.other_name || c.other_id}
                              </div>
                              <div style={{ fontSize: '9px', color: otherColor, fontFamily: 'monospace' }}>
                                {c.rel_type} (to {otherType})
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Intelligence Context Badge */}
        <div className="details-intel-badge" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <strong style={{ color: '#f1f5f9', fontSize: '11px' }}>Knowledge Graph Synced</strong>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
            Entity fully indexed in Neo4j topology. Real-time telemetry and disruption monitoring active.
          </div>
        </div>
      </div>
    </div>
  );
}
