"""
AtmoGraph — Risk API Routes

GET /api/risk
GET /api/risk/entities
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import APIRouter, HTTPException
from backend.app.database.neo4j_db import db


router = APIRouter()


# ============================================================
# RISK LEVEL
# ============================================================

def _risk_level(score: float) -> str:

    score = float(score or 0)

    if score >= 0.50:
        return "CRITICAL"

    if score >= 0.30:
        return "HIGH"

    if score >= 0.15:
        return "MEDIUM"

    return "LOW"


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

                score = float(record["risk"] or 0)

                entities.append({

                    "id": record["id"],

                    "name": record["name"],

                    "type": record["entity_type"],

                    "risk_score": score,

                    "risk_level": _risk_level(score),

                    "status": record["status"]

                })


        # ====================================================
        # GROUP BY ENTITY TYPE
        # ====================================================

        by_type = {}

        for entity in entities:

            entity_type = entity["type"]

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


        # Calculate average + category risk level

        for entity_type, data in by_type.items():

            scores = [

                entity["risk_score"]

                for entity in data["entities"]

                if entity["risk_score"] is not None

            ]

            if scores:

                data["avg_risk"] = sum(scores) / len(scores)

            else:

                data["avg_risk"] = 0.0

            data["risk_level"] = _risk_level(
                data["max_risk"]
            )


        # ====================================================
        # OVERALL DISTRIBUTION
        # ====================================================

        distribution = {

            "CRITICAL": 0,

            "HIGH": 0,

            "MEDIUM": 0,

            "LOW": 0

        }


        for entity in entities:

            level = entity["risk_level"]

            distribution[level] += 1


        # ====================================================
        # TOP RISKS
        # ====================================================

        top_risks = sorted(

            entities,

            key=lambda x: x["risk_score"],

            reverse=True

        )[:10]


        # ====================================================
        # RESPONSE
        # ====================================================

        return {

            "distribution": distribution,

            "by_entity_type": list(
                by_type.values()
            ),

            "top_risks": top_risks,

            "total_entities_with_risk": len(entities)

        }


    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=str(e)

        )


# ============================================================
# GET ENTITY RISKS
# ============================================================

@router.get("/entities")
def get_entity_risks():

    try:

        query = """

        MATCH (n)

        WHERE n.risk IS NOT NULL

        RETURN

            labels(n)[0] AS type,

            n.id AS id,

            n.name AS name,

            n.risk AS risk,

            n.status AS status

        ORDER BY n.risk DESC

        """

        entities = []

        with db.session() as session:

            for record in session.run(query):

                score = float(record["risk"] or 0)

                entities.append({

                    "id": record["id"],

                    "name": record["name"],

                    "type": record["type"],

                    "risk_score": score,

                    "risk_level": _risk_level(score),

                    "status": record["status"]

                })


        return {

            "entities": entities

        }


    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=str(e)

        )