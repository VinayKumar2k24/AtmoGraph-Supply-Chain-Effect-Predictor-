import random

import numpy as np
import torch
import torch.nn.functional as F

from app.models.gnn_model import SupplyChainGNN
from app.services.graph_data import create_graph_data


# ============================================================
# REPRODUCIBILITY
# ============================================================

SEED = 42

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


# ============================================================
# CONFIGURATION
# ============================================================

INPUT_DIM = 3
HIDDEN_DIM = 32
OUTPUT_DIM = 1

LEARNING_RATE = 0.01
EPOCHS = 500


# ============================================================
# LOAD REAL GRAPH FROM NEO4J
# ============================================================

print("\n========================================")
print("SUPPLY CHAIN GNN TRAINING")
print("========================================")

print("\nLoading real supply-chain graph...")

data = create_graph_data()


# ============================================================
# VERIFY GRAPH
# ============================================================

print("\n========================================")
print("GRAPH INFORMATION")
print("========================================")

print(
    f"Number of nodes : {data.num_nodes}"
)

print(
    f"Number of edges : {data.num_edges}"
)

print(
    f"Original feature shape : "
    f"{tuple(data.x.shape)}"
)

print(
    f"Target shape : "
    f"{tuple(data.y.shape)}"
)


# ============================================================
# PREPARE FEATURES
# ============================================================
#
# graph_data.py creates:
#
# [risk, disruption, capacity, delay]
#
# But delay is our TARGET.
#
# Therefore we DO NOT give delay to the model.
#
# Actual GNN input:
#
# [risk, disruption, capacity]
#
# Target:
#
# delay
# ============================================================

x = data.x[:, :3]

y = data.y


print("\n========================================")
print("GNN INPUT")
print("========================================")

print(
    "Feature order:"
)

print(
    "[risk, disruption, capacity]"
)

print(
    f"Input feature shape : "
    f"{tuple(x.shape)}"
)

print(
    f"Target shape        : "
    f"{tuple(y.shape)}"
)


# ============================================================
# VALIDATION
# ============================================================

if x.shape[1] != INPUT_DIM:

    raise RuntimeError(
        f"Expected {INPUT_DIM} input features, "
        f"but received {x.shape[1]}"
    )


if data.num_nodes != y.shape[0]:

    raise RuntimeError(
        "Number of nodes does not match "
        "number of target values."
    )


if data.num_edges == 0:

    raise RuntimeError(
        "Graph contains no edges. "
        "Cannot train GraphSAGE properly."
    )


# ============================================================
# CREATE GNN MODEL
# ============================================================

print("\nCreating GraphSAGE model...")

model = SupplyChainGNN(
    input_dim=INPUT_DIM,
    hidden_dim=HIDDEN_DIM,
    output_dim=OUTPUT_DIM
)


print(model)


# ============================================================
# OPTIMIZER
# ============================================================

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=LEARNING_RATE
)


# ============================================================
# TRAINING
# ============================================================

print("\n========================================")
print("STARTING GNN TRAINING")
print("========================================")

for epoch in range(1, EPOCHS + 1):

    model.train()

    optimizer.zero_grad()

    # --------------------------------------------------------
    # Forward pass
    # --------------------------------------------------------

    prediction = model(
        x,
        data.edge_index
    )

    # --------------------------------------------------------
    # Calculate loss
    # --------------------------------------------------------

    loss = F.mse_loss(
        prediction,
        y
    )

    # --------------------------------------------------------
    # Backpropagation
    # --------------------------------------------------------

    loss.backward()

    optimizer.step()

    # --------------------------------------------------------
    # Print progress
    # --------------------------------------------------------

    if (
        epoch == 1
        or epoch % 50 == 0
        or epoch == EPOCHS
    ):

        print(
            f"Epoch {epoch:03d} | "
            f"Loss: {loss.item():.6f}"
        )


# ============================================================
# FINAL PREDICTIONS
# ============================================================

model.eval()

with torch.no_grad():

    predictions = model(
        x,
        data.edge_index
    )


# ============================================================
# PRINT PREDICTIONS
# ============================================================

print("\n========================================")
print("GNN PREDICTIONS")
print("========================================")

print(
    "\nNode | Actual Delay | Predicted Delay"
)

print(
    "----------------------------------------"
)

for i in range(data.num_nodes):

    actual = float(
        y[i].item()
    )

    predicted = float(
        predictions[i].item()
    )

    print(
        f"{i:4d} | "
        f"{actual:12.2f} | "
        f"{predicted:15.2f}"
    )


# ============================================================
# SAVE MODEL
# ============================================================

from pathlib import Path


BACKEND_DIR = Path(
    __file__
).resolve().parents[2]


MODEL_PATH = (
    BACKEND_DIR / "gnn_model.pth"
)


torch.save(
    model.state_dict(),
    MODEL_PATH
)


print("\n========================================")
print("MODEL SAVED SUCCESSFULLY")
print("========================================")

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

print(
    "\nGNN training completed successfully."
)