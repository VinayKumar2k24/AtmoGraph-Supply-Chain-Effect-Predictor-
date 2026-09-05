/**
 * AtmoGraph — Graph Data Layer
 * Transforms the mock_supply_chain.json structure into React Flow nodes and edges.
 * Designed so this file can be replaced by live API data in Week 2
 * without changing any component code.
 *
 * Layout: Dagre hierarchical layout is applied via getHierarchicalLayout()
 * so both the static fallback AND live Neo4j data render identically clean.
 */

import { getHierarchicalLayout } from '../utils/hierarchicalLayout.js';

// ─── RAW MOCK DATA ───────────────────────────────────────────────────────────
// Mirrors data/mock_supply_chain.json exactly.
// In Week 2, this will be fetched from GET /api/graph

const rawData = {
  countries: [
    { id: 'IND', name: 'India' },
    { id: 'USA', name: 'United States' },
    { id: 'DEU', name: 'Germany' },
    { id: 'CHN', name: 'China' },
    { id: 'NLD', name: 'Netherlands' },
  ],
  suppliers: [
    { id: 'SUP001', name: 'Global Electronics Components', country: 'IND', risk: 0.15, status: 'NORMAL' },
    { id: 'SUP002', name: 'Asia Semiconductor Supply',     country: 'CHN', risk: 0.25, status: 'NORMAL' },
    { id: 'SUP003', name: 'European Precision Parts',      country: 'DEU', risk: 0.10, status: 'NORMAL' },
  ],
  manufacturers: [
    { id: 'MAN001', name: 'North America Electronics', country: 'USA', risk: 0.0, status: 'NORMAL' },
    { id: 'MAN002', name: 'European Consumer Devices',  country: 'DEU', risk: 0.0, status: 'NORMAL' },
    { id: 'MAN003', name: 'India Assembly Works',       country: 'IND', risk: 0.0, status: 'NORMAL' },
  ],
  products: [
    { id: 'PROD001', name: 'Smartphone',            category: 'Consumer Electronics' },
    { id: 'PROD002', name: 'Laptop',                category: 'Consumer Electronics' },
    { id: 'PROD003', name: 'Automotive Controller', category: 'Automotive' },
  ],
  ports: [
    { id: 'PORT001', name: 'Port of Rotterdam',   country: 'NLD', risk: 0.0, status: 'OPERATIONAL' },
    { id: 'PORT002', name: 'Port of Shanghai',    country: 'CHN', risk: 0.0, status: 'OPERATIONAL' },
    { id: 'PORT003', name: 'Port of Los Angeles', country: 'USA', risk: 0.0, status: 'OPERATIONAL' },
    { id: 'PORT004', name: 'Port of Hamburg',     country: 'DEU', risk: 0.0, status: 'OPERATIONAL' },
    { id: 'PORT005', name: 'Port of Chennai',     country: 'IND', risk: 0.0, status: 'OPERATIONAL' },
  ],
  warehouses: [
    { id: 'WH001', name: 'Chicago Distribution Center',  country: 'USA', status: 'OPERATIONAL' },
    { id: 'WH002', name: 'Bengaluru Distribution Center', country: 'IND', status: 'OPERATIONAL' },
  ],
};

// ─── RELATIONSHIP DATA (mirrors 02_seed_supply_chain.py) ─────────────────────
const rawRelationships = {
  SUPPLIES: [
    { source: 'SUP001', target: 'MAN001' },
    { source: 'SUP002', target: 'MAN001' },
    { source: 'SUP003', target: 'MAN002' },
    { source: 'SUP001', target: 'MAN003' },
  ],
  PRODUCES: [
    { source: 'MAN001', target: 'PROD001' },
    { source: 'MAN001', target: 'PROD002' },
    { source: 'MAN002', target: 'PROD003' },
    { source: 'MAN003', target: 'PROD001' },
  ],
  SHIPS_THROUGH: [
    { source: 'MAN001', target: 'PORT003' },
    { source: 'MAN002', target: 'PORT004' },
    { source: 'MAN003', target: 'PORT005' },
  ],
  CONNECTED_TO: [
    { source: 'PORT002', target: 'PORT005' },
    { source: 'PORT005', target: 'PORT003' },
    { source: 'PORT003', target: 'PORT001' },
    { source: 'PORT004', target: 'PORT001' },
    { source: 'PORT002', target: 'PORT004' },
  ],
  LOCATED_IN: [
    { source: 'SUP001', target: 'IND' },
    { source: 'SUP002', target: 'CHN' },
    { source: 'SUP003', target: 'DEU' },
    { source: 'MAN001', target: 'USA' },
    { source: 'MAN002', target: 'DEU' },
    { source: 'MAN003', target: 'IND' },
    { source: 'PORT001', target: 'NLD' },
    { source: 'PORT002', target: 'CHN' },
    { source: 'PORT003', target: 'USA' },
    { source: 'PORT004', target: 'DEU' },
    { source: 'PORT005', target: 'IND' },
    { source: 'WH001', target: 'USA' },
    { source: 'WH002', target: 'IND' },
  ],
};

