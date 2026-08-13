import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Globe,
  Package,
  Factory,
  Box,
  Anchor,
  Warehouse,
  ShieldAlert,
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  country: {
    Icon: Globe,
    label: 'Country',
    cls: 'rf-node-country',
    accent: '#6366f1',
  },
  supplier: {
    Icon: Package,
    label: 'Supplier',
    cls: 'rf-node-supplier',
    accent: '#f59e0b',
  },
  manufacturer: {
    Icon: Factory,
    label: 'Manufacturer',
    cls: 'rf-node-manufacturer',
    accent: '#10b981',
  },
  product: {
    Icon: Box,
    label: 'Product',
    cls: 'rf-node-product',
    accent: '#3b82f6',
  },
  port: {
    Icon: Anchor,
    label: 'Port',
    cls: 'rf-node-port',
    accent: '#a855f7',
  },
  warehouse: {
    Icon: Warehouse,
    label: 'Warehouse',
    cls: 'rf-node-warehouse',
    accent: '#06b6d4',
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
  const { Icon, label, cls, accent } = cfg;
  const riskInfo = getRiskInfo(data.risk);
  const dimmed = data.dimmed || false;
  const highlighted = data.highlighted || false;

  return (
    <div
      className={`rf-node ${cls} ${selected ? 'selected' : ''} ${highlighted ? 'highlighted' : ''} ${dimmed ? 'dimmed' : ''}`}
      style={{
        opacity: dimmed ? 0.18 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Handles */}
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
        <div className="rf-node-icon">
          <Icon size={12} strokeWidth={2.4} />
        </div>
        <span className="rf-node-type-label">{label}</span>
        <div className="rf-node-header-spacer" />
        {data.status && (
          <span
            className="rf-node-status-dot"
            title={`Status: ${data.status}`}
            style={{
              background:
                data.status === 'NORMAL' || data.status === 'OPERATIONAL'
                  ? '#22c55e'
                  : '#ef4444',
              boxShadow:
                data.status === 'NORMAL' || data.status === 'OPERATIONAL'
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
          {riskInfo && (
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
        <div className="rf-node-name" title={data.name}>
          {data.name}
        </div>

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
