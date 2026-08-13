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

    def match_entity(self, entity):

        text = entity["text"]
        label = entity["label"]

        result = None
        matched_type = None

        if label == "GPE":

            result = self.entity_matcher.find_country(text)

            if result:
                matched_type = "Country"

        elif label == "LOC":

            result = self.entity_matcher.find_port(text)

            if result:
                matched_type = "Port"

        elif label == "ORG":

            result = self.entity_matcher.find_supplier(text)

            if result:
                matched_type = "Supplier"

            else:

                result = self.entity_matcher.find_manufacturer(text)

                if result:
                    matched_type = "Manufacturer"

        return {
            "text": text,
            "label": label,
            "matched": bool(result),
            "graph_type": matched_type
        }

    # ========================================================
    # APPLY NEWS RISK
    # ========================================================

    def apply_news_risk(self, entity):

        if not entity["matched"]:
            return

        text = entity["text"]
        graph_type = entity["graph_type"]

        risk_values = {
            "Port": 0.70,
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
        WHERE toLower(n.name) CONTAINS toLower($name)

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
                    "name": text,
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

        for entity in news["entities"]:

            matched = self.match_entity(entity)

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
            "entities": matched_entities
        }