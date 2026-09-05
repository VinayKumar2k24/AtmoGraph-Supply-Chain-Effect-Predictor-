"""
AtmoGraph — Supply Chain Ripple Effect Propagation Service
Week 3: Graph Traversal, Exponential Decay, and Path Explainability

Traverses downstream Neo4j dependencies from any disrupted entity,
calculates hop-by-hop ripple propagation scores using exponential decay,
and enriches each affected entity with GNN delay predictions and path descriptions.
"""

import time
from typing import Dict, List, Optional, Any, Tuple
from backend.app.services.graph_data import load_supply_chain_graph
from backend.app.services.gnn_predictor import predict_supply_chain_risk

# ============================================================
# PROPAGATION CONFIGURATION & CACHE
# ============================================================

RIPPLE_DECAY: float = 0.70  # 70% retention per hop
DEFAULT_MAX_DEPTH: int = 4   # Maximum graph propagation horizon

_CACHE_DATA: Optional[Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, Any], Dict[str, str]]] = None
_CACHE_TIMESTAMP: float = 0.0
_CACHE_TTL_SECONDS: float = 60.0  # 60-second in-memory cache to avoid repeated Neo4j queries and model loads


def invalidate_ripple_cache() -> None:
    """Explicitly invalidates the graph & GNN prediction cache."""
    global _CACHE_DATA, _CACHE_TIMESTAMP
    _CACHE_DATA = None
    _CACHE_TIMESTAMP = 0.0


def _build_graph_cache(force_refresh: bool = False):
    """
    Loads nodes, relationships, and GNN predictions from Neo4j with caching.
    Prevents redundant Neo4j queries and duplicate GNN model loading.
    Returns:
        node_map: dict[neo4j_id -> node_dict]
        rels: list of relationship dicts
        pred_map: dict[neo4j_id -> prediction_dict]
        lookup_map: dict[key -> neo4j_id] supporting elementId, code (P003), and name
    """
    global _CACHE_DATA, _CACHE_TIMESTAMP
    now = time.time()

    if not force_refresh and _CACHE_DATA is not None and (now - _CACHE_TIMESTAMP) < _CACHE_TTL_SECONDS:
        return _CACHE_DATA

    nodes, rels = load_supply_chain_graph()
    node_map: Dict[str, Dict[str, Any]] = {n["neo4j_id"]: n for n in nodes}

    # Fetch GNN predictions for delay enrichment (reuses existing GNN model)
    try:
        predictions = predict_supply_chain_risk()
        pred_map = {p["neo4j_id"]: p for p in predictions}
    except Exception as err:
        print(f"[RippleEffect] Warning: could not load GNN predictions: {err}")
        pred_map = {}

    lookup_map: Dict[str, str] = {}
    for n in nodes:
        nid = n["neo4j_id"]
        lookup_map[nid.lower()] = nid
        props = n.get("properties", {})
        if props.get("id"):
            lookup_map[str(props["id"]).lower()] = nid
        if props.get("name"):
            lookup_map[str(props["name"]).lower()] = nid

    _CACHE_DATA = (node_map, rels, pred_map, lookup_map)
    _CACHE_TIMESTAMP = now
    return _CACHE_DATA


def get_ripple_candidate_nodes() -> List[Dict[str, Any]]:
    """
    Returns all supply chain nodes available for ripple simulation,
    sorted by disruption descending, then risk descending.
    """
    node_map, _, pred_map, _ = _build_graph_cache()
    candidates = []

    for nid, node in node_map.items():
        props = node.get("properties", {})
        labels = node.get("labels", [])
        entity_type = labels[0] if labels else "Unknown"
        pred = pred_map.get(nid, {})

        status = str(props.get("status", "")).upper()
        disruption = (
            1.0 if status == "DISRUPTED"
            else (0.75 if "DELAY" in status
                  else (0.5 if "RISK" in status
                        else float(props.get("disruption", pred.get("disruption", 0.0)))))
        )
        risk = float(props.get("risk", pred.get("risk", 0.0)))
        predicted_delay = float(pred.get("predicted_delay", props.get("delay", 0.0)))

        candidates.append({
            "neo4j_id": nid,
            "id": props.get("id"),
            "name": props.get("name", props.get("id", "Unknown")),
            "entity_type": entity_type,
            "status": status or "NORMAL",
            "risk": round(risk, 4),
            "disruption": round(disruption, 4),
            "predicted_delay": round(predicted_delay, 2),
        })

    # Sort candidates so most disrupted/risky entities appear first
    candidates.sort(key=lambda x: (-x["disruption"], -x["risk"], x["name"]))
    return candidates


