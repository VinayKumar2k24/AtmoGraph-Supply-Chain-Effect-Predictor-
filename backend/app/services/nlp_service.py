import spacy


class NLPService:

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def extract_entities(self, text: str):
        doc = self.nlp(text)

        entities = []

        for ent in doc.ents:
            entities.append(
                {
                    "text": ent.text,
                    "label": ent.label_
                }
            )

        return entities


if __name__ == "__main__":

    service = NLPService()

    text = """
    Workers at the Port of Rotterdam in the Netherlands have started
    a major strike, disrupting container shipments. Global Electronics
    Components and European Precision Parts may experience delays.
    """

    entities = service.extract_entities(text)

    print("\nExtracted Entities:")
    print("-" * 40)

    for entity in entities:
        print(
            f"{entity['text']} -> {entity['label']}"
        )