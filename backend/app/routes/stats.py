"""
AtmoGraph — Stats API Routes
GET /api/stats  — graph entity counts and relationship counts
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import APIRouter, HTTPException
from backend.app.database.neo4j_db import db

router = APIRouter()


@router.get("")
def get_stats():
    """Return entity and relationship counts from Neo4j."""
    try:
        query = """
        CALL {
            MATCH (n:Country)      RETURN 'countries'     AS key, count(n) AS val
            UNION ALL
            MATCH (n:Supplier)     RETURN 'suppliers'     AS key, count(n) AS val
            UNION ALL
            MATCH (n:Manufacturer) RETURN 'manufacturers' AS key, count(n) AS val
            UNION ALL
            MATCH (n:Product)      RETURN 'products'      AS key, count(n) AS val
            UNION ALL
            MATCH (n:Port)         RETURN 'ports'         AS key, count(n) AS val
            UNION ALL
            MATCH (n:Warehouse)    RETURN 'warehouses'    AS key, count(n) AS val
            UNION ALL
            MATCH (n)              RETURN 'totalNodes'    AS key, count(n) AS val
            UNION ALL
            MATCH ()-[r]->()       RETURN 'totalRelationships' AS key, count(r) AS val
        }
        RETURN key, val
        """
        result = {}
        with db.session() as session:
            for record in session.run(query):
                result[record["key"]] = record["val"]

        # Relationship type breakdown
        rel_query = """
        MATCH ()-[r]->()
        RETURN type(r) AS rel_type, count(r) AS cnt
        ORDER BY cnt DESC
        """
        by_rel = {}
        with db.session() as session:
            for record in session.run(rel_query):
                by_rel[record["rel_type"]] = record["cnt"]

        result["byRelType"] = by_rel
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
