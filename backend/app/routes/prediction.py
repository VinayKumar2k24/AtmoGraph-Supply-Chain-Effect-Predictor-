"""
AtmoGraph — GNN Prediction API Routes

Endpoints:
GET /api/prediction/predictions
GET /api/prediction/evaluation
"""

from fastapi import APIRouter, HTTPException

from backend.app.services.gnn_predictor import (
    predict_supply_chain_risk,
    evaluate_gnn_model,
)


router = APIRouter()


# ============================================================
# GET GNN PREDICTIONS
# ============================================================

@router.get("/predictions")
def get_gnn_predictions():
    """
    Generate GNN predictions for all supply-chain nodes.

    Returns:
        - success
        - total_nodes
        - node-level predictions
    """

    try:
        results = predict_supply_chain_risk()

        return {
            "success": True,
            "total_nodes": len(results),
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
        - MAE
        - RMSE
        - R²
        - total evaluated nodes
        - actual vs predicted delay for every node
    """

    try:

        # ----------------------------------------------------
        # Run dynamic GNN evaluation
        # ----------------------------------------------------

        evaluation = evaluate_gnn_model()

        # ----------------------------------------------------
        # Get metrics
        #
        # Current evaluate_gnn_model() structure:
        #
        # {
        #     "metrics": {
        #         "mae": ...,
        #         "rmse": ...,
        #         "r2": ...
        #     },
        #     "total_nodes": ...,
        #     "predictions": [...]
        # }
        #
        # The fallback logic also supports older structures.
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

        # ----------------------------------------------------
        # Return clean API response
        # ----------------------------------------------------

        return {
            "success": True,

            "metrics": {
                "mae": round(float(mae), 4),
                "rmse": round(float(rmse), 4),
                "r2": round(float(r2), 4),
            },

            "total_nodes": int(total_nodes),

            "predictions": predictions,
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"GNN evaluation failed: {str(e)}",
        )