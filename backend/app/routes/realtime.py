"""
AtmoGraph — Real-Time Pipeline API Routes
Week 4: Exposes the central Real-Time Disruption & Intelligence Pipeline.

Endpoints:
POST /api/realtime/process — Execute one complete real-time disruption cycle
"""

import sys
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException


# ============================================================
# PROJECT ROOT
# ============================================================

ROOT_DIR = Path(__file__).resolve().parents[3]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


# ============================================================
# SERVICES
# ============================================================

from backend.app.services.realtime_pipeline import (
    run_realtime_pipeline,
    RIPPLE_DECAY,
    DEFAULT_MAX_DEPTH,
)


router = APIRouter()


# ============================================================
# NEWS DIRECTORY
# ============================================================

NEWS_DIR = ROOT_DIR / "data" / "news"

# Default sample news file
DEFAULT_NEWS_FILE = NEWS_DIR / "port_strike_europe.json"


# ============================================================
# PROCESSED NEWS REGISTRY (Automatic / Live Update State)
# ============================================================

_PROCESSED_NEWS_REGISTRY: set = {"NEWS001", "port_strike_europe.json"}
_LAST_PROCESSED_INFO: Dict[str, Any] = {
    "news_id": "NEWS001",
    "title": "Major European Port Strike Disrupts Supply Chains",
    "timestamp": "2026-08-13T10:00:00",
    "shock_origin": "Rotterdam Port",
}


def check_unprocessed_news() -> Optional[Dict[str, Any]]:
    """
    Lightweight check scanning data/news/*.json for any unprocessed news item.
    Does NOT run NLP or GNN; only reads file JSON headers.
    """
    if not NEWS_DIR.exists():
        return None

    for f in sorted(NEWS_DIR.glob("*.json")):
        filename = f.name
        if filename in _PROCESSED_NEWS_REGISTRY:
            continue
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            news_id = str(data.get("id") or filename)
            if news_id in _PROCESSED_NEWS_REGISTRY:
                continue
            return {
                "id": news_id,
                "filename": filename,
                "title": data.get("title", f"Disruption from {filename}"),
                "source": data.get("source", "Live News Feed"),
                "published_at": data.get("published_at"),
            }
        except Exception as e:
            print(f"[REALTIME STATUS] Could not inspect news file '{filename}': {e}")

    return None


@router.get("/status")
def get_realtime_status():
    """
    Lightweight endpoint for automatic polling and live-update monitoring.
    Returns whether an unprocessed news event is available without executing GNN.
    """
    pending = check_unprocessed_news()
    return {
        "success": True,
        "live_updates_enabled": True,
        "last_processed_news_id": _LAST_PROCESSED_INFO.get("news_id"),
        "last_processed_at": _LAST_PROCESSED_INFO.get("timestamp"),
        "last_processed_title": _LAST_PROCESSED_INFO.get("title"),
        "last_shock_origin": _LAST_PROCESSED_INFO.get("shock_origin"),
        "update_available": pending is not None,
        "pending_news": pending,
    }


@router.post("/status/reset")
def reset_realtime_status():
    """
    Reset processed registry to initial state (for demo/testing).
    """
    global _PROCESSED_NEWS_REGISTRY, _LAST_PROCESSED_INFO
    _PROCESSED_NEWS_REGISTRY = {"NEWS001", "port_strike_europe.json"}
    return {
        "success": True,
        "message": "Processed registry reset to baseline",
    }


# ============================================================
# REQUEST MODEL
# ============================================================

