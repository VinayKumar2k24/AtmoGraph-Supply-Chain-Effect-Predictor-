import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.database.neo4j_db import driver


CONSTRAINTS = [
    """
    CREATE CONSTRAINT supplier_id_unique IF NOT EXISTS
    FOR (s:Supplier)
    REQUIRE s.id IS UNIQUE
    """,

    """
    CREATE CONSTRAINT manufacturer_id_unique IF NOT EXISTS
    FOR (m:Manufacturer)
    REQUIRE m.id IS UNIQUE
    """,

    """
    CREATE CONSTRAINT port_id_unique IF NOT EXISTS
    FOR (p:Port)
    REQUIRE p.id IS UNIQUE
    """,

    """
    CREATE CONSTRAINT product_id_unique IF NOT EXISTS
    FOR (p:Product)
    REQUIRE p.id IS UNIQUE
    """
]


def main():
    with driver.session(database="neo4j") as session:

        for constraint in CONSTRAINTS:
            session.run(constraint).consume()

    print("All Neo4j constraints created successfully.")

    driver.close()


if __name__ == "__main__":
    main()