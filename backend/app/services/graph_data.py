from pathlib import Path
import os

from dotenv import load_dotenv
from neo4j import GraphDatabase
import torch
from torch_geometric.data import Data


# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


# ============================================================
# CHECK NEO4J CONFIGURATION
# ============================================================

if not NEO4J_URI:
    raise RuntimeError(
        f"NEO4J_URI is not configured. "
        f"Expected .env at: {ENV_FILE}"
    )

if not NEO4J_USERNAME:
    raise RuntimeError(
        f"NEO4J_USERNAME is not configured. "
        f"Expected .env at: {ENV_FILE}"
    )

if not NEO4J_PASSWORD:
    raise RuntimeError(
        f"NEO4J_PASSWORD is not configured. "
        f"Expected .env at: {ENV_FILE}"
    )

# ============================================================
# NEO4J CONFIGURATION
# ============================================================

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


def check_neo4j_config():

    if not NEO4J_URI:
        raise RuntimeError(
            "NEO4J_URI is not configured. "
            "Set it in your .env file."
        )

    if not NEO4J_USERNAME:
        raise RuntimeError(
            "NEO4J_USERNAME is not configured. "
            "Set it in your .env file."
        )

    if not NEO4J_PASSWORD:
        raise RuntimeError(
            "NEO4J_PASSWORD is not configured. "
            "Set it in your .env file."
        )


# ============================================================
# CONNECT TO NEO4J
# ============================================================

def create_driver():

    check_neo4j_config()

    return GraphDatabase.driver(
        NEO4J_URI,
        auth=(
            NEO4J_USERNAME,
            NEO4J_PASSWORD
        )
    )


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def safe_float(value, default=0.0):

    if value is None:
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def calculate_disruption(properties):

    """
    Convert Neo4j status information into
    a numerical disruption value.

    0.0 = normal
    0.5 = at risk
    1.0 = disrupted
    """

    status = str(
        properties.get("status", "")
    ).upper()

    if status == "DISRUPTED":
        return 1.0

    if status in [
        "AT_RISK",
        "AT RISK",
        "RISK"
    ]:
        return 0.5

    if status in [
        "DELAYED",
        "DISRUPTION"
    ]:
        return 0.75

    return safe_float(
        properties.get("disruption"),
        0.0
    )


def calculate_capacity(properties):

    """
    Read capacity if it exists.

    If Neo4j does not contain capacity yet,
    return 0.0 rather than inventing a value.
    """

    return safe_float(
        properties.get("capacity"),
        0.0
    )


def calculate_delay(properties):

    """
    Read actual delay from Neo4j.

    This is the target used by the GNN.
    """

    return safe_float(
        properties.get("delay"),
        0.0
    )


# ============================================================
# LOAD GRAPH FROM NEO4J
# ============================================================

def load_supply_chain_graph():

    print("\nLoading supply-chain graph from Neo4j...")

    driver = create_driver()

    nodes = []
    relationships = []

    try:

        with driver.session() as session:

            # ------------------------------------------------
            # LOAD NODES
            # ------------------------------------------------

            node_result = session.run(
                """
                MATCH (n)
                RETURN elementId(n) AS neo4j_id,
                       labels(n) AS labels,
                       properties(n) AS properties
                ORDER BY elementId(n)
                """
            )

            for record in node_result:

                nodes.append(
                    {
                        "neo4j_id": record["neo4j_id"],
                        "labels": record["labels"],
                        "properties": record["properties"]
                    }
                )

            # ------------------------------------------------
            # LOAD RELATIONSHIPS
            # ------------------------------------------------

            relationship_result = session.run(
                """
                MATCH (a)-[r]->(b)
                RETURN elementId(a) AS source,
                       elementId(b) AS target,
                       type(r) AS relationship_type
                """
            )

            for record in relationship_result:

                relationships.append(
                    {
                        "source": record["source"],
                        "target": record["target"],
                        "type": record["relationship_type"]
                    }
                )

    finally:

        driver.close()

    print(
        f"Neo4j nodes found: {len(nodes)}"
    )

    print(
        f"Neo4j relationships found: "
        f"{len(relationships)}"
    )

    return nodes, relationships


# ============================================================
# CONVERT NEO4J GRAPH → PYTORCH GEOMETRIC
# ============================================================

