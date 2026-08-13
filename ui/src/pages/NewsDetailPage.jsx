import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Newspaper,
  Clock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Globe,
  Package,
  Factory,
  Box,
  Anchor,
  Warehouse,
  ShieldAlert,
  ChevronRight,
  Share2,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';
import { fetchNewsById } from '../services/api.js';
import { nodeTypeColors } from '../data/graphData.js';

const TYPE_ICONS = {
  Country: Globe,
  Supplier: Package,
  Manufacturer: Factory,
  Product: Box,
  Port: Anchor,
  Warehouse: Warehouse,
};

function RiskBadge({ level }) {
  const colors = {
    HIGH: { text: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)' },
    MEDIUM: { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' },
    LOW: { text: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)' },
    CRITICAL: { text: '#dc2626', bg: 'rgba(220,38,38,0.2)', border: 'rgba(220,38,38,0.5)' },
  };
  const c = colors[level] || { text: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' };
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '9999px',
        padding: '3px 10px',
        letterSpacing: '0.6px',
      }}
    >
      {level} RISK DISRUPTION
    </span>
  );
}

export default function NewsDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNewsById(id)
      .then((a) => {
        if (!a) throw new Error('Intelligence event not found');
        setArticle(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page-loading-wrap">
        <div className="spinner" />
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: 12 }}>
          Loading intelligence event data…
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="empty-state-card" style={{ margin: '40px auto', maxWidth: 450 }}>
        <XCircle size={40} color="#ef4444" />
        <div className="empty-title">Article Not Found</div>
        <div className="empty-desc">{error || 'Requested news intelligence record is unavailable.'}</div>
        <Link to="/news" className="btn btn-primary" style={{ marginTop: 14 }}>
          <ArrowLeft size={13} /> Back to News Intelligence
        </Link>
      </div>
    );
  }

  // Group matched entities by graph node type
  const byType = {};
  (article.entities || []).forEach((e) => {
    if (!e.matched) return;
    const t = e.graph_type || 'Other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(e);
  });

  const unmatched = (article.entities || []).filter((e) => !e.matched);
  const matchRate = article.total_entities
    ? Math.round((article.matched_count / article.total_entities) * 100)
    : 0;

  return (
    <div className="page-full-scroll">
      {/* Breadcrumb Navigation */}
      <div className="detail-breadcrumb-bar">
        <Link to="/news" className="breadcrumb-link">
          <ArrowLeft size={13} /> Back to News Intelligence
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{article.id}</span>
      </div>

      <div className="news-detail-grid">
        {/* ── LEFT COLUMN: Article Content & NLP Matcher ── */}
        <div className="detail-col-left">
          {/* Article Header Card */}
          <div className="dash-card">
            <div className="detail-head-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="news-id-badge">{article.id}</span>
                <RiskBadge level={article.risk_level} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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

            <h1 className="detail-article-title">{article.title}</h1>

            {/* Original Article Content */}
            {article.text && (
              <div className="detail-article-body-box">
                <div className="detail-body-box-lbl">
                  <Info size={11} /> Raw Ingested Content
                </div>
                <p className="detail-body-text">{article.text}</p>
              </div>
            )}
          </div>

          {/* NLP → Graph Entity Matching Section */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div className="dash-card-header-title">
                <Sparkles size={15} color="#818cf8" />
                <span>NLP Named Entity Recognition (NER) & Neo4j Mapping</span>
              </div>
              <span className="count-badge-cyan">
                {article.matched_count}/{article.total_entities} Matched ({matchRate}%)
              </span>
            </div>

            <div className="nlp-pipeline-strip">
              <span>Raw Text</span>
              <ChevronRight size={12} />
              <span>spaCy en_core_web_sm</span>
              <ChevronRight size={12} />
              <span>Entity Extraction</span>
              <ChevronRight size={12} />
              <span>EntityMatcher (Cypher)</span>
              <ChevronRight size={12} />
              <span style={{ color: '#22c55e', fontWeight: 600 }}>Neo4j Graph Node</span>
            </div>

            {/* Extracted Entity Table */}
            <div className="entity-match-table">
              <div className="entity-table-header">
                <div>Extracted Text (NER)</div>
                <div>NER Tag</div>
                <div>Match Status</div>
                <div>Graph Node Type</div>
                <div>Graph Action</div>
              </div>

              {(article.entities || []).map((e, idx) => {
                const c = nodeTypeColors[e.graph_type?.toLowerCase()] || '#64748b';
                const Icon = TYPE_ICONS[e.graph_type] || Globe;
                return (
                  <div key={idx} className="entity-table-row">
                    <div className="entity-name-cell">
                      <span className="entity-quoted-text">"{e.text}"</span>
                    </div>

                    <div>
                      <span className="ner-tag-pill">{e.label}</span>
                    </div>

                    <div>
                      {e.matched ? (
                        <span className="match-status-badge match-yes">
                          <CheckCircle2 size={11} /> Matched
                        </span>
                      ) : (
                        <span className="match-status-badge match-no">
                          <XCircle size={11} /> Not In Graph
                        </span>
                      )}
                    </div>

                    <div>
                      {e.matched ? (
                        <span
                          className="graph-type-badge"
                          style={{
                            color: c,
                            background: `${c}15`,
                            border: `1px solid ${c}30`,
                          }}
                        >
                          <Icon size={11} />
                          {e.graph_type}
                        </span>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '11px' }}>—</span>
                      )}
                    </div>

                    <div>
                      {e.matched ? (
                        <Link
                          to={`/graph?filter=${e.graph_type.toLowerCase()}`}
                          className="table-action-link"
                        >
                          <Share2 size={11} /> View in Graph
                        </Link>
                      ) : (
                        <span style={{ color: '#334155', fontSize: '11px' }}>None</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Metrics & Affected Supply Chain Entities ── */}
        <div className="detail-col-right">
          {/* Match Rate Summary */}
          <div className="dash-card">
            <div className="section-mini-title">Entity Match Summary</div>
            <div className="detail-kpi-grid">
              <div className="detail-kpi-box">
                <div className="detail-kpi-val" style={{ color: '#818cf8' }}>
                  {article.total_entities}
                </div>
                <div className="detail-kpi-lbl">Total Entities</div>
              </div>
              <div className="detail-kpi-box">
                <div className="detail-kpi-val" style={{ color: '#22c55e' }}>
                  {article.matched_count}
                </div>
                <div className="detail-kpi-lbl">Graph Matched</div>
              </div>
              <div className="detail-kpi-box">
                <div className="detail-kpi-val" style={{ color: '#ef4444' }}>
                  {article.unmatched_count}
                </div>
                <div className="detail-kpi-lbl">Unmatched</div>
              </div>
              <div className="detail-kpi-box">
                <div className="detail-kpi-val" style={{ color: '#06b6d4' }}>
                  {matchRate}%
                </div>
                <div className="detail-kpi-lbl">Match Rate</div>
              </div>
            </div>
          </div>

          {/* Affected Supply Chain Entities */}
          <div className="dash-card">
            <div className="section-mini-title">Affected Supply Chain Entities</div>

            <div className="affected-entities-group">
              {Object.entries(byType).map(([type, entities]) => {
                const c = nodeTypeColors[type.toLowerCase()] || '#64748b';
                const Icon = TYPE_ICONS[type] || Globe;
                return (
                  <div key={type} className="affected-category-block">
                    <div className="affected-category-head">
                      <Icon size={12} color={c} />
                      <span style={{ color: c }}>{type}s</span>
                      <span className="affected-count-tag">({entities.length})</span>
                    </div>

                    <div className="affected-chips-list">
                      {entities.map((e, idx) => (
                        <div
                          key={idx}
                          className="affected-entity-chip"
                          style={{
                            borderColor: `${c}30`,
                            background: `${c}0e`,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
                          <span style={{ color: '#e2e8f0' }}>{e.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Risk Assessment & Disruption Impact */}
          <div className="dash-card">
            <div className="section-mini-title">
              <ShieldAlert size={12} style={{ display: 'inline', marginRight: 4 }} />
              AI Disruption Impact Assessment
            </div>

            <div className="risk-assessment-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <RiskBadge level={article.risk_level} />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Critical Bottleneck</span>
              </div>

              <p className="risk-explanation-p">
                {article.risk_level === 'HIGH'
                  ? 'Major European maritime container congestion at the Port of Rotterdam directly affects downstream suppliers (Global Electronics, European Precision Parts) and transatlantic manufacturing nodes in Germany & USA.'
                  : article.risk_level === 'MEDIUM'
                  ? 'Moderate supplier and shipping variance detected. Recommended to verify buffer inventory at regional distribution centers.'
                  : 'Low supply chain impact. Monitored routes operating within normal parameters.'}
              </p>

              <div className="recommended-action-box">
                <div className="action-box-lbl">Recommended Action</div>
                <div className="action-box-text">
                  Reroute incoming container shipments via Port of Hamburg (PORT004) or activate secondary buffer stock at Chicago Distribution Center (WH001).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
