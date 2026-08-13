import { useState, useEffect } from 'react';
import {
  MousePointer2,
  Globe,
  Package,
  Factory,
  Box,
  Anchor,
  Warehouse,
  ShieldAlert,
  X,
  Activity,
  ArrowRight,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { nodeTypeColors, getCountryName } from '../data/graphData.js';
import { fetchNodeDetail } from '../services/api.js';

const NODE_ICONS = {
  country:      Globe,
  supplier:     Package,
  manufacturer: Factory,
  product:      Box,
  port:         Anchor,
  warehouse:    Warehouse,
};

function getRiskLevel(risk) {
  if (risk === undefined || risk === null) return null;
  if (risk < 0.15) return { label: 'Low',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (risk < 0.30) return { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return               { label: 'High',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

function getStatusColor(status) {
  if (!status) return '#64748b';
  if (status === 'NORMAL' || status === 'OPERATIONAL') return '#22c55e';
  if (status === 'DISRUPTED') return '#ef4444';
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

export default function NodeDetails({ selectedNode, onClose, onFocusNode }) {
  const [connections, setConnections] = useState([]);
  const [loadingConn, setLoadingConn] = useState(false);

  useEffect(() => {
    if (!selectedNode?.id) {
      setConnections([]);
      return;
    }
    setLoadingConn(true);
    fetchNodeDetail(selectedNode.id)
      .then((res) => {
        if (res && res.connections) {
          setConnections(res.connections.filter((c) => c.other_id));
        } else {
          setConnections([]);
        }
      })
      .catch(() => setConnections([]))
      .finally(() => setLoadingConn(false));
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return (
      <div className="details-panel">
        <div className="details-panel-header">
          <span className="details-panel-title">Node Inspector</span>
        </div>
        <div className="details-empty">
          <div className="details-empty-icon">
            <MousePointer2 size={24} />
          </div>
          <div className="details-empty-title">Select an Entity</div>
          <p className="details-empty-text">
            Click any node in the graph to inspect properties, live supply-chain connections, and risk analytics.
          </p>
        </div>
      </div>
    );
  }

  const data = selectedNode.data;
  const nodeType = data.nodeType || 'country';
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
        <button
          onClick={onClose}
          className="details-close-btn"
          title="Close panel"
        >
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

            {data.country && (
              <PropertyRow
                label="Country / Region"
                value={`${getCountryName(data.country)} (${data.country})`}
              />
            )}

            {data.category && (
              <PropertyRow label="Category" value={data.category} />
            )}

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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Risk Score:{' '}
                  <strong style={{ color: risk.color }}>
                    {((data.risk ?? 0) * 100).toFixed(0)}%
                  </strong>
                </span>
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
              </div>
              <div className="risk-meter-bar-bg">
                <div
                  className="risk-meter-bar"
                  style={{
                    width: `${Math.max(6, (data.risk ?? 0) * 100)}%`,
                    background: risk.color,
                    boxShadow: `0 0 10px ${risk.color}80`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Graph Connections */}
        <div>
          <div className="details-section-title">
            <Share2 size={11} style={{ display: 'inline', marginRight: 4 }} />
            Connected Graph Entities
          </div>
          {loadingConn ? (
            <div style={{ fontSize: '11px', color: '#64748b', padding: '8px 0' }}>
              Querying Neo4j relationships…
            </div>
          ) : connections.length === 0 ? (
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
              No direct relationships queried for this node.
            </div>
          ) : (
            <div className="connections-list">
              {connections.map((c, i) => {
                const otherType = (c.other_labels?.[0] || 'Unknown').toLowerCase();
                const otherColor = nodeTypeColors[otherType] || '#64748b';
                const isOut = c.direction === 'out';
                return (
                  <div
                    key={i}
                    className="connection-item"
                    style={{
                      cursor: onFocusNode ? 'pointer' : 'default',
                    }}
                    onClick={() => onFocusNode?.(c.other_id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {isOut ? (
                        <ArrowRight size={12} color="#818cf8" />
                      ) : (
                        <ArrowLeft size={12} color="#f59e0b" />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }} className="truncate">
                          {c.other_name || c.other_id}
                        </div>
                        <div style={{ fontSize: '9px', color: otherColor, fontFamily: 'monospace' }}>
                          {c.rel_type} ({otherType})
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Intelligence Context Badge */}
        <div className="details-intel-badge">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <strong style={{ color: '#f1f5f9', fontSize: '11px' }}>
              Knowledge Graph Status
            </strong>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
            Entity active in Neo4j supply chain graph. Continuous NLP news monitoring enabled.
          </div>
        </div>
      </div>
    </div>
  );
}
