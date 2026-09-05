"""
AtmoGraph — Ripple Effect API Routes
Week 3: Supply Chain Ripple Effect Propagation

Endpoints:
GET  /api/ripple/nodes         — Get all available supply chain nodes for simulation
GET  /api/ripple/{node_id}     — Simulate ripple propagation from a node (ID or name)
POST /api/ripple               — Simulate ripple propagation via JSON payload
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.services.ripple_effect import (
    calculate_ripple_propagation,
    get_explainability_paths,
    get_ripple_candidate_nodes,
    RIPPLE_DECAY,
    DEFAULT_MAX_DEPTH,
)

router = APIRouter()


class RippleRequest(BaseModel):
    node_id: Optional[str] = Field(default=None, description="Neo4j elementId, short code (e.g. P003), or node name")
    nodeId: Optional[str] = Field(default=None, description="CamelCase alias for node_id")
    decay: Optional[float] = Field(default=RIPPLE_DECAY, description="Propagation decay factor per hop (0.0 - 1.0)")
    max_depth: Optional[int] = Field(default=DEFAULT_MAX_DEPTH, description="Maximum graph traversal depth")


# ============================================================
# GET CANDIDATE NODES
# ============================================================

@router.get("/nodes")
def get_nodes():
    """
    Return all 18 supply chain nodes available for ripple effect analysis,
    sorted by disruption index and risk score.
    """
    try:
        nodes = get_ripple_candidate_nodes()
        return {
            "success": True,
            "total": len(nodes),
            "nodes": nodes,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch ripple candidate nodes: {str(e)}"
        )


# ============================================================
# EXPLAINABILITY PATHS VIA GET /api/ripple/explainability/{node_id}
# ============================================================

@router.get("/explainability/{node_id}")
def get_ripple_explainability(node_id: str):
    """
    Explain WHY each downstream entity was affected by the selected disrupted node.
    Dynamically traverses actual Neo4j graph relationships and attaches
    real GraphSAGE GNN predicted delays and ripple propagation scores.
    """
    try:
        result = get_explainability_paths(source_identifier=node_id)
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{node_id}' not found in Neo4j graph.",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate explainability paths for '{node_id}': {str(e)}"
        )


# ============================================================
# SIMULATE RIPPLE VIA GET /api/ripple/{node_id}
# ============================================================

@router.get("/{node_id}")
def simulate_ripple_get(
    node_id: str,
    decay: float = Query(default=RIPPLE_DECAY, ge=0.1, le=1.0, description="Decay factor per hop (default 0.70)"),
    max_depth: int = Query(default=DEFAULT_MAX_DEPTH, ge=1, le=6, description="Max propagation depth (default 4)"),
):
    """
    Calculate ripple effect propagation starting from a disrupted node.

    Accepts node ID (e.g. P003, S001), full Neo4j elementId, or entity name (e.g. 'Rotterdam Port').
    Returns affected nodes, propagation paths, and hop-by-hop ripple scores.
    """
    try:
        result = calculate_ripple_propagation(
            source_identifier=node_id,
            decay=decay,
            max_depth=max_depth,
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{node_id}' not found in Neo4j graph.",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error simulating ripple effect: {str(e)}"
        )


# ============================================================
# SIMULATE RIPPLE VIA POST /api/ripple
# ============================================================

@router.post("")
@router.post("/")
def simulate_ripple_post(payload: RippleRequest):
    """
    Calculate ripple effect propagation via JSON body payload.
    """
    target_id = payload.node_id or payload.nodeId
    if not target_id:
        raise HTTPException(
            status_code=422,
            detail="Either 'node_id' or 'nodeId' must be provided in request body."
        )

    try:
        result = calculate_ripple_propagation(
            source_identifier=target_id,
            decay=payload.decay or RIPPLE_DECAY,
            max_depth=payload.max_depth or DEFAULT_MAX_DEPTH,
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{target_id}' not found in Neo4j graph.",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error simulating ripple effect: {str(e)}"
        )
