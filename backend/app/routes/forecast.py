"""
AtmoGraph — Supply Chain Forecast API Routes
Week 4: 30 / 60 / 90-Day Supply Chain Horizon Projections

Endpoints:
GET  /api/forecast/30-60-90?shock_node=... — Generate 30/60/90-day supply chain forecast
GET  /api/forecast/{node_id}               — Generate forecast for specific node ID or name
POST /api/forecast                         — Generate forecast via JSON payload
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.services.forecast_service import (
    generate_supply_chain_forecast,
    RIPPLE_DECAY,
    DEFAULT_MAX_DEPTH,
)

router = APIRouter()


class ForecastRequest(BaseModel):
    shock_node: Optional[str] = Field(default=None, description="Shock origin entity name or Neo4j ID")
    node_id: Optional[str] = Field(default=None, description="Alias for shock_node")
    decay: Optional[float] = Field(default=RIPPLE_DECAY, description="Per-hop exponential ripple decay")
    max_depth: Optional[int] = Field(default=DEFAULT_MAX_DEPTH, description="Maximum graph propagation depth")


@router.get("/30-60-90")
def get_forecast_30_60_90(
    shock_node: Optional[str] = Query(default=None, description="Disrupted entity name or ID"),
    decay: float = Query(default=RIPPLE_DECAY, ge=0.1, le=1.0, description="Per-hop ripple decay"),
    max_depth: int = Query(default=DEFAULT_MAX_DEPTH, ge=1, le=6, description="Max traversal depth"),
):
    """
    Generate 30 / 60 / 90-day deterministic supply chain forecast.
    Combines live Neo4j topology, trained GraphSAGE GNN delay predictions,
    and exponential decay ripple propagation.
    """
    try:
        forecast_result = generate_supply_chain_forecast(
            shock_node=shock_node,
            decay=decay,
            max_depth=max_depth,
        )

        if not forecast_result:
            target = shock_node or "default candidate"
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{target}' not found in graph.",
            )

        return forecast_result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate supply chain forecast: {str(e)}",
        )


@router.get("/{node_id}")
def get_forecast_by_node_id(
    node_id: str,
    decay: float = Query(default=RIPPLE_DECAY, ge=0.1, le=1.0),
    max_depth: int = Query(default=DEFAULT_MAX_DEPTH, ge=1, le=6),
):
    """
    Generate 30 / 60 / 90-day forecast for a specific node ID or entity name.
    """
    # Exclude reserved path if hit accidentally
    if node_id == "30-60-90":
        return get_forecast_30_60_90(shock_node=None, decay=decay, max_depth=max_depth)

    try:
        forecast_result = generate_supply_chain_forecast(
            shock_node=node_id,
            decay=decay,
            max_depth=max_depth,
        )

        if not forecast_result:
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{node_id}' not found in graph.",
            )

        return forecast_result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate supply chain forecast for '{node_id}': {str(e)}",
        )


@router.post("")
@router.post("/")
def post_forecast(payload: ForecastRequest):
    """
    Generate 30 / 60 / 90-day forecast via POST JSON request.
    """
    target = payload.shock_node or payload.node_id
    try:
        forecast_result = generate_supply_chain_forecast(
            shock_node=target,
            decay=payload.decay or RIPPLE_DECAY,
            max_depth=payload.max_depth or DEFAULT_MAX_DEPTH,
        )

        if not forecast_result:
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{target}' not found in graph.",
            )

        return forecast_result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate supply chain forecast: {str(e)}",
        )
