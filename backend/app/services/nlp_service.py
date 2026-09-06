"""
AtmoGraph — Enhanced NLP Entity Extraction Service
Week 4 / Post-Processing Refinements:
- Reclassifies misclassified supply-chain facilities (e.g. "Mundra Container Yard" labeled as PERSON -> FAC).
- Identifies news sources / publishers (e.g. "India Shipping News", "Journal of Commerce" -> SOURCE / is_source=True).
- Tags numeric, quantitative, and temporal entities so they are not treated as graph nodes.
- Deduplicates extracted entities to maintain consistent UI counts.
"""

import re
import spacy
from typing import Dict, List, Any, Optional, Set

# Known news publishers & industry trade press
KNOWN_NEWS_PUBLISHERS: Set[str] = {
    "india shipping news",
    "journal of commerce",
    "global trade magazine",
    "transport topics",
    "maritime logistics daily",
    "european freight review",
    "pacific shipping journal",
    "asia logistics weekly",
    "continental industrial wire",
    "reuters",
    "bbc",
    "cnn",
    "bloomberg",
    "financial times",
    "wall street journal",
    "associated press",
    "ap news",
    "cnbc",
    "the maritime executive",
    "freightwaves",
    "lloyd's list",
    "supply chain dive",
}

# Regex patterns identifying publisher / media / wire sources
PUBLISHER_PATTERNS = [
    r"\bshipping news\b",
    r"\btrade magazine\b",
    r"\blogistics weekly\b",
    r"\bfreight review\b",
    r"\bmaritime daily\b",
    r"\bmaritime news\b",
    r"\bindustrial wire\b",
    r"\bnews service\b",
    r"\bpress agency\b",
    r"\bwire service\b",
    r"\bjournal of commerce\b",
    r"\bnews agency\b",
]

# Obvious supply-chain facility keywords for correcting misclassified entities (e.g. PERSON -> FAC)
FACILITY_KEYWORDS = [
    "port",
    "container yard",
    "container terminal",
    "terminal",
    "distribution center",
    "distribution centre",
    "warehouse",
    "logistics hub",
    "harbor",
    "harbour",
    "airport",
    "docks",
    "dockyard",
    "freight corridor",
    "berth",
    "depot",
    "rail yard",
    "freight terminal",
]

# Non-graph entity types
NUMERIC_TEMPORAL_LABELS = {
    "CARDINAL",
    "QUANTITY",
    "PERCENT",
    "MONEY",
    "DATE",
    "TIME",
    "ORDINAL",
}


