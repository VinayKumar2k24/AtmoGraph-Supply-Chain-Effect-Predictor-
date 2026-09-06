import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.news_ingestion_service import NewsIngestionService
from backend.app.services.entity_matcher import EntityMatcher
from backend.app.database.neo4j_db import db


class NewsGraphService:

    def __init__(self):
        self.news_service = NewsIngestionService()
        self.entity_matcher = EntityMatcher()

    def match_entity(self, entity, source=None):
        return self.entity_matcher.match_entity(entity, source=source)

    # ========================================================
    # APPLY NEWS RISK
    # ========================================================

    def apply_news_risk(self, entity):

        if not entity.get("matched"):
            return

        if entity.get("is_source"):
            return

        graph_type = entity.get("graph_type")
        canonical_name = entity.get("canonical_name") or entity.get("text")

        risk_values = {
            "Port": 0.70,
            "Warehouse": 0.50,
            "Supplier": 0.40,
            "Manufacturer": 0.30,
            "Country": 0.20
        }

        risk = risk_values.get(graph_type)

        if risk is None:
            return

        label = graph_type

        query = f"""
        MATCH (n:{label})
        WHERE toLower(n.name) = toLower($name)
           OR toLower(n.name) CONTAINS toLower($name)

        SET n.risk = CASE
            WHEN coalesce(n.risk, 0.0) < $risk
            THEN $risk
            ELSE n.risk
        END

        RETURN n
        """

        with db.session() as session:

            session.run(
                query,
                {
                    "name": canonical_name,
                    "risk": risk
                }
            ).consume()

    # ========================================================
    # APPLY PORT STRIKE IMPACT
    # ========================================================

    def apply_port_strike_impact(self):

        with db.session() as session:

            # Rotterdam
            session.run(
                """
                MATCH (p:Port)
                WHERE
                    toLower(p.name) CONTAINS 'rotterdam'
                    OR toLower(p.name) CONTAINS 'port of rotterdam'

                SET
                    p.risk = 0.70,
                    p.status = 'DISRUPTED'

                RETURN p
                """
            ).consume()

            # Global Electronics Components
            session.run(
                """
                MATCH (s:Supplier)
                WHERE toLower(s.name) CONTAINS
                      'global electronics components'

                SET
                    s.risk = CASE
                        WHEN coalesce(s.risk, 0.0) < 0.40
                        THEN 0.40
                        ELSE s.risk
                    END,

                    s.status = 'AT_RISK'

                RETURN s
                """
            ).consume()

            # European Precision Parts
            session.run(
                """
                MATCH (s:Supplier)
                WHERE toLower(s.name) CONTAINS
                      'european precision parts'

                SET
                    s.risk = CASE
                        WHEN coalesce(s.risk, 0.0) < 0.40
                        THEN 0.40
                        ELSE s.risk
                    END,

                    s.status = 'AT_RISK'

                RETURN s
                """
            ).consume()

    # ========================================================
    # PROCESS NEWS
    # ========================================================

    def process_news(self, file_path: str):

        news = self.news_service.process_news(file_path)

        matched_entities = []

        article_source = news.get("source")
        for entity in news["entities"]:

            matched = self.match_entity(entity, source=article_source)

            matched_entities.append(matched)

            self.apply_news_risk(matched)

        # NEWS001 = European Port Strike
        if news["id"] == "NEWS001":

            self.apply_port_strike_impact()

        return {
            "id": news["id"],
            "title": news["title"],
            "source": news["source"],
            "published_at": news["published_at"],
            "text": news.get("text", ""),
            "entities": matched_entities
        }