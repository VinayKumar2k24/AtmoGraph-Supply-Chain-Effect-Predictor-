import { useState, useEffect, useCallback } from 'react';
import {
  Radio, Wifi, WifiOff, RefreshCw, Play, Square,
  AlertTriangle, Loader2, Clock, Check, Activity,
} from 'lucide-react';
import { useLiveWebSocket } from '../context/LiveWebSocketContext.jsx';
import { getExtractedCount, getMatchedCount } from '../services/liveWebSocket.js';
import { getLiveNewsStatus, startLiveNews, stopLiveNews } from '../services/api.js';

/* ── helper: relative time string ── */
function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Math.max(0, (Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 6) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ── pipeline status step pill ── */
function PipelinePill({ label, status, doneText = 'Updated' }) {
  // status: 'completed' | 'processing' | 'idle'
  let color = '#64748b';
  let bg = 'rgba(255, 255, 255, 0.03)';
  let border = 'rgba(255, 255, 255, 0.06)';
  let icon = '○';
  let text = 'Ready';

  if (status === 'completed') {
    color = '#22c55e';
    bg = 'rgba(34, 197, 94, 0.08)';
    border = 'rgba(34, 197, 94, 0.25)';
    icon = '✓';
    text = doneText;
  } else if (status === 'processing') {
    color = '#38bdf8';
    bg = 'rgba(56, 189, 248, 0.12)';
    border = 'rgba(56, 189, 248, 0.35)';
    icon = '●';
    text = 'Processing…';
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 12px',
      borderRadius: 8,
      background: bg,
      border: `1px solid ${border}`,
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{ color, fontSize: 13, fontWeight: 800 }}>{icon}</span>
      <span style={{ color: '#cbd5e1' }}>{label}</span>
      <span style={{ color, fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{text}</span>
    </div>
  );
}

/* ── impact summary card ── */
function MetricBox({ label, value, color = '#38bdf8' }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 120,
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 10,
      padding: '12px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value ?? '--'}
      </div>
    </div>
  );
}

export default function LiveNewsStatus({ onDataRefresh, fallbackEvent }) {
  const { connectionStatus, workerStatus, latestProcessedEvent } = useLiveWebSocket();

  // ── worker state ──
  const [workerRunning, setWorkerRunning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [, setTick] = useState(Date.now());

  // Auto-tick for relative time display
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // ── Periodic & mount synchronization with backend worker status ──
  const checkStatus = useCallback(async () => {
    try {
      const s = await getLiveNewsStatus();
      if (typeof s?.running === 'boolean') {
        setWorkerRunning(s.running);
      }
    } catch {
      // Backend not reached or offline
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Sync workerRunning when workerStatus events arrive via WebSocket
  useEffect(() => {
    if (!workerStatus?.status) return;
    if (['monitoring', 'processing', 'completed', 'waiting'].includes(workerStatus.status)) {
      setWorkerRunning(true);
    } else if (workerStatus.status === 'stopped') {
      setWorkerRunning(false);
    }
  }, [workerStatus]);

  // ── Start Handler (POST /api/live-news/start) ──
  const handleStart = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await startLiveNews();
      setWorkerRunning(Boolean(res?.running));
      if (onDataRefresh) onDataRefresh();
    } catch {
      setActionError('Unable to start live news monitoring');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Stop Handler (POST /api/live-news/stop) ──
  const handleStop = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await stopLiveNews();
      setWorkerRunning(Boolean(res?.running));
      if (onDataRefresh) onDataRefresh();
    } catch {
      setActionError('Unable to stop live news monitoring');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived state for activity indicator ──
  const wsStatus = workerStatus?.status;
  const isProcessing = wsStatus === 'processing';

  const monitorState = (() => {
    if (actionLoading && !workerRunning) return 'starting';
    if (actionLoading && workerRunning) return 'stopping';
    if (wsStatus === 'error') return 'error';
    if (isProcessing) return 'processing';
    if (wsStatus === 'completed') return 'completed';
    if (workerRunning) return 'monitoring';
    return 'stopped';
  })();

  const stateBadges = {
    stopped: {
      color: '#ef4444',
      dotColor: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.25)',
      statusTitle: 'LIVE NEWS: STOPPED',
      statusText: 'STOPPED',
      subText: 'Monitoring automatically for supply-chain disruptions',
      pulse: false,
    },
    starting: {
      color: '#f59e0b',
      dotColor: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.35)',
      statusTitle: 'LIVE NEWS: STARTING…',
      statusText: 'STARTING',
      subText: 'Initializing background live worker…',
      pulse: true,
    },
    stopping: {
      color: '#f59e0b',
      dotColor: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.35)',
      statusTitle: 'LIVE NEWS: STOPPING…',
      statusText: 'STOPPING',
      subText: 'Stopping background live worker cleanly…',
      pulse: true,
    },
    monitoring: {
      color: '#22c55e',
      dotColor: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.14)',
      border: 'rgba(34, 197, 94, 0.35)',
      statusTitle: 'LIVE NEWS: MONITORING',
      statusText: 'MONITORING',
      subText: 'Monitoring automatically for supply-chain disruptions',
      pulse: true,
    },
    processing: {
      color: '#38bdf8',
      dotColor: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.14)',
      border: 'rgba(56, 189, 248, 0.35)',
      statusTitle: 'Live analysis in progress',
      statusText: 'PROCESSING',
      subText: 'Ingesting news article · running NLP entity extraction & GNN cascade prediction…',
      pulse: true,
    },
    completed: {
      color: '#22c55e',
      dotColor: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.14)',
      border: 'rgba(34, 197, 94, 0.35)',
      statusTitle: 'Live analysis completed',
      statusText: 'COMPLETED',
      subText: 'Disruption event analyzed · Knowledge graph and cascade predictions updated',
      pulse: false,
    },
    error: {
      color: '#ef4444',
      dotColor: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.14)',
      border: 'rgba(239, 68, 68, 0.35)',
      statusTitle: 'Live analysis error',
      statusText: 'ERROR',
      subText: workerStatus?.error || 'An error occurred during live news monitoring',
      pulse: false,
    },
  };
  const activeBadge = stateBadges[monitorState] || stateBadges.stopped;

  // Active event resolution: prioritize WebSocket event, then fallback event
  const ev = latestProcessedEvent || fallbackEvent;
  const hasEvent = Boolean(ev);
  const extCount = ev ? getExtractedCount(ev) : 0;
  const matCount = ev ? getMatchedCount(ev) : 0;
  const eventTime = ev?.timestamp || ev?.published_at;

  const isCompleted = hasEvent || wsStatus === 'completed';

  return (
    <div
      id="live-news-monitoring-card"
      style={{
        flexShrink: 0,
        minHeight: 'fit-content',
        background: 'var(--bg-card, #0f172a)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
      }}
    >

      {/* ── TOP BAR: Status Indicator & Start/Stop Control ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 22px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* Left: Status with icon and badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Radio size={18} color="#06b6d4" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: activeBadge.color,
                background: activeBadge.bg,
                border: `1px solid ${activeBadge.border}`,
                borderRadius: 9999,
                padding: '3px 12px',
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: activeBadge.dotColor,
                  boxShadow: activeBadge.pulse ? `0 0 8px ${activeBadge.dotColor}` : 'none',
                  animation: activeBadge.pulse ? 'lnPulse 1.6s ease-in-out infinite' : 'none',
                }} />
                {activeBadge.statusTitle}
              </span>

              {/* WS Connection Pill */}
              {(() => {
                const isWsConnected = connectionStatus === 'connected' || connectionStatus === 'CONNECTED';
                const isWsConnecting = connectionStatus === 'connecting' || connectionStatus === 'CONNECTING';
                return (
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: isWsConnected ? '#22c55e' : isWsConnecting ? '#f59e0b' : '#ef4444',
                    background: isWsConnected ? 'rgba(34, 197, 94, 0.1)' : isWsConnecting ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${isWsConnected ? 'rgba(34, 197, 94, 0.25)' : isWsConnecting ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    borderRadius: 6,
                    padding: '2px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {isWsConnected ? (
                      <>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                        LIVE STREAM
                      </>
                    ) : isWsConnecting ? (
                      <>
                        <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <WifiOff size={10} />
                        Live connection disconnected
                      </>
                    )}
                  </span>
                );
              })()}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {activeBadge.subText}
            </div>
          </div>
        </div>

        {/* Right: Prominent Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {actionError && (
            <span style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(239, 68, 68, 0.12)',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              <AlertTriangle size={12} />
              {actionError}
            </span>
          )}

          {workerRunning ? (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                borderRadius: 9,
                border: '1px solid rgba(239, 68, 68, 0.5)',
                background: 'rgba(239, 68, 68, 0.16)',
                color: '#f87171',
                fontSize: 13.5,
                fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.6 : 1,
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)',
                transition: 'all 0.2s ease',
              }}
            >
              {actionLoading ? <Loader2 size={15} className="spin" /> : <Square size={14} fill="#f87171" />}
              {actionLoading ? 'Stopping…' : '■ STOP LIVE NEWS'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                borderRadius: 9,
                border: 'none',
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.6 : 1,
                boxShadow: '0 0 22px rgba(6, 182, 212, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              {actionLoading ? <Loader2 size={15} className="spin" /> : <Play size={14} fill="#ffffff" />}
              {actionLoading ? 'Starting…' : '▶ START LIVE NEWS'}
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CARD BODY: Always rendered with structured sections ── */}
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* SECTION 1: LATEST EVENT */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#64748b',
            marginBottom: 8,
          }}>
            LATEST EVENT
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: hasEvent ? '#f8fafc' : '#94a3b8',
              lineHeight: 1.4,
            }}>
              {hasEvent
                ? (ev.title || 'Live Disruption Event')
                : 'No live disruption events processed yet — click Start Live News to begin monitoring'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Source:{' '}
                <strong style={{ color: '#cbd5e1' }}>
                  {hasEvent && ev.source ? ev.source : 'Live Ingestion Service'}
                </strong>
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Shock Origin:{' '}
                <strong style={{ color: ev?.shock_origin && ev.shock_origin !== 'None' ? '#c084fc' : '#64748b' }}>
                  {hasEvent && ev.shock_origin && ev.shock_origin !== 'None' ? ev.shock_origin : '--'}
                </strong>
              </span>
              {hasEvent && (
                <span style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={12} />
                  Processed {timeAgo(eventTime) || 'recently'}
                  {ev.duration_ms ? ` (${ev.duration_ms}ms)` : ''}
                </span>
              )}
            </div>

            {hasEvent && (
              <div style={{ display: 'flex', gap: 16, fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
                <span style={{ color: '#94a3b8' }}>
                  Extracted Entities: <strong style={{ color: '#38bdf8' }}>{extCount}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>
                  Matched Entities: <strong style={{ color: '#22c55e' }}>{matCount}</strong>
                </span>
                {ev.risk_level && (
                  <span style={{ color: '#94a3b8' }}>
                    Risk Level: <strong style={{ color: '#fbbf24' }}>{ev.risk_level}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: IMPACT SUMMARY (GNN DELAY, AFFECTED NODES, RIPPLE DEPTH) */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#64748b',
            marginBottom: 8,
          }}>
            IMPACT SUMMARY
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <MetricBox
              label="GNN AVG PREDICTED DELAY"
              value={hasEvent && ev.avg_predicted_delay != null ? `${Number(ev.avg_predicted_delay).toFixed(2)} days` : '--'}
              color="#38bdf8"
            />
            <MetricBox
              label="AFFECTED RIPPLE NODES"
              value={hasEvent && ev.affected_nodes != null ? `${ev.affected_nodes} node${ev.affected_nodes !== 1 ? 's' : ''}` : '--'}
              color="#a78bfa"
            />
            <MetricBox
              label="MAX RIPPLE DEPTH"
              value={hasEvent && ev.max_depth != null ? `${ev.max_depth} hop${ev.max_depth !== 1 ? 's' : ''}` : '--'}
              color="#34d399"
            />
          </div>
        </div>

        {/* SECTION 3: PIPELINE STATUS */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#64748b',
            marginBottom: 8,
          }}>
            PIPELINE STATUS
          </div>
          <div style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '12px 16px',
          }}>
            <PipelinePill
              label="News"
              status={isCompleted ? 'completed' : isProcessing ? 'processing' : 'idle'}
              doneText="Completed"
            />
            <PipelinePill
              label="NLP"
              status={isCompleted ? 'completed' : isProcessing ? 'processing' : 'idle'}
              doneText="Completed"
            />
            <PipelinePill
              label="Neo4j"
              status={isCompleted && ev?.neo4j_updated !== false ? 'completed' : isProcessing ? 'processing' : 'idle'}
              doneText="Updated"
            />
            <PipelinePill
              label="GNN"
              status={isCompleted && ev?.gnn_updated !== false ? 'completed' : isProcessing ? 'processing' : 'idle'}
              doneText="Updated"
            />
            <PipelinePill
              label="Ripple"
              status={isCompleted && ev?.ripple_updated !== false ? 'completed' : isProcessing ? 'processing' : 'idle'}
              doneText="Updated"
            />
          </div>
        </div>

      </div>

      {/* Animation pulse styles */}
      <style>{`
        @keyframes lnPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
