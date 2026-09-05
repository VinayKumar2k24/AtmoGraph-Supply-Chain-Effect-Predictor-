import { useState } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  Truck,
  Factory,
  Cpu,
  Anchor,
  Warehouse,
  ArrowRight,
} from 'lucide-react';
import { nodeTypeColors } from '../data/graphData.js';
import { EDGE_STYLE_CONFIG } from '../utils/graphValidation.js';

const NODE_LEGEND = [
  { type: 'country',      label: 'Country',      Icon: Globe,     color: nodeTypeColors.country },
  { type: 'supplier',     label: 'Supplier',     Icon: Truck,     color: nodeTypeColors.supplier },
  { type: 'manufacturer', label: 'Manufacturer', Icon: Factory,   color: nodeTypeColors.manufacturer },
  { type: 'product',      label: 'Product',      Icon: Cpu,       color: nodeTypeColors.product },
  { type: 'port',         label: 'Port',         Icon: Anchor,    color: nodeTypeColors.port },
  { type: 'warehouse',    label: 'Warehouse',    Icon: Warehouse, color: nodeTypeColors.warehouse },
];

const RELATIONSHIPS_LIST = [
  { type: 'SUPPLIES',   desc: 'Supplier → Manufacturer' },
  { type: 'PRODUCES',   desc: 'Manufacturer → Product' },
  { type: 'PROVIDES',   desc: 'Supplier → Product' },
  { type: 'SHIPS_TO',   desc: 'Manufacturer → Warehouse' },
  { type: 'SERVES',     desc: 'Port → Warehouse' },
  { type: 'STORED_AT',  desc: 'Product → Warehouse' },
  { type: 'LOCATED_IN', desc: 'Port / Supplier → Country' },
];

export default function GraphLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`graph-legend ${collapsed ? 'collapsed' : ''}`} style={{ maxWidth: 260 }}>
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
          {/* Node Entities Section */}
          <div className="legend-section">
            <div className="legend-section-title">Node Categories</div>
            <div className="legend-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 10px' }}>
              {NODE_LEGEND.map(({ type, label, Icon, color }) => (
                <div className="legend-item" key={type} style={{ gap: 6 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: `${color}20`,
                      border: `1px solid ${color}45`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color,
                    }}
                  >
                    <Icon size={10} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Directed Flow Semantics */}
          <div className="legend-section">
            <div className="legend-section-title">Relationship Semantics</div>
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '8px',
                fontSize: '10px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowRight size={12} color="#818cf8" />
              <span>Arrows indicate directed relationship flow</span>
            </div>

            <div className="legend-edge-list">
              {RELATIONSHIPS_LIST.map(({ type, desc }) => {
                const styleCfg = EDGE_STYLE_CONFIG[type] || { stroke: '#64748b', dashed: false };
                return (
                  <div className="legend-item" key={type} style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 14,
                          height: 2,
                          background: styleCfg.stroke,
                          borderTop: styleCfg.dashed ? `2px dashed ${styleCfg.stroke}` : undefined,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          color: styleCfg.stroke,
                          fontWeight: 700,
                        }}
                      >
                        {type}
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>{desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