// ─── LAYOUT POSITIONS ────────────────────────────────────────────────────────
// Hierarchical layout: Country → Supplier → Manufacturer → Product
//                                               ↓
//                                             Port ↔ Port
//                                               ↓
//                                           Warehouse

const POSITIONS = {
  // Layer 0 — Countries (Top Row: y = 40)
  IND: { x:   80, y:  40 },
  CHN: { x:  360, y:  40 },
  DEU: { x:  640, y:  40 },
  NLD: { x:  920, y:  40 },
  USA: { x: 1200, y:  40 },

  // Layer 1 — Suppliers (y = 200)
  SUP001: { x:   80, y: 200 }, // Global Electronics (IND)
  SUP002: { x:  360, y: 200 }, // Asia Semiconductor (CHN)
  SUP003: { x:  640, y: 200 }, // European Precision (DEU)

  // Layer 2 — Manufacturers (y = 360)
  MAN003: { x:   80, y: 360 }, // India Assembly (IND)
  MAN002: { x:  640, y: 360 }, // European Consumer Devices (DEU)
  MAN001: { x: 1200, y: 360 }, // North America Electronics (USA)

  // Layer 3 — Products (y = 520)
  PROD001: { x:   80, y: 520 }, // Smartphone
  PROD003: { x:  640, y: 520 }, // Automotive Controller
  PROD002: { x: 1200, y: 520 }, // Laptop

  // Layer 4 — Ports (y = 680)
  PORT005: { x:   80, y: 680 }, // Port of Chennai (IND)
  PORT002: { x:  360, y: 680 }, // Port of Shanghai (CHN)
  PORT004: { x:  640, y: 680 }, // Port of Hamburg (DEU)
  PORT001: { x:  920, y: 680 }, // Port of Rotterdam (NLD)
  PORT003: { x: 1200, y: 680 }, // Port of Los Angeles (USA)

  // Layer 5 — Warehouses (y = 840)
  WH002: { x:   80, y: 840 }, // Bengaluru DC (IND)
  WH001: { x: 1200, y: 840 }, // Chicago DC (USA)
};

// ─── EDGE STYLES ─────────────────────────────────────────────────────────────
const EDGE_STYLES = {
  SUPPLIES: {
    stroke: '#f59e0b',
    animated: true,
    strokeDasharray: null,
    label: 'supplies',
  },
  PRODUCES: {
    stroke: '#10b981',
    animated: true,
    strokeDasharray: null,
    label: 'produces',
  },
  PROVIDES: {
    stroke: '#3b82f6',
    animated: true,
    strokeDasharray: null,
    label: 'provides',
  },
  SHIPS_TO: {
    stroke: '#a855f7',
    animated: false,
    strokeDasharray: '5 3',
    label: 'ships to',
  },
  SHIPS_THROUGH: {
    stroke: '#a855f7',
    animated: false,
    strokeDasharray: '5 3',
    label: 'ships via',
  },
  SERVES: {
    stroke: '#06b6d4',
    animated: false,
    strokeDasharray: '3 4',
    label: 'serves',
  },
  STORED_AT: {
    stroke: '#818cf8',
    animated: false,
    strokeDasharray: '4 4',
    label: 'stored at',
  },
  CONNECTED_TO: {
    stroke: '#06b6d4',
    animated: false,
    strokeDasharray: '3 4',
    label: '→',
  },
  LOCATED_IN: {
    stroke: '#64748b',
    animated: false,
    strokeDasharray: '2 4',
    label: 'located in',
  },
};

