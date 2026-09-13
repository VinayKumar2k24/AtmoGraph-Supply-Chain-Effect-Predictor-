"""
AtmoGraph — WebSocket Live Communication Layer
Week 4: Real-Time Event Streaming & Client Notifications

Provides real-time bi-directional WebSocket connection management,
handling client connections, disconnects, heartbeats, and broadcasting
live disruption and pipeline execution events to connected React clients.
"""

import sys
import json
import asyncio
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException, status
from starlette.websockets import WebSocketState

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logger = logging.getLogger("atmo_websocket")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

router = APIRouter(tags=["WebSocket"])


# =============================================================================
# WEBSOCKET CONNECTION MANAGER
# =============================================================================

class ConnectionManager:
    """
    Manages active WebSocket connections for AtmoGraph.
    Supports connection lifecycle, broadcast to all connected clients,
    safe disconnection cleanup, dead connection pruning, and thread-safe
    dispatch from background threads (e.g. LiveNewsWorker).
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.RLock()

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Stores reference to the running FastAPI asyncio event loop."""
        self._loop = loop

    def get_event_loop(self) -> Optional[asyncio.AbstractEventLoop]:
        """Returns the active asyncio event loop or attempts to find running loop."""
        if self._loop and self._loop.is_running():
            return self._loop
        try:
            loop = asyncio.get_running_loop()
            self._loop = loop
            return loop
        except RuntimeError:
            return self._loop

    async def connect(self, websocket: WebSocket) -> None:
        """Accepts and registers a new WebSocket client in a thread-safe manner."""
        await websocket.accept()
        with self._lock:
            self.active_connections.add(websocket)

        # Capture current event loop
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

        logger.info(
            f"WebSocket client connected. Total active connections: {self.count()}"
        )

        # Send welcome message upon connection; prune client immediately if send fails
        try:
            await websocket.send_json({
                "type": "connection_established",
                "message": "Connected to AtmoGraph Live WebSocket stream",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "active_connections": self.count(),
            })
        except Exception as exc:
            logger.warning(f"Failed to send welcome message to new WebSocket client, pruning: {exc}")
            self.disconnect(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """
        Removes a client from the active registry in a thread-safe, idempotent manner.
        """
        was_present = False
        with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                was_present = True

        if was_present:
            logger.info(
                f"WebSocket client disconnected. Remaining active connections: {self.count()}"
            )

    def count(self) -> int:
        """Returns number of active client connections (thread-safe)."""
        with self._lock:
            return len(self.active_connections)

    async def broadcast(self, message: Union[Dict[str, Any], str]) -> None:
        """
        Asynchronously broadcasts a JSON payload to all connected clients.
        Automatically detects and prunes disconnected or failing clients.
        """
        with self._lock:
            connections = list(self.active_connections)

        if not connections:
            logger.debug("No active WebSocket clients to receive broadcast.")
            return

        payload = message if isinstance(message, dict) else {"message": str(message)}
        dead_connections: List[WebSocket] = []

        # Iterate over snapshot of active connections
        for connection in connections:
            # Check client state if available to avoid sending to already-closed sockets
            if hasattr(connection, "client_state"):
                state = getattr(connection, "client_state", None)
                if state == WebSocketState.DISCONNECTED or getattr(state, "name", None) == "DISCONNECTED":
                    dead_connections.append(connection)
                    continue

            try:
                await connection.send_json(payload)
            except (WebSocketDisconnect, RuntimeError, ConnectionResetError, Exception) as exc:
                logger.warning(
                    f"Error broadcasting to WebSocket client ({exc.__class__.__name__}: {exc}), marking for cleanup."
                )
                dead_connections.append(connection)

        # Clean up any dead connections from the active set
        if dead_connections:
            for dead_ws in dead_connections:
                self.disconnect(dead_ws)

    def broadcast_sync(self, message: Union[Dict[str, Any], str]) -> None:
        """
        Thread-safe synchronous broadcast method.
        Can be called safely by background threads (e.g., LiveNewsWorker in threading.Thread).
        """
        with self._lock:
            if not self.active_connections:
                return

        loop = self.get_event_loop()
        if loop and loop.is_running():
            try:
                asyncio.run_coroutine_threadsafe(self.broadcast(message), loop)
            except Exception as exc:
                logger.warning(f"Error dispatching thread-safe WebSocket broadcast: {exc}")
        else:
            logger.warning("No running asyncio event loop available for thread-safe WebSocket broadcast.")


# Singleton ConnectionManager instance
manager = ConnectionManager()


# =============================================================================
# REUSABLE BROADCAST FUNCTIONS
# =============================================================================

def broadcast_live_event(event_data: Dict[str, Any]) -> None:
    """
    Public helper to broadcast an event dictionary to all active WebSocket clients.
    Thread-safe; can be called directly by background threads or synchronous code.
    """
    manager.broadcast_sync(event_data)


async def async_broadcast_live_event(event_data: Dict[str, Any]) -> None:
    """
    Asynchronous helper to broadcast an event dictionary to all active WebSocket clients.
    """
    await manager.broadcast(event_data)


def create_live_news_event(
    article_id: str,
    title: str,
    shock_origin: str,
    extracted_entities: int = 0,
    matched_entities: int = 0,
    gnn_updated: bool = True,
    ripple_updated: bool = True,
    affected_nodes: int = 0,
    timestamp: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Standard event payload constructor for live_news_processed events.
    """
    event = {
        "type": "live_news_processed",
        "article_id": article_id,
        "title": title,
        "shock_origin": shock_origin,
        "extracted_entities": extracted_entities,
        "matched_entities": matched_entities,
        "gnn_updated": gnn_updated,
        "ripple_updated": ripple_updated,
        "affected_nodes": affected_nodes,
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        event.update(extra)
    return event


def create_worker_status_event(
    status: str,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Standard event payload constructor for worker_status events.
    Status can be 'idle', 'processing', 'completed', 'error'.
    """
    event = {
        "type": "worker_status",
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if details:
        event["details"] = details
    return event


# =============================================================================
# WEBSOCKET ROUTE ENDPOINT
# =============================================================================

@router.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    """
    Primary real-time WebSocket endpoint for AtmoGraph clients.
    Path: /ws/live
    """
    await manager.connect(websocket)

    try:
        while True:
            # Receive optional messages from connected client (heartbeats, commands)
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except Exception:
                msg = {"type": "raw", "content": raw_data}

            msg_type = str(msg.get("type", "")).lower() if isinstance(msg, dict) else ""

            if msg_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "active_connections": manager.count(),
                })
            elif msg_type == "status":
                await websocket.send_json({
                    "type": "worker_status",
                    "status": "connected",
                    "active_connections": manager.count(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
            else:
                # Acknowledge received payload
                await websocket.send_json({
                    "type": "ack",
                    "received": msg,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed cleanly by client.")
    except Exception as exc:
        logger.warning(f"WebSocket client connection closed with error ({exc.__class__.__name__}: {exc})")
    finally:
        manager.disconnect(websocket)


# =============================================================================
# INTERNAL HTTP BROADCAST BRIDGE (CROSS-PROCESS COMPATIBILITY)
# =============================================================================

@router.post("/api/internal/live/broadcast")
async def internal_live_broadcast_endpoint(event_data: Dict[str, Any], request: Request):
    """
    Internal HTTP bridge endpoint for LiveNewsWorker (or other separate processes)
    to broadcast live disruption events to connected browser WebSocket clients.
    Protected to loopback / localhost callers only.
    """
    # Verify localhost caller
    client_host = request.client.host if request.client else ""
    allowed_hosts = {"127.0.0.1", "::1", "localhost", "testclient"}
    if client_host and client_host not in allowed_hosts:
        logger.warning(f"[LiveWS Bridge] Rejected broadcast request from non-local host: {client_host}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Internal broadcast endpoint is restricted to localhost."
        )

    connected_count = manager.count()
    logger.info(f"[LiveWS Bridge] Broadcasting event to {connected_count} connected clients")

    # Register article in LiveNewsStore within the FastAPI process
    if event_data.get("type") == "live_news_processed":
        try:
            from backend.app.services.live_news_store import get_live_news_store
            store = get_live_news_store()
            if "article" in event_data and isinstance(event_data["article"], dict):
                store.register_article(event_data["article"])
            else:
                store.register_from_event(event_data)
        except Exception as store_exc:
            logger.warning(f"[LiveWS Bridge] Could not register in LiveNewsStore: {store_exc}")

    # Broadcast directly via the FastAPI ConnectionManager instance
    await manager.broadcast(event_data)

    return {
        "status": "ok",
        "broadcasted_to": connected_count,
        "event_type": event_data.get("type"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
