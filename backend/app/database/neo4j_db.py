import os
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase


# ---------------------------------------------------------
# Load .env from project root
# ---------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = ROOT_DIR / ".env"

load_dotenv(ENV_FILE)


# ---------------------------------------------------------
# Neo4j Configuration
# ---------------------------------------------------------

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


if not NEO4J_PASSWORD:
    raise RuntimeError(
        "NEO4J_PASSWORD is not set in the .env file."
    )


# ---------------------------------------------------------
# Neo4j Database Wrapper
# ---------------------------------------------------------

class Neo4jDatabase:

    def __init__(self):
        self.driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(
                NEO4J_USERNAME,
                NEO4J_PASSWORD
            )
        )

    # -----------------------------------------------------
    # Verify Neo4j connection
    # -----------------------------------------------------

    def verify(self):
        self.driver.verify_connectivity()

        print("Neo4j connection successful.")
        return True

    # -----------------------------------------------------
    # Create session
    # -----------------------------------------------------

    def session(self):
        return self.driver.session(
            database=NEO4J_DATABASE
        )

    # -----------------------------------------------------
    # Execute Cypher query
    # -----------------------------------------------------

    def execute_query(self, query, parameters=None):

        if parameters is None:
            parameters = {}

        with self.driver.session(
            database=NEO4J_DATABASE
        ) as session:

            result = session.run(
                query,
                parameters
            )

            return result.consume()

    # -----------------------------------------------------
    # Close connection
    # -----------------------------------------------------

    def close(self):
        self.driver.close()


# ---------------------------------------------------------
# Global database object
# ---------------------------------------------------------

db = Neo4jDatabase()