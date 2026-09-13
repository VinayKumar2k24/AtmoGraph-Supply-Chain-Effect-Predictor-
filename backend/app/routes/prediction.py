"""
AtmoGraph — GNN Prediction API Routes

Endpoints:
GET /api/prediction/predictions
GET /api/prediction/evaluation
"""

from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from backend.app.services.gnn_predictor import (
    predict_supply_chain_risk,
    evaluate_gnn_model,
)

router = APIRouter()

MODEL_TYPE: str = "GraphSAGE GNN"
PREDICTION_TARGET: str = "delay_days"
TARGET_UNIT: str = "days"
TARGET_METRIC: str = "predicted_delay"


def _get_current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# GET GNN PREDICTIONS
# ============================================================

@router.get("/predictions")
def get_gnn_predictions():
    """
    Generate GNN predictions for all supply-chain nodes.

    Returns:
        - success
        - model_type
        - prediction_target
        - target_unit
        - timestamp
        - total_nodes
        - metadata
        - predictions
    """
    try:
        timestamp_iso = _get_current_timestamp()
        results = predict_supply_chain_risk()

        return {
            "success": True,
            "model_type": MODEL_TYPE,
            "prediction_target": PREDICTION_TARGET,
            "target_metric": TARGET_METRIC,
            "target_unit": TARGET_UNIT,
            "timestamp": timestamp_iso,
            "total_nodes": len(results),
            "metadata": {
                "model_type": MODEL_TYPE,
                "prediction_target": PREDICTION_TARGET,
                "target_metric": TARGET_METRIC,
                "target_unit": TARGET_UNIT,
                "node_count": len(results),
                "generated_at": timestamp_iso,
            },
            "predictions": results,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"GNN prediction failed: {str(e)}",
        )


# ============================================================
# GET GNN EVALUATION
# ============================================================

@router.get("/evaluation")
def get_gnn_evaluation():
    """
    Dynamically evaluate the trained GraphSAGE GNN model.

    Returns:
        - success
        - model_type
        - prediction_target
        - target_unit
        - timestamp
        - metrics (MAE, RMSE, R²)
        - total_nodes
        - metadata
        - predictions
    """
    try:
        timestamp_iso = _get_current_timestamp()

        # ----------------------------------------------------
        # Run dynamic GNN evaluation
        # ----------------------------------------------------
        evaluation = evaluate_gnn_model()

        # ----------------------------------------------------
        # Get metrics
        # ----------------------------------------------------
        metrics = evaluation.get("metrics", {})

        mae = metrics.get(
            "mae",
            metrics.get("MAE")
        )

        rmse = metrics.get(
            "rmse",
            metrics.get("RMSE")
        )

        r2 = metrics.get(
            "r2",
            metrics.get("R2")
        )

        # ----------------------------------------------------
        # Fallback:
        # Support evaluation results where metrics are returned
        # directly at the top level.
        # ----------------------------------------------------
        if mae is None:
            mae = evaluation.get(
                "mae",
                evaluation.get("MAE")
            )

        if rmse is None:
            rmse = evaluation.get(
                "rmse",
                evaluation.get("RMSE")
            )

        if r2 is None:
            r2 = evaluation.get(
                "r2",
                evaluation.get("R2")
            )

        # ----------------------------------------------------
        # Get total nodes
        # ----------------------------------------------------
        predictions = evaluation.get(
            "predictions",
            []
        )

        total_nodes = evaluation.get(
            "total_nodes",
            evaluation.get(
                "nodes",
                len(predictions)
            )
        )

        # ----------------------------------------------------
        # Validate metrics
        # ----------------------------------------------------
        if mae is None:
            raise ValueError(
                "MAE metric was not returned by evaluate_gnn_model()"
            )

        if rmse is None:
            raise ValueError(
                "RMSE metric was not returned by evaluate_gnn_model()"
            )

        if r2 is None:
            raise ValueError(
                "R2 metric was not returned by evaluate_gnn_model()"
            )

        mae_val = round(float(mae), 4)
        rmse_val = round(float(rmse), 4)
        r2_val = round(float(r2), 4)
        node_cnt = int(total_nodes)

        # ----------------------------------------------------
        # Return clean API response with enriched metadata
        # ----------------------------------------------------
        return {
            "success": True,
            "model_type": MODEL_TYPE,
            "prediction_target": PREDICTION_TARGET,
            "target_metric": TARGET_METRIC,
            "target_unit": TARGET_UNIT,
            "timestamp": timestamp_iso,
            "metrics": {
                "mae": mae_val,
                "rmse": rmse_val,
                "r2": r2_val,
            },
            "total_nodes": node_cnt,
            "metadata": {
                "model_type": MODEL_TYPE,
                "prediction_target": PREDICTION_TARGET,
                "target_metric": TARGET_METRIC,
                "target_unit": TARGET_UNIT,
                "node_count": node_cnt,
                "generated_at": timestamp_iso,
                "metrics_summary": f"MAE: {mae_val}d, RMSE: {rmse_val}d, R²: {r2_val}",
            },
            "predictions": predictions,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"GNN evaluation failed: {str(e)}",
        )