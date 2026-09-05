import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Globe,
  Truck,
  Factory,
  Cpu,
  Anchor,
  Warehouse,
  ShieldAlert,
} from 'lucide-react';

// ─── Semantic Node Type Configurations ───────────────────────────────────────
const TYPE_CONFIG = {
  country: {
    Icon: Globe,
    label: 'Country',
    cls: 'rf-node-country',
    accent: '#38bdf8',
    isLarge: true,
  },
  supplier: {
    Icon: Truck,
    label: 'Supplier',
    cls: 'rf-node-supplier',
    accent: '#f59e0b',
    isLarge: false,
  },
  manufacturer: {
    Icon: Factory,
    label: 'Manufacturer',
    cls: 'rf-node-manufacturer',
    accent: '#10b981',
    isLarge: false,
  },
  product: {
    Icon: Cpu,
    label: 'Product',
    cls: 'rf-node-product',
    accent: '#818cf8',
    isLarge: false,
  },
  port: {
    Icon: Anchor,
    label: 'Port',
    cls: 'rf-node-port',
    accent: '#a855f7',
    isLarge: false,
  },
  warehouse: {
    Icon: Warehouse,
    label: 'Warehouse',
    cls: 'rf-node-warehouse',
    accent: '#06b6d4',
    isLarge: false,
  },
};

function getRiskInfo(risk) {
  if (risk === undefined || risk === null) return null;
  if (risk < 0.15) return { color: '#22c55e', label: 'Low' };
  if (risk < 0.30) return { color: '#f59e0b', label: 'Med' };
  return { color: '#ef4444', label: 'High' };
}

function AtmoNode({ data, selected }) {
  const cfg = TYPE_CONFIG[data.nodeType] || TYPE_CONFIG.country;
  const { Icon, label, cls, accent, isLarge } = cfg;
  const riskInfo = getRiskInfo(data.risk);
  const dimmed = data.dimmed || false;
  const highlighted = data.highlighted || false;
  const isRippleSource = data.rippleRole === 'source';
  const isRippleAffected = data.rippleRole === 'affected';

  let borderColor = selected ? '#ffffff' : highlighted ? accent : undefined;
  let boxShadow = selected
    ? `0 0 0 2px #ffffff, 0 0 20px ${accent}80`
    : highlighted
    ? `0 0 12px ${accent}60`
    : undefined;

  if (isRippleSource) {
    borderColor = '#ef4444';
    boxShadow = '0 0 0 2px #ef4444, 0 0 24px rgba(239, 68, 68, 0.9)';
  } else if (isRippleAffected) {
    borderColor = '#f59e0b';
    boxShadow = '0 0 0 1.5px #f59e0b, 0 0 16px rgba(245, 158, 11, 0.65)';
  }

  return (
    <div
      className={`rf-node ${cls} ${selected ? 'selected' : ''} ${highlighted ? 'highlighted' : ''} ${dimmed ? 'dimmed' : ''}`}
      style={{
        opacity: dimmed ? 0.16 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: isLarge ? 210 : 190,
        borderColor,
        boxShadow,
      }}
    >
      {/* Dynamic 4-Direction Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: accent,
          width: 8,
          height: 8,
          border: '2px solid #0f172a',
          top: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: accent,
          width: 8,
          height: 8,
          border: '2px solid #0f172a',
          bottom: -4,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: accent,
          width: 6,
          height: 6,
          border: '1.5px solid #0f172a',
          left: -3,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: accent,
          width: 6,
          height: 6,
          border: '1.5px solid #0f172a',
          right: -3,
        }}
      />

      {/* Header Bar */}
      <div className="rf-node-header">
        <div
          className="rf-node-icon"
          style={{
            background: isLarge ? `${accent}30` : undefined,
          }}
        >
          <Icon size={isLarge ? 14 : 12} strokeWidth={2.4} color={accent} />
        </div>
        <span className="rf-node-type-label" style={{ fontWeight: isLarge ? 700 : 600 }}>
          {label}
        </span>
        <div className="rf-node-header-spacer" />
        {data.status && (
          <span
            className="rf-node-status-dot"
            title={`Status: ${data.status}`}
            style={{
              background:
                data.status === 'NORMAL' || data.status === 'OPERATIONAL' || data.status === 'ACTIVE'
                  ? '#22c55e'
                  : '#ef4444',
              boxShadow:
                data.status === 'NORMAL' || data.status === 'OPERATIONAL' || data.status === 'ACTIVE'
                  ? '0 0 6px rgba(34,197,94,0.7)'
                  : '0 0 6px rgba(239,68,68,0.7)',
            }}
          />
        )}
      </div>

      {/* Body */}
      <div className="rf-node-body">
        <div className="rf-node-id-row">
          <span className="rf-node-id">{data.id}</span>
          {isRippleSource && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.22)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '4px',
                padding: '1px 5px',
                letterSpacing: '0.4px',
              }}
            >
              SOURCE
            </span>
          )}
          {isRippleAffected && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '4px',
                padding: '1px 5px',
              }}
            >
              Hop #{data.rippleDepth} · {Math.round((data.rippleScore ?? 0) * 100)}%
            </span>
          )}
          {!isRippleSource && !isRippleAffected && riskInfo && (
            <span
              className="rf-node-risk-pill"
              style={{
                color: riskInfo.color,
                background: `${riskInfo.color}18`,
                border: `1px solid ${riskInfo.color}35`,
              }}
            >
              {((data.risk ?? 0) * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="rf-node-name"
          title={data.name}
          style={{
            fontSize: isLarge ? '13px' : '12px',
            fontWeight: isLarge ? 700 : 600,
          }}
        >
          {data.name}
        </div>
        {(data.country || data.location || data.category) && (
          <div className="rf-node-subprop" title={data.country || data.location || data.category}>
            {data.country || data.location || data.category}
          </div>
        )}

        {/* Risk meter fill */}
        {riskInfo && (
          <div className="rf-node-risk">
            <div
              className="rf-node-risk-fill"
              style={{
                width: `${Math.max(6, (data.risk ?? 0) * 100)}%`,
                background: riskInfo.color,
                boxShadow: `0 0 6px ${riskInfo.color}60`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AtmoNode);
