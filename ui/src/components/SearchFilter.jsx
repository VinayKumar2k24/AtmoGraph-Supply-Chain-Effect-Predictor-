import { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Globe,
  Truck,
  Factory,
  Cpu,
  Anchor,
  Warehouse,
  GitBranch,
  Filter,
} from 'lucide-react';
import { nodeTypeColors } from '../data/graphData.js';
import { EDGE_STYLE_CONFIG } from '../utils/graphValidation.js';

const NODE_ICONS = {
  country:      Globe,
  supplier:     Truck,
  manufacturer: Factory,
  product:      Cpu,
  port:         Anchor,
  warehouse:    Warehouse,
};

const NODE_FILTER_OPTIONS = [
  { id: 'all',          label: 'All Nodes',     color: '#64748b' },
  { id: 'country',      label: 'Countries',     color: nodeTypeColors.country },
  { id: 'supplier',     label: 'Suppliers',     color: nodeTypeColors.supplier },
  { id: 'manufacturer', label: 'Manufacturers', color: nodeTypeColors.manufacturer },
  { id: 'product',      label: 'Products',      color: nodeTypeColors.product },
  { id: 'port',         label: 'Ports',         color: nodeTypeColors.port },
  { id: 'warehouse',    label: 'Warehouses',    color: nodeTypeColors.warehouse },
];

const REL_FILTER_OPTIONS = [
  'ALL',
  'LOCATED_IN',
  'PRODUCES',
  'PROVIDES',
  'SERVES',
  'SHIPS_TO',
  'STORED_AT',
  'SUPPLIES',
];

export default function SearchFilter({
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
  activeRelFilter = 'ALL',
  onRelFilterChange,
  nodes = [],
  onSelectNode,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Filter autocomplete suggestions based on query
  const query = (search || '').trim().toLowerCase();
  const searchMatches = query
    ? nodes.filter((n) => {
        const d = n.data || {};
        const name = (d.name || '').toLowerCase();
        const id = (n.id || '').toLowerCase();
        const type = (d.nodeType || '').toLowerCase();
        return name.includes(query) || id.includes(query) || type.includes(query);
      }).slice(0, 7)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (node) => {
    onSearchChange(node.data?.name || node.id);
    onSelectNode?.(node);
    setDropdownOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {/* Top Row: Search Box & Node Type Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Search input with autocomplete dropdown */}
        <div className="search-input-wrap" ref={searchContainerRef} style={{ position: 'relative', width: 260 }}>
          <Search size={14} className="search-icon" />
          <input
            id="graph-search"
            type="text"
            className="search-input"
            placeholder="Search nodes by name or type…"
            value={search}
            autoComplete="off"
            onChange={(e) => {
              onSearchChange(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => {
              if (query) setDropdownOpen(true);
            }}
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('');
                setDropdownOpen(false);
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                padding: 0,
              }}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {dropdownOpen && searchMatches.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: '#0b0f19',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.8)',
                zIndex: 9999,
                overflow: 'hidden',
              }}
            >
              {searchMatches.map((n) => {
                const nodeType = (n.data?.nodeType || 'country').toLowerCase();
                const Icon = NODE_ICONS[nodeType] || Globe;
                const color = nodeTypeColors[nodeType] || '#818cf8';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleSelectSuggestion(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: `${color}18`,
                        border: `1px solid ${color}35`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color,
                      }}
                    >
                      <Icon size={12} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }} className="truncate">
                        {n.data?.name || n.id}
                      </div>
                      <div style={{ fontSize: '10px', color, fontFamily: 'monospace' }}>
                        {n.id} · {nodeType.toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Node Category Filters */}
        <div className="filter-chips">
          {NODE_FILTER_OPTIONS.map(({ id, label, color }) => (
            <button
              key={id}
              id={`filter-${id}`}
              className={`filter-chip ${activeFilter === id ? 'active' : ''}`}
              style={
                activeFilter === id
                  ? { background: color, borderColor: color }
                  : {}
              }
              onClick={() => onFilterChange(id)}
            >
              {id !== 'all' && (
                <span
                  className="filter-chip-dot"
                  style={{ background: color, opacity: activeFilter === id ? 1 : 0.7 }}
                />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Row: Relationship Path Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
          <GitBranch size={13} color="#818cf8" />
          <span>Path Filter:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {REL_FILTER_OPTIONS.map((rel) => {
            const isSelected = activeRelFilter === rel;
            const styleCfg = EDGE_STYLE_CONFIG[rel] || { stroke: '#818cf8' };
            const chipColor = rel === 'ALL' ? '#64748b' : styleCfg.stroke;

            return (
              <button
                key={rel}
                onClick={() => onRelFilterChange?.(rel)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: isSelected ? 700 : 500,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  border: `1px solid ${isSelected ? chipColor : 'rgba(255,255,255,0.1)'}`,
                  background: isSelected ? `${chipColor}25` : 'rgba(255,255,255,0.03)',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {rel !== 'ALL' && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: chipColor,
                      boxShadow: isSelected ? `0 0 6px ${chipColor}` : 'none',
                    }}
                  />
                )}
                {rel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