// ─── BUILD REACT FLOW NODES ──────────────────────────────────────────────────
function buildNodes() {
  const nodes = [];

  rawData.countries.forEach((c) => {
    nodes.push({
      id: c.id,
      type: 'atomoNode',
      position: POSITIONS[c.id] || { x: 0, y: 0 },
      data: { nodeType: 'country', id: c.id, name: c.name },
    });
  });

  rawData.suppliers.forEach((s) => {
    nodes.push({
      id: s.id,
      type: 'atomoNode',
      position: POSITIONS[s.id] || { x: 0, y: 0 },
      data: {
        nodeType: 'supplier',
        id: s.id,
        name: s.name,
        country: s.country,
        risk: s.risk,
        status: s.status,
      },
    });
  });

  rawData.manufacturers.forEach((m) => {
    nodes.push({
      id: m.id,
      type: 'atomoNode',
      position: POSITIONS[m.id] || { x: 0, y: 0 },
      data: {
        nodeType: 'manufacturer',
        id: m.id,
        name: m.name,
        country: m.country,
        risk: m.risk,
        status: m.status,
      },
    });
  });

  rawData.products.forEach((p) => {
    nodes.push({
      id: p.id,
      type: 'atomoNode',
      position: POSITIONS[p.id] || { x: 0, y: 0 },
      data: {
        nodeType: 'product',
        id: p.id,
        name: p.name,
        category: p.category,
      },
    });
  });

  rawData.ports.forEach((p) => {
    nodes.push({
      id: p.id,
      type: 'atomoNode',
      position: POSITIONS[p.id] || { x: 0, y: 0 },
      data: {
        nodeType: 'port',
        id: p.id,
        name: p.name,
        country: p.country,
        risk: p.risk,
        status: p.status,
      },
    });
  });

  rawData.warehouses.forEach((w) => {
    nodes.push({
      id: w.id,
      type: 'atomoNode',
      position: POSITIONS[w.id] || { x: 0, y: 0 },
      data: {
        nodeType: 'warehouse',
        id: w.id,
        name: w.name,
        country: w.country,
        status: w.status,
      },
    });
  });

  return nodes;
}

// ─── BUILD REACT FLOW EDGES ──────────────────────────────────────────────────
function buildEdges() {
  const edges = [];
  let edgeIndex = 0;

  Object.entries(rawRelationships).forEach(([relType, pairs]) => {
    const style = EDGE_STYLES[relType];
    pairs.forEach(({ source, target }) => {
      const id = `e-${relType}-${edgeIndex++}`;
      edges.push({
        id,
        source,
        target,
        type: 'smoothstep',
        animated: style.animated,
        label: style.label,
        labelBgStyle: { fill: 'rgba(13,18,32,0.85)', rx: 4 },
        labelStyle: { fill: '#64748b', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        style: {
          stroke: style.stroke,
          strokeWidth: 1.5,
          strokeDasharray: style.strokeDasharray,
        },
        data: { relType },
        // All edges visible by default
        hidden: false,
      });
    });
  });

  return edges;
}

// ─── STATISTICS ──────────────────────────────────────────────────────────────
export const graphStats = {
  totalNodes: 18,
  totalRelationships: 24,
  countries:     rawData.countries.length,
  suppliers:     rawData.suppliers.length,
  manufacturers: rawData.manufacturers.length,
  products:      rawData.products.length,
  ports:         rawData.ports.length,
  warehouses:    rawData.warehouses.length,
  byRelType: {
    SUPPLIES:      rawRelationships.SUPPLIES.length,
    PRODUCES:      rawRelationships.PRODUCES.length,
    SHIPS_THROUGH: rawRelationships.SHIPS_THROUGH.length,
    CONNECTED_TO:  rawRelationships.CONNECTED_TO.length,
    LOCATED_IN:    rawRelationships.LOCATED_IN.length,
  },
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
// Apply hierarchical layout to the static fallback data so the graph
// is clean and organised even before live API data arrives.
const _rawNodes = buildNodes();
const _rawEdges = buildEdges();

export const initialNodes = getHierarchicalLayout(_rawNodes, _rawEdges);
export const initialEdges = _rawEdges;

/** Returns the country name for a given country id */
export function getCountryName(id) {
  const c = rawData.countries.find((c) => c.id === id);
  return c ? c.name : id;
}

/** Get all unique node types */
export const nodeTypes = ['country', 'supplier', 'manufacturer', 'product', 'port', 'warehouse'];

/** Edge type display info */
export const edgeTypeInfo = EDGE_STYLES;

/** Color map for node types */
export const nodeTypeColors = {
  country:      '#38bdf8', // Blue / sky / cyan
  supplier:     '#f59e0b', // Yellow / gold
  manufacturer: '#10b981', // Green
  product:      '#818cf8', // Purple / blue
  port:         '#a855f7', // Violet
  warehouse:    '#06b6d4', // Cyan / teal
};
