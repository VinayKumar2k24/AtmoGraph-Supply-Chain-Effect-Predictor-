import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple

import torch

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.models.gnn_model import SupplyChainGNN
from backend.app.services.graph_data import create_graph_data


# ============================================================
# PATH CONFIGURATION
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BACKEND_DIR / "gnn_model.pth"


# ============================================================
# MODEL CONFIGURATION
# ============================================================

INPUT_DIM = 3
HIDDEN_DIM = 32
OUTPUT_DIM = 1


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Safely converts a value to float, handling None and malformed types."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _validate_graph_data(data: Any) -> None:
    """
    Validates graph data structure, node count, feature tensor dimensions,
    edge index validity, and metadata integrity before GNN inference.
    """
    if data is None:
        raise ValueError("Invalid graph data: Graph data object is None.")

    if not hasattr(data, "x") or data.x is None:
        raise ValueError("Invalid graph data: Node feature tensor 'x' is missing.")

    if not isinstance(data.x, torch.Tensor):
        raise TypeError(f"Invalid graph data: Node feature tensor 'x' must be a torch.Tensor, got {type(data.x).__name__}.")

    if data.x.ndim != 2:
        raise ValueError(f"Invalid graph data: Node feature tensor 'x' must be 2-dimensional [nodes, features], got shape {list(data.x.shape)}.")

    num_nodes = data.x.shape[0]
    num_features = data.x.shape[1]

    if num_nodes == 0:
        raise ValueError("Invalid graph data: Graph contains 0 nodes. Inference cannot be performed.")

    if num_features < INPUT_DIM:
        raise ValueError(
            f"Invalid graph data: Node feature tensor has {num_features} features, "
            f"but GNN requires at least {INPUT_DIM} features [risk, disruption, capacity]."
        )

    if not hasattr(data, "edge_index") or data.edge_index is None:
        raise ValueError("Invalid graph data: 'edge_index' tensor is missing.")

    if not isinstance(data.edge_index, torch.Tensor):
        raise TypeError(f"Invalid graph data: 'edge_index' must be a torch.Tensor, got {type(data.edge_index).__name__}.")

    if data.edge_index.numel() > 0:
        if data.edge_index.ndim != 2 or data.edge_index.shape[0] != 2:
            raise ValueError(
                f"Invalid graph data: 'edge_index' must have shape [2, num_edges], got {list(data.edge_index.shape)}."
            )
        max_node_idx = data.edge_index.max().item()
        if max_node_idx >= num_nodes:
            raise ValueError(
                f"Invalid graph data: 'edge_index' contains node index {max_node_idx}, "
                f"which exceeds total node count {num_nodes}."
            )

    if hasattr(data, "node_metadata") and data.node_metadata is not None:
        if len(data.node_metadata) != num_nodes:
            raise ValueError(
                f"Invalid graph data: Node metadata count ({len(data.node_metadata)}) "
                f"does not match node count ({num_nodes})."
            )


# ============================================================
# LOAD TRAINED GNN MODEL
# ============================================================

def load_gnn_model():
    print("\nLoading trained GNN model...")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"GNN model not found at:\n"
            f"{MODEL_PATH}\n\n"
            f"Run train_gnn.py first."
        )

    checkpoint = torch.load(MODEL_PATH, map_location="cpu")

    model = SupplyChainGNN(
        input_dim=INPUT_DIM,
        hidden_dim=HIDDEN_DIM,
        output_dim=OUTPUT_DIM,
    )

    model.load_state_dict(checkpoint)
    model.eval()

    print("GNN MODEL LOADED SUCCESSFULLY")
    print(f"Model path: {MODEL_PATH}")
    print(f"Input dimension: {INPUT_DIM}")
    print(f"Hidden dimension: {HIDDEN_DIM}")
    print(f"Output dimension: {OUTPUT_DIM}")

    return model


# ============================================================
# GLOBAL MODEL
# ============================================================

model = load_gnn_model()


# ============================================================
# RUN GNN ON REAL NEO4J GRAPH
# ============================================================

def _run_gnn_prediction():
    print("\nLoading real supply-chain graph from Neo4j...")

    data = create_graph_data()
    _validate_graph_data(data)

    # --------------------------------------------------------
    # Use ONLY: [risk, disruption, capacity]
    # Delay remains the target; avoid target leakage.
    # --------------------------------------------------------
    x = data.x[:, :INPUT_DIM]

    if x.ndim != 2 or x.shape[1] != INPUT_DIM:
        raise RuntimeError(
            f"GNN expected {INPUT_DIM} features but received shape {list(x.shape)}"
        )

    # --------------------------------------------------------
    # Run GNN prediction strictly under torch.no_grad()
    # --------------------------------------------------------
    model.eval()
    with torch.no_grad():
        predictions = model(x, data.edge_index)

    if predictions.ndim > 1:
        predictions = predictions.squeeze(-1)
    elif predictions.ndim == 0:
        predictions = predictions.unsqueeze(0)

    if predictions.shape[0] != data.num_nodes:
        raise RuntimeError(
            f"GNN produced {predictions.shape[0]} predictions, expected {data.num_nodes}."
        )

    return data, predictions


# ============================================================
# PREDICT SUPPLY-CHAIN DELAY
# ============================================================

def predict_supply_chain_risk() -> List[Dict[str, Any]]:
    """
    Runs the GraphSAGE GNN on the current supply chain network to predict
    downstream disruption delay (in days) for every node.
    """
    data, predictions = _run_gnn_prediction()

    results = []

    for node_index in range(data.num_nodes):
        prediction = float(predictions[node_index].item())

        metadata = (
            data.node_metadata[node_index]
            if (hasattr(data, "node_metadata") and data.node_metadata and node_index < len(data.node_metadata))
            else {}
        )

        if hasattr(data, "y") and data.y is not None and node_index < data.y.shape[0]:
            actual_delay = float(data.y[node_index].item())
        else:
            actual_delay = _safe_float(metadata.get("delay"), 0.0)

        results.append({
            "node_index": node_index,
            "neo4j_id": metadata.get("neo4j_id"),
            "name": metadata.get("name"),
            "labels": metadata.get("labels"),
            "risk": round(_safe_float(metadata.get("risk"), 0.0), 4),
            "disruption": round(_safe_float(metadata.get("disruption"), 0.0), 4),
            "capacity": round(_safe_float(metadata.get("capacity"), 0.0), 4),
            "actual_delay": round(actual_delay, 4),
            "predicted_delay": round(prediction, 4),
        })

    return results


# ============================================================
# CALCULATE GNN EVALUATION METRICS
# ============================================================

def calculate_evaluation_metrics(actual: torch.Tensor, predicted: torch.Tensor) -> Dict[str, float]:
    """
    Calculate regression evaluation metrics:
        MAE  - Mean Absolute Error
        RMSE - Root Mean Squared Error
        R2   - Coefficient of Determination
    """
    if actual.numel() == 0:
        raise RuntimeError("Cannot calculate metrics: no actual target values found.")

    if predicted.numel() == 0:
        raise RuntimeError("Cannot calculate metrics: no predictions found.")

    if actual.shape != predicted.shape:
        raise RuntimeError(
            f"Actual ({list(actual.shape)}) and predicted ({list(predicted.shape)}) tensors must have the same shape."
        )

    # MAE = mean(|actual - predicted|)
    absolute_errors = torch.abs(actual - predicted)
    mae = torch.mean(absolute_errors)

    # RMSE = sqrt(mean((actual - predicted)^2))
    squared_errors = (actual - predicted) ** 2
    mse = torch.mean(squared_errors)
    rmse = torch.sqrt(mse)

    # R² = 1 - SS_res / SS_tot
    actual_mean = torch.mean(actual)
    ss_res = torch.sum((actual - predicted) ** 2)
    ss_tot = torch.sum((actual - actual_mean) ** 2)

    if torch.isclose(ss_tot, torch.tensor(0.0, dtype=ss_tot.dtype)):
        r2 = 0.0
    else:
        r2 = float((1.0 - (ss_res / ss_tot)).item())

    return {
        "mae": round(float(mae.item()), 4),
        "rmse": round(float(rmse.item()), 4),
        "r2": round(r2, 4),
    }


# ============================================================
# EVALUATE GNN MODEL
# ============================================================

def evaluate_gnn_model() -> Dict[str, Any]:
    """
    Dynamically evaluates the trained GNN model against the supply chain graph.

    Returns:
        {
            "mae": float,
            "rmse": float,
            "r2": float,
            "total_nodes": int,
            "predictions": list
        }
    """
    print("\n========================================")
    print("GNN MODEL EVALUATION")
    print("========================================")

    print("\nLoading real supply-chain graph from Neo4j...")
    data = create_graph_data()
    _validate_graph_data(data)

    if not hasattr(data, "y") or data.y is None or data.y.numel() == 0:
        raise RuntimeError("Cannot evaluate GNN model: Target tensor 'y' (actual delays) is missing from graph data.")

    x = data.x[:, :INPUT_DIM]
    if x.shape[1] != INPUT_DIM:
        raise RuntimeError(f"GNN expected {INPUT_DIM} features but received {x.shape[1]}")

    model.eval()
    with torch.no_grad():
        predictions = model(x, data.edge_index)

    if predictions.ndim > 1:
        predictions = predictions.squeeze(-1)
    elif predictions.ndim == 0:
        predictions = predictions.unsqueeze(0)

    actual = data.y.squeeze(-1) if data.y.ndim > 1 else data.y

    metrics = calculate_evaluation_metrics(actual, predictions)
    mae = metrics["mae"]
    rmse = metrics["rmse"]
    r2 = metrics["r2"]

    results = []
    for node_index in range(data.num_nodes):
        metadata = (
            data.node_metadata[node_index]
            if (hasattr(data, "node_metadata") and data.node_metadata and node_index < len(data.node_metadata))
            else {}
        )
        actual_delay = float(actual[node_index].item())
        predicted_delay = float(predictions[node_index].item())

        results.append({
            "node_index": node_index,
            "neo4j_id": metadata.get("neo4j_id"),
            "name": metadata.get("name"),
            "labels": metadata.get("labels"),
            "risk": round(_safe_float(metadata.get("risk"), 0.0), 4),
            "disruption": round(_safe_float(metadata.get("disruption"), 0.0), 4),
            "capacity": round(_safe_float(metadata.get("capacity"), 0.0), 4),
            "actual_delay": round(actual_delay, 4),
            "predicted_delay": round(predicted_delay, 4),
        })

    print("\nEvaluation Metrics:")
    print(f"MAE  : {mae:.4f} days")
    print(f"RMSE : {rmse:.4f} days")
    print(f"R²   : {r2:.4f}")
    print(f"Nodes: {data.num_nodes}")

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "total_nodes": int(data.num_nodes),
        "predictions": results,
    }


if __name__ == "__main__":
    print("=" * 60)
    print("AtmoGraph: GNN Predictor Service & Evaluation Verification")
    print("=" * 60)

    # 1. Prediction Verification
    print("\n[1/2] Running GNN Delay Predictions...")
    predictions = predict_supply_chain_risk()
    print(f"Predictions generated successfully for {len(predictions)} nodes.")
    for p in predictions[:3]:
        print(f" - {p['name']} ({p.get('labels', [''])[0]}): Predicted Delay = {p['predicted_delay']}d (Actual = {p['actual_delay']}d)")

    # 2. Evaluation Verification
    print("\n[2/2] Running GNN Dynamic Evaluation...")
    eval_result = evaluate_gnn_model()
    print(f"\nEvaluation Results Summary:")
    print(f" - Evaluated Nodes : {eval_result['total_nodes']}")
    print(f" - MAE             : {eval_result['mae']} days")
    print(f" - RMSE            : {eval_result['rmse']} days")
    print(f" - R² Score        : {eval_result['r2']}")
    print("\n[GNN PREDICTOR] Verification completed successfully.")