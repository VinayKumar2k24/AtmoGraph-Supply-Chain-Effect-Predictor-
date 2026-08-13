import { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { nodeTypeColors, edgeTypeInfo } from '../data/graphData.js';

const NODE_LEGEND = [
  { type: 'country',      label: 'Country' },
  { type: 'supplier',     label: 'Supplier' },
  { type: 'manufacturer', label: 'Manufacturer' },
  { type: 'product',      label: 'Product' },
  { type: 'port',         label: 'Port' },
  { type: 'warehouse',    label: 'Warehouse' },
];

const EDGE_LEGEND = [
  { type: 'SUPPLIES',      label: 'SUPPLIES',      dashed: false },
  { type: 'PRODUCES',      label: 'PRODUCES',      dashed: false },
  { type: 'SHIPS_THROUGH', label: 'SHIPS_THROUGH', dashed: true },
  { type: 'CONNECTED_TO',  label: 'CONNECTED_TO',  dashed: true },
  { type: 'LOCATED_IN',    label: 'LOCATED_IN',    dashed: true },
];

export default function GraphLegend({ showLocatedIn, onToggleLocatedIn }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`graph-legend ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="legend-title"
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={13} color="#818cf8" />
          <span>Graph Legend</span>
        </div>
        {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {!collapsed && (
        <div className="legend-body">
          {/* Node types */}
          <div className="legend-section">
            <div className="legend-section-title">Node Entities</div>
            <div className="legend-grid">
              {NODE_LEGEND.map(({ type, label }) => (
                <div className="legend-item" key={type}>
                  <span
                    className="legend-dot"
                    style={{
                      background: nodeTypeColors[type],
                      boxShadow: `0 0 6px ${nodeTypeColors[type]}60`,
                    }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship types */}
          <div className="legend-section">
            <div className="legend-section-title">Relationships</div>
            <div className="legend-edge-list">
              {EDGE_LEGEND.map(({ type, label, dashed }) => (
                <div className="legend-item" key={type}>
                  {dashed ? (
                    <div
                      style={{
                        width: 18,
                        height: 2,
                        borderTop: `2px dashed ${edgeTypeInfo[type]?.stroke || '#64748b'}`,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 18,
                        height: 2.5,
                        background: edgeTypeInfo[type]?.stroke || '#64748b',
                        flexShrink: 0,
                        borderRadius: 1,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: edgeTypeInfo[type]?.stroke || '#94a3b8',
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle LOCATED_IN */}
          <button
            onClick={onToggleLocatedIn}
            className={`legend-toggle-btn ${showLocatedIn ? 'active' : ''}`}
          >
            {showLocatedIn ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{showLocatedIn ? 'Hide LOCATED_IN Edges' : 'Show LOCATED_IN Edges'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
