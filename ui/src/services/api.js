/**
 * AtmoGraph — API Service Layer v2
 *
 * Live mode: all calls go through the Vite proxy → FastAPI backend → Neo4j.
 * Fallback mock data is used ONLY when a real endpoint returns an error.
 */

import { initialNodes, initialEdges, graphStats } from '../data/graphData.js';

// Centralized Backend API base URL
// Configurable via Vite environment variable VITE_API_URL, defaulting to http://127.0.0.1:8000
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function apiFetch(path, opts = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson?.detail) errorDetail = errJson.detail;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(`API Error ${res.status}: ${errorDetail}`);
  }
  return res.json();
}

// ─── Health ──────────────────────────────────────────────────────────────────
export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    return { connected: true, ...data };
  } catch {
    return { connected: false, status: 'offline' };
  }
}

// ─── Graph ───────────────────────────────────────────────────────────────────
export async function fetchGraph() {
  return apiFetch('/api/graph');
}

export async function fetchNodeDetail(nodeId) {
  try {
    return await apiFetch(`/api/graph/node/${nodeId}`);
  } catch {
    const node = initialNodes.find((n) => n.id === nodeId);
    return node ? node.data : null;
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function fetchStats() {
  // Live stats from Neo4j via backend
  return apiFetch('/api/stats');
}

// ─── News ────────────────────────────────────────────────────────────────────
export async function fetchNews() {
  return apiFetch('/api/news');
}

export async function fetchNewsById(newsId) {
  return apiFetch(`/api/news/${newsId}`);
}

// ─── Risk ────────────────────────────────────────────────────────────────────
export async function fetchRisk() {
  return apiFetch('/api/risk');
}

export async function fetchRiskTop(limit = 10) {
  return apiFetch(`/api/risk/top?limit=${limit}`);
}

export const fetchTopRisks = fetchRiskTop;

export async function fetchRiskEntities() {
  return apiFetch('/api/risk/entities');
}

// ─── GNN Predictions & Evaluation ───────────────────────────────────────────
export async function fetchPredictions() {
  return apiFetch('/api/prediction/predictions');
}

export async function fetchEvaluation() {
  return apiFetch('/api/prediction/evaluation');
}

// ─── Ripple Propagation (Week 3) ─────────────────────────────────────────────
export async function fetchRippleNodes() {
  return apiFetch('/api/ripple/nodes');
}

export async function simulateRipple(nodeId, decay = 0.70) {
  const enc = encodeURIComponent(nodeId);
  return apiFetch(`/api/ripple/${enc}?decay=${decay}`);
}

export const fetchRipple = simulateRipple;

export async function fetchExplainability(nodeName) {
  const enc = encodeURIComponent(nodeName);
  return apiFetch(`/api/risk/explainability/${enc}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA — mirrors the actual backend pipeline output
// ═══════════════════════════════════════════════════════════════════════════════

function getMockNews() {
  return {
    total: 1,
    articles: [
      {
        id: 'NEWS001',
        title: 'Major European Port Strike Disrupts Supply Chains',
        source: 'AtmoGraph Mock News',
        published_at: '2026-08-13T10:00:00',
        text: 'Workers at the Port of Rotterdam in the Netherlands have started a major strike, disrupting container shipments. Global Electronics Components and European Precision Parts may experience delays. Manufacturers in Germany and the United States are expected to face supply chain disruptions.',
        risk_level: 'HIGH',
        matched_count: 6,
        unmatched_count: 0,
        total_entities: 6,
        entities: [
          { text: 'Port of Rotterdam',            label: 'LOC', matched: true,  graph_type: 'Port' },
          { text: 'Netherlands',                  label: 'GPE', matched: true,  graph_type: 'Country' },
          { text: 'Global Electronics Components',label: 'ORG', matched: true,  graph_type: 'Supplier' },
          { text: 'European Precision Parts',     label: 'ORG', matched: true,  graph_type: 'Supplier' },
          { text: 'Germany',                      label: 'GPE', matched: true,  graph_type: 'Country' },
          { text: 'United States',                label: 'GPE', matched: true,  graph_type: 'Country' },
        ],
      },
    ],
  };
}

function getMockRisk() {
  return {
    distribution: { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 5 },
    by_entity_type: [
      { type: 'Supplier',     entities: 3, max_risk: 0.25, avg_risk: 0.167, risk_level: 'MEDIUM' },
      { type: 'Manufacturer', entities: 3, max_risk: 0.0,  avg_risk: 0.0,   risk_level: 'LOW'    },
      { type: 'Port',         entities: 5, max_risk: 0.0,  avg_risk: 0.0,   risk_level: 'LOW'    },
    ],
    top_risks: [
      { id: 'SUP002', name: 'Asia Semiconductor Supply',     type: 'Supplier', risk_score: 0.25, risk_level: 'MEDIUM', status: 'NORMAL' },
      { id: 'SUP001', name: 'Global Electronics Components', type: 'Supplier', risk_score: 0.15, risk_level: 'MEDIUM', status: 'NORMAL' },
      { id: 'SUP003', name: 'European Precision Parts',      type: 'Supplier', risk_score: 0.10, risk_level: 'LOW',    status: 'NORMAL' },
    ],
    total_entities_with_risk: 8,
  };
}

function getMockRiskEntities() {
  return {
    entities: [
      { id: 'SUP002', name: 'Asia Semiconductor Supply',     type: 'Supplier', risk_score: 0.25, risk_level: 'MEDIUM', status: 'NORMAL' },
      { id: 'SUP001', name: 'Global Electronics Components', type: 'Supplier', risk_score: 0.15, risk_level: 'MEDIUM', status: 'NORMAL' },
      { id: 'SUP003', name: 'European Precision Parts',      type: 'Supplier', risk_score: 0.10, risk_level: 'LOW',    status: 'NORMAL' },
      { id: 'MAN001', name: 'North America Electronics',     type: 'Manufacturer', risk_score: 0.0, risk_level: 'LOW', status: 'NORMAL' },
      { id: 'MAN002', name: 'European Consumer Devices',     type: 'Manufacturer', risk_score: 0.0, risk_level: 'LOW', status: 'NORMAL' },
      { id: 'MAN003', name: 'India Assembly Works',          type: 'Manufacturer', risk_score: 0.0, risk_level: 'LOW', status: 'NORMAL' },
      { id: 'PORT001', name: 'Port of Rotterdam',  type: 'Port', risk_score: 0.0, risk_level: 'LOW', status: 'OPERATIONAL' },
      { id: 'PORT002', name: 'Port of Shanghai',   type: 'Port', risk_score: 0.0, risk_level: 'LOW', status: 'OPERATIONAL' },
    ],
  };
}
