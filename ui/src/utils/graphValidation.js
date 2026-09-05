import { MarkerType } from '@xyflow/react';

export const EDGE_STYLE_CONFIG = {
  SUPPLIES:   { stroke: '#f59e0b', label: 'supplies',   animated: true,  dashed: false },
  PRODUCES:   { stroke: '#10b981', label: 'produces',   animated: true,  dashed: false },
  PROVIDES:   { stroke: '#3b82f6', label: 'provides',   animated: true,  dashed: false },
  SHIPS_TO:   { stroke: '#a855f7', label: 'ships to',   animated: false, dashed: true  },
  SERVES:     { stroke: '#06b6d4', label: 'serves',     animated: false, dashed: true  },
  STORED_AT:  { stroke: '#818cf8', label: 'stored at',  animated: false, dashed: true  },
  LOCATED_IN: { stroke: '#64748b', label: 'located in', animated: false, dashed: true  },
};

const DEFAULT_EDGE_STYLE = { stroke: '#64748b', label: 'connected to', animated: false, dashed: false };

/**
 * Validates and normalizes raw graph data returned from the backend API.
 * Ensures referential integrity, attaches directional arrows, and computes dynamic stats.
 *
 * @param {Array} rawNodes - Raw nodes from /api/graph
 * @param {Array} rawEdges - Raw edges from /api/graph
 * @returns {{ nodes: Array, edges: Array, stats: Object }}
 */
export function validateAndTransformGraph(rawNodes = [], rawEdges = []) {
  const validNodes = [];
  const validNodeIds = new Set();
  const nodeTypeSet = new Set();
  const nodeTypeCounts = {};

  // 1. Validate & Normalize Nodes
  (rawNodes || []).forEach((node, idx) => {
    if (!node) return;

    const id = String(node.id || node.data?.id || node.name || `node-${idx}`).trim();
    if (!id || validNodeIds.has(id)) return;

    const data = node.data || {};
    let nodeType = (data.nodeType || (data.labels && data.labels[0]) || 'unknown').toLowerCase();
    
    // Normalize aliases
    if (nodeType === 'countries') nodeType = 'country';
    if (nodeType === 'suppliers') nodeType = 'supplier';
    if (nodeType === 'manufacturers') nodeType = 'manufacturer';
    if (nodeType === 'products') nodeType = 'product';
    if (nodeType === 'ports') nodeType = 'port';
    if (nodeType === 'warehouses') nodeType = 'warehouse';

    const name = data.name || node.name || id;

    const normalizedNode = {
      ...node,
      id,
      type: 'atomoNode',
      position: node.position || { x: 0, y: 0 },
      data: {
        ...data,
        id,
        name,
        nodeType,
        labels: data.labels || [nodeType.charAt(0).toUpperCase() + nodeType.slice(1)],
        status: data.status || 'NORMAL',
      },
    };

    validNodes.push(normalizedNode);
    validNodeIds.add(id);
    nodeTypeSet.add(nodeType);
    nodeTypeCounts[nodeType] = (nodeTypeCounts[nodeType] || 0) + 1;
  });

  // 2. Validate & Normalize Edges
  const validEdges = [];
  const relTypeSet = new Set();
  const relTypeCounts = {};

  (rawEdges || []).forEach((edge, idx) => {
    if (!edge) return;

    const source = String(edge.source || '').trim();
    const target = String(edge.target || '').trim();

    // Referential integrity check: both source and target nodes MUST exist
    if (!source || !target || !validNodeIds.has(source) || !validNodeIds.has(target)) {
      console.warn(`[AtmoGraph] Dropped orphaned edge: ${source} -> ${target}`);
      return;
    }

    const relType = (edge.data?.relType || edge.label || 'CONNECTED_TO').toUpperCase();
    const styleCfg = EDGE_STYLE_CONFIG[relType] || DEFAULT_EDGE_STYLE;
    const strokeColor = styleCfg.stroke;
    const edgeId = edge.id || `e-${relType}-${source}-${target}-${idx}`;

    validEdges.push({
      ...edge,
      id: edgeId,
      source,
      target,
      type: 'smoothstep',
      animated: styleCfg.animated,
      label: styleCfg.label || relType.toLowerCase().replace('_', ' '),
      labelBgStyle: {
        fill: 'rgba(15, 23, 42, 0.88)',
        rx: 4,
        ry: 4,
      },
      labelStyle: {
        fill: '#94a3b8',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'monospace',
      },
      style: {
        stroke: strokeColor,
        strokeWidth: 1.5,
        strokeDasharray: styleCfg.dashed ? '4 4' : undefined,
        cursor: 'pointer',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: strokeColor,
      },
      data: {
        ...(edge.data || {}),
        relType,
        source,
        target,
      },
    });

    relTypeSet.add(relType);
    relTypeCounts[relType] = (relTypeCounts[relType] || 0) + 1;
  });

  const stats = {
    totalNodes: validNodes.length,
    totalRelationships: validEdges.length,
    nodeTypesCount: nodeTypeSet.size,
    relTypesCount: relTypeSet.size,
    byNodeType: nodeTypeCounts,
    byRelType: relTypeCounts,
  };

  return { nodes: validNodes, edges: validEdges, stats };
}
