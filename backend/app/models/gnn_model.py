import torch
import torch.nn as nn
import torch.nn.functional as F

from torch_geometric.nn import SAGEConv


class SupplyChainGNN(nn.Module):
    def __init__(self, input_dim, hidden_dim=32, output_dim=1):
        super().__init__()

        # GraphSAGE layers
        self.conv1 = SAGEConv(input_dim, hidden_dim)
        self.conv2 = SAGEConv(hidden_dim, hidden_dim)

        # Final prediction layer
        self.predictor = nn.Linear(hidden_dim, output_dim)

    def forward(self, x, edge_index):
        # First GraphSAGE layer
        x = self.conv1(x, edge_index)
        x = F.relu(x)

        # Second GraphSAGE layer
        x = self.conv2(x, edge_index)
        x = F.relu(x)

        # Predict risk / value for each node
        out = self.predictor(x)

        return out