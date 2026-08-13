import sys
import json
from pathlib import Path

# ============================================================
# PROJECT ROOT
# ============================================================

ROOT = Path(__file__).resolve().parents[3]

# Add project root to Python path
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ============================================================
# NEO4J DATABASE
# ============================================================

from backend.app.database.neo4j_db import db


# ============================================================
# DATA FILE
# ============================================================

DATA_FILE = ROOT / "data" / "mock_supply_chain.json"


# ============================================================
# LOAD JSON DATA
# ============================================================

def load_data():
    """
    Load mock supply-chain data from JSON file.
    """

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Mock supply-chain data file not found:\n{DATA_FILE}"
        )

    with open(DATA_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


# ============================================================
# CREATE SUPPLY CHAIN GRAPH
# ============================================================

def create_graph(data):

    # --------------------------------------------------------
    # COUNTRIES
    # --------------------------------------------------------

    for country in data["countries"]:

        db.execute_query(
            """
            MERGE (c:Country {id: $id})
            SET c.name = $name
            """,
            country
        )


    # --------------------------------------------------------
    # SUPPLIERS
    # --------------------------------------------------------

    for supplier in data["suppliers"]:

        db.execute_query(
            """
            MERGE (s:Supplier {id: $id})
            SET s.name = $name,
                s.risk = $risk,
                s.status = 'NORMAL'

            WITH s

            MATCH (c:Country {id: $country})

            MERGE (s)-[:LOCATED_IN]->(c)
            """,
            supplier
        )


    # --------------------------------------------------------
    # MANUFACTURERS
    # --------------------------------------------------------

    for manufacturer in data["manufacturers"]:

        db.execute_query(
            """
            MERGE (m:Manufacturer {id: $id})
            SET m.name = $name,
                m.status = 'NORMAL',
                m.risk = 0.0

            WITH m

            MATCH (c:Country {id: $country})

            MERGE (m)-[:LOCATED_IN]->(c)
            """,
            manufacturer
        )


    # --------------------------------------------------------
    # PRODUCTS
    # --------------------------------------------------------

    for product in data["products"]:

        db.execute_query(
            """
            MERGE (p:Product {id: $id})
            SET p.name = $name,
                p.category = $category
            """,
            product
        )


    # --------------------------------------------------------
    # PORTS
    # --------------------------------------------------------

    for port in data["ports"]:

        db.execute_query(
            """
            MERGE (p:Port {id: $id})
            SET p.name = $name,
                p.status = 'OPERATIONAL',
                p.risk = 0.0

            WITH p

            MATCH (c:Country {id: $country})

            MERGE (p)-[:LOCATED_IN]->(c)
            """,
            port
        )


    # --------------------------------------------------------
    # WAREHOUSES
    # --------------------------------------------------------

    for warehouse in data["warehouses"]:

        db.execute_query(
            """
            MERGE (w:Warehouse {id: $id})
            SET w.name = $name,
                w.status = 'OPERATIONAL'

            WITH w

            MATCH (c:Country {id: $country})

            MERGE (w)-[:LOCATED_IN]->(c)
            """,
            warehouse
        )


    # ========================================================
    # SUPPLIER → MANUFACTURER
    # ========================================================

    supplier_manufacturer_relationships = [
        ("SUP001", "MAN001"),
        ("SUP002", "MAN001"),
        ("SUP003", "MAN002"),
        ("SUP001", "MAN003"),
    ]

    for supplier_id, manufacturer_id in supplier_manufacturer_relationships:

        db.execute_query(
            """
            MATCH (s:Supplier {id: $supplier_id})
            MATCH (m:Manufacturer {id: $manufacturer_id})

            MERGE (s)-[:SUPPLIES]->(m)
            """,
            {
                "supplier_id": supplier_id,
                "manufacturer_id": manufacturer_id,
            }
        )


    # ========================================================
    # MANUFACTURER → PRODUCT
    # ========================================================

    manufacturer_product_relationships = [
        ("MAN001", "PROD001"),
        ("MAN001", "PROD002"),
        ("MAN002", "PROD003"),
        ("MAN003", "PROD001"),
    ]

    for manufacturer_id, product_id in manufacturer_product_relationships:

        db.execute_query(
            """
            MATCH (m:Manufacturer {id: $manufacturer_id})
            MATCH (p:Product {id: $product_id})

            MERGE (m)-[:PRODUCES]->(p)
            """,
            {
                "manufacturer_id": manufacturer_id,
                "product_id": product_id,
            }
        )


    # ========================================================
    # MANUFACTURER → PORT
    # ========================================================

    manufacturer_port_relationships = [
        ("MAN001", "PORT003"),
        ("MAN002", "PORT004"),
        ("MAN003", "PORT005"),
    ]

    for manufacturer_id, port_id in manufacturer_port_relationships:

        db.execute_query(
            """
            MATCH (m:Manufacturer {id: $manufacturer_id})
            MATCH (p:Port {id: $port_id})

            MERGE (m)-[:SHIPS_THROUGH]->(p)
            """,
            {
                "manufacturer_id": manufacturer_id,
                "port_id": port_id,
            }
        )


    # ========================================================
    # PORT → PORT
    # ========================================================

    port_connections = [
        ("PORT002", "PORT005"),
        ("PORT005", "PORT003"),
        ("PORT003", "PORT001"),
        ("PORT004", "PORT001"),
        ("PORT002", "PORT004"),
    ]

    for source_port, target_port in port_connections:

        db.execute_query(
            """
            MATCH (source:Port {id: $source})
            MATCH (target:Port {id: $target})

            MERGE (source)-[:CONNECTED_TO]->(target)
            """,
            {
                "source": source_port,
                "target": target_port,
            }
        )


    # ========================================================
    # SUCCESS MESSAGE
    # ========================================================

    print()
    print("=" * 60)
    print("ATMO GRAPH SUPPLY-CHAIN SEEDING COMPLETED")
    print("=" * 60)
    print("Countries       : Created")
    print("Suppliers       : Created")
    print("Manufacturers   : Created")
    print("Products        : Created")
    print("Ports           : Created")
    print("Warehouses      : Created")
    print("Relationships   : Created")
    print("=" * 60)
    print("Supply-chain graph created successfully.")
    print("=" * 60)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    try:

        print()
        print("Connecting to Neo4j...")

        db.verify()

        print("Neo4j connection successful.")
        print()

        print("Loading mock supply-chain data...")

        data = load_data()

        print(f"Data file: {DATA_FILE}")
        print()

        print("Creating AtmoGraph supply-chain graph...")

        create_graph(data)

    except Exception as error:

        print()
        print("=" * 60)
        print("ERROR WHILE CREATING SUPPLY-CHAIN GRAPH")
        print("=" * 60)
        print(error)
        print("=" * 60)

        raise

    finally:

        db.close()