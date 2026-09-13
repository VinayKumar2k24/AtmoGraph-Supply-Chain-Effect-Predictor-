import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Radio,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
} from 'lucide-react';
import { useLiveWebSocket } from '../context/LiveWebSocketContext.jsx';
import { getExtractedCount, getMatchedCount } from '../services/liveWebSocket.js';

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Math.max(0, (Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function MetricItem({ label, value, color = '#38bdf8' }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      borderRadius: 8,
      padding: '7px 9px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 9.5,
        fontWeight: 700,
        color: '#64748b',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 800,
        color: color,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

export default function RealtimeEventIndicator() {
  const {
    connectionStatus,
    workerStatus,
    latestProcessedEvent,
    latestEvent,
    lastError,
  } = useLiveWebSocket();

  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [tick, setTick] = useState(Date.now());

  // Periodically refresh relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // When a new event arrives or worker starts processing, surface the indicator if dismissed
  useEffect(() => {
    if (latestEvent) {
      setIsDismissed(false);
    }
  }, [latestEvent]);

  useEffect(() => {
    if (workerStatus?.status === 'processing') {
      setIsDismissed(false);
      setIsMinimized(false);
    }
  }, [workerStatus?.status]);

  // Derive status presentation
  const statusConfig = useMemo(() => {
    const st = workerStatus?.status;
    if (st === 'processing') {
      return {
        label: 'Live analysis in progress',
        color: '#38bdf8',
        dotColor: '#06b6d4',
        pulse: true,
        icon: Loader2,
      };
    }
    if (st === 'completed') {
      return {
        label: 'Live analysis completed',
        color: '#22c55e',
        dotColor: '#22c55e',
        pulse: false,
        icon: CheckCircle2,
      };
    }
    if (st === 'error') {
      return {
        label: 'Live analysis error',
        color: '#ef4444',
        dotColor: '#ef4444',
        pulse: false,
        icon: AlertCircle,
      };
    }
    if (connectionStatus === 'connected') {
      return {
        label: 'Live stream connected',
        color: '#22c55e',
        dotColor: '#22c55e',
        pulse: false,
        icon: Activity,
      };
    }
    if (connectionStatus === 'connecting') {
      return {
        label: 'Connecting live stream…',
        color: '#f59e0b',
        dotColor: '#f59e0b',
        pulse: true,
        icon: Loader2,
      };
    }
    return {
      label: 'Live stream disconnected',
      color: '#94a3b8',
      dotColor: '#64748b',
      pulse: false,
      icon: Radio,
    };
  }, [workerStatus?.status, connectionStatus]);

  const ev = latestProcessedEvent;
  const hasEvent = Boolean(ev);
  const isProcessing = workerStatus?.status === 'processing';

  // Extract strict fields without inventing any mock/fake data
  const articleTitle = ev?.title || ev?.article?.title || (isProcessing && workerStatus?.title ? workerStatus.title : null);
  const source = ev?.source || ev?.article?.source || null;
  const shockOrigin = ev?.shock_origin || null;
  const extractedEntities = ev ? getExtractedCount(ev) : null;
  const matchedEntities = ev ? getMatchedCount(ev) : null;
  const gnnAvgDelay = ev && ev.avg_predicted_delay !== undefined && ev.avg_predicted_delay !== null
    ? `${Number(ev.avg_predicted_delay).toFixed(2)} days`
    : null;
  const affectedNodes = ev && ev.affected_nodes !== undefined && ev.affected_nodes !== null
    ? `${ev.affected_nodes} node${ev.affected_nodes === 1 ? '' : 's'}`
    : null;
  const maxDepth = ev && ev.max_depth !== undefined && ev.max_depth !== null
    ? `${ev.max_depth} hop${ev.max_depth === 1 ? '' : 's'}`
    : null;

  const eventTime = ev?.timestamp || ev?.published_at || workerStatus?.timestamp;

  // If dismissed, render a subtle docked pill button to allow restoring
  if (isDismissed) {
    return (
      <>
        <style>{`
          .atmograph-live-docked {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999;
            background: rgba(10, 16, 31, 0.90);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(6, 182, 212, 0.3);
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
            border-radius: 9999px;
            padding: 6px 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            color: #cbd5e1;
            font-size: 12px;
            font-weight: 700;
            transition: all 0.2s ease;
          }
          .atmograph-live-docked:hover {
            border-color: rgba(6, 182, 212, 0.6);
            transform: translateY(-1px);
            box-shadow: 0 6px 22px rgba(6, 182, 212, 0.25);
          }
          @keyframes rteiDotPulse {
            0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.6); }
            50% { transform: scale(1.15); opacity: 0.8; box-shadow: 0 0 0 5px rgba(6, 182, 212, 0); }
          }
        `}</style>
        <button
          onClick={() => setIsDismissed(false)}
          className="atmograph-live-docked"
          title="Click to view realtime disruption events"
        >
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusConfig.dotColor,
            animation: statusConfig.pulse ? 'rteiDotPulse 1.8s infinite ease-in-out' : 'none',
          }} />
          <Radio size={13} color={statusConfig.color} />
          <span style={{ color: statusConfig.color }}>{statusConfig.label}</span>
        </button>
      </>
    );
  }

  const StatusIcon = statusConfig.icon;

  return (
    <>
      <style>{`
        @keyframes rteiCardPulse {
          0%, 100% {
            border-color: rgba(6, 182, 212, 0.35);
            box-shadow: 0 10px 32px -6px rgba(0, 0, 0, 0.65), 0 0 16px rgba(6, 182, 212, 0.12);
          }
          50% {
            border-color: rgba(6, 182, 212, 0.75);
            box-shadow: 0 10px 32px -6px rgba(0, 0, 0, 0.65), 0 0 24px rgba(6, 182, 212, 0.3);
          }
        }
        @keyframes rteiDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7); }
          50% { transform: scale(1.15); opacity: 0.85; box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
        }
        @keyframes rteiSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rtei-card {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999;
          width: 390px;
          max-width: calc(100vw - 32px);
          background: rgba(10, 16, 31, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(6, 182, 212, 0.28);
          border-radius: 14px;
          box-shadow: 0 12px 36px -6px rgba(0, 0, 0, 0.7), 0 0 20px rgba(6, 182, 212, 0.12);
          overflow: hidden;
          font-family: inherit;
          transition: border-color 0.2s ease;
        }
        .rtei-card.is-processing {
          animation: rteiCardPulse 2.2s infinite ease-in-out;
        }
        .rtei-icon-spin {
          animation: rteiSpin 1.4s linear infinite;
        }
        @media (max-width: 480px) {
          .rtei-card {
            bottom: 14px;
            right: 14px;
            width: calc(100vw - 28px);
          }
        }
      `}</style>

      <div className={`rtei-card ${isProcessing ? 'is-processing' : ''}`}>
        {/* ── Top Bar Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.07)',
          gap: 8,
        }}>
          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusConfig.dotColor,
              animation: statusConfig.pulse ? 'rteiDotPulse 1.8s infinite ease-in-out' : 'none',
              flexShrink: 0,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <StatusIcon
                size={13}
                color={statusConfig.color}
                className={isProcessing ? 'rtei-icon-spin' : ''}
              />
              <span style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: statusConfig.color,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Action buttons: Minimize and Dismiss */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => setIsMinimized((prev) => !prev)}
              aria-label={isMinimized ? 'Expand realtime indicator' : 'Minimize realtime indicator'}
              title={isMinimized ? 'Expand' : 'Minimize'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '4px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss realtime indicator"
              title="Dismiss"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '4px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Collapsible Card Body ── */}
        {!isMinimized && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Error Message Display if worker error occurred */}
            {workerStatus?.status === 'error' && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{workerStatus.error || lastError || 'Live analysis encountered an error'}</span>
              </div>
            )}

            {/* Processing State Description (when actively ingesting) */}
            {isProcessing && !hasEvent && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                  {articleTitle || 'Ingesting live RSS news feed…'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Extracting supply chain entities, computing GNN delay, and propagating ripple shock cascade…
                </div>
              </div>
            )}

            {/* When live_news_processed arrives: Display the 8 exact required fields */}
            {hasEvent && (
              <>
                {/* 1. Article Title */}
                <div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#f8fafc',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }} title={articleTitle || 'Disruption Event'}>
                    {articleTitle || 'Disruption Event'}
                  </div>

                  {/* 2. Source & 3. Shock Origin */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '2px 7px',
                      borderRadius: 5,
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      Source: <strong style={{ color: '#cbd5e1' }}>{source || '—'}</strong>
                    </span>

                    <span style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      background: 'rgba(168, 85, 247, 0.1)',
                      padding: '2px 7px',
                      borderRadius: 5,
                      border: '1px solid rgba(168, 85, 247, 0.28)',
                    }}>
                      Shock Origin:{' '}
                      <strong style={{ color: shockOrigin ? '#c084fc' : '#64748b' }}>
                        {shockOrigin || '—'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Metrics Grid: 4. Extracted Entities, 5. Matched Entities, 6. GNN Delay, 7. Affected Nodes, 8. Max Depth */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 6,
                  marginTop: 2,
                }}>
                  <MetricItem
                    label="Extracted Entities"
                    value={extractedEntities !== null ? extractedEntities : '—'}
                    color="#38bdf8"
                  />
                  <MetricItem
                    label="Matched Entities"
                    value={matchedEntities !== null ? matchedEntities : '—'}
                    color="#22c55e"
                  />
                  <MetricItem
                    label="GNN Avg Predicted Delay"
                    value={gnnAvgDelay !== null ? gnnAvgDelay : '—'}
                    color="#38bdf8"
                  />
                  <MetricItem
                    label="Affected Ripple Nodes"
                    value={affectedNodes !== null ? affectedNodes : '—'}
                    color="#a78bfa"
                  />
                </div>

                {/* Max Depth & Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingTop: 4,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Max Ripple Depth:{' '}
                    <strong style={{ color: '#34d399' }}>{maxDepth || '—'}</strong>
                  </div>

                  {eventTime && (
                    <div style={{
                      fontSize: 10.5,
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Clock size={11} />
                      {timeAgo(eventTime) || 'just now'}
                      {ev.duration_ms ? ` (${ev.duration_ms}ms)` : ''}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Standby State (connected, no processed event yet) */}
            {!hasEvent && !isProcessing && workerStatus?.status !== 'error' && (
              <div style={{
                fontSize: 11.5,
                color: '#64748b',
                lineHeight: 1.4,
              }}>
                Awaiting incoming disruption events from the background live news worker.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
