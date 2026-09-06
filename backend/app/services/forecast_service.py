"""
AtmoGraph — 30 / 60 / 90-Day Supply Chain Forecast Service
Week 4: Temporal Scenario Modeling & Horizon Forecasting

Combines GraphSAGE GNN predicted delays, Neo4j graph topology,
and exponential decay ripple propagation into deterministic,
explainable 30, 60, and 90-day forward-looking scenario projections.
"""

from typing import Dict, List, Optional, Any
from backend.app.services.ripple_effect import (
    calculate_ripple_propagation,
    get_ripple_candidate_nodes,
    RIPPLE_DECAY,
    DEFAULT_MAX_DEPTH,
)


def _compute_risk_level(peak_ripple: float, max_delay: float, disruption: float, horizon_days: int) -> str:
    """
    Computes a deterministic risk level classification based on
    peak ripple propagation intensity, maximum GNN predicted delay,
    and shock disruption score.
    """
    if peak_ripple >= 0.60 or max_delay >= 7.0 or (disruption >= 0.85 and peak_ripple >= 0.45):
        return "CRITICAL"
    if peak_ripple >= 0.35 or max_delay >= 4.0 or (disruption >= 0.60 and horizon_days <= 60):
        return "HIGH"
    if peak_ripple >= 0.20 or max_delay >= 2.0:
        return "MEDIUM"
    return "LOW"


def _generate_horizon_narrative(
    horizon_days: int,
    source_name: str,
    source_type: str,
    source_delay: float,
    active_nodes: List[Dict[str, Any]],
    max_depth: int,
    peak_ripple: float,
    avg_delay: float,
) -> tuple[str, str, str]:
    """
    Generates explainable, deterministic title, impact summary, and
    mitigation priority tailored to the specific shock origin and horizon.
    """
    count = len(active_nodes)

    if horizon_days == 30:
        title = "30-Day Outlook: Immediate Shock & Buffer Depletion"
        if count == 0:
            summary = (
                f"Disruption at {source_name} ({source_type}) remains localized. "
                f"GNN predicted delay of {source_delay:.1f} days is absorbed internally with no immediate downstream propagation."
            )
            mitigation = "Monitor internal turnaround times and ensure local operational containment."
        else:
            entity_names = ", ".join([n["name"] for n in active_nodes[:2]])
            summary = (
                f"Immediate Tier-1 propagation from {source_name} impacts {count} downstream {'entity' if count == 1 else 'entities'} "
                f"(including {entity_names}). Safety stock buffers (typically 7-14 days) absorb initial shocks before delivery stalls begin. "
                f"Peak ripple intensity reaches {peak_ripple * 100:.1f}% with an expected immediate delay of {avg_delay:.2f} days."
            )
            mitigation = "Activate secondary supplier allocations and re-route near-term inbound logistics to protect Tier-1 assembly."

    elif horizon_days == 60:
        title = "60-Day Outlook: Mid-Tier Compound Delay & Buffer Exhaustion"
        if count == 0:
            summary = (
                f"At 60 days, {source_name} has resolved initial volatility. "
                f"Zero downstream percolation detected across the supply chain network."
            )
            mitigation = "Maintain standard inventory auditing and restore baseline operating buffers."
        else:
            summary = (
                f"Buffer inventory across affected tiers is exhausted. Propagated delays compound across {count} entities "
                f"spanning up to {max_depth} graph hops. Unfulfilled backlogs and production starvation increase expected delays "
                f"to {avg_delay:.2f} days (peak ripple reaching {peak_ripple * 100:.1f}%)."
            )
            mitigation = "Reprioritize manufacturing production lines and expedite multi-modal freight to bypass congested intermediate nodes."

    else:  # 90 Days
        title = "90-Day Outlook: Systemic Network Reach & Fulfillment Equilibrium"
        if count == 0:
            summary = (
                f"Full 90-day horizon indicates stable network equilibrium. "
                f"The isolated disruption at {source_name} has completely decoupled from network fulfillment."
            )
            mitigation = "Post-incident audit to reinforce buffer thresholds against future single-point disruptions."
        elif max_depth >= 3:
            summary = (
                f"Full network percolation reaches terminal fulfillment hubs and end-market distribution centers "
                f"(up to {max_depth} hops deep). {count} total supply chain entities experience systemic disruption, "
                f"with multi-tier order backlogs averaging {avg_delay:.2f} days as network replenishment begins."
            )
            mitigation = "Engage dynamic order reallocation, adjust customer delivery SLAs, and execute multi-region warehouse balancing."
        else:
            summary = (
                f"Disruption remains structurally bounded to {max_depth} hop(s) across {count} downstream nodes. "
                f"By day 90, carrier rerouting, customs clearance, and inventory replenishment take effect, reducing active delays "
                f"to {avg_delay:.2f} days (peak ripple clearing down to {peak_ripple * 100:.1f}%)."
            )
            mitigation = "Focus on clearing accumulated warehouse backlogs and standardizing replenishment cadence."

    return title, summary, mitigation


