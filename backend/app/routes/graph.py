"""
AtmoGraph — Graph API Routes
GET /api/graph         — full supply chain graph (nodes + edges)
GET /api/graph/nodes   — all nodes
GET /api/graph/node/{node_id} — single node detail
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import APIRouter, HTTPException
from backend.app.database.neo4j_db import db

router = APIRouter()

# ─── Node type color map ─────────────────────────────────────────────────────
NODE_COLORS = {
    "Country":      "#38bdf8",
    "Supplier":     "#f59e0b",
    "Manufacturer": "#10b981",
    "Product":      "#818cf8",
    "Port":         "#a855f7",
    "Warehouse":    "#06b6d4",
}

POSITIONS = {
    # Layer 0 — Countries (Top Row: y = 40)
    "IND":    {"x":   80, "y":  40},
    "CHN":    {"x":  360, "y":  40},
    "DEU":    {"x":  640, "y":  40},
    "NLD":    {"x":  920, "y":  40},
    "USA":    {"x": 1200, "y":  40},

    # Layer 1 — Suppliers (y = 200)
    "SUP001": {"x":   80, "y": 200},
    "SUP002": {"x":  360, "y": 200},
    "SUP003": {"x":  640, "y": 200},

    # Layer 2 — Manufacturers (y = 360)
    "MAN003": {"x":   80, "y": 360},
    "MAN002": {"x":  640, "y": 360},
    "MAN001": {"x": 1200, "y": 360},

    # Layer 3 — Products (y = 520)
    "PROD001":{"x":   80, "y": 520},
    "PROD003":{"x":  640, "y": 520},
    "PROD002":{"x": 1200, "y": 520},

    # Layer 4 — Ports (y = 680)
    "PORT005":{"x":   80, "y": 680},
    "PORT002":{"x":  360, "y": 680},
    "PORT004":{"x":  640, "y": 680},
    "PORT001":{"x":  920, "y": 680},
    "PORT003":{"x": 1200, "y": 680},

    # Layer 5 — Warehouses (y = 840)
    "WH002":  {"x":   80, "y": 840},
    "WH001":  {"x": 1200, "y": 840},
}

EDGE_STYLES = {
    "SUPPLIES":      {"stroke": "#f59e0b", "animated": True,  "strokeDasharray": None,  "label": "supplies"},
    "PRODUCES":      {"stroke": "#10b981", "animated": True,  "strokeDasharray": None,  "label": "produces"},
    "PROVIDES":      {"stroke": "#3b82f6", "animated": True,  "strokeDasharray": None,  "label": "provides"},
    "SHIPS_TO":      {"stroke": "#a855f7", "animated": False, "strokeDasharray": "5 3", "label": "ships to"},
    "SHIPS_THROUGH": {"stroke": "#a855f7", "animated": False, "strokeDasharray": "5 3", "label": "ships via"},
    "SERVES":        {"stroke": "#06b6d4", "animated": False, "strokeDasharray": "3 4", "label": "serves"},
    "STORED_AT":     {"stroke": "#818cf8", "animated": False, "strokeDasharray": "4 4", "label": "stored at"},
    "CONNECTED_TO":  {"stroke": "#06b6d4", "animated": False, "strokeDasharray": "3 4", "label": "connected to"},
    "LOCATED_IN":    {"stroke": "#64748b", "animated": False, "strokeDasharray": "2 4", "label": "located in"},
}


def _node_to_rf(node_id: str, labels: list, props: dict) -> dict:
    """Convert a Neo4j node to a React Flow node."""
    type_priority = ["Country", "Supplier", "Manufacturer", "Product", "Port", "Warehouse"]
    node_type = "unknown"
    for t in type_priority:
        if t in labels:
            node_type = t.lower()
            break
    if node_type == "unknown" and labels:
        node_type = labels[0].lower()

    pos = POSITIONS.get(node_id, {"x": 0, "y": 0})
    return {
        "id": node_id,
        "type": "atomoNode",
        "position": pos,
        "data": {
            "nodeType": node_type,
            "id": node_id,
            "name": props.get("name", node_id),
            "labels": labels,
            **{k: v for k, v in props.items() if k not in ("name",)},
        },
    }


@router.get("")
def get_graph():
    """Return all nodes and relationships formatted for React Flow."""
    try:
        # ── Nodes ────────────────────────────────────────────────────────────
        node_query = """
        MATCH (n)
        RETURN
            coalesce(n.id, n.name, elementId(n)) AS id,
            labels(n)  AS labels,
            properties(n) AS props
        ORDER BY n.id
        """
        rf_nodes = []
        with db.session() as session:
            for record in session.run(node_query):
                rf_nodes.append(_node_to_rf(
                    record["id"],
                    record["labels"],
                    record["props"],
                ))

        # ── Edges ────────────────────────────────────────────────────────────
        edge_query = """
        MATCH (a)-[r]->(b)
        RETURN
            coalesce(a.id, a.name, elementId(a)) AS source,
            coalesce(b.id, b.name, elementId(b)) AS target,
            type(r)       AS rel_type,
            properties(r) AS rel_props
        """
        rf_edges = []
        edge_idx = 0
        with db.session() as session:
            for record in session.run(edge_query):
                rel_type = record["rel_type"]
                style = EDGE_STYLES.get(rel_type, {"stroke": "#64748b", "animated": False, "strokeDasharray": None, "label": rel_type})
                rf_edges.append({
                    "id": f"e-{rel_type}-{edge_idx}",
                    "source": record["source"],
                    "target": record["target"],
                    "type": "smoothstep",
                    "animated": style["animated"],
                    "label": style["label"],
                    "labelBgStyle": {"fill": "rgba(13,18,32,0.85)", "rx": 4},
                    "labelStyle": {"fill": "#94a3b8", "fontSize": 10},
                    "style": {
                        "stroke": style["stroke"],
                        "strokeWidth": 1.5,
                        "strokeDasharray": style["strokeDasharray"],
                    },
                    "data": {"relType": rel_type},
                    "hidden": False,
                })
                edge_idx += 1

        return {"nodes": rf_nodes, "edges": rf_edges}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/node/{node_id}")
def get_node(node_id: str):
    """Return detailed info for a single node."""
    try:
        query = """
        MATCH (n {id: $node_id})
        OPTIONAL MATCH (n)-[r]-(m)
        RETURN
            n.id AS id,
            labels(n) AS labels,
            properties(n) AS props,
            collect({
                rel_type: type(r),
                direction: CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END,
                other_id: m.id,
                other_name: m.name,
                other_labels: labels(m)
            }) AS connections
        """
        with db.session() as session:
            result = session.run(query, {"node_id": node_id})
            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
            return {
                "id": record["id"],
                "labels": record["labels"],
                "props": record["props"],
                "connections": record["connections"],
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