class RealtimeProcessRequest(BaseModel):
    news_file: Optional[str] = Field(
        default=None,
        description=(
            "News JSON file. Accepts either a filename "
            "(e.g. 'port_strike_europe.json'), a relative path "
            "(e.g. 'data/news/port_strike_europe.json'), "
            "or an absolute path."
        ),
    )

    news_id: Optional[str] = Field(
        default=None,
        description="Optional custom ID for the disruption event.",
    )

    title: Optional[str] = Field(
        default=None,
        description="Headline/title of the disruption event.",
    )

    text: Optional[str] = Field(
        default=None,
        description="Raw text content of the news bulletin or disruption report.",
    )

    source: Optional[str] = Field(
        default=None,
        description="Source of the disruption report.",
    )

    published_at: Optional[str] = Field(
        default=None,
        description="ISO publication timestamp.",
    )

    shock_node: Optional[str] = Field(
        default=None,
        description=(
            "Optional shock origin entity name or ID "
            "(e.g. 'Rotterdam Port', 'European Precision Parts', 'P003'). "
            "If omitted, automatically derived from matched entities."
        ),
    )

    decay: Optional[float] = Field(
        default=RIPPLE_DECAY,
        ge=0.1,
        le=1.0,
        description="Exponential decay factor per downstream hop.",
    )

    max_depth: Optional[int] = Field(
        default=DEFAULT_MAX_DEPTH,
        ge=1,
        le=6,
        description="Maximum propagation horizon in graph hops.",
    )


# ============================================================
# NEWS FILE RESOLVER
# ============================================================

def resolve_news_file(news_file: str) -> Path:
    """
    Resolve a supplied news filename/path into an existing file.

    Supported inputs:

        port_strike_europe.json

        data/news/port_strike_europe.json

        C:/.../AtmoGraph/data/news/port_strike_europe.json
    """

    supplied_path = Path(news_file.strip())

    # --------------------------------------------------------
    # 1. Absolute path
    # --------------------------------------------------------

    if supplied_path.is_absolute():
        if supplied_path.is_file():
            return supplied_path

        raise HTTPException(
            status_code=404,
            detail=f"Specified news file '{news_file}' not found.",
        )

    # --------------------------------------------------------
    # 2. Bare filename
    #
    # Example:
    # port_strike_europe.json
    #
    # Search:
    # AtmoGraph/data/news/port_strike_europe.json
    # --------------------------------------------------------

    if len(supplied_path.parts) == 1:
        candidate = NEWS_DIR / supplied_path.name

        if candidate.is_file():
            return candidate

    # --------------------------------------------------------
    # 3. Project-relative path
    #
    # Example:
    # data/news/port_strike_europe.json
    # --------------------------------------------------------

    candidate = ROOT_DIR / supplied_path

    if candidate.is_file():
        return candidate

    # --------------------------------------------------------
    # 4. Final fallback: search inside data/news
    # --------------------------------------------------------

    filename_candidate = NEWS_DIR / supplied_path.name

    if filename_candidate.is_file():
        return filename_candidate

    # --------------------------------------------------------
    # File genuinely does not exist
    # --------------------------------------------------------

    raise HTTPException(
        status_code=404,
        detail=(
            f"Specified news file '{news_file}' not found. "
            f"Expected location: '{NEWS_DIR / supplied_path.name}'"
        ),
    )


# ============================================================
# REAL-TIME PROCESS ENDPOINT
# ============================================================

