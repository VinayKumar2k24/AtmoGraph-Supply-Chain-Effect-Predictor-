import sys
from pathlib import Path

# Resolve project root
ROOT_DIR = Path(__file__).resolve().parents[3]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.news_graph_service import NewsGraphService


def main():

    print()
    print("=" * 70)
    print("ATMOGRAPH NEWS GRAPH MAPPING TEST")
    print("=" * 70)

    # ---------------------------------------------------------
    # News file
    # ---------------------------------------------------------

    news_file = (
        ROOT_DIR
        / "data"
        / "news"
        / "port_strike_europe.json"
    )

    print()
    print("News File:")
    print(news_file)

    if not news_file.exists():
        print()
        print("ERROR: News file not found.")
        print("Expected:")
        print(news_file)
        return

    # ---------------------------------------------------------
    # Create service
    # ---------------------------------------------------------

    service = NewsGraphService()

    # ---------------------------------------------------------
    # Process news
    # ---------------------------------------------------------

    result = service.process_news(str(news_file))

    # ---------------------------------------------------------
    # Display news information
    # ---------------------------------------------------------

    print()
    print("NEWS GRAPH MAPPING")
    print("=" * 70)

    print()
    print("News ID:", result["id"])
    print("News:", result["title"])

    # ---------------------------------------------------------
    # Display matched entities
    # ---------------------------------------------------------

    print()
    print("Entity Mapping")
    print("-" * 70)

    for entity in result["entities"]:

        text = entity["text"]
        label = entity["label"]
        matched = entity["matched"]
        graph_type = entity["graph_type"]

        if matched:
            print(
                f"{text} -> {label} -> "
                f"MATCHED AS {graph_type}"
            )
        else:
            print(
                f"{text} -> {label} -> "
                f"NOT FOUND"
            )

    # ---------------------------------------------------------
    # Summary
    # ---------------------------------------------------------

    total = len(result["entities"])

    matched_count = sum(
        1
        for entity in result["entities"]
        if entity["matched"]
    )

    print()
    print("=" * 70)
    print("MAPPING SUMMARY")
    print("=" * 70)

    print("Total extracted entities :", total)
    print("Matched entities         :", matched_count)
    print("Unmatched entities       :", total - matched_count)

    print()
    print("=" * 70)
    print("NEWS GRAPH MAPPING TEST COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    main()