def create_graph_data():

    nodes, relationships = load_supply_chain_graph()

    if not nodes:

        raise RuntimeError(
            "No nodes found in Neo4j."
        )

    # --------------------------------------------------------
    # CREATE NODE ID → PYTORCH INDEX MAPPING
    # --------------------------------------------------------

    node_index = {}

    for index, node in enumerate(nodes):

        node_index[
            node["neo4j_id"]
        ] = index

    # --------------------------------------------------------
    # NODE FEATURES
    #
    # [risk, disruption, capacity, delay]
    # --------------------------------------------------------

    feature_list = []

    target_list = []

    node_metadata = []

    for index, node in enumerate(nodes):

        properties = node["properties"]
        labels = node["labels"]

        # -----------------------------------------------
        # RISK
        # -----------------------------------------------

        risk = safe_float(
            properties.get("risk"),
            0.0
        )

        # -----------------------------------------------
        # DISRUPTION
        # -----------------------------------------------

        disruption = calculate_disruption(
            properties
        )

        # -----------------------------------------------
        # CAPACITY
        # -----------------------------------------------

        capacity = calculate_capacity(
            properties
        )

        # -----------------------------------------------
        # DELAY
        # -----------------------------------------------

        delay = calculate_delay(
            properties
        )

        # -----------------------------------------------
        # FEATURES
        # -----------------------------------------------

        features = [
            risk,
            disruption,
            capacity,
            delay
        ]

        feature_list.append(
            features
        )

        # -----------------------------------------------
        # TARGET
        #
        # Currently using delay as target.
        # This requires Neo4j delay properties.
        # -----------------------------------------------

        target_list.append(
            [delay]
        )

        # -----------------------------------------------
        # METADATA
        # -----------------------------------------------

        node_metadata.append(
            {
                "index": index,
                "neo4j_id": node["neo4j_id"],
                "labels": labels,
                "name": properties.get(
                    "name",
                    f"Node {index}"
                ),
                "id": properties.get(
                    "id",
                    None
                ),
                "risk": risk,
                "disruption": disruption,
                "capacity": capacity,
                "delay": delay
            }
        )

    # --------------------------------------------------------
    # CREATE EDGE INDEX
    # --------------------------------------------------------

    edge_list = []

    for relationship in relationships:

        source = relationship["source"]
        target = relationship["target"]

        if (
            source not in node_index
            or target not in node_index
        ):
            continue

        source_index = node_index[source]
        target_index = node_index[target]

        # Original direction
        edge_list.append(
            [
                source_index,
                target_index
            ]
        )

        # Reverse direction
        edge_list.append(
            [
                target_index,
                source_index
            ]
        )

    # --------------------------------------------------------
    # CONVERT TO TENSORS
    # --------------------------------------------------------

    x = torch.tensor(
        feature_list,
        dtype=torch.float32
    )

    y = torch.tensor(
        target_list,
        dtype=torch.float32
    )

    if edge_list:

        edge_index = torch.tensor(
            edge_list,
            dtype=torch.long
        ).t().contiguous()

    else:

        edge_index = torch.empty(
            (2, 0),
            dtype=torch.long
        )

    # --------------------------------------------------------
    # CREATE PYTORCH GEOMETRIC DATA
    # --------------------------------------------------------

    data = Data(
        x=x,
        edge_index=edge_index,
        y=y
    )

    # Store metadata separately
    data.node_metadata = node_metadata

    # --------------------------------------------------------
    # PRINT INFORMATION
    # --------------------------------------------------------

    print("\n====================================")
    print("GRAPH DATA CREATED SUCCESSFULLY")
    print("====================================")

    print(
        f"Number of nodes : "
        f"{data.num_nodes}"
    )

    print(
        f"Number of edges : "
        f"{data.num_edges}"
    )

    print(
        f"Feature shape   : "
        f"{tuple(data.x.shape)}"
    )

    print(
        f"Target shape    : "
        f"{tuple(data.y.shape)}"
    )

    print(
        f"Input dimension : "
        f"{data.x.shape[1]}"
    )

    print(
        "Feature order:"
    )

    print(
        "[risk, disruption, capacity, delay]"
    )

    print("====================================")

    return data


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    print(
        "Testing Neo4j → PyTorch Geometric pipeline..."
    )

    try:

        data = create_graph_data()

        print("\nGraph Data:")
        print(data)

        print("\nNode features:")
        print(data.x)

        print("\nEdge index:")
        print(data.edge_index)

        print("\nTargets:")
        print(data.y)

        print(
            "\nNeo4j graph successfully converted "
            "to PyTorch Geometric format."
        )

    except Exception as e:

        print(
            "\nERROR while creating graph data:"
        )

        print(e)