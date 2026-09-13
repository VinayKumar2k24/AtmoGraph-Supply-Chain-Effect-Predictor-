"""
AtmoGraph — Live News Worker Control API
Exposes GET /status, POST /start, POST /stop for the shared LiveNewsWorker.
Zero changes to the existing pipeline — only lifecycle control is added.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter
from backend.app.services.live_news_worker import LiveNewsWorker

router = APIRouter()

# ── Singleton worker shared by this FastAPI process ───────────────────────────
_worker: Optional[LiveNewsWorker] = None

def _get_worker() -> LiveNewsWorker:
    global _worker
    if _worker is None:
        _worker = LiveNewsWorker(poll_interval=10.0)
    return _worker

def _status_dict(w: LiveNewsWorker) -> dict:
    last_poll = None
    if w._last_poll_time is not None:
        last_poll = datetime.fromtimestamp(w._last_poll_time, tz=timezone.utc).isoformat()
    return {
        "running":         w.is_running,
        "poll_interval":   w.poll_interval,
        "batch_size":      w.max_batch_size,
        "last_poll":       last_poll,
        "processed_count": w._processed_count,
        "error_count":     w._error_count,
    }

def _broadcast_worker_state(status: str, msg: str):
    """Notify WebSocket clients of worker status change."""
    try:
        from backend.app.routes.websocket import broadcast_live_event
        broadcast_live_event({
            "type": "worker_status",
            "status": status,
            "message": msg,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

@router.get("/status")
def get_status():
    """Return current worker state. Safe to call at any time."""
    return _status_dict(_get_worker())

@router.post("/start")
def start_worker():
    """Start the live news background worker (no-op if already running)."""
    w = _get_worker()
    if w.is_running:
        return {
            "success": True,
            "running": True,
            "message": "Live news monitoring is already running",
            **_status_dict(w),
        }
    w.start()
    _broadcast_worker_state("monitoring", "Live news monitoring started")
    return {
        "success": True,
        "running": w.is_running,
        "message": "Live news monitoring started",
        **_status_dict(w),
    }

@router.post("/stop")
def stop_worker():
    """Stop the live news background worker cleanly."""
    w = _get_worker()
    if not w.is_running:
        return {
            "success": True,
            "running": False,
            "message": "Live news monitoring was not running",
            **_status_dict(w),
        }
    w.stop(timeout=12.0)
    is_still_running = w.is_running
    if not is_still_running:
        _broadcast_worker_state("stopped", "Live news monitoring stopped")
    return {
        "success": not is_still_running,
        "running": is_still_running,
        "message": "Live news monitoring stopped" if not is_still_running else "Worker is stopping in background",
        **_status_dict(w),
    }