@router.post("/process")
def process_realtime_disruption(
    payload: Optional[RealtimeProcessRequest] = None,
):
    """
    Execute one complete real-time supply-chain disruption cycle.

    Pipeline:

        News Ingestion
              ↓
        spaCy NLP
              ↓
        Entity Matching
              ↓
        Neo4j Graph Update
              ↓
        GraphSAGE GNN Prediction
              ↓
        Ripple Effect Analysis
              ↓
        Consolidated Intelligence
    """

    try:

        # ====================================================
        # DEFAULT VALUES
        # ====================================================

        news_input = None

        shock_node = None

        decay = RIPPLE_DECAY

        max_depth = DEFAULT_MAX_DEPTH

        # ====================================================
        # PROCESS REQUEST PAYLOAD
        # ====================================================

        if payload:

            # ------------------------------------------------
            # Ripple configuration
            # ------------------------------------------------

            shock_node = payload.shock_node

            if payload.decay is not None:
                decay = payload.decay

            if payload.max_depth is not None:
                max_depth = payload.max_depth

            # ------------------------------------------------
            # Option A: News JSON file
            # ------------------------------------------------

            if payload.news_file:

                resolved_file = resolve_news_file(
                    payload.news_file
                )

                print(
                    f"[REALTIME API] News file resolved: "
                    f"{resolved_file}"
                )

                news_input = str(resolved_file)

            # ------------------------------------------------
            # Option B: Raw news text
            # ------------------------------------------------

            elif payload.text:

                news_id = (
                    payload.news_id
                    or f"NEWS_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                )

                news_input = {
                    "id": news_id,
                    "title": (
                        payload.title
                        or "Real-time Supply Chain Disruption"
                    ),
                    "source": (
                        payload.source
                        or "Live Event Ingestion"
                    ),
                    "published_at": (
                        payload.published_at
                        or datetime.now(timezone.utc).isoformat()
                    ),
                    "text": payload.text,
                }

                # Persist to data/news/ so it appears in the News Intelligence article feed
                news_filename = f"{news_id.lower()}.json"
                try:
                    target_file = NEWS_DIR / news_filename
                    with open(target_file, "w", encoding="utf-8") as f:
                        json.dump(news_input, f, indent=2)
                    _PROCESSED_NEWS_REGISTRY.add(news_filename)
                    _PROCESSED_NEWS_REGISTRY.add(news_id)
                    print(f"[REALTIME API] News item saved and registered: {news_filename}")
                except Exception as e:
                    print(f"[REALTIME API] Warning: could not persist news JSON file: {e}")

            # ------------------------------------------------
            # Option C: Disruption tied to requested shock node
            # ------------------------------------------------

            elif payload.shock_node:

                node_clean = payload.shock_node.strip()

                news_input = {
                    "id": f"DISRUPT_{node_clean.replace(' ', '_').upper()}",
                    "title": (
                        payload.title
                        or f"{node_clean} Supply Chain Disruption"
                    ),
                    "source": (
                        payload.source
                        or "Live Operational Disruption Alert"
                    ),
                    "published_at": (
                        payload.published_at
                    ),
                    "text": (
                        f"Supply chain disruption reported at {node_clean} "
                        f"affecting downstream logistics and shipments."
                    ),
                }

                print(
                    f"[REALTIME API] Using disruption context for shock node: "
                    f"'{node_clean}'"
                )

        # ====================================================
        # FALLBACK TO DEFAULT NEWS
        # ====================================================

        if not news_input:

            if not DEFAULT_NEWS_FILE.is_file():

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Default sample news file is missing: "
                        f"'{DEFAULT_NEWS_FILE}'"
                    ),
                )

            news_input = str(DEFAULT_NEWS_FILE)

            print(
                f"[REALTIME API] Using default news file: "
                f"{DEFAULT_NEWS_FILE}"
            )

        # ====================================================
        # EXECUTE CENTRAL REAL-TIME PIPELINE
        # ====================================================

        print("\n" + "=" * 70)
        print("[REALTIME API] Starting real-time disruption processing")
        print("=" * 70)

        pipeline_result = run_realtime_pipeline(
            news_input=news_input,
            shock_node=shock_node,
            decay=decay,
            max_depth=max_depth,
        )

        # ====================================================
        # HANDLE PIPELINE FAILURE
        # ====================================================

        if not pipeline_result.get("success"):

            stage = pipeline_result.get(
                "failed_stage",
                "UNKNOWN",
            )

            error_message = pipeline_result.get(
                "error",
                "Unknown pipeline error",
            )

            status_code = (
                400
                if stage in [
                    "NEWS_INGESTION",
                    "NLP_EXTRACTION",
                ]
                else 500
            )

            raise HTTPException(
                status_code=status_code,
                detail=(
                    f"Realtime pipeline failed at "
                    f"stage '{stage}': {error_message}"
                ),
            )

        # ====================================================
        # EXTRACT PREDICTION RESULTS
        # ====================================================

        prediction_results = pipeline_result.get(
            "prediction_results",
            {},
        )

        predictions = prediction_results.get(
            "predictions",
            [],
        )

        prediction_summary = prediction_results.get(
            "summary",
            {},
        )

        # ====================================================
        # EXTRACT RIPPLE RESULTS
        # ====================================================

        ripple_results = (
            pipeline_result.get(
                "ripple_results",
                {},
            )
            or {}
        )

        affected_nodes = ripple_results.get(
            "affected_nodes",
            [],
        )

        maximum_depth = ripple_results.get(
            "max_depth",
            0,
        )

        # ====================================================
        # FINAL API RESPONSE
        # ====================================================

        response = {
            "success": True,

            "timestamp": pipeline_result.get(
                "timestamp"
            ),

            "duration": pipeline_result.get(
                "duration_ms"
            ),

            "duration_ms": pipeline_result.get(
                "duration_ms"
            ),

            # ----------------------------------------------
            # NEWS
            # ----------------------------------------------

            "processed_news": pipeline_result.get(
                "processed_news"
            ),

            # ----------------------------------------------
            # NLP
            # ----------------------------------------------

            "extracted_entities": pipeline_result.get(
                "extracted_entities",
                [],
            ),

            # ----------------------------------------------
            # ENTITY MATCHING
            # ----------------------------------------------

            "matched_entities": pipeline_result.get(
                "matched_entities",
                [],
            ),

            # ----------------------------------------------
            # NEO4J UPDATE
            # ----------------------------------------------

            "graph_update_status": pipeline_result.get(
                "graph_update_status"
            ),

            # ----------------------------------------------
            # GNN
            # ----------------------------------------------

            "prediction_status": pipeline_result.get(
                "prediction_status"
            ),

            "total_predicted_nodes": prediction_results.get(
                "total_nodes",
                len(predictions),
            ),

            "average_predicted_delay": prediction_summary.get(
                "avg_predicted_delay",
                0.0,
            ),

            # ----------------------------------------------
            # RIPPLE
            # ----------------------------------------------

            "ripple_origin": pipeline_result.get(
                "shock_origin"
            ),

            "shock_origin": pipeline_result.get(
                "shock_origin"
            ),

            "ripple_analysis_status": pipeline_result.get(
                "ripple_analysis_status"
            ),

            "affected_nodes": affected_nodes,

            "maximum_propagation_depth": maximum_depth,

            # ----------------------------------------------
            # FULL RESULTS
            # ----------------------------------------------

            "prediction_results": prediction_results,

            "ripple_results": ripple_results,
        }

        # ----------------------------------------------------
        # REGISTER PROCESSED NEWS (Avoid Duplicate Runs)
        # ----------------------------------------------------
        processed_item = pipeline_result.get("processed_news", {})
        processed_id = processed_item.get("id")
        if processed_id:
            _PROCESSED_NEWS_REGISTRY.add(str(processed_id))
            _PROCESSED_NEWS_REGISTRY.add(f"{str(processed_id).lower()}.json")
        if payload and payload.news_file:
            _PROCESSED_NEWS_REGISTRY.add(Path(payload.news_file).name)
        if payload and payload.news_id:
            _PROCESSED_NEWS_REGISTRY.add(str(payload.news_id))
            _PROCESSED_NEWS_REGISTRY.add(f"{str(payload.news_id).lower()}.json")

        _LAST_PROCESSED_INFO["news_id"] = processed_id or "NEWS_REALTIME"
        _LAST_PROCESSED_INFO["title"] = processed_item.get("title", "Supply Chain Disruption")
        _LAST_PROCESSED_INFO["timestamp"] = pipeline_result.get("timestamp", "")
        _LAST_PROCESSED_INFO["shock_origin"] = pipeline_result.get("shock_origin", "")

        # Also register into LiveNewsStore so GET /api/news/{id} can locate it
        try:
            from backend.app.services.live_news_store import get_live_news_store
            get_live_news_store().register_from_pipeline(
                article=processed_item,
                pipeline_result=pipeline_result
            )
        except Exception as store_err:
            print(f"[REALTIME API] Note: Failed to register into LiveNewsStore: {store_err}")

        print("=" * 70)
        print(f"[REALTIME API] Pipeline completed successfully (Registered ID: {_LAST_PROCESSED_INFO['news_id']})")
        print("=" * 70)

        return response

    # ========================================================
    # FASTAPI HTTP EXCEPTIONS
    # ========================================================

    except HTTPException:
        raise

    # ========================================================
    # UNEXPECTED ERROR
    # ========================================================

    except Exception as e:

        print(
            f"[REALTIME API] Unexpected error: {str(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unexpected error in realtime pipeline route: "
                f"{str(e)}"
            ),
        )