class NLPService:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        
        # Add EntityRuler before statistical NER to reliably capture domain terms
        ruler = self.nlp.add_pipe("entity_ruler", before="ner")
        ruler_patterns = [
            # Ports & Port Authorities
            {"label": "FAC", "pattern": "Chennai Port Authority"},
            {"label": "FAC", "pattern": "Chennai Port"},
            {"label": "FAC", "pattern": "Port of Chennai"},
            {"label": "FAC", "pattern": "Rotterdam Port"},
            {"label": "FAC", "pattern": "Port of Rotterdam"},
            {"label": "FAC", "pattern": "Los Angeles Port"},
            {"label": "FAC", "pattern": "Port of Los Angeles"},
            {"label": "FAC", "pattern": "LA Port"},
            {"label": "FAC", "pattern": "Mundra Container Yard"},
            {"label": "FAC", "pattern": "California Distribution Center"},
            {"label": "FAC", "pattern": "Bangalore Distribution Center"},
            {"label": "FAC", "pattern": "Amsterdam Distribution Center"},
            {"label": "FAC", "pattern": [{"LOWER": "top"}, {"LOWER": "u.s."}, {"LOWER": "ports"}]},
            {"label": "FAC", "pattern": [{"LOWER": "top"}, {"LOWER": "us"}, {"LOWER": "ports"}]},
            # Geographic / Countries
            {"label": "GPE", "pattern": "U.S."},
            {"label": "GPE", "pattern": "United States"},
            {"label": "GPE", "pattern": "USA"},
            {"label": "GPE", "pattern": "Netherlands"},
            {"label": "GPE", "pattern": "India"},
            # Publishers & Trade Media
            {"label": "SOURCE", "pattern": "Journal of Commerce"},
            {"label": "SOURCE", "pattern": "India Shipping News"},
            {"label": "SOURCE", "pattern": "Transport Topics"},
            {"label": "SOURCE", "pattern": "Global Trade Magazine"},
            {"label": "SOURCE", "pattern": "Maritime Logistics Daily"},
            {"label": "SOURCE", "pattern": "European Freight Review"},
            {"label": "SOURCE", "pattern": "Pacific Shipping Journal"},
            {"label": "SOURCE", "pattern": "Asia Logistics Weekly"},
            {"label": "SOURCE", "pattern": "Continental Industrial Wire"},
            {"label": "SOURCE", "pattern": "FreightWaves"},
            {"label": "SOURCE", "pattern": "Supply Chain Dive"},
            {"label": "SOURCE", "pattern": "Reuters"},
            {"label": "SOURCE", "pattern": "Bloomberg"},
        ]
        ruler.add_patterns(ruler_patterns)

    def is_news_publisher(self, text: str, source: Optional[str] = None) -> bool:
        """Determines if the given text represents a news agency or publication."""
        clean = text.strip().lower()
        if not clean:
            return False

        # Match known publishers
        if clean in KNOWN_NEWS_PUBLISHERS:
            return True

        # Match article source if supplied
        if source:
            clean_source = source.strip().lower()
            if clean == clean_source or clean in clean_source or clean_source in clean:
                return True

        # Pattern heuristics
        for pattern in PUBLISHER_PATTERNS:
            if re.search(pattern, clean):
                return True

        return False

    def is_facility_name(self, text: str) -> bool:
        """Checks if text contains distinct facility/logistics infrastructure tokens."""
        clean = text.strip().lower()
        for kw in FACILITY_KEYWORDS:
            # Word-boundary match for the keyword
            if re.search(rf"\b{re.escape(kw)}\b", clean):
                return True
        return False

    def extract_entities(self, text: str, source: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts named entities with supply-chain post-processing rules:
        - Reclassifies facility names (e.g. PERSON -> FAC)
        - Labels news publishers/sources as SOURCE (is_source=True)
        - Deduplicates entities to maintain consistent UI counts
        """
        if not text or not str(text).strip():
            return []

        doc = self.nlp(text)
        raw_entities: List[Dict[str, Any]] = []

        # If article source is explicitly provided and mentioned in text, ensure it's tracked
        if source and str(source).strip():
            clean_src = str(source).strip()
            if clean_src.lower() in text.lower():
                raw_entities.append({
                    "text": clean_src,
                    "label": "SOURCE",
                    "is_source": True,
                })

        KNOWN_GEOGRAPHIC_NAMES = {
            "rotterdam", "chennai", "los angeles", "amsterdam", "bangalore", "bengaluru",
            "india", "usa", "netherlands", "california"
        }

        for ent in doc.ents:
            ent_text = ent.text.strip()
            ent_label = ent.label_

            # Clean leading/trailing hyphens, dashes, colons, or quotes
            ent_text = re.sub(r"^[\s\-–—:\'\"`]+|[\s\-–—:\'\"`]+$", "", ent_text).strip()

            if not ent_text or len(ent_text) <= 1:
                continue

            # Skip single-word verbs or junk tokens mislabeled by statistical NER
            if ent_label in ("ORG", "MISC", "PERSON") and ent_text.lower() in {
                "restart", "disrupts", "delays", "reports", "says", "warns", "halts", "faces", "chaotic"
            }:
                continue

            # Check if token boundary expansion for ports/facilities applies
            start_idx = ent.start
            end_idx = ent.end
            if start_idx >= 2 and doc[start_idx - 2 : start_idx].text.strip().lower() == "port of":
                ent_text = doc[start_idx - 2 : end_idx].text.strip()
                ent_label = "FAC"
            elif start_idx >= 1 and doc[start_idx - 1].text.strip().lower() == "port":
                ent_text = doc[start_idx - 1 : end_idx].text.strip()
                ent_label = "FAC"
            elif end_idx < len(doc) and doc[end_idx].text.strip().lower() in ("port", "terminal", "yard", "harbor", "harbour"):
                ent_text = doc[start_idx : end_idx + 1].text.strip()
                ent_label = "FAC"

            is_source = False

            # 1. Check if news publisher / source
            if self.is_news_publisher(ent_text, source=source):
                ent_label = "SOURCE"
                is_source = True

            # 2. Check facility correction (e.g. PERSON or ORG with container yard/port keywords -> FAC)
            elif ent_label in ("PERSON", "ORG", "MISC", "PRODUCT") and self.is_facility_name(ent_text):
                ent_label = "FAC"

            # 3. Known geographic location misclassified as PERSON -> LOC
            elif ent_label == "PERSON" and ent_text.strip().lower() in KNOWN_GEOGRAPHIC_NAMES:
                ent_label = "LOC"

            raw_entities.append({
                "text": ent_text,
                "label": ent_label,
                "is_source": is_source,
                "is_numeric": ent_label in NUMERIC_TEMPORAL_LABELS,
            })

        # 3. Deduplicate entities by lowercased text (maintaining first occurrence order)
        deduped: List[Dict[str, Any]] = []
        seen_texts: Set[str] = set()

        for e in raw_entities:
            key = e["text"].lower()
            if key not in seen_texts:
                seen_texts.add(key)
                deduped.append(e)

        return deduped


_default_nlp_service = None

def extract_entities(text: str, source: Optional[str] = None) -> List[Dict[str, Any]]:
    global _default_nlp_service
    if _default_nlp_service is None:
        _default_nlp_service = NLPService()
    return _default_nlp_service.extract_entities(text, source=source)


if __name__ == "__main__":
    service = NLPService()

    sample_text = (
        "According to India Shipping News, severe congestion at Mundra Container Yard has paralyzed "
        "regional freight, with around 5,000 containers delayed. Journal of Commerce reported that "
        "Chennai Port and Port of Rotterdam continue to operate under heightened alert."
    )

    extracted = service.extract_entities(sample_text, source="India Shipping News")

    print("\nExtracted & Post-Processed Entities:")
    print("-" * 65)
    for ent in extracted:
        src_tag = " [NEWS SOURCE]" if ent.get("is_source") else ""
        num_tag = " [NUMERIC/DATE]" if ent.get("is_numeric") else ""
        print(f"'{ent['text']}' -> {ent['label']}{src_tag}{num_tag}")