def generate_supply_chain_forecast(
    shock_node: Optional[str] = None,
    decay: float = RIPPLE_DECAY,
    max_depth: int = DEFAULT_MAX_DEPTH,
) -> Optional[Dict[str, Any]]:
    """
    Generates a complete 30 / 60 / 90-day deterministic forecast for the given shock origin.

    Args:
        shock_node: Name, ID, or Neo4j ID of the disrupted node. If None, picks the highest-risk candidate.
        decay: Per-hop exponential ripple decay (default 0.70).
        max_depth: Maximum graph propagation depth (default 4).

    Returns:
        Structured forecast dictionary with 30_days, 60_days, and 90_days outlooks.
    """
    # 1. Resolve shock node if not explicitly provided
    resolved_identifier = shock_node
    if not resolved_identifier:
        candidates = get_ripple_candidate_nodes()
        if candidates:
            resolved_identifier = candidates[0].get("name") or candidates[0].get("id")
        else:
            resolved_identifier = "Rotterdam Port"

    # 2. Run ripple propagation across real Neo4j graph and GraphSAGE predictions
    ripple_result = calculate_ripple_propagation(
        source_identifier=resolved_identifier,
        decay=decay,
        max_depth=max_depth,
    )

    if not ripple_result or not ripple_result.get("source_node"):
        return None

    src = ripple_result["source_node"]
    src_name = src.get("name", str(resolved_identifier))
    src_type = src.get("entity_type", "Unknown")
    src_delay = float(src.get("predicted_delay", 0.0))
    src_disruption = float(src.get("disruption", 0.5))
    src_risk = float(src.get("risk", 0.4))

    all_affected = ripple_result.get("affected_nodes", [])
    graph_max_depth = ripple_result.get("max_depth", 0)

    # 3. Deterministic Temporal Horizon Calculation
    forecast_map = {}

    # ─── HORIZON 1: 30 DAYS (Immediate Shock & Tier-1 Propagation) ───────────────
    nodes_30 = [n for n in all_affected if n.get("depth", 1) <= 1]
    entities_30 = []
    delays_30 = []
    ripples_30 = []

    for n in nodes_30:
        d = round(float(n.get("predicted_delay", 0.0)), 2)
        r = round(float(n.get("ripple_score", 0.0)), 4)
        delays_30.append(d)
        ripples_30.append(r)
        entities_30.append({
            "neo4j_id": n.get("neo4j_id"),
            "id": n.get("id"),
            "name": n.get("name"),
            "entity_type": n.get("entity_type"),
            "hop": n.get("depth"),
            "relationship": n.get("relationship"),
            "ripple_score": r,
            "predicted_delay": d,
            "risk": n.get("risk"),
        })

    if not delays_30:
        delays_30 = [src_delay]
        ripples_30 = [src_disruption]

    avg_30 = round(sum(delays_30) / len(delays_30), 2)
    max_30 = round(max(delays_30), 2)
    peak_r_30 = round(max(ripples_30), 4)
    hop_30 = max([n.get("depth", 0) for n in nodes_30], default=0)
    risk_30 = _compute_risk_level(peak_r_30, max_30, src_disruption, 30)
    title_30, summary_30, mit_30 = _generate_horizon_narrative(
        30, src_name, src_type, src_delay, nodes_30, hop_30, peak_r_30, avg_30
    )

    forecast_map["30_days"] = {
        "horizon": "30_days",
        "horizon_days": 30,
        "title": title_30,
        "risk_level": risk_30,
        "affected_node_count": len(nodes_30),
        "max_propagation_depth": hop_30,
        "peak_ripple_score": peak_r_30,
        "average_delay_days": avg_30,
        "max_delay_days": max_30,
        "impact_summary": summary_30,
        "mitigation_priority": mit_30,
        "affected_entities": entities_30,
    }

    # ─── HORIZON 2: 60 DAYS (Compounded Mid-Term Impact & Buffer Depletion) ───────
    nodes_60 = [n for n in all_affected if n.get("depth", 1) <= 2]
    entities_60 = []
    delays_60 = []
    ripples_60 = []

    for n in nodes_60:
        base_d = float(n.get("predicted_delay", 0.0))
        base_r = float(n.get("ripple_score", 0.0))
        # Compounding multiplier: unmitigated disruption compounds into order queues
        comp_mult = 1.0 + (base_r * 0.50)
        comp_d = round(base_d * comp_mult, 2)
        comp_r = round(min(1.0, base_r * 1.15), 4)
        delays_60.append(comp_d)
        ripples_60.append(comp_r)
        entities_60.append({
            "neo4j_id": n.get("neo4j_id"),
            "id": n.get("id"),
            "name": n.get("name"),
            "entity_type": n.get("entity_type"),
            "hop": n.get("depth"),
            "relationship": n.get("relationship"),
            "ripple_score": comp_r,
            "predicted_delay": comp_d,
            "risk": n.get("risk"),
        })

    if not delays_60:
        delays_60 = [round(src_delay * 1.25, 2)]
        ripples_60 = [round(min(1.0, src_disruption * 1.15), 4)]

    avg_60 = round(sum(delays_60) / len(delays_60), 2)
    max_60 = round(max(delays_60), 2)
    peak_r_60 = round(max(ripples_60), 4)
    hop_60 = max([n.get("depth", 0) for n in nodes_60], default=0)
    risk_60 = _compute_risk_level(peak_r_60, max_60, src_disruption, 60)
    title_60, summary_60, mit_60 = _generate_horizon_narrative(
        60, src_name, src_type, src_delay, nodes_60, hop_60, peak_r_60, avg_60
    )

    forecast_map["60_days"] = {
        "horizon": "60_days",
        "horizon_days": 60,
        "title": title_60,
        "risk_level": risk_60,
        "affected_node_count": len(nodes_60),
        "max_propagation_depth": hop_60,
        "peak_ripple_score": peak_r_60,
        "average_delay_days": avg_60,
        "max_delay_days": max_60,
        "impact_summary": summary_60,
        "mitigation_priority": mit_60,
        "affected_entities": entities_60,
    }

    # ─── HORIZON 3: 90 DAYS (Systemic Reach / Network Recovery) ───────────────────
    nodes_90 = list(all_affected)
    entities_90 = []
    delays_90 = []
    ripples_90 = []
    is_bounded = (graph_max_depth <= 1)

    for n in nodes_90:
        hop = n.get("depth", 1)
        base_d = float(n.get("predicted_delay", 0.0))
        base_r = float(n.get("ripple_score", 0.0))

        if is_bounded:
            # 1-hop bounded network: recovery, customs clearance, and inventory replenishment
            recov_d = round((base_d * (1.0 + base_r * 0.50)) * 0.55, 2)
            recov_r = round(base_r * 0.55, 4)
        else:
            # Multi-hop deep network: full percolation with tiered recovery
            if hop == 1:
                recov_d = round((base_d * (1.0 + base_r * 0.50)) * 0.80, 2)
                recov_r = round(base_r * 0.70, 4)
            elif hop == 2:
                recov_d = round((base_d * (1.0 + base_r * 0.50)) * 0.90, 2)
                recov_r = round(base_r * 0.85, 4)
            else:  # Hop 3+
                recov_d = round(base_d * (1.0 + base_r * 0.85), 2)
                recov_r = round(base_r, 4)

        delays_90.append(recov_d)
        ripples_90.append(recov_r)
        entities_90.append({
            "neo4j_id": n.get("neo4j_id"),
            "id": n.get("id"),
            "name": n.get("name"),
            "entity_type": n.get("entity_type"),
            "hop": hop,
            "relationship": n.get("relationship"),
            "ripple_score": recov_r,
            "predicted_delay": recov_d,
            "risk": n.get("risk"),
        })

    if not delays_90:
        delays_90 = [round(src_delay * 0.70, 2)]
        ripples_90 = [round(src_disruption * 0.50, 4)]

    avg_90 = round(sum(delays_90) / len(delays_90), 2)
    max_90 = round(max(delays_90), 2)
    peak_r_90 = round(max(ripples_90), 4)
    hop_90 = max([n.get("depth", 0) for n in nodes_90], default=0)
    risk_90 = _compute_risk_level(peak_r_90, max_90, src_disruption, 90)
    title_90, summary_90, mit_90 = _generate_horizon_narrative(
        90, src_name, src_type, src_delay, nodes_90, hop_90, peak_r_90, avg_90
    )

    forecast_map["90_days"] = {
        "horizon": "90_days",
        "horizon_days": 90,
        "title": title_90,
        "risk_level": risk_90,
        "affected_node_count": len(nodes_90),
        "max_propagation_depth": hop_90,
        "peak_ripple_score": peak_r_90,
        "average_delay_days": avg_90,
        "max_delay_days": max_90,
        "impact_summary": summary_90,
        "mitigation_priority": mit_90,
        "affected_entities": entities_90,
    }

    return {
        "success": True,
        "shock_origin": src_name,
        "source_node": {
            "neo4j_id": src.get("neo4j_id"),
            "id": src.get("id"),
            "name": src_name,
            "entity_type": src_type,
            "predicted_delay": src_delay,
            "disruption": src_disruption,
            "risk": src_risk,
        },
        "total_graph_affected": len(all_affected),
        "max_graph_depth": graph_max_depth,
        "forecast": forecast_map,
    }
