import { Search, X } from 'lucide-react';
import { nodeTypeColors } from '../data/graphData.js';

const FILTER_OPTIONS = [
  { id: 'all',          label: 'All',           color: '#64748b' },
  { id: 'country',      label: 'Countries',     color: nodeTypeColors.country },
  { id: 'supplier',     label: 'Suppliers',     color: nodeTypeColors.supplier },
  { id: 'manufacturer', label: 'Manufacturers', color: nodeTypeColors.manufacturer },
  { id: 'product',      label: 'Products',      color: nodeTypeColors.product },
  { id: 'port',         label: 'Ports',         color: nodeTypeColors.port },
  { id: 'warehouse',    label: 'Warehouses',    color: nodeTypeColors.warehouse },
];

export default function SearchFilter({ search, onSearchChange, activeFilter, onFilterChange }) {
  return (
    <>
      {/* Search box */}
      <div className="search-input-wrap">
        <Search size={14} className="search-icon" />
        <input
          id="graph-search"
          type="text"
          className="search-input"
          placeholder="Search nodes…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
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
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Filter chips */}
      <div className="filter-chips">
        {FILTER_OPTIONS.map(({ id, label, color }) => (
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
    </>
  );
}
