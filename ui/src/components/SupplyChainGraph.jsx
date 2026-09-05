import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, RefreshCw, Layers } from 'lucide-react';

import { nodeTypeColors } from '../data/graphData.js';
import { fetchGraph } from '../services/api.js';
import GraphLegend from './GraphLegend.jsx';
import AtmoNode from './AtmoNode.jsx';
import { getHierarchicalLayout } from '../utils/hierarchicalLayout.js';
import { validateAndTransformGraph } from '../utils/graphValidation.js';

const NODE_TYPES = { atomoNode: AtmoNode };

function FlowCanvas({
  onNodeSelect,
  onEdgeSelect,
  searchQuery = '',
  activeFilter = 'all',
  activeRelFilter = 'ALL',
  layoutRef,
  onStatsCalculated,
  onGraphLoaded,
  focusNodeId,
  rippleSourceId = null,
  rippleAffectedMap = null,
  ripplePaths = null,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);

  const reactFlowInstance = useReactFlow();
  const rawGraphRef = useRef({ nodes: [], edges: [] });
  const nodesRef = useRef([]);
  nodesRef.current = nodes;

  // Stably hold parent callbacks to completely break cyclic re-render loops
  const callbacksRef = useRef({
    onNodeSelect,
    onEdgeSelect,
    onStatsCalculated,
    onGraphLoaded,
  });
  useEffect(() => {
    callbacksRef.current = {
      onNodeSelect,
      onEdgeSelect,
      onStatsCalculated,
      onGraphLoaded,
    };
  }, [onNodeSelect, onEdgeSelect, onStatsCalculated, onGraphLoaded]);

  // ── Apply Hierarchical Layout and Fit View ──────────────────────────────────
  const applyLayout = useCallback(
    (nodeList, edgeList) => {
      const laid = getHierarchicalLayout(nodeList, edgeList);
      setNodes(laid);
      setTimeout(() => {
        reactFlowInstance?.fitView?.({ padding: 0.18, duration: 500 });
      }, 80);
      return laid;
    },
    [reactFlowInstance, setNodes]
  );

  // ── Fetch Graph Data from live FastAPI Backend ─────────────────────────────
  const loadGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    callbacksRef.current.onNodeSelect?.(null);
    callbacksRef.current.onEdgeSelect?.(null);

    try {
      const res = await fetchGraph();
      if (!res || !Array.isArray(res.nodes)) {
        throw new Error('Invalid graph payload received from backend.');
      }

      // Validate, sanitize, and attach arrow markers & relationship styles
      const { nodes: validNodes, edges: validEdges, stats } = validateAndTransformGraph(
        res.nodes,
        res.edges
      );

      if (validNodes.length === 0) {
        rawGraphRef.current = { nodes: [], edges: [] };
        setNodes([]);
        setEdges([]);
        callbacksRef.current.onStatsCalculated?.(stats);
        callbacksRef.current.onGraphLoaded?.({ nodes: [], edges: [], stats });
        return;
      }

      // Apply automatic hierarchical layout
      const laidNodes = getHierarchicalLayout(validNodes, validEdges);
      rawGraphRef.current = { nodes: laidNodes, edges: validEdges };

      setNodes(laidNodes);
      setEdges(validEdges);
      callbacksRef.current.onStatsCalculated?.(stats);
      callbacksRef.current.onGraphLoaded?.({ nodes: laidNodes, edges: validEdges, stats });

      setTimeout(() => {
        reactFlowInstance?.fitView?.({ padding: 0.18, duration: 500 });
      }, 120);
    } catch (err) {
      console.error('[AtmoGraph] Failed to load graph data:', err);
      setError(err.message || 'Unable to connect to backend server at http://127.0.0.1:8000');
    } finally {
      setLoading(false);
    }
  }, [reactFlowInstance, setNodes, setEdges]);

  // Load once on component mount
  useEffect(() => {
    loadGraphData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Expose Controls (Reset Layout, Fit View, Focus Node) to Parent ─────────
  useEffect(() => {
    if (!layoutRef) return;
    layoutRef.current = {
      resetLayout: () => {
        if (rawGraphRef.current.nodes.length === 0) return;
        const laid = applyLayout(rawGraphRef.current.nodes, rawGraphRef.current.edges);
        rawGraphRef.current = { ...rawGraphRef.current, nodes: laid };
      },
      fitView: () => {
        reactFlowInstance?.fitView?.({ padding: 0.18, duration: 500 });
      },
      focusNode: (nodeId) => {
        const target = nodesRef.current.find((n) => n.id === nodeId);
        if (target) {
          setSelectedNodeId(nodeId);
          setSelectedEdgeId(null);
          callbacksRef.current.onNodeSelect?.(target);
          callbacksRef.current.onEdgeSelect?.(null);
          reactFlowInstance?.setCenter?.(
            target.position.x + 100,
            target.position.y + 40,
            { zoom: 1.15, duration: 600 }
          );
        }
      },
      refresh: loadGraphData,
    };
  }, [layoutRef, applyLayout, reactFlowInstance, loadGraphData]);

  // Handle external focusNodeId trigger (e.g. from search selection)
  useEffect(() => {
    if (!focusNodeId) return;
    const target = nodesRef.current.find((n) => n.id === focusNodeId);
    if (target) {
      setSelectedNodeId(focusNodeId);
      setSelectedEdgeId(null);
      reactFlowInstance?.setCenter?.(
        target.position.x + 100,
        target.position.y + 40,
        { zoom: 1.15, duration: 600 }
      );
    }
  }, [focusNodeId, reactFlowInstance]);

  // ── Calculate Connected Neighbors & Edges for Highlight/Dim ───────────────
  const connectedContext = useMemo(() => {
    if (selectedNodeId) {
      const neighborNodeIds = new Set([selectedNodeId]);
      const connectedEdgeIds = new Set();

      rawGraphRef.current.edges.forEach((edge) => {
        if (edge.source === selectedNodeId) {
          neighborNodeIds.add(edge.target);
          connectedEdgeIds.add(edge.id);
        } else if (edge.target === selectedNodeId) {
          neighborNodeIds.add(edge.source);
          connectedEdgeIds.add(edge.id);
        }
      });

      return { type: 'node', neighborNodeIds, connectedEdgeIds };
    }

    const activeEdgeId = selectedEdgeId || hoveredEdgeId;
    if (activeEdgeId) {
      const edge = rawGraphRef.current.edges.find((e) => e.id === activeEdgeId);
      if (edge) {
        return {
          type: 'edge',
          activeEdgeId,
          source: edge.source,
          target: edge.target,
        };
      }
    }

    return null;
  }, [selectedNodeId, selectedEdgeId, hoveredEdgeId]);

  // ── Apply Search, Filters, and Highlighting to Nodes & Edges ───────────────
  useEffect(() => {
    if (rawGraphRef.current.nodes.length === 0) return;

    const q = (searchQuery || '').toLowerCase().trim();
    const visibleNodeIds = new Set();

    // 1. Process Nodes
    setNodes((currentNodes) =>
      currentNodes.map((n) => {
        const { nodeType, id, name } = n.data || {};

        // Node Type filter
        const matchesType = activeFilter === 'all' || nodeType === activeFilter;

        // Search match
        const matchesSearch =
          q === '' ||
          id?.toLowerCase().includes(q) ||
          name?.toLowerCase().includes(q) ||
          nodeType?.toLowerCase().includes(q);

        // Path / Relationship filter: if active, show only nodes that participate in that rel
        let matchesRel = true;
        if (activeRelFilter !== 'ALL') {
          const hasRelEdge = rawGraphRef.current.edges.some(
            (e) =>
              e.data?.relType === activeRelFilter &&
              (e.source === n.id || e.target === n.id)
          );
          matchesRel = hasRelEdge;
        }

        const isHidden = !matchesType || !matchesRel;
        if (!isHidden) {
          visibleNodeIds.add(n.id);
        }

        let dimmed = false;
        let highlighted = false;
        let rippleRole = null;
        let rippleDepth = null;
        let rippleScore = null;

        if (rippleSourceId) {
          const isSource =
            n.id === rippleSourceId ||
            n.data?.name === rippleSourceId ||
            n.data?.neo4j_id === rippleSourceId ||
            n.data?.id === rippleSourceId;

          const affected = rippleAffectedMap
            ? rippleAffectedMap[n.id] ||
              rippleAffectedMap[n.data?.name] ||
              rippleAffectedMap[n.data?.neo4j_id] ||
              rippleAffectedMap[n.data?.id]
            : null;

          if (isSource) {
            highlighted = true;
            dimmed = false;
            rippleRole = 'source';
          } else if (affected) {
            highlighted = true;
            dimmed = false;
            rippleRole = 'affected';
            rippleDepth = affected.depth;
            rippleScore = affected.ripple_score;
          } else {
            dimmed = true;
            highlighted = false;
          }
        } else if (connectedContext) {
          if (connectedContext.type === 'node') {
            if (connectedContext.neighborNodeIds.has(n.id)) {
              highlighted = true;
              dimmed = false;
            } else {
              dimmed = true;
            }
          } else if (connectedContext.type === 'edge') {
            if (n.id === connectedContext.source || n.id === connectedContext.target) {
              highlighted = true;
              dimmed = false;
            } else {
              dimmed = true;
            }
          }
        } else if (q !== '') {
          dimmed = !matchesSearch;
          highlighted = matchesSearch;
        }

        return {
          ...n,
          hidden: isHidden,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            dimmed,
            highlighted,
            rippleRole,
            rippleDepth,
            rippleScore,
          },
        };
      })
    );

    // 2. Process Edges
    setEdges((currentEdges) =>
      currentEdges.map((e) => {
        // Relationship filter match
        const matchesRelFilter =
          activeRelFilter === 'ALL' || e.data?.relType === activeRelFilter;

        // Check if endpoints are visible
        const endpointsVisible =
          visibleNodeIds.size === 0 ||
          (visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

        if (!matchesRelFilter || !endpointsVisible) {
          return { ...e, hidden: true };
        }

        let style = { ...e.style };
        let animated = e.animated;

        if (rippleSourceId && Array.isArray(ripplePaths) && ripplePaths.length > 0) {
          const isRippleEdge = ripplePaths.some((p) => {
            const matchSrc =
              p.source === e.source ||
              p.source_id === e.source ||
              p.source === e.data?.source ||
              p.source === e.data?.sourceName;
            const matchTgt =
              p.target === e.target ||
              p.target_id === e.target ||
              p.target === e.data?.target ||
              p.target === e.data?.targetName;
            return (matchSrc && matchTgt) || p.source === e.source || p.target === e.target;
          });

          if (isRippleEdge) {
            style.opacity = 1;
            style.stroke = '#f43f5e';
            style.strokeWidth = 2.8;
            animated = true;
          } else {
            style.opacity = 0.08;
            style.strokeWidth = 1;
            animated = false;
          }
        } else if (connectedContext) {
          if (connectedContext.type === 'node') {
            if (connectedContext.connectedEdgeIds.has(e.id)) {
              style.opacity = 1;
              style.strokeWidth = 2.5;
              animated = true;
            } else {
              style.opacity = 0.08;
              style.strokeWidth = 1;
              animated = false;
            }
          } else if (connectedContext.type === 'edge') {
            if (e.id === connectedContext.activeEdgeId) {
              style.opacity = 1;
              style.strokeWidth = 3;
              animated = true;
            } else {
              style.opacity = 0.08;
              style.strokeWidth = 1;
              animated = false;
            }
          }
        } else {
          style.opacity = 0.9;
          style.strokeWidth = 1.5;
        }

        return {
          ...e,
          hidden: false,
          style,
          animated,
        };
      })
    );
  }, [
    searchQuery,
    activeFilter,
    activeRelFilter,
    selectedNodeId,
    selectedEdgeId,
    hoveredEdgeId,
    connectedContext,
    rippleSourceId,
    rippleAffectedMap,
    ripplePaths,
    setNodes,
    setEdges,
  ]);

  // ── Node Click ────────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_evt, node) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      callbacksRef.current.onNodeSelect?.(node);
      callbacksRef.current.onEdgeSelect?.(null);
    },
    []
  );

  // ── Edge Click ────────────────────────────────────────────────────────────
  const onEdgeClick = useCallback(
    (_evt, edge) => {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      callbacksRef.current.onEdgeSelect?.(edge);
      callbacksRef.current.onNodeSelect?.(null);
    },
    []
  );

  // ── Edge Hover ────────────────────────────────────────────────────────────
  const onEdgeMouseEnter = useCallback((_evt, edge) => {
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  // ── Pane Click (Deselect) ─────────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    callbacksRef.current.onNodeSelect?.(null);
    callbacksRef.current.onEdgeSelect?.(null);
  }, []);

  // ── Minimap Node Color ────────────────────────────────────────────────────
  const minimapNodeColor = useCallback((node) => {
    return nodeTypeColors[node.data?.nodeType] || '#334155';
  }, []);

  // ── Render Error State if load failed and no nodes exist ──────────────────
  if (error && nodes.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={24} color="#ef4444" />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
          Unable to load graph data. Please check that the backend server is running.
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: 460, marginBottom: 20 }}>
          {error}
        </p>
        <button onClick={loadGraphData} className="btn btn-primary">
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  // ── Render Empty State if no nodes exist ──────────────────────────────────
  if (!loading && nodes.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <Layers size={40} color="#64748b" style={{ marginBottom: 12, opacity: 0.5 }} />
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
          No supply-chain data available.
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: 16 }}>
          The Neo4j database returned zero nodes for this graph query.
        </p>
        <button onClick={loadGraphData} className="btn btn-outline">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="graph-canvas-wrap" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18, duration: 400 }}
        minZoom={0.15}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="rgba(255,255,255,0.06)"
        />
        <Controls position="bottom-right" style={{ bottom: 16, right: 16 }} />
        <MiniMap
          position="top-right"
          nodeColor={minimapNodeColor}
          maskColor="rgba(6,9,17,0.85)"
          style={{
            top: 14,
            right: 14,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}
        />
        <GraphLegend />
      </ReactFlow>

      {/* Loading Overlay — displays over the canvas without tearing down ReactFlow DOM */}
      {loading && (
        <div
          className="page-loading-wrap"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 15, 29, 0.78)',
            backdropFilter: 'blur(3px)',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <div className="spinner" />
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: 14, fontWeight: 500 }}>
            Loading supply-chain network...
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupplyChainGraph(props) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
