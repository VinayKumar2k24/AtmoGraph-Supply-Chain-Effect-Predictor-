"""
AtmoGraph — FastAPI Backend
Main application entry point.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes import (
    graph,
    news,
    stats,
    risk,
    prediction,
    ripple,
    realtime,
    forecast,
    websocket,
)


app = FastAPI(
    title="AtmoGraph API",
    description="Supply Chain Intelligence Platform — REST API",
    version="1.0.0",
)


# ─── CORS — allow React dev server ───────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(
    graph.router,
    prefix="/api/graph",
    tags=["Graph"]
)

app.include_router(
    news.router,
    prefix="/api/news",
    tags=["News"]
)

app.include_router(
    stats.router,
    prefix="/api/stats",
    tags=["Stats"]
)

app.include_router(
    risk.router,
    prefix="/api/risk",
    tags=["Risk"]
)

# ─── GNN Prediction Router ──────────────────────────────────────────────────

app.include_router(
    prediction.router,
    prefix="/api/prediction",
    tags=["GNN Prediction"]
)

# ─── Ripple Effect Router ────────────────────────────────────────────────────

app.include_router(
    ripple.router,
    prefix="/api/ripple",
    tags=["Ripple Effect"]
)

# ─── Real-Time Pipeline Router ───────────────────────────────────────────────

app.include_router(
    realtime.router,
    prefix="/api/realtime",
    tags=["Real-Time Pipeline"]
)

# ─── Supply Chain Forecast Router (30/60/90 Days) ───────────────────────────

app.include_router(
    forecast.router,
    prefix="/api/forecast",
    tags=["Supply Chain Forecast"]
)

# ─── WebSocket Live Stream Router ────────────────────────────────────────────

app.include_router(
    websocket.router
)


# ─── Health Check ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "AtmoGraph API"
    }