def _get_downstream_neighbors(
    node_id: str,
    node_map: Dict[str, Any],
    rels: List[Dict[str, Any]],
) -> List[tuple]:
    """
    Identifies valid downstream propagation connections.
    Strictly follows original directed Neo4j relationships: (node_id)-[r]->(target).
    Never traverses reverse edges or treats incoming relationships as downstream.
    Directional semantics:
      - Supplier: SUPPLIES -> Manufacturer, PROVIDES -> Product
      - Manufacturer: PRODUCES -> Product, SHIPS_TO -> Warehouse
      - Port: SERVES -> Warehouse
      - Product: STORED_AT -> Warehouse
    """
    downstream = []
    curr_node = node_map.get(node_id)
    if not curr_node:
        return downstream

    VALID_SUPPLY_CHAIN_RELS = {
        "SUPPLIES",
        "PRODUCES",
        "PROVIDES",
        "SHIPS_TO",
        "SERVES",
        "STORED_AT",
    }

    for r in rels:
        # Strictly real directed outgoing supply chain edges: (node_id)-[r]->(target)
        if r["source"] == node_id and r["type"] in VALID_SUPPLY_CHAIN_RELS:
            downstream.append((r["target"], r["type"]))

    return downstream


def calculate_ripple_propagation(
    source_identifier: str,
    decay: float = RIPPLE_DECAY,
    max_depth: int = DEFAULT_MAX_DEPTH,
) -> Optional[Dict[str, Any]]:
    """
    Executes ripple propagation from a source node across the real Neo4j graph.

    Args:
        source_identifier: Neo4j elementId, short code (e.g. 'P003', 'S001'), or entity name ('Rotterdam Port')
        decay: Decay multiplier per hop (default: 0.70)
        max_depth: Maximum propagation horizon (default: 4)

    Returns:
        Structured dictionary matching API specifications, or None if node not found.
    """
    node_map, rels, pred_map, lookup_map = _build_graph_cache()

    target_nid = lookup_map.get(str(source_identifier).strip().lower())
    if not target_nid or target_nid not in node_map:
        return None

    src_node = node_map[target_nid]
    src_props = src_node.get("properties", {})
    src_labels = src_node.get("labels", [])
    src_type = src_labels[0] if src_labels else "Unknown"
    src_pred = pred_map.get(target_nid, {})

    # Compute baseline disruption
    status = str(src_props.get("status", "")).upper()
    disruption = (
        1.0 if status == "DISRUPTED"
        else (0.75 if "DELAY" in status
              else (0.5 if "RISK" in status
                    else float(src_props.get("disruption", src_pred.get("disruption", 0.0)))))
    )
    # Ensure a non-zero propagation baseline so shock ripples visibly
    if disruption <= 0.0:
        disruption = max(float(src_props.get("risk", src_pred.get("risk", 0.0))), 0.5)

    source_info = {
        "neo4j_id": target_nid,
        "id": src_props.get("id"),
        "name": src_props.get("name", src_props.get("id", "Unknown")),
        "entity_type": src_type,
        "status": status or "NORMAL",
        "risk": round(float(src_props.get("risk", src_pred.get("risk", 0.0))), 4),
        "disruption": round(disruption, 4),
        "predicted_delay": round(float(src_pred.get("predicted_delay", src_props.get("delay", 0.0))), 2),
    }

    # BFS Traversal
    # Item in queue: (current_node_id, current_depth, path_list)
    print(f"\n[RippleEngine] ==================================================")
    print(f"[RippleEngine] Starting Ripple Simulation for Disrupted Node: {source_info['name']} ({source_info['entity_type']}) [ID: {source_info['id']}]")
    print(f"[RippleEngine] Baseline Disruption: {disruption} | Per-Hop Decay: {decay} | Max Depth: {max_depth}")
    print(f"[RippleEngine] ==================================================")

    queue = [(target_nid, 0, [])]
    visited_depth = {target_nid: 0}
    affected_nodes = []
    paths = []
    seen_edges = set()

    while queue:
        curr_id, depth, curr_path = queue.pop(0)
        if depth >= max_depth:
            continue

        neighbors = _get_downstream_neighbors(curr_id, node_map, rels)
        for next_id, rel_type in neighbors:
            next_depth = depth + 1

            curr_name = node_map[curr_id].get("properties", {}).get("name", curr_id)
            next_node = node_map[next_id]
            next_props = next_node.get("properties", {})
            next_name = next_props.get("name", next_id)

            # Check if this edge is a valid downstream propagation edge
            # (i.e. next_id is first visited or reached at the same or shorter depth)
            is_first_visit = (next_id not in visited_depth)
            is_shorter = (not is_first_visit and next_depth < visited_depth[next_id])
            is_same_depth = (not is_first_visit and next_depth == visited_depth[next_id])

            edge_key = (curr_id, next_id, rel_type)
            if (is_first_visit or is_shorter or is_same_depth) and edge_key not in seen_edges:
                seen_edges.add(edge_key)
                paths.append({
                    "source": curr_name,
                    "source_id": curr_id,
                    "target": next_name,
                    "target_id": next_id,
                    "relationship": rel_type,
                    "depth": next_depth,
                })
                if is_same_depth:
                    next_pred = pred_map.get(next_id, {})
                    same_pred_delay = round(float(next_pred.get("predicted_delay", next_props.get("delay", 0.0))), 2)
                    same_ripple_score = round(disruption * (decay ** next_depth), 4)
                    print(
                        f"[RippleEngine] Traversal (convergent): {curr_name} --[{rel_type}]--> {next_name} | "
                        f"Hop: {next_depth} | GNN Predicted Delay: {same_pred_delay}d | Ripple Score: {same_ripple_score * 100:.1f}%"
                    )

            if is_first_visit or is_shorter:
                visited_depth[next_id] = next_depth

                next_pred = pred_map.get(next_id, {})
                next_labels = next_node.get("labels", [])
                next_type = next_labels[0] if next_labels else "Unknown"

                # Calculate exponential decay ripple score
                # depth 1: 0.70 * disruption
                # depth 2: 0.49 * disruption
                # depth 3: 0.343 * disruption
                ripple_score = round(disruption * (decay ** next_depth), 4)
                pred_delay = round(float(next_pred.get("predicted_delay", next_props.get("delay", 0.0))), 2)
                act_delay = round(float(next_pred.get("actual_delay", next_props.get("delay", 0.0))), 2)

                print(
                    f"[RippleEngine] Traversal: {curr_name} --[{rel_type}]--> {next_name} | "
                    f"Hop: {next_depth} | GNN Predicted Delay: {pred_delay}d | Ripple Score: {ripple_score * 100:.1f}%"
                )

                new_path = curr_path + [{
                    "source": curr_name,
                    "target": next_name,
                    "relationship": rel_type,
                }]

                # Human-readable step-by-step path explanation
                path_segments = [p["source"] + f" ({p['relationship']})" for p in new_path]
                path_segments.append(next_name)
                path_desc = " -> ".join(path_segments)

                ordered_nodes = [p["source"] for p in new_path] + [next_name]
                ordered_rels = [p["relationship"] for p in new_path]
                explanation_sentence = f"{next_name} is affected through a {next_depth}-hop downstream path from {source_info['name']}."

                affected_nodes.append({
                    "neo4j_id": next_id,
                    "id": next_props.get("id"),
                    "name": next_name,
                    "entity_type": next_type,
                    "depth": next_depth,
                    "hops": next_depth,
                    "nodes": ordered_nodes,
                    "relationships": ordered_rels,
                    "explanation": explanation_sentence,
                    "ripple_score": ripple_score,
                    "predicted_delay": pred_delay,
                    "actual_delay": act_delay,
                    "risk": round(float(next_props.get("risk", next_pred.get("risk", 0.0))), 4),
                    "disruption": round(float(next_props.get("disruption", next_pred.get("disruption", 0.0))), 4),
                    "capacity": round(float(next_props.get("capacity", next_pred.get("capacity", 0.0))), 4),
                    "relationship": rel_type,
                    "path_description": path_desc,
                })

                queue.append((next_id, next_depth, new_path))

    max_d = max([a["depth"] for a in affected_nodes], default=0)
    print(
        f"[RippleEngine] Simulation Complete: {len(affected_nodes)} affected nodes across {len(paths)} traversed paths (Max Depth: {max_d} hops).\n"
    )

    # Sort affected nodes by ripple_score descending, then depth ascending
    affected_nodes.sort(key=lambda x: (-x["ripple_score"], x["depth"]))

    return {
        "success": True,
        "source_node": source_info,
        "affected_nodes": affected_nodes,
        "paths": paths,
        "total_affected_nodes": len(affected_nodes),
        "max_depth": max_d,
        "ripple_decay": decay,
    }


def get_explainability_paths(
    source_identifier: str,
    decay: float = RIPPLE_DECAY,
    max_depth: int = DEFAULT_MAX_DEPTH,
) -> Optional[Dict[str, Any]]:
    """
    Returns explainability paths explaining why each downstream entity was affected
    by the selected disrupted node. Matches format:
    {
      "source": "European Precision Parts",
      "total_paths": 6,
      "paths": [
        {
          "target": "Amsterdam Distribution Center",
          "hops": 2,
          "nodes": ["European Precision Parts", "European Consumer Devices", "Amsterdam Distribution Center"],
          "relationships": ["SUPPLIES", "SHIPS_TO"],
          "predicted_delay": 3.12,
          "actual_delay": 3.0,
          "ripple_score": 0.245,
          "explanation": "Amsterdam Distribution Center is affected through a 2-hop downstream path from European Precision Parts."
        }
      ]
    }
    """
    res = calculate_ripple_propagation(
        source_identifier=source_identifier,
        decay=decay,
        max_depth=max_depth,
    )
    if not res or not res.get("source_node"):
        return None

    source_info = res["source_node"]
    affected_nodes = res.get("affected_nodes", [])

    paths = []
    for a in affected_nodes:
        paths.append({
            "target": a["name"],
            "target_type": a.get("entity_type", "Unknown"),
            "hops": a.get("depth", a.get("hops", 1)),
            "nodes": a.get("nodes", [source_info["name"], a["name"]]),
            "relationships": a.get("relationships", [a.get("relationship", "")]),
            "predicted_delay": a.get("predicted_delay", 0.0),
            "actual_delay": a.get("actual_delay", 0.0),
            "ripple_score": a.get("ripple_score", 0.0),
            "explanation": a.get(
                "explanation",
                f"{a['name']} is affected through a {a.get('depth', 1)}-hop downstream path from {source_info['name']}."
            ),
        })

    return {
        "source": source_info["name"],
        "source_id": source_info.get("id"),
        "source_type": source_info.get("entity_type"),
        "total_paths": len(paths),
        "max_depth": res.get("max_depth", 0),
        "paths": paths,
    }
