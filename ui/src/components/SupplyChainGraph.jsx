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

import { initialNodes, initialEdges, nodeTypeColors, edgeTypeInfo } from '../data/graphData.js';
import { fetchGraph } from '../services/api.js';
import GraphLegend from './GraphLegend.jsx';
import AtmoNode from './AtmoNode.jsx';

const NODE_TYPES = { atomoNode: AtmoNode };

function FlowCanvas({ onNodeSelect, searchQuery = '', activeFilter = 'all' }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showLocatedIn, setShowLocatedIn] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const reactFlowInstance = useReactFlow();
  const rawDataRef = useRef({ nodes: initialNodes, edges: initialEdges });

  // ── Load live graph data from backend ──────────────────────────────────────
  useEffect(() => {
    fetchGraph()
      .then((data) => {
        if (data && data.nodes && data.edges) {
          rawDataRef.current = { nodes: data.nodes, edges: data.edges };
          setNodes(data.nodes);
          setEdges(data.edges);
          setTimeout(() => {
            reactFlowInstance?.fitView?.({ padding: 0.15, duration: 400 });
          }, 100);
        }
      })
      .catch((err) => {
        console.warn('[AtmoGraph] Live graph fetch failed, using fallback:', err);
      });
  }, [reactFlowInstance, setNodes, setEdges]);

  // ── Calculate Connected Neighbors for Selection Highlighting ──────────────
  const connectedMap = useMemo(() => {
    if (!selectedNodeId) return null;
    const neighborNodeIds = new Set([selectedNodeId]);
    const connectedEdgeIds = new Set();

    rawDataRef.current.edges.forEach((edge) => {
      if (edge.source === selectedNodeId) {
        neighborNodeIds.add(edge.target);
        connectedEdgeIds.add(edge.id);
      } else if (edge.target === selectedNodeId) {
        neighborNodeIds.add(edge.source);
        connectedEdgeIds.add(edge.id);
      }
    });

    return { neighborNodeIds, connectedEdgeIds };
  }, [selectedNodeId]);

  // ── Apply search, filter, and selection states ────────────────────────────
  useEffect(() => {
    const q = (searchQuery || '').toLowerCase().trim();

    setNodes((nds) =>
      nds.map((n) => {
        const { nodeType, id, name, country } = n.data;

        // Filter match
        const typeMatch = activeFilter === 'all' || nodeType === activeFilter;

        // Search match
        const searchMatch =
          q === '' ||
          id.toLowerCase().includes(q) ||
          (name && name.toLowerCase().includes(q)) ||
          nodeType.toLowerCase().includes(q) ||
          (country && country.toLowerCase().includes(q));

        const hidden = !typeMatch;

        let dimmed = false;
        let highlighted = false;

        if (connectedMap) {
          // If a node is selected, highlight neighbors, dim the rest
          if (connectedMap.neighborNodeIds.has(n.id)) {
            highlighted = true;
            dimmed = false;
          } else {
            dimmed = true;
          }
        } else if (q !== '') {
          // If searching, dim non-matching
          dimmed = !searchMatch;
        }

        return {
          ...n,
          hidden,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            dimmed,
            highlighted,
          },
        };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isLocatedIn = e.data?.relType === 'LOCATED_IN';
        if (isLocatedIn && !showLocatedIn) return { ...e, hidden: true };

        const sourceNode = nodes.find((n) => n.id === e.source);
        const targetNode = nodes.find((n) => n.id === e.target);
        const isNodeHidden = sourceNode?.hidden || targetNode?.hidden;

        if (isNodeHidden) return { ...e, hidden: true };

        let style = { ...e.style };
        let animated = e.animated;

        if (connectedMap) {
          if (connectedMap.connectedEdgeIds.has(e.id)) {
            style.opacity = 1;
            style.strokeWidth = 2.5;
            animated = true;
          } else {
            style.opacity = 0.08;
            style.strokeWidth = 1;
            animated = false;
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
  }, [searchQuery, activeFilter, showLocatedIn, selectedNodeId, connectedMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node Click ────────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_evt, node) => {
      setSelectedNodeId(node.id);
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );

  // ── Pane Click (Deselect) ─────────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // ── Minimap Node Color ────────────────────────────────────────────────────
  const minimapNodeColor = useCallback((node) => {
    return nodeTypeColors[node.data?.nodeType] || '#334155';
  }, []);

  return (
    <div className="graph-canvas-wrap" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15, duration: 400 }}
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
        <Controls
          position="bottom-right"
          style={{ bottom: 16, right: 16 }}
        />
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
        <GraphLegend
          showLocatedIn={showLocatedIn}
          onToggleLocatedIn={() => setShowLocatedIn((v) => !v)}
        />
      </ReactFlow>
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
