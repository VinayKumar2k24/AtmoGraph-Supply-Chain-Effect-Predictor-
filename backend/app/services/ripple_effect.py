"""
AtmoGraph — Supply Chain Ripple Effect Propagation Service
Week 3: Graph Traversal, Exponential Decay, and Path Explainability

Traverses downstream Neo4j dependencies from any disrupted entity,
calculates hop-by-hop ripple propagation scores using exponential decay,
and enriches each affected entity with GNN delay predictions and path descriptions.
"""

import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

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


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Safely converts a value to float, handling None, empty values, and malformed types."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _safe_str(val: Any, default: str = "") -> str:
    """Safely converts a value to stripped string, handling None and empty values."""
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default


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
        props = n.get("properties") or {}
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
    sorted by disruption descending, then risk descending, then name.
    """
    node_map, _, pred_map, _ = _build_graph_cache()
    candidates = []

    for nid, node in node_map.items():
        props = node.get("properties") or {}
        labels = node.get("labels") or []
        entity_type = labels[0] if labels else "Unknown"
        pred = pred_map.get(nid) or {}

        status = _safe_str(props.get("status"), "NORMAL").upper()
        disruption_raw = props.get("disruption") if props.get("disruption") is not None else pred.get("disruption")
        disruption = (
            1.0 if status == "DISRUPTED"
            else (0.75 if "DELAY" in status
                  else (0.5 if "RISK" in status
                        else _safe_float(disruption_raw, 0.0)))
        )
        risk = _safe_float(props.get("risk") if props.get("risk") is not None else pred.get("risk"), 0.0)
        delay_raw = pred.get("predicted_delay") if pred.get("predicted_delay") is not None else props.get("delay")
        predicted_delay = _safe_float(delay_raw, 0.0)
        actual_delay = _safe_float(pred.get("actual_delay") if pred.get("actual_delay") is not None else props.get("delay"), 0.0)
        capacity = _safe_float(props.get("capacity") if props.get("capacity") is not None else pred.get("capacity"), 0.0)

        node_id_str = _safe_str(props.get("id"), nid)
        node_name_str = _safe_str(props.get("name"), node_id_str)

        candidates.append({
            "neo4j_id": nid,
            "id": node_id_str,
            "name": node_name_str,
            "entity_type": entity_type,
            "status": status,
            "risk": round(risk, 4),
            "disruption": round(disruption, 4),
            "predicted_delay": round(predicted_delay, 2),
            "actual_delay": round(actual_delay, 2),
            "capacity": round(capacity, 4),
            "country": _safe_str(props.get("country"), ""),
            "city": _safe_str(props.get("city"), ""),
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
    src_props = src_node.get("properties") or {}
    src_labels = src_node.get("labels") or []
    src_type = src_labels[0] if src_labels else "Unknown"
    src_pred = pred_map.get(target_nid) or {}

    # Compute baseline disruption
    status = _safe_str(src_props.get("status"), "NORMAL").upper()
    disruption_raw = src_props.get("disruption") if src_props.get("disruption") is not None else src_pred.get("disruption")
    disruption = (
        1.0 if status == "DISRUPTED"
        else (0.75 if "DELAY" in status
              else (0.5 if "RISK" in status
                    else _safe_float(disruption_raw, 0.0)))
    )
    # Ensure a non-zero propagation baseline so shock ripples visibly
    if disruption <= 0.0:
        disruption = max(_safe_float(src_props.get("risk") if src_props.get("risk") is not None else src_pred.get("risk"), 0.0), 0.5)

    src_id_str = _safe_str(src_props.get("id"), target_nid)
    src_name_str = _safe_str(src_props.get("name"), src_id_str)
    src_risk = _safe_float(src_props.get("risk") if src_props.get("risk") is not None else src_pred.get("risk"), 0.0)
    src_pred_delay = _safe_float(src_pred.get("predicted_delay") if src_pred.get("predicted_delay") is not None else src_props.get("delay"), 0.0)
    src_act_delay = _safe_float(src_pred.get("actual_delay") if src_pred.get("actual_delay") is not None else src_props.get("delay"), 0.0)
    src_capacity = _safe_float(src_props.get("capacity") if src_props.get("capacity") is not None else src_pred.get("capacity"), 0.0)

    source_info = {
        "neo4j_id": target_nid,
        "id": src_id_str,
        "name": src_name_str,
        "entity_type": src_type,
        "status": status,
        "risk": round(src_risk, 4),
        "disruption": round(disruption, 4),
        "predicted_delay": round(src_pred_delay, 2),
        "actual_delay": round(src_act_delay, 2),
        "capacity": round(src_capacity, 4),
        "country": _safe_str(src_props.get("country"), ""),
        "city": _safe_str(src_props.get("city"), ""),
    }

    # BFS Traversal
    # Item in queue: (current_node_id, current_depth, path_list)
    print(f"\n[RippleEngine] ==================================================")
    print(f"[RippleEngine] Starting Ripple Simulation for Disrupted Node: {source_info['name']} ({source_info['entity_type']}) [ID: {source_info['id']}]")
    print(f"[RippleEngine] Baseline Disruption: {disruption} | Per-Hop Decay: {decay} | Max Depth: {max_depth}")
    print(f"[RippleEngine] ==================================================")

    queue = [(target_nid, 0, [])]
    visited_depth: Dict[str, int] = {target_nid: 0}
    affected_nodes_dict: Dict[str, Dict[str, Any]] = {}
    paths: List[Dict[str, Any]] = []
    seen_edges = set()

    while queue:
        curr_id, depth, curr_path = queue.pop(0)
        if depth >= max_depth:
            continue

        neighbors = _get_downstream_neighbors(curr_id, node_map, rels)
        for next_id, rel_type in neighbors:
            next_depth = depth + 1

            curr_props = node_map.get(curr_id, {}).get("properties") or {}
            curr_name = _safe_str(curr_props.get("name"), curr_id)
            next_node = node_map.get(next_id) or {}
            next_props = next_node.get("properties") or {}
            next_id_str = _safe_str(next_props.get("id"), next_id)
            next_name = _safe_str(next_props.get("name"), next_id_str)

            # Check if this edge is a valid downstream propagation edge
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
                    next_pred = pred_map.get(next_id) or {}
                    delay_raw = next_pred.get("predicted_delay") if next_pred.get("predicted_delay") is not None else next_props.get("delay")
                    same_pred_delay = round(_safe_float(delay_raw, 0.0), 2)
                    same_ripple_score = round(disruption * (decay ** next_depth), 4)
                    print(
                        f"[RippleEngine] Traversal (convergent): {curr_name} --[{rel_type}]--> {next_name} | "
                        f"Hop: {next_depth} | GNN Predicted Delay: {same_pred_delay}d | Ripple Score: {same_ripple_score * 100:.1f}%"
                    )

            if is_first_visit or is_shorter:
                visited_depth[next_id] = next_depth

                next_pred = pred_map.get(next_id) or {}
                next_labels = next_node.get("labels") or []
                next_type = next_labels[0] if next_labels else "Unknown"

                # Calculate exponential decay ripple score
                # depth 1: 0.70 * disruption
                # depth 2: 0.49 * disruption
                # depth 3: 0.343 * disruption
                ripple_score = round(disruption * (decay ** next_depth), 4)

                pred_delay_raw = next_pred.get("predicted_delay") if next_pred.get("predicted_delay") is not None else next_props.get("delay")
                pred_delay = round(_safe_float(pred_delay_raw, 0.0), 2)

                act_delay_raw = next_pred.get("actual_delay") if next_pred.get("actual_delay") is not None else next_props.get("delay")
                act_delay = round(_safe_float(act_delay_raw, 0.0), 2)

                risk_raw = next_props.get("risk") if next_props.get("risk") is not None else next_pred.get("risk")
                node_risk = round(_safe_float(risk_raw, 0.0), 4)

                disrupt_raw = next_props.get("disruption") if next_props.get("disruption") is not None else next_pred.get("disruption")
                node_disruption = round(_safe_float(disrupt_raw, 0.0), 4)

                cap_raw = next_props.get("capacity") if next_props.get("capacity") is not None else next_pred.get("capacity")
                node_capacity = round(_safe_float(cap_raw, 0.0), 4)

                next_status = _safe_str(next_props.get("status"), "NORMAL").upper()

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

                # Create or update affected node record (ensures NO duplicate affected nodes)
                affected_nodes_dict[next_id] = {
                    "neo4j_id": next_id,
                    "id": next_id_str,
                    "name": next_name,
                    "entity_type": next_type,
                    "status": next_status,
                    "depth": next_depth,
                    "hops": next_depth,
                    "nodes": ordered_nodes,
                    "relationships": ordered_rels,
                    "explanation": explanation_sentence,
                    "ripple_score": ripple_score,
                    "predicted_delay": pred_delay,
                    "actual_delay": act_delay,
                    "risk": node_risk,
                    "disruption": node_disruption,
                    "capacity": node_capacity,
                    "relationship": rel_type,
                    "path_description": path_desc,
                    "country": _safe_str(next_props.get("country"), ""),
                    "city": _safe_str(next_props.get("city"), ""),
                }

                queue.append((next_id, next_depth, new_path))

    affected_nodes = list(affected_nodes_dict.values())
    max_d = max([a["depth"] for a in affected_nodes], default=0)
    print(
        f"[RippleEngine] Simulation Complete: {len(affected_nodes)} affected nodes across {len(paths)} traversed paths (Max Depth: {max_d} hops).\n"
    )

    # Sort affected nodes meaningfully by ripple_score descending (peak impact first),
    # then propagation depth ascending (nearest first), predicted delay descending, and name
    affected_nodes.sort(key=lambda x: (-x["ripple_score"], x["depth"], -x["predicted_delay"], x["name"]))

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
        node_name = a.get("name") or "Unknown"
        hops = a.get("depth", a.get("hops", 1))
        src_name = source_info.get("name") or "Source"
        paths.append({
            "target": node_name,
            "target_id": a.get("id") or a.get("neo4j_id", ""),
            "target_type": a.get("entity_type", "Unknown"),
            "hops": hops,
            "nodes": a.get("nodes", [src_name, node_name]),
            "relationships": a.get("relationships", [a.get("relationship", "")]),
            "predicted_delay": a.get("predicted_delay", 0.0),
            "actual_delay": a.get("actual_delay", 0.0),
            "ripple_score": a.get("ripple_score", 0.0),
            "explanation": a.get(
                "explanation",
                f"{node_name} is affected through a {hops}-hop downstream path from {src_name}."
            ),
        })

    return {
        "source": source_info.get("name", "Unknown"),
        "source_id": source_info.get("id"),
        "source_type": source_info.get("entity_type"),
        "total_paths": len(paths),
        "max_depth": res.get("max_depth", 0),
        "paths": paths,
    }


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "Rotterdam Port"
    print(f"[RippleEffect CLI] Executing simulation for: '{target}'")
    result = calculate_ripple_propagation(target)
    if result:
        print(f"Success               : {result.get('success')}")
        src = result.get("source_node", {})
        print(f"Source Node           : {src.get('name')} ({src.get('entity_type')}) [ID: {src.get('id')}]")
        print(f"Source Disruption     : {src.get('disruption')} | Risk: {src.get('risk')} | Delay: {src.get('predicted_delay')}d")
        print(f"Total Affected Nodes  : {result.get('total_affected_nodes')}")
        print(f"Max Traversed Depth   : {result.get('max_depth')} hops")
        print(f"Traversed Paths Count : {len(result.get('paths', []))}")
        print("\nAffected Nodes Summary:")
        print("-" * 70)
        for a in result.get("affected_nodes", []):
            print(
                f" - {a.get('name')} ({a.get('entity_type')}) [ID: {a.get('id')}] | "
                f"Hop: {a.get('depth')} | "
                f"Ripple Score: {a.get('ripple_score', 0.0) * 100:.1f}% | "
                f"GNN Delay: {a.get('predicted_delay')}d"
            )
        print("\n[RippleEffect CLI] Verification completed successfully.")
    else:
        print(f"[RippleEffect CLI] Error: Node '{target}' could not be resolved.")
        sys.exit(1)
