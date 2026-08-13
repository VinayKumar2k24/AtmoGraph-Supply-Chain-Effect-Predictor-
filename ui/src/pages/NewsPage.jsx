import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Newspaper,
  Clock,
  ArrowRight,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Layers,
} from 'lucide-react';
import { fetchNews } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';

function RiskBadge({ level }) {
  const colors = {
    HIGH: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
    MEDIUM: { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    LOW: { text: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
    CRITICAL: { text: '#dc2626', bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.4)' },
  };
  const c = colors[level] || { text: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' };
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '9999px',
        padding: '2px 8px',
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.text }} />
      {level} RISK
    </span>
  );
}

function EntityPill({ entity }) {
  const c = nodeTypeColors[entity.graph_type?.toLowerCase()] || '#64748b';
  return (
    <span
      className="news-entity-pill"
      style={{
        color: c,
        background: `${c}12`,
        border: `1px solid ${c}25`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c,
          boxShadow: `0 0 4px ${c}`,
          flexShrink: 0,
        }}
      />
      <span className="entity-text">{entity.text}</span>
      <span className="entity-type-tag">{entity.graph_type}</span>
    </span>
  );
}

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const loadData = () => {
    setLoading(true);
    fetchNews()
      .then((d) => setArticles(d.articles || []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = articles.filter((a) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      a.title?.toLowerCase().includes(q) ||
      a.source?.toLowerCase().includes(q) ||
      a.id?.toLowerCase().includes(q) ||
      a.entities?.some((e) => e.text?.toLowerCase().includes(q) || e.graph_type?.toLowerCase().includes(q));

    const matchesRisk = riskFilter === 'ALL' || a.risk_level === riskFilter;

    const matchesEntity =
      entityFilter === 'ALL' ||
      a.entities?.some((e) => e.graph_type?.toLowerCase() === entityFilter.toLowerCase());

    return matchesSearch && matchesRisk && matchesEntity;
  });

  return (
    <div className="page-full-scroll">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="title-icon-badge" style={{ background: 'rgba(6,182,212,0.15)', borderColor: 'rgba(6,182,212,0.3)' }}>
              <Newspaper size={16} color="#06b6d4" />
            </div>
            <h1 className="page-main-title">News Intelligence</h1>
          </div>
          <p className="page-sub-title">
            AI-powered supply chain news monitoring, NLP entity extraction and Neo4j graph entity matching
          </p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadData} title="Refresh intelligence feed">
            <RefreshCw size={13} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Pipeline Infographic Banner */}
      <div className="pipeline-banner-card">
        <div className="pipeline-banner-header">
          <Sparkles size={14} color="#22d3ee" />
          <span>Real-Time NLP Intelligence Pipeline</span>
        </div>
        <div className="pipeline-steps-flow">
          {[
            { step: '1. Ingest', label: 'News Feed JSON', icon: '📥' },
            { step: '2. NLP', label: 'spaCy NER (en_core_web_sm)', icon: '🧠' },
            { step: '3. Match', label: 'EntityMatcher Service', icon: '🔍' },
            { step: '4. Graph', label: 'Neo4j Knowledge Graph', icon: '🌐' },
            { step: '5. Assess', label: 'Ripple Impact Scoring', icon: '⚡' },
          ].map((item, i, arr) => (
            <div key={item.step} className="pipeline-step-item">
              <div className="pipeline-step-box">
                <span className="step-icon">{item.icon}</span>
                <div>
                  <div className="step-tag">{item.step}</div>
                  <div className="step-title">{item.label}</div>
                </div>
              </div>
              {i < arr.length - 1 && <ChevronRight size={14} className="pipeline-arrow" />}
            </div>
          ))}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="news-filter-toolbar">
        <div className="search-input-wrap" style={{ maxWidth: 280 }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search news by headline, entity, port…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="toolbar-divider" />

        {/* Risk Filters */}
        <div className="filter-pill-group">
          <span className="filter-label-text">Risk:</span>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
            <button
              key={lvl}
              className={`filter-btn-pill ${riskFilter === lvl ? 'active' : ''}`}
              onClick={() => setRiskFilter(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="toolbar-divider" />

        {/* Entity Filters */}
        <div className="filter-pill-group">
          <span className="filter-label-text">Entity:</span>
          {['ALL', 'Port', 'Country', 'Supplier', 'Manufacturer'].map((type) => (
            <button
              key={type}
              className={`filter-btn-pill ${entityFilter === type ? 'active' : ''}`}
              onClick={() => setEntityFilter(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="news-count-badge">
          {filtered.length} {filtered.length === 1 ? 'Article' : 'Articles'} Found
        </div>
      </div>

      {/* Articles List */}
      <div className="news-cards-container">
        {loading ? (
          <div className="page-loading-wrap">
            <div className="spinner" />
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 12 }}>
              Scanning intelligence feeds…
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-card">
            <Newspaper size={36} color="#334155" />
            <div className="empty-title">No matching supply chain intelligence events</div>
            <div className="empty-desc">
              Try adjusting your search query or risk filters to view all monitored events.
            </div>
            <button
              className="btn btn-outline"
              style={{ marginTop: 12 }}
              onClick={() => {
                setSearch('');
                setRiskFilter('ALL');
                setEntityFilter('ALL');
              }}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          filtered.map((article) => (
            <Link
              key={article.id}
              to={`/news/${article.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="news-card-elevated">
                {/* Top Row */}
                <div className="news-card-top-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="news-id-badge">{article.id}</span>
                    <RiskBadge level={article.risk_level} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="news-meta-date">
                      <Clock size={12} />
                      {new Date(article.published_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="news-source-tag">{article.source}</span>
                  </div>
                </div>

                {/* Title */}
                <h2 className="news-card-headline">{article.title}</h2>

                {/* Excerpt */}
                {article.text && (
                  <p className="news-card-body-text">{article.text}</p>
                )}

                {/* Entity Pipeline Result Box */}
                <div className="news-entity-matches-box">
                  <div className="entity-box-title">
                    <span>NLP Extracted Entities & Graph Mappings</span>
                    <span className="match-count-pill">
                      <CheckCircle2 size={11} color="#22c55e" />
                      {article.matched_count}/{article.total_entities} Matched in Neo4j
                    </span>
                  </div>
                  <div className="entity-pills-wrap">
                    {(article.entities || []).map((e, idx) => (
                      <EntityPill key={idx} entity={e} />
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="news-card-footer">
                  <span className="news-view-cta">
                    Inspect NLP Pipeline & Impact Analysis <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
