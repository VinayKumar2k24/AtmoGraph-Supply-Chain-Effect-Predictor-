import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import SupplyChainGraph from '../components/SupplyChainGraph.jsx';
import SearchFilter from '../components/SearchFilter.jsx';
import NodeDetails from '../components/NodeDetails.jsx';
import {
  Maximize2,
  RefreshCw,
  Share2,
  GitBranch,
  Box,
  Layers,
  XCircle,
  Package,
  Factory,
  Anchor,
  Warehouse,
  Globe,
  Cpu,
  Truck,
} from 'lucide-react';
import { nodeTypeColors } from '../data/graphData.js';

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Detect incoming focus target from router state or query param
  const focusTarget =
    location.state?.focusNode ||
    location.state?.nodeName ||
    searchParams.get('focus') ||
    searchParams.get('node') ||
    null;

  const initialFilter = focusTarget ? 'all' : (searchParams.get('filter') || 'all');

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [activeRelFilter, setActiveRelFilter] = useState('ALL');
  const [graphKey, setGraphKey] = useState(0);

  const [graphStats, setGraphStats] = useState(null);
  const [allNodes, setAllNodes] = useState([]);
  const [focusNodeId, setFocusNodeId] = useState(focusTarget);

  // Ref to invoke layout methods (resetLayout / fitView / focusNode)
  const layoutRef = useRef(null);

  // Synchronize focus target or URL query param with activeFilter
  useEffect(() => {
    const target =
      location.state?.focusNode ||
      location.state?.nodeName ||
      searchParams.get('focus') ||
      searchParams.get('node');

    if (target) {
      // Arriving via "View in Graph" -> Ensure full graph is visible without stale filters
      setActiveFilter('all');
      setActiveRelFilter('ALL');
      setSearch('');
      setFocusNodeId(target);
    } else {
      const f = searchParams.get('filter');
      if (f && f !== activeFilter) {
        setActiveFilter(f);
      }
    }
  }, [location.state, searchParams]);

  const handleFilterChange = useCallback((filterId) => {
    setActiveFilter(filterId);
    if (filterId === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: filterId });
    }
  }, [setSearchParams]);

  const handleResetLayout = useCallback(() => {
    if (layoutRef.current?.resetLayout) {
      layoutRef.current.resetLayout();
    } else {
      setGraphKey((k) => k + 1);
    }
  }, []);

  const handleFitView = useCallback(() => {
    if (layoutRef.current?.fitView) {
      layoutRef.current.fitView();
    } else {
      const fitBtn = document.querySelector('.react-flow__controls-fitview');
      if (fitBtn) fitBtn.click();
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setSearch('');
    setFocusNodeId(null);
    layoutRef.current?.fitView?.();
  }, []);

  const handleGraphLoaded = useCallback(({ nodes, stats }) => {
    setAllNodes(nodes || []);
    setGraphStats(stats || null);
  }, []);

  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
    if (node) setSelectedEdge(null);
  }, []);

  const handleEdgeSelect = useCallback((edge) => {
    setSelectedEdge(edge);
    if (edge) setSelectedNode(null);
  }, []);

  const handleSelectNodeFromSearch = useCallback((node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setFocusNodeId(node ? node.id : null);
  }, []);

  // Node category breakdown counts from live stats or fallback counts
  const nodeCounts = graphStats?.byNodeType || {};

  return (
    <div className="graph-page-container">
      {/* Top Header Bar */}
      <div className="graph-page-topbar">
        <div className="graph-title-group">
          <div className="graph-title-icon">
            <Share2 size={16} color="#818cf8" />
          </div>
          <div>
            <h1 className="graph-page-title">Supply Chain Knowledge Graph</h1>
            <p className="graph-page-desc">
              Interactive live topology mapping suppliers, manufacturers, products, shipping ports, warehouses & global regions
            </p>
          </div>
        </div>

        <div className="graph-topbar-actions">
          {(selectedNode || selectedEdge) && (
            <button
              className="btn btn-outline"
              onClick={handleClearSelection}
              title="Deselect active item and restore full view"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}
            >
              <XCircle size={13} color="#ef4444" />
              Clear Selection
            </button>
          )}

          <button className="btn btn-outline" onClick={handleResetLayout} title="Auto-arrange nodes to logical hierarchical layout">
            <RefreshCw size={13} />
            Reset Layout
          </button>

          <button className="btn btn-primary" onClick={handleFitView} title="Fit all nodes to screen">
            <Maximize2 size={13} />
            Fit View
          </button>
        </div>
      </div>

      {/* Dynamic Graph Summary Ribbon (Section 8) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 16px',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '10px',
          marginBottom: '12px',
        }}
      >
        {/* Core 4 metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
              {graphStats?.totalNodes ?? 18}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Nodes
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#818cf8', fontFamily: 'monospace' }}>
              {graphStats?.totalRelationships ?? 24}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Relationships
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {graphStats?.nodeTypesCount ?? 6}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Node Types
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
              {graphStats?.relTypesCount ?? 7}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Path Types
            </span>
          </div>
        </div>

        {/* Breakdown chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: `${nodeTypeColors.supplier}15`,
              color: nodeTypeColors.supplier,
              border: `1px solid ${nodeTypeColors.supplier}35`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Truck size={11} /> {nodeCounts.supplier ?? 3} Suppliers
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: `${nodeTypeColors.manufacturer}15`,
              color: nodeTypeColors.manufacturer,
              border: `1px solid ${nodeTypeColors.manufacturer}35`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Factory size={11} /> {nodeCounts.manufacturer ?? 3} Manufacturers
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: `${nodeTypeColors.product}15`,
              color: nodeTypeColors.product,
              border: `1px solid ${nodeTypeColors.product}35`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Cpu size={11} /> {nodeCounts.product ?? 3} Products
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: `${nodeTypeColors.port}15`,
              color: nodeTypeColors.port,
              border: `1px solid ${nodeTypeColors.port}35`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Anchor size={11} /> {nodeCounts.port ?? 3} Ports
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: `${nodeTypeColors.warehouse}15`,
              color: nodeTypeColors.warehouse,
              border: `1px solid ${nodeTypeColors.warehouse}35`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Warehouse size={11} /> {nodeCounts.warehouse ?? 3} Warehouses
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: `${nodeTypeColors.country}15`,
              color: nodeTypeColors.country,
              border: `1px solid ${nodeTypeColors.country}35`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Globe size={11} /> {nodeCounts.country ?? 3} Countries
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="main-toolbar" style={{ marginBottom: '12px' }}>
        <SearchFilter
          search={search}
          onSearchChange={setSearch}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          activeRelFilter={activeRelFilter}
          onRelFilterChange={setActiveRelFilter}
          nodes={allNodes}
          onSelectNode={handleSelectNodeFromSearch}
        />
      </div>

      {/* Main Graph Canvas Area with side panel */}
      <div className={`graph-viewport-split ${selectedNode || selectedEdge ? 'has-details' : ''}`}>
        <div className="graph-canvas-area">
          <SupplyChainGraph
            key={graphKey}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
            searchQuery={search}
            activeFilter={activeFilter}
            activeRelFilter={activeRelFilter}
            layoutRef={layoutRef}
            onGraphLoaded={handleGraphLoaded}
            focusNodeId={focusNodeId}
          />
        </div>

        {(selectedNode || selectedEdge) && (
          <div className="graph-details-aside">
            <NodeDetails
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              allNodes={allNodes}
              onClose={handleClearSelection}
              onFocusNode={(nodeId) => {
                layoutRef.current?.focusNode?.(nodeId);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
