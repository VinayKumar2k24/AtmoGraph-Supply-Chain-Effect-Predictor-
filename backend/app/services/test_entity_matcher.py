from backend.app.services.entity_matcher import EntityMatcher
from backend.app.database.neo4j_db import db


def main():

    matcher = EntityMatcher()

    print("\n" + "=" * 60)
    print("ATMoGraph ENTITY MATCHER TEST")
    print("=" * 60)

    # ---------------------------------------------------------
    # Test Country
    # ---------------------------------------------------------

    print("\n[1] Testing Country")
    print("-" * 60)

    result = matcher.find_country("Netherlands")

    if result:
        print("MATCH FOUND:")
        print(result)
    else:
        print("NO MATCH FOUND")


    # ---------------------------------------------------------
    # Test Supplier
    # ---------------------------------------------------------

    print("\n[2] Testing Supplier")
    print("-" * 60)

    result = matcher.find_supplier(
        "Global Electronics Components"
    )

    if result:
        print("MATCH FOUND:")
        print(result)
    else:
        print("NO MATCH FOUND")


    # ---------------------------------------------------------
    # Test Manufacturer
    # ---------------------------------------------------------

    print("\n[3] Testing Manufacturer")
    print("-" * 60)

    result = matcher.find_manufacturer(
        "European Precision Parts"
    )

    if result:
        print("MATCH FOUND:")
        print(result)
    else:
        print("NO MATCH FOUND")


    # ---------------------------------------------------------
    # Test Port
    # ---------------------------------------------------------

    print("\n[4] Testing Port")
    print("-" * 60)

    result = matcher.find_port(
        "Port of Rotterdam"
    )

    if result:
        print("MATCH FOUND:")
        print(result)
    else:
        print("NO MATCH FOUND")


    # ---------------------------------------------------------
    # Case-insensitive test
    # ---------------------------------------------------------

    print("\n[5] Testing Case-Insensitive Matching")
    print("-" * 60)

    result = matcher.find_country("netherlands")

    if result:
        print("CASE-INSENSITIVE MATCH WORKING")
    else:
        print("CASE-INSENSITIVE MATCH FAILED")


    db.close()

    print("\n" + "=" * 60)
    print("ENTITY MATCHER TEST COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    main()