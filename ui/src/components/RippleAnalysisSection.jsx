import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Share2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  Activity,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  Maximize2,
  CornerDownRight,
  Sparkles,
  Columns,
} from 'lucide-react';
import { fetchRippleNodes, simulateRipple, fetchExplainability } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';
import SupplyChainGraph from './SupplyChainGraph.jsx';

export default function RippleAnalysisSection() {
  const [candidates, setCandidates] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [decay, setDecay] = useState(0.70);
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [rippleData, setRippleData] = useState(null);
  const [error, setError] = useState(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'paths' when not in split view

  // Fetch available simulation nodes
  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const res = await fetchRippleNodes();
      if (res?.nodes && res.nodes.length > 0) {
        setCandidates(res.nodes);
        // Default to Rotterdam Port or the most disrupted node
        const defaultNode =
          res.nodes.find((n) => n.name?.toLowerCase().includes('rotterdam') || n.id === 'P003') ||
          res.nodes[0];
        if (defaultNode) {
          setSelectedNodeId(defaultNode.id || defaultNode.neo4j_id || defaultNode.name);
        }
      }
    } catch (err) {
      console.warn('Failed to load ripple candidate nodes:', err);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Execute ripple simulation
  const handleAnalyze = useCallback(
    async (nodeToAnalyze) => {
      const targetId = nodeToAnalyze || selectedNodeId;
      if (!targetId) return;

      setLoading(true);
      setError(null);
      try {
        const res = await simulateRipple(targetId, decay);
        if (!res || !res.source_node) {
          throw new Error('Invalid response received from ripple simulation API.');
        }
        setRippleData(res);
      } catch (err) {
        console.error('Ripple simulation error:', err);
        setError(err.message || 'Unable to simulate ripple propagation.');
      } finally {
        setLoading(false);
      }
    },
    [selectedNodeId, decay]
  );

  // Run initial simulation on Rotterdam Port once candidates are loaded
  useEffect(() => {
    if (candidates.length > 0 && selectedNodeId && !rippleData && !loading) {
      handleAnalyze(selectedNodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  // Map of affected node IDs for graph highlighting
  const rippleAffectedMap = useMemo(() => {
    if (!rippleData?.affected_nodes) return {};
    const map = {};
    rippleData.affected_nodes.forEach((a) => {
      if (a.id) map[a.id] = a;
      if (a.neo4j_id) map[a.neo4j_id] = a;
      if (a.name) map[a.name] = a;
    });
    return map;
  }, [rippleData]);

  const sourceNode = rippleData?.source_node;
  const affectedNodes = rippleData?.affected_nodes || [];
  const paths = rippleData?.paths || [];

  // Dynamically resolve currently selected node metadata and shock label (Requirement 1 & 2)
  const selectedCandidate = useMemo(() => {
    return (
      candidates.find(
        (c) =>
          (c.id && c.id === selectedNodeId) ||
          (c.name && c.name === selectedNodeId) ||
          (c.neo4j_id && c.neo4j_id === selectedNodeId)
      ) ||
      (sourceNode
        ? {
            name: sourceNode.name,
            id: sourceNode.id,
            entity_type: sourceNode.entity_type,
          }
        : null)
    );
  }, [candidates, selectedNodeId, sourceNode]);

  const selectedNodeName = selectedCandidate?.name || sourceNode?.name || 'Selected Node';
  const shockLabel = `${selectedNodeName} Shock`;

  return (
    <div
      className="dash-card ripple-analysis-wrapper"
      style={{
        marginBottom: 20,
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(168, 85, 247, 0.28)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.45)',
        borderRadius: 12,
        padding: '20px 22px',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitBranch size={17} color="#ef4444" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#f8fafc',
                    margin: 0,
                    letterSpacing: '-0.2px',
                  }}
                >
                  Supply Chain Ripple Effect Propagation
                </h2>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#c084fc',
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
                  Week 3 Topology Engine
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#fca5a5',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    letterSpacing: '0.4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 6px #ef4444',
                    }}
                  />
                  {shockLabel}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>
                Simulate shock propagation across downstream dependencies using exponential graph decay & GNN delay regression
              </p>
            </div>
          </div>
        </div>

        {/* View mode toggle (Requirement 5 & 6) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`filter-btn-pill ${isSplitView ? 'active' : ''}`}
            onClick={() => setIsSplitView((prev) => !prev)}
            style={{
              fontSize: '11px',
              padding: '4px 12px',
              background: isSplitView ? 'rgba(168, 85, 247, 0.22)' : undefined,
              borderColor: isSplitView ? 'rgba(168, 85, 247, 0.55)' : undefined,
              color: isSplitView ? '#f3e8ff' : undefined,
              fontWeight: isSplitView ? 700 : 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Toggle side-by-side topology canvas and propagation paths layout"
          >
            <Columns size={12} />
            {isSplitView ? 'Exit Split View' : 'Split Canvas & Paths'}
          </button>
          <button
            className={`filter-btn-pill ${!isSplitView && activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => {
              setIsSplitView(false);
              setActiveTab('graph');
            }}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            title="Focus on Supply Chain Graph Topology"
          >
            Topology View
          </button>
          <button
            className={`filter-btn-pill ${!isSplitView && activeTab === 'paths' ? 'active' : ''}`}
            onClick={() => {
              setIsSplitView(false);
              setActiveTab('paths');
            }}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            title="Focus on Propagation Paths Breakdown"
          >
            Explainability Paths
          </button>
        </div>
      </div>

      {/* Control Bar: Selector + Decay + Analyze Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
            Select Disrupted Node:
          </label>
          <select
            value={selectedNodeId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedNodeId(newId);
              handleAnalyze(newId);
            }}
            disabled={loadingCandidates || loading}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: '#f8fafc',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              minWidth: 260,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {candidates.map((c) => (
              <option key={c.neo4j_id || c.id} value={c.id || c.name}>
                {c.name} ({c.entity_type}){c.disruption >= 0.75 ? ' — [DISRUPTED]' : c.risk >= 0.3 ? ' — [AT RISK]' : ''}
              </option>
            ))}
          </select>

          {/* Dynamic shock trigger button (Requirement 1 & 2) */}
          <button
            onClick={() => handleAnalyze(selectedNodeId)}
            disabled={loading || !selectedNodeId}
            className="filter-btn-pill active"
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.14)',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
            title={`Trigger ripple shock analysis for ${selectedNodeName}`}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px #ef4444',
              }}
            />
            {shockLabel}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '11.5px',
              color: '#94a3b8',
            }}
            title="Exponential decay multiplier applied per graph hop"
          >
            <span>Decay:</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              70% / hop (decay = 0.70)
            </span>
          </div>

          <button
            onClick={() => handleAnalyze()}
            disabled={loading || !selectedNodeId}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              borderColor: 'rgba(168, 85, 247, 0.5)',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: 700,
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            {loading ? 'Propagating Shock…' : 'Analyze Ripple Effect'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
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
            color: '#fca5a5',
            fontSize: '12.5px',
          }}
        >
          <AlertTriangle size={16} color="#ef4444" />
          <span>{error}</span>
        </div>
      )}

      {/* Ripple Summary KPI Ribbon */}
      {sourceNode && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {/* Source Node */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Shock Origin (Source)
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', marginTop: 3 }}>
              {sourceNode.name}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 2 }}>
              {sourceNode.entity_type} • <span style={{ color: '#fca5a5', fontWeight: 600 }}>{shockLabel}</span>
            </div>
          </div>

          {/* Total Affected Nodes */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(168, 85, 247, 0.06)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Affected Nodes
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#c084fc', marginTop: 2, fontFamily: 'monospace' }}>
              {rippleData.total_affected_nodes} Entities
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 2 }}>
              Downstream supply chain impact
            </div>
          </div>

          {/* Maximum Propagation Depth */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Max Propagation Depth
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: 2, fontFamily: 'monospace' }}>
              {rippleData.max_depth} Hops
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 2 }}>
              Traversed supply chain distance
            </div>
          </div>

          {/* Highest Ripple Score */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Peak Ripple Score
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: 2, fontFamily: 'monospace' }}>
              {affectedNodes.length > 0 ? `${(affectedNodes[0].ripple_score * 100).toFixed(0)}%` : '0%'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 2 }}>
              Hop #1 immediate downstream shock
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Display: Graph Visualization & Explainability Path Panel (Requirement 2 & 3) */}
      <div className={isSplitView ? 'ripple-split-layout' : 'ripple-single-layout'}>
        {/* LEFT PANEL: Dedicated Supply Chain Topology Canvas */}
        {(isSplitView || activeTab === 'graph') && (
          <div className="ripple-panel">
            <div className="ripple-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={14} color="#ef4444" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>
                  Supply Chain Topology Canvas
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px' }}>
                <span style={{ color: '#cbd5e1' }}>
                  Shock Origin: <strong style={{ color: '#fca5a5' }}>{sourceNode?.name || selectedNodeName}</strong>
                </span>
                <span style={{ color: '#64748b' }}>•</span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  {affectedNodes.length} Impacted Nodes
                </span>
              </div>
            </div>

            <div className="ripple-panel-body">
              <SupplyChainGraph
                rippleSourceId={sourceNode?.neo4j_id || sourceNode?.id || sourceNode?.name}
                rippleAffectedMap={rippleAffectedMap}
                ripplePaths={paths}
              />
            </div>
          </div>
        )}

        {/* RIGHT PANEL: Dedicated Propagation Paths Breakdown */}
        {(isSplitView || activeTab === 'paths') && (
          <div className="ripple-panel">
            <div className="ripple-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={14} color="#a855f7" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>
                  Propagation Paths Breakdown
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {affectedNodes.length > 0 ? `${affectedNodes.length} Downstream Hops` : '0 Hops'}
              </span>
            </div>

            <div className="ripple-paths-scroll">
              {affectedNodes.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '12px',
                    textAlign: 'center',
                    padding: '32px 16px',
                  }}
                >
                  <ShieldAlert size={28} style={{ marginBottom: 8, opacity: 0.5, color: '#94a3b8' }} />
                  <strong style={{ color: '#cbd5e1', fontSize: '13.5px' }}>No downstream affected entities</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                    {sourceNode?.name || selectedNodeName} has no downstream dependent connections in the graph.
                  </span>
                </div>
              ) : (
                affectedNodes.map((a, idx) => {
                  const c = nodeTypeColors[a.entity_type?.toLowerCase()] || '#818cf8';
                  const depthColor =
                    a.depth === 1 ? '#ef4444' : a.depth === 2 ? '#f59e0b' : a.depth === 3 ? '#38bdf8' : '#a855f7';
                  const rippleScorePct = Math.round(a.ripple_score * 100);

                  return (
                    <div
                      key={a.neo4j_id || idx}
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Header row: Hop badge, Node name, Entity type, Ripple score */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: depthColor,
                              background: `${depthColor}18`,
                              border: `1px solid ${depthColor}45`,
                              padding: '2px 7px',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          >
                            Hop #{a.depth}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                              {a.name}
                            </span>
                            <span style={{ fontSize: '10.5px', color: c, fontWeight: 600, marginLeft: 6 }}>
                              ({a.entity_type})
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              color: rippleScorePct >= 50 ? '#ef4444' : rippleScorePct >= 25 ? '#f59e0b' : '#38bdf8',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                            title="Graph-based Ripple Propagation Score"
                          >
                            Score: {(a.ripple_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Visual Ordered Path Sequence: Node -> [RELATIONSHIP] -> Node */}
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 6,
                          background: 'rgba(0, 0, 0, 0.45)',
                          border: '1px solid rgba(168, 85, 247, 0.22)',
                          padding: '7px 10px',
                          borderRadius: 6,
                        }}
                      >
                        {a.nodes && a.nodes.length > 0 ? (
                          a.nodes.map((nodeName, nIdx) => {
                            const isSrc = nIdx === 0;
                            const isTgt = nIdx === a.nodes.length - 1;
                            const rel = a.relationships && a.relationships[nIdx];
                            return (
                              <div key={nIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontWeight: isSrc || isTgt ? 800 : 600,
                                    color: isSrc ? '#fca5a5' : isTgt ? '#f3e8ff' : '#cbd5e1',
                                    background: isSrc
                                      ? 'rgba(239, 68, 68, 0.18)'
                                      : isTgt
                                      ? 'rgba(168, 85, 247, 0.25)'
                                      : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${
                                      isSrc
                                        ? 'rgba(239, 68, 68, 0.4)'
                                        : isTgt
                                        ? 'rgba(168, 85, 247, 0.5)'
                                        : 'rgba(255, 255, 255, 0.1)'
                                    }`,
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    fontSize: '11px',
                                  }}
                                >
                                  {nodeName}
                                </span>
                                {rel && (
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: '9.5px',
                                      fontWeight: 800,
                                      color: '#38bdf8',
                                      background: 'rgba(56, 189, 248, 0.12)',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                      padding: '1px 5px',
                                      borderRadius: 3,
                                      letterSpacing: '0.4px',
                                    }}
                                  >
                                    --{rel}&rarr;
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CornerDownRight size={12} color="#c084fc" style={{ flexShrink: 0 }} />
                            <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                              {a.path_description}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Human-readable Explanation Sentence */}
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#e2e8f0',
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 10px',
                          background: 'rgba(168, 85, 247, 0.08)',
                          borderLeft: '3px solid #a855f7',
                          borderRadius: '0 5px 5px 0',
                          lineHeight: '1.4',
                        }}
                      >
                        <span>
                          "{a.explanation || `${a.name} is affected through a ${a.depth}-hop downstream path from ${sourceNode?.name || selectedNodeName}.`}"
                        </span>
                      </div>

                      {/* Metrics footer: GNN Predicted Delay, Actual, Risk, Disruption */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          paddingTop: 4,
                          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                          fontSize: '10.5px',
                          color: '#94a3b8',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: '#f3e8ff',
                              background: 'rgba(168, 85, 247, 0.2)',
                              border: '1px solid rgba(168, 85, 247, 0.35)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            <Clock size={10} color="#c084fc" />
                            GNN Predicted: {a.predicted_delay} days
                          </span>
                          <span>Actual: <strong style={{ color: '#38bdf8' }}>{a.actual_delay}d</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Risk: <strong style={{ color: a.risk >= 0.4 ? '#ef4444' : '#f59e0b' }}>{(a.risk * 100).toFixed(0)}%</strong></span>
                          <span>•</span>
                          <span>Disruption: <strong style={{ color: a.disruption > 0.4 ? '#fca5a5' : '#86efac' }}>{a.disruption.toFixed(2)}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Affected Entities Detailed Table */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={14} color="#818cf8" />
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Downstream Affected Entities ({affectedNodes.length} Impacted)
            </h3>
          </div>
          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
            Ranked by Graph-based Ripple Propagation Score descending
          </span>
        </div>

        <div className="risk-entities-table-wrap">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>Affected Entity</th>
                <th>Entity Type</th>
                <th>Propagation Depth</th>
                <th>Inbound Connection</th>
                <th>Ripple Propagation Score</th>
                <th>GNN Predicted Delay</th>
                <th>Baseline Risk</th>
                <th>Disruption Index</th>
              </tr>
            </thead>
            <tbody>
              {affectedNodes.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
                    <ShieldAlert size={26} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#cbd5e1' }}>
                      No downstream affected entities
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                      No downstream supply chain entities are impacted by {sourceNode?.name || selectedNodeName}.
                    </div>
                  </td>
                </tr>
              ) : (
                affectedNodes.map((a, idx) => {
                  const type = a.entity_type || 'Unknown';
                  const c = nodeTypeColors[type.toLowerCase()] || '#64748b';
                  const ripplePct = Math.round(a.ripple_score * 100);
                  const depthColor =
                    a.depth === 1 ? '#ef4444' : a.depth === 2 ? '#f59e0b' : a.depth === 3 ? '#38bdf8' : '#a855f7';

                  return (
                    <tr key={a.neo4j_id || idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: depthColor,
                            }}
                          />
                          <div>
                            <div className="table-row-name">{a.name}</div>
                            <div className="table-row-mono-id">
                              {a.id || a.neo4j_id?.slice(-8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="table-type-badge" style={{ color: c, borderColor: `${c}30` }}>
                          {type}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: depthColor,
                            background: `${depthColor}15`,
                            border: `1px solid ${depthColor}35`,
                            borderRadius: 4,
                            padding: '2px 8px',
                          }}
                        >
                          Hop #{a.depth}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            color: '#94a3b8',
                            fontFamily: 'monospace',
                          }}
                        >
                          {a.relationship}
                        </span>
                      </td>

                      <td>
                        <div className="table-risk-score-cell">
                          <span
                            className="table-score-num"
                            style={{
                              color: ripplePct >= 50 ? '#ef4444' : ripplePct >= 30 ? '#f59e0b' : '#38bdf8',
                              fontWeight: 800,
                            }}
                          >
                            {(a.ripple_score * 100).toFixed(1)}%
                          </span>
                          <div className="table-score-bar-track">
                            <div
                              className="table-score-bar-fill"
                              style={{
                                width: `${Math.max(6, ripplePct)}%`,
                                background:
                                  ripplePct >= 50
                                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                    : ripplePct >= 30
                                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                    : 'linear-gradient(90deg, #38bdf8, #0284c7)',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#f3e8ff',
                            background: 'rgba(168, 85, 247, 0.18)',
                            border: '1px solid rgba(168, 85, 247, 0.35)',
                            borderRadius: 6,
                            padding: '2px 8px',
                          }}
                        >
                          <Clock size={11} color="#c084fc" />
                          {a.predicted_delay} days
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>
                          {(a.risk * 100).toFixed(0)}%
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: a.disruption > 0.4 ? '#fca5a5' : '#86efac',
                          }}
                        >
                          {a.disruption.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
