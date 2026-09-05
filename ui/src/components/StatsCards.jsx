import { useState, useEffect } from 'react';
import {
  Share2,
  Link as LinkIcon,
  Package,
  Factory,
  Anchor,
  Box,
  Globe,
  Warehouse,
} from 'lucide-react';
import { graphStats, nodeTypeColors } from '../data/graphData.js';
import { fetchStats } from '../services/api.js';

export default function StatsCards({ stats: propStats }) {
  const [stats, setStats] = useState(propStats || graphStats);

  useEffect(() => {
    if (propStats) {
      setStats(propStats);
      return;
    }
    fetchStats()
      .then((data) => {
        if (data && data.totalNodes !== undefined) setStats(data);
      })
      .catch(() => {});
  }, [propStats]);

  const cards = [
    {
      label: 'Total Nodes',
      value: stats?.totalNodes !== undefined ? stats.totalNodes : graphStats.totalNodes,
      icon: Share2,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.12)',
    },
    {
      label: 'Relationships',
      value: stats?.totalRelationships !== undefined ? stats.totalRelationships : graphStats.totalRelationships,
      icon: LinkIcon,
      color: '#818cf8',
      bg: 'rgba(99,102,241,0.08)',
    },
    {
      label: 'Suppliers',
      value: stats?.suppliers !== undefined ? stats.suppliers : graphStats.suppliers,
      icon: Package,
      color: nodeTypeColors.supplier,
      bg: 'rgba(245,158,11,0.12)',
    },
    {
      label: 'Manufacturers',
      value: stats?.manufacturers !== undefined ? stats.manufacturers : graphStats.manufacturers,
      icon: Factory,
      color: nodeTypeColors.manufacturer,
      bg: 'rgba(16,185,129,0.12)',
    },
    {
      label: 'Ports',
      value: stats?.ports !== undefined ? stats.ports : graphStats.ports,
      icon: Anchor,
      color: nodeTypeColors.port,
      bg: 'rgba(168,85,247,0.12)',
    },
    {
      label: 'Products',
      value: stats?.products !== undefined ? stats.products : graphStats.products,
      icon: Box,
      color: nodeTypeColors.product,
      bg: 'rgba(59,130,246,0.12)',
    },
    {
      label: 'Countries',
      value: stats?.countries !== undefined ? stats.countries : graphStats.countries,
      icon: Globe,
      color: nodeTypeColors.country,
      bg: 'rgba(56,189,248,0.12)',
    },
    {
      label: 'Warehouses',
      value: stats?.warehouses !== undefined ? stats.warehouses : graphStats.warehouses,
      icon: Warehouse,
      color: nodeTypeColors.warehouse,
      bg: 'rgba(6,182,212,0.12)',
    },
  ];

  return (
    <div className="stats-bar">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div className="stat-card" key={label}>
          <div className="stat-card-icon" style={{ background: bg }}>
            <Icon size={15} color={color} />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{value}</div>
            <div className="stat-card-label">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
