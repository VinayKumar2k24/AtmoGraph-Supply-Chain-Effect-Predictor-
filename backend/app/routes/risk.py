"""
AtmoGraph — Risk API Routes

Endpoints:
    GET /api/risk
    GET /api/risk/entities
    GET /api/risk/top
"""

import sys
from pathlib import Path

# ============================================================
# PROJECT ROOT
# ============================================================

ROOT_DIR = Path(__file__).resolve().parents[3]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


from fastapi import APIRouter, HTTPException

from backend.app.database.neo4j_db import db


router = APIRouter()


# ============================================================
# RISK LEVEL CALCULATION
# ============================================================

def _risk_level(score: float) -> str:
    """
    Convert numerical risk score into a human-readable
    risk category.
    """

    try:
        score = float(score or 0)
    except (TypeError, ValueError):
        score = 0.0

    if score >= 0.50:
        return "CRITICAL"

    if score >= 0.30:
        return "HIGH"

    if score >= 0.15:
        return "MEDIUM"

    return "LOW"


# ============================================================
# CONVERT NEO4J RECORD INTO RESPONSE OBJECT
# ============================================================

def _format_entity(record):
    """
    Convert a Neo4j record into a standard risk entity object.
    """

    try:
        score = float(record["risk"] or 0)
    except (TypeError, ValueError):
        score = 0.0

    return {
        "id": record["id"],
        "name": record["name"],
        "type": record["entity_type"],
        "risk_score": round(score, 4),
        "risk_level": _risk_level(score),
        "status": record["status"],
    }


# ============================================================
# GET OVERALL RISK SUMMARY
# ============================================================

@router.get("")
def get_risk_summary():

    try:

        query = """
        MATCH (n)
        WHERE n.risk IS NOT NULL

        RETURN
            labels(n)[0] AS entity_type,
            n.id AS id,
            n.name AS name,
            n.risk AS risk,
            n.status AS status

        ORDER BY n.risk DESC
        """

        entities = []

        with db.session() as session:

            for record in session.run(query):

                entities.append(
                    _format_entity(record)
                )


        # ====================================================
        # GROUP ENTITIES BY TYPE
        # ====================================================

        by_type = {}

        for entity in entities:

            entity_type = entity["type"] or "Unknown"

            if entity_type not in by_type:

                by_type[entity_type] = {
                    "type": entity_type,
                    "entities": [],
                    "max_risk": 0.0,
                    "avg_risk": 0.0,
                }

            by_type[entity_type]["entities"].append(entity)

            score = entity["risk_score"]

            if score > by_type[entity_type]["max_risk"]:
                by_type[entity_type]["max_risk"] = score


        # ====================================================
        # CALCULATE AVERAGE + RISK LEVEL
        # ====================================================

        for entity_type, data in by_type.items():

            scores = [
                entity["risk_score"]
                for entity in data["entities"]
            ]

            if scores:

                data["avg_risk"] = round(
                    sum(scores) / len(scores),
                    4
                )

            else:

                data["avg_risk"] = 0.0

            data["max_risk"] = round(
                data["max_risk"],
                4
            )

            data["risk_level"] = _risk_level(
                data["max_risk"]
            )


        # ====================================================
        # RISK DISTRIBUTION
        # ====================================================

        distribution = {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
        }

        for entity in entities:

            level = entity["risk_level"]

            if level in distribution:
                distribution[level] += 1


        # ====================================================
        # TOP 10 RISKS
        # ====================================================

        top_risks = sorted(
            entities,
            key=lambda x: x["risk_score"],
            reverse=True
        )[:10]


        # ====================================================
        # OVERALL AVERAGE RISK
        # ====================================================

        if entities:

            overall_average = round(
                sum(
                    entity["risk_score"]
                    for entity in entities
                ) / len(entities),
                4
            )

        else:

            overall_average = 0.0


        # ====================================================
        # RESPONSE
        # ====================================================

        return {

            "success": True,

            "summary": {
                "total_entities_with_risk": len(entities),
                "overall_average_risk": overall_average,
                "distribution": distribution,
            },

            "distribution": distribution,

            "by_entity_type": list(
                by_type.values()
            ),

            "top_risks": top_risks,

            "total_entities_with_risk": len(entities),

        }


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch risk summary: {str(e)}"
        )


# ============================================================
# GET ALL ENTITY RISKS
# ============================================================

@router.get("/entities")
def get_entity_risks():

    try:

        query = """
        MATCH (n)
        WHERE n.risk IS NOT NULL

        RETURN
            labels(n)[0] AS entity_type,
            n.id AS id,
            n.name AS name,
            n.risk AS risk,
            n.status AS status

        ORDER BY n.risk DESC
        """

        entities = []

        with db.session() as session:

            for record in session.run(query):

                entities.append(
                    _format_entity(record)
                )


        return {
            "success": True,
            "count": len(entities),
            "entities": entities,
        }


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch entity risks: {str(e)}"
        )


# ============================================================
# GET TOP RISK ENTITIES
# ============================================================

@router.get("/top")
def get_top_risks(limit: int = 10):

    try:

        # Prevent unreasonable values
        limit = max(1, min(limit, 100))


        query = """
        MATCH (n)
        WHERE n.risk IS NOT NULL

        RETURN
            labels(n)[0] AS entity_type,
            n.id AS id,
            n.name AS name,
            n.risk AS risk,
            n.status AS status

        ORDER BY n.risk DESC

        LIMIT $limit
        """


        entities = []

        with db.session() as session:

            result = session.run(
                query,
                limit=limit
            )

            for record in result:

                entities.append(
                    _format_entity(record)
                )


        return {
            "success": True,
            "count": len(entities),
            "limit": limit,
            "risks": entities,
        }


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch top risks: {str(e)}"
        )


# ============================================================
# GET EXPLAINABILITY PATHS FOR A DISRUPTED NODE
# ============================================================

@router.get("/explainability/{node_name}")
def get_risk_explainability(node_name: str):
    """
    Explain WHY each downstream entity was affected by the selected disrupted node.
    Dynamically traverses actual Neo4j graph relationships and attaches
    real GraphSAGE GNN predicted delays and ripple propagation scores.
    """
    try:
        from backend.app.services.ripple_effect import get_explainability_paths

        result = get_explainability_paths(source_identifier=node_name)

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Supply chain node '{node_name}' not found in Neo4j graph.",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate explainability paths for '{node_name}': {str(e)}"
        )