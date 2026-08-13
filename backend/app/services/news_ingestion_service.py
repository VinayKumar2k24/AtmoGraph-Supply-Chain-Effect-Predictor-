import sys
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


from backend.app.services.nlp_service import NLPService


class NewsIngestionService:

    def __init__(self):
        self.nlp_service = NLPService()

    def load_news(self, file_path: str):

        path = Path(file_path)

        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)

    def process_news(self, file_path: str):

        news = self.load_news(file_path)

        entities = self.nlp_service.extract_entities(
            news["text"]
        )

        return {
            "id": news["id"],
            "title": news["title"],
            "source": news["source"],
            "published_at": news["published_at"],
            "text": news["text"],
            "entities": entities
        }


if __name__ == "__main__":

    project_root = Path(__file__).resolve().parents[3]

    news_file = (
        project_root
        / "data"
        / "news"
        / "port_strike_europe.json"
    )

    service = NewsIngestionService()

    result = service.process_news(str(news_file))

    print("\nNews Processing Result")
    print("=" * 50)

    print("News ID:", result["id"])
    print("Title:", result["title"])

    print("\nEntities:")
    print("-" * 50)

    for entity in result["entities"]:
        print(
            f"{entity['text']} -> {entity['label']}"
        )