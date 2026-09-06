import React from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Anchor,
  Clock,
  Share2,
  GitBranch,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Database,
  Cpu,
  Layers,
  Timer,
  BookOpen,
} from 'lucide-react';
import { useLiveWebSocket } from '../context/LiveWebSocketContext.jsx';
import { getExtractedCount, getMatchedCount } from '../services/liveWebSocket.js';

export default function LiveNewsStatus({ onDataRefresh }) {
  const { connectionStatus, workerStatus, latestProcessedEvent } = useLiveWebSocket();

  // Subtle connection badge (Requirement 6)
  const renderConnectionBadge = () => {
    let dotColor = '#22c55e';
    let text = 'CONNECTED';
    let Icon = Wifi;

    if (connectionStatus === 'CONNECTING') {
      dotColor = '#f59e0b';
      text = 'CONNECTING';
      Icon = RefreshCw;
    } else if (connectionStatus === 'DISCONNECTED') {
      dotColor = '#ef4444';
      text = 'DISCONNECTED';
      Icon = WifiOff;
    }

    return (
      <div
        className="live-ws-badge"
        title={`WebSocket status: ${connectionStatus}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 700,
          color: dotColor,
          background: `${dotColor}14`,
          border: `1px solid ${dotColor}33`,
          borderRadius: '9999px',
          padding: '2px 10px',
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: dotColor,
            boxShadow: connectionStatus === 'CONNECTED' ? `0 0 8px ${dotColor}` : 'none',
          }}
        />
        <Icon size={11} className={connectionStatus === 'CONNECTING' ? 'spin' : ''} />
        <span>{text}</span>
      </div>
    );
  };

  const isProcessing = workerStatus?.status === 'processing';
  const hasProcessedEvent = Boolean(latestProcessedEvent);
  const isCompleted = workerStatus?.status === 'completed' || hasProcessedEvent;
  const isError = workerStatus?.status === 'error';

  // ── 1. ACTIVE PROCESSING STATE (Requirement 3) ─────────────────────────────
  if (isProcessing) {
    const processingTitle = workerStatus?.title || 'Incoming supply-chain news article';
    return (
      <div className="live-news-card is-processing">
        <div className="live-news-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="live-pulse-dot-cyan" />
            <Radio size={14} color="#06b6d4" />
            <span className="live-idle-title">Live Stream Monitoring</span>
            <span className="live-pill active" style={{ marginLeft: 6 }}>
              <Loader2 size={11} className="spin" />
              ● Processing
            </span>
          </div>
          <div>{renderConnectionBadge()}</div>
        </div>

        <div className="live-news-title-row" style={{ marginTop: 6, marginBottom: 12 }}>
          <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 600, marginBottom: 4 }}>
            Processing live news...
          </div>
          <h2 className="live-news-title">{processingTitle}</h2>
          {workerStatus?.article_id && (
            <span className="live-news-article-id">{workerStatus.article_id}</span>
          )}
        </div>

        <div className="live-news-processing-state">
          <div className="live-processing-bar-wrap">
            <div className="live-processing-progress-indeterminate" />
          </div>
          <div className="live-processing-meta">
            <span className="live-processing-hint">
              Extracting NLP entities, updating Neo4j knowledge graph, computing GNN delay predictions & ripple effect...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. LIVE EVENT PROCESSED / COMPLETED STATE (Requirement 3 & 9) ───────────
  if (hasProcessedEvent) {
    const ev = latestProcessedEvent;
    const shockOrigin = ev.shock_origin || 'Inferred / Network Fallback';
    const avgDelay =
      ev.avg_predicted_delay !== undefined && ev.avg_predicted_delay !== null
        ? `${Number(ev.avg_predicted_delay).toFixed(2)} days`
        : '0.00 days';
    const affectedNodes = ev.affected_nodes ?? 0;
    const rippleDepth = `${ev.max_depth ?? 0} hop${ev.max_depth === 1 ? '' : 's'}`;
    const processingTime = ev.duration_ms ? `${ev.duration_ms} ms` : 'Completed';
    const extractedCount = getExtractedCount(ev);
    const matchedCount = getMatchedCount(ev);

    return (
      <div className="live-news-card is-processed">
        {/* Header Row */}
        <div className="live-news-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="live-news-beacon-wrap">
              <span className="live-beacon-ring" />
              <span className="live-beacon-dot" />
              <span className="live-news-badge-text">LIVE EVENT DETECTED</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                color: '#22c55e',
                fontWeight: 600,
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.25)',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              Last event processed successfully
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {renderConnectionBadge()}
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="live-news-title-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Live Stream Monitoring
              </span>
              <span style={{ color: '#475569' }}>·</span>
              <span style={{ fontSize: '11px', color: '#06b6d4' }}>
                Source: {ev.source || 'Live Ingestion'}
              </span>
            </div>
            <h2 className="live-news-title">{ev.title || 'Live Supply Chain Disruption'}</h2>
          </div>
          {ev.article_id && (
            <span className="live-news-article-id">{ev.article_id}</span>
          )}
        </div>

        {/* Dynamic Metric Grid (Requirement 3) */}
        <div className="live-news-kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="live-kpi-box">
            <div className="live-kpi-label">
              <Anchor size={12} color="#a855f7" />
              <span>Shock Origin</span>
            </div>
            <div className="live-kpi-value text-purple" title={shockOrigin}>
              {shockOrigin}
            </div>
          </div>

          <div className="live-kpi-box">
            <div className="live-kpi-label">
              <Clock size={12} color="#f59e0b" />
              <span>GNN Avg Delay</span>
            </div>
            <div className="live-kpi-value text-amber">{avgDelay}</div>
          </div>

          <div className="live-kpi-box">
            <div className="live-kpi-label">
              <Share2 size={12} color="#ef4444" />
              <span>Affected Nodes</span>
            </div>
            <div className="live-kpi-value text-red">{affectedNodes} nodes</div>
          </div>

          <div className="live-kpi-box">
            <div className="live-kpi-label">
              <GitBranch size={12} color="#06b6d4" />
              <span>Ripple Depth</span>
            </div>
            <div className="live-kpi-value text-cyan">{rippleDepth}</div>
          </div>

          <div className="live-kpi-box">
            <div className="live-kpi-label">
              <Timer size={12} color="#10b981" />
              <span>Processing Time</span>
            </div>
            <div className="live-kpi-value" style={{ color: '#10b981' }}>{processingTime}</div>
          </div>
        </div>

        {/* Pipeline Stage Status Pills (Requirement 3) */}
        <div className="live-news-pills-row">
          <span className="live-pill completed">
            <CheckCircle2 size={12} color="#22c55e" />
            ● Extracted ({extractedCount})
          </span>
          <span className="live-pill completed">
            <CheckCircle2 size={12} color="#22c55e" />
            ● Matched ({matchedCount})
          </span>
          <span className="live-pill completed">
            <Database size={12} color="#22c55e" />
            ● Neo4j Updated
          </span>
          <span className="live-pill completed">
            <Cpu size={12} color="#22c55e" />
            ● GNN Updated
          </span>
          <span className="live-pill completed">
            <Layers size={12} color="#22c55e" />
            ● Ripple Updated
          </span>
        </div>
      </div>
    );
  }

  // ── 3. ERROR STATE (Requirement 2) ─────────────────────────────────────────
  if (isError) {
    return (
      <div className="live-news-idle-bar" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
        <div className="live-news-idle-left">
          <AlertTriangle size={15} color="#ef4444" />
          <span className="live-idle-title" style={{ color: '#ef4444' }}>
            Live Stream Monitoring
          </span>
          <span className="live-idle-desc" style={{ color: '#fca5a5' }}>
            Pipeline error: {workerStatus?.error || 'Failed to process incoming event'}
          </span>
        </div>
        <div className="live-news-idle-right">{renderConnectionBadge()}</div>
      </div>
    );
  }

  // ── 4. IDLE / CONNECTED WAITING STATE (Requirement 3) ──────────────────────
  const idleSubtitle =
    connectionStatus === 'CONNECTED'
      ? 'Connected — waiting for the next supply-chain event'
      : connectionStatus === 'CONNECTING'
      ? 'Connecting to WebSocket stream...'
      : 'Disconnected — waiting to reconnect';

  return (
    <div className="live-news-idle-bar">
      <div className="live-news-idle-left">
        <span className="live-pulse-dot-cyan" />
        <Radio size={14} color="#06b6d4" />
        <span className="live-idle-title">Live Stream Monitoring</span>
        <span className="live-idle-desc">{idleSubtitle}</span>
      </div>
      <div className="live-news-idle-right">{renderConnectionBadge()}</div>
    </div>
  );
}
