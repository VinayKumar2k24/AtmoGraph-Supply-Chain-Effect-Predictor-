import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StatsCards from '../components/StatsCards.jsx';
import SupplyChainGraph from '../components/SupplyChainGraph.jsx';
import SearchFilter from '../components/SearchFilter.jsx';
import NodeDetails from '../components/NodeDetails.jsx';
import { Maximize2, RefreshCw, Share2, Layers, Filter } from 'lucide-react';
import { fetchStats } from '../services/api.js';

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [graphKey, setGraphKey] = useState(0);
  const [stats, setStats] = useState(null);

  // Sync with searchParams if changed
  useEffect(() => {
    const f = searchParams.get('filter');
    if (f && f !== activeFilter) {
      setActiveFilter(f);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
  }, []);

  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    if (filterId === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: filterId });
    }
  };

  const handleReset = () => {
    setSearch('');
    setActiveFilter('all');
    setSelectedNode(null);
    setSearchParams({});
    setGraphKey((k) => k + 1);
  };

  const handleFitView = () => {
    const fitBtn = document.querySelector('.react-flow__controls-fitview');
    if (fitBtn) fitBtn.click();
  };

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
              Interactive 5-layer topology mapping suppliers, manufacturers, shipping lanes & distribution hubs
            </p>
          </div>
        </div>

        <div className="graph-topbar-actions">
          <button className="btn btn-outline" onClick={handleReset} title="Reset graph view">
            <RefreshCw size={13} />
            Reset View
          </button>
          <button className="btn btn-primary" onClick={handleFitView} title="Fit all nodes to view">
            <Maximize2 size={13} />
            Fit View
          </button>
        </div>
      </div>

      {/* Stats KPI Ribbon */}
      <StatsCards stats={stats} />

      {/* Search & Filter Toolbar */}
      <div className="main-toolbar">
        <SearchFilter
          search={search}
          onSearchChange={setSearch}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Main Graph Canvas Area with side panel */}
      <div className={`graph-viewport-split ${selectedNode ? 'has-details' : ''}`}>
        <div className="graph-canvas-area">
          <SupplyChainGraph
            key={graphKey}
            onNodeSelect={setSelectedNode}
            searchQuery={search}
            activeFilter={activeFilter}
          />
        </div>

        {selectedNode && (
          <div className="graph-details-aside">
            <NodeDetails
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
