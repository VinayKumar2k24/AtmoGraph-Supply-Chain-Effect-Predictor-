"""
AtmoGraph — GNN Prediction API Routes

Endpoints:
GET /api/prediction/predictions
GET /api/prediction/evaluation
"""

from fastapi import APIRouter, HTTPException

from backend.app.services.gnn_predictor import (
    predict_supply_chain_risk,
    evaluate_gnn_model
)


router = APIRouter()


# ============================================================
# GET GNN PREDICTIONS
# ============================================================

@router.get("/predictions")
def get_gnn_predictions():
    """
    Generate GNN predictions for all supply-chain nodes.
    """

    try:

        results = predict_supply_chain_risk()

        return {
            "success": True,
            "total_nodes": len(results),
            "predictions": results
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# GET GNN EVALUATION
# ============================================================

@router.get("/evaluation")
def get_gnn_evaluation():
    """
    Evaluate the trained GNN model dynamically.

    Returns:
        - MAE
        - RMSE
        - R²
        - total nodes
        - node-level actual vs predicted delays
    """

    try:

        evaluation = evaluate_gnn_model()

        # ----------------------------------------------------
        # Normalize metric names
        # Supports either lowercase or uppercase keys
        # returned by gnn_predictor.py
        # ----------------------------------------------------

        mae = evaluation.get(
            "mae",
            evaluation.get("MAE")
        )

        rmse = evaluation.get(
            "rmse",
            evaluation.get("RMSE")
        )

        r2 = evaluation.get(
            "r2",
            evaluation.get("R2")
        )

        total_nodes = evaluation.get(
            "total_nodes",
            evaluation.get(
                "nodes",
                len(evaluation.get("predictions", []))
            )
        )

        predictions = evaluation.get(
            "predictions",
            []
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

        # ----------------------------------------------------
        # API RESPONSE
        # ----------------------------------------------------

        return {
            "success": True,

            "metrics": {
                "mae": round(float(mae), 4),
                "rmse": round(float(rmse), 4),
                "r2": round(float(r2), 4)
            },

            "total_nodes": int(total_nodes),

            "predictions": predictions
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )