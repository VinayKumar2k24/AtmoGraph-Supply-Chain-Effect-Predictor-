from pathlib import Path

import torch

from backend.app.models.gnn_model import SupplyChainGNN
from backend.app.services.graph_data import create_graph_data


# ============================================================
# PATH CONFIGURATION
# ============================================================

BACKEND_DIR = Path(
    __file__
).resolve().parents[2]


MODEL_PATH = (
    BACKEND_DIR / "gnn_model.pth"
)


# ============================================================
# MODEL CONFIGURATION
# ============================================================

INPUT_DIM = 3
HIDDEN_DIM = 32
OUTPUT_DIM = 1


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

    # --------------------------------------------------------
    # Load trained weights
    # --------------------------------------------------------

    checkpoint = torch.load(
        MODEL_PATH,
        map_location="cpu"
    )

    # --------------------------------------------------------
    # Create model
    # --------------------------------------------------------

    model = SupplyChainGNN(
        input_dim=INPUT_DIM,
        hidden_dim=HIDDEN_DIM,
        output_dim=OUTPUT_DIM
    )

    # --------------------------------------------------------
    # Load weights
    # --------------------------------------------------------

    model.load_state_dict(
        checkpoint
    )

    # --------------------------------------------------------
    # Evaluation mode
    # --------------------------------------------------------

    model.eval()

    print(
        "GNN MODEL LOADED SUCCESSFULLY"
    )

    print(
        f"Model path: {MODEL_PATH}"
    )

    print(
        f"Input dimension: {INPUT_DIM}"
    )

    print(
        f"Hidden dimension: {HIDDEN_DIM}"
    )

    print(
        f"Output dimension: {OUTPUT_DIM}"
    )

    return model


# ============================================================
# GLOBAL MODEL
# ============================================================

model = load_gnn_model()


# ============================================================
# RUN GNN ON REAL NEO4J GRAPH
# ============================================================

def _run_gnn_prediction():

    print(
        "\nLoading real supply-chain graph "
        "from Neo4j..."
    )

    # --------------------------------------------------------
    # Load actual Neo4j graph
    # --------------------------------------------------------

    data = create_graph_data()

    # --------------------------------------------------------
    # Use ONLY:
    #
    # [risk, disruption, capacity]
    #
    # Delay remains the target.
    #
    # This avoids target leakage because actual delay
    # is NOT supplied to the GNN as an input feature.
    # --------------------------------------------------------

    x = data.x[:, :3]

    # --------------------------------------------------------
    # Validate feature dimension
    # --------------------------------------------------------

    if x.shape[1] != INPUT_DIM:

        raise RuntimeError(
            f"GNN expected {INPUT_DIM} features "
            f"but received {x.shape[1]}"
        )

    # --------------------------------------------------------
    # Run GNN prediction
    # --------------------------------------------------------

    with torch.no_grad():

        predictions = model(
            x,
            data.edge_index
        )

    predictions = predictions.squeeze(-1)

    return data, predictions


# ============================================================
# PREDICT SUPPLY-CHAIN DELAY
# ============================================================

def predict_supply_chain_risk():

    # --------------------------------------------------------
    # Run GNN
    # --------------------------------------------------------

    data, predictions = _run_gnn_prediction()

    # --------------------------------------------------------
    # Prepare results
    # --------------------------------------------------------

    results = []

    for node_index in range(
        data.num_nodes
    ):

        prediction = float(
            predictions[
                node_index
            ].item()
        )

        # ----------------------------------------------------
        # Get metadata
        # ----------------------------------------------------

        metadata = data.node_metadata[
            node_index
        ]

        # ----------------------------------------------------
        # Actual delay
        # ----------------------------------------------------

        actual_delay = float(
            data.y[
                node_index
            ].item()
        )

        # ----------------------------------------------------
        # Result
        # ----------------------------------------------------

        results.append(
            {
                "node_index": node_index,

                "neo4j_id":
                    metadata.get(
                        "neo4j_id"
                    ),

                "name":
                    metadata.get(
                        "name"
                    ),

                "labels":
                    metadata.get(
                        "labels"
                    ),

                "risk":
                    round(
                        float(
                            metadata.get(
                                "risk",
                                0.0
                            )
                        ),
                        4
                    ),

                "disruption":
                    round(
                        float(
                            metadata.get(
                                "disruption",
                                0.0
                            )
                        ),
                        4
                    ),

                "capacity":
                    round(
                        float(
                            metadata.get(
                                "capacity",
                                0.0
                            )
                        ),
                        4
                    ),

                "actual_delay":
                    round(
                        actual_delay,
                        4
                    ),

                "predicted_delay":
                    round(
                        prediction,
                        4
                    )
            }
        )

    return results


# ============================================================
# CALCULATE GNN EVALUATION METRICS
# ============================================================

def calculate_evaluation_metrics(
    actual,
    predicted
):
    """
    Calculate regression evaluation metrics.

    Metrics:
        MAE  - Mean Absolute Error
        RMSE - Root Mean Squared Error
        R2   - Coefficient of Determination
    """

    # --------------------------------------------------------
    # Safety checks
    # --------------------------------------------------------

    if actual.numel() == 0:

        raise RuntimeError(
            "Cannot calculate metrics: "
            "no actual target values found."
        )

    if predicted.numel() == 0:

        raise RuntimeError(
            "Cannot calculate metrics: "
            "no predictions found."
        )

    if actual.shape != predicted.shape:

        raise RuntimeError(
            "Actual and predicted tensors "
            "must have the same shape."
        )

    # --------------------------------------------------------
    # MAE
    #
    # MAE = mean(|actual - predicted|)
    # --------------------------------------------------------

    absolute_errors = torch.abs(
        actual - predicted
    )

    mae = torch.mean(
        absolute_errors
    )

    # --------------------------------------------------------
    # RMSE
    #
    # RMSE = sqrt(mean((actual - predicted)^2))
    # --------------------------------------------------------

    squared_errors = (
        actual - predicted
    ) ** 2

    mse = torch.mean(
        squared_errors
    )

    rmse = torch.sqrt(
        mse
    )

    # --------------------------------------------------------
    # R²
    #
    # R² = 1 - SS_res / SS_tot
    #
    # SS_res = sum((actual - predicted)^2)
    # SS_tot = sum((actual - mean(actual))^2)
    # --------------------------------------------------------

    actual_mean = torch.mean(
        actual
    )

    ss_res = torch.sum(
        (actual - predicted) ** 2
    )

    ss_tot = torch.sum(
        (actual - actual_mean) ** 2
    )

    # --------------------------------------------------------
    # Handle the rare case where all actual values are equal.
    # --------------------------------------------------------

    if torch.isclose(
        ss_tot,
        torch.tensor(
            0.0,
            dtype=ss_tot.dtype
        )
    ):

        r2 = 0.0

    else:

        r2 = (
            1.0 -
            (ss_res / ss_tot)
        )

    # --------------------------------------------------------
    # Return normal Python floats
    # --------------------------------------------------------

    return {
        "mae": round(
            float(mae.item()),
            4
        ),

        "rmse": round(
            float(rmse.item()),
            4
        ),

        "r2": round(
            float(r2.item()),
            4
        )
    }


# ============================================================
# EVALUATE GNN MODEL
# ============================================================

def evaluate_gnn_model():
    """
    Dynamically evaluate the trained GNN model.

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

    # --------------------------------------------------------
    # GNN uses only the first 3 features
    # [risk, disruption, capacity]
    #
    # Delay is the target, so it is NOT used as an input.
    # --------------------------------------------------------

    x = data.x[:, :3]

    if x.shape[1] != INPUT_DIM:
        raise RuntimeError(
            f"GNN expected {INPUT_DIM} features "
            f"but received {x.shape[1]}"
        )

    # --------------------------------------------------------
    # Generate predictions
    # --------------------------------------------------------

    model.eval()

    with torch.no_grad():
        predictions = model(
            x,
            data.edge_index
        )

    predictions = predictions.squeeze(-1)

    # --------------------------------------------------------
    # Actual target values
    # --------------------------------------------------------

    actual = data.y.squeeze(-1)

    # --------------------------------------------------------
    # Calculate MAE
    # --------------------------------------------------------

    absolute_errors = torch.abs(
        predictions - actual
    )

    mae = torch.mean(
        absolute_errors
    ).item()

    # --------------------------------------------------------
    # Calculate RMSE
    # --------------------------------------------------------

    squared_errors = (
        predictions - actual
    ) ** 2

    mse = torch.mean(
        squared_errors
    ).item()

    rmse = mse ** 0.5

    # --------------------------------------------------------
    # Calculate R²
    # --------------------------------------------------------

    ss_res = torch.sum(
        (actual - predictions) ** 2
    ).item()

    actual_mean = torch.mean(actual)

    ss_tot = torch.sum(
        (actual - actual_mean) ** 2
    ).item()

    if ss_tot == 0:
        r2 = 0.0
    else:
        r2 = 1.0 - (
            ss_res / ss_tot
        )

    # --------------------------------------------------------
    # Node-level prediction results
    # --------------------------------------------------------

    results = []

    for node_index in range(data.num_nodes):

        metadata = data.node_metadata[node_index]

        actual_delay = float(
            actual[node_index].item()
        )

        predicted_delay = float(
            predictions[node_index].item()
        )

        results.append({
            "node_index": node_index,

            "neo4j_id": metadata.get(
                "neo4j_id"
            ),

            "name": metadata.get(
                "name"
            ),

            "labels": metadata.get(
                "labels"
            ),

            "risk": round(
                float(
                    metadata.get(
                        "risk",
                        0.0
                    )
                ),
                4
            ),

            "disruption": round(
                float(
                    metadata.get(
                        "disruption",
                        0.0
                    )
                ),
                4
            ),

            "capacity": round(
                float(
                    metadata.get(
                        "capacity",
                        0.0
                    )
                ),
                4
            ),

            "actual_delay": round(
                actual_delay,
                4
            ),

            "predicted_delay": round(
                predicted_delay,
                4
            )
        })

    # --------------------------------------------------------
    # Display evaluation metrics
    # --------------------------------------------------------

    print("\nEvaluation Metrics:")
    print(
        f"MAE  : {mae:.4f} days"
    )
    print(
        f"RMSE : {rmse:.4f} days"
    )
    print(
        f"R²   : {r2:.4f}"
    )
    print(
        f"Nodes: {data.num_nodes}"
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # RETURN metrics so FastAPI can access them.
    # --------------------------------------------------------

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "total_nodes": int(data.num_nodes),
        "predictions": results
    }