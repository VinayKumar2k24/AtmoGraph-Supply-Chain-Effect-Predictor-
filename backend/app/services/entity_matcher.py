"""
AtmoGraph — Enhanced Type-Aware Entity Matcher
Provides conservative, semantically accurate matching of NLP-extracted entities to Neo4j graph nodes.

Features:
- Robust normalization: lowercase, punctuation stripping, extra whitespace removal, hyphen normalization,
  common geographic synonyms (United States / U.S. / US -> USA; Netherlands), port authority resolution.
- Centralized GRAPH_ALIASES dictionary for all 18 Neo4j graph nodes.
- Explicit entity categorization:
    * SUPPLY_CHAIN_ENTITY (GPE, LOC, FAC, relevant ORG, Product, etc.)
    * NON_GRAPH_ENTITY (publishers, sources, cardinals, quantities, dates, times, money, percentages)
- 4-Tier matching priority:
    1. Exact normalized node-name match (confidence: 1.0)
    2. Alias match from GRAPH_ALIASES (confidence: 0.95)
    3. Controlled type-compatible fuzzy match (threshold >= 0.85)
    4. Otherwise unmatched supply chain entity (status: "not_in_graph", confidence: 0)
- Clean, structured response schema distinguishing "matched", "not_in_graph", and "not_graph_candidate".
"""

import re
import difflib
import logging
from typing import Dict, List, Any, Optional, Set, Tuple

logger = logging.getLogger("atmo_entity_matcher")

# Corporate / organizational suffixes to strip during normalization
CORPORATE_SUFFIXES = [
    r"\bpvt\s+ltd\b",
    r"\bltd\b",
    r"\binc\b",
    r"\bllc\b",
    r"\bcorp\b",
    r"\bcorporation\b",
    r"\bcompany\b",
    r"\bco\b",
    r"\bgmbh\b",
    r"\bag\b",
    r"\bsa\b",
    r"\bplc\b",
]

# News publisher names & substrings that MUST NOT be matched to graph nodes
KNOWN_NEWS_SOURCES: Set[str] = {
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

# Non-graph entity types
NON_GRAPH_LABELS: Set[str] = {
    "CARDINAL",
    "DATE",
    "TIME",
    "MONEY",
    "PERCENT",
    "QUANTITY",
    "ORDINAL",
    "PERSON",
    "SOURCE",
    "NEWS_SOURCE",
}

# Type compatibility matrix: maps NER label to permissible graph entity types
NER_TO_GRAPH_TYPES: Dict[str, Set[str]] = {
    "GPE": {"Country", "Port", "Warehouse"},
    "LOC": {"Port", "Warehouse", "Country"},
    "FAC": {"Port", "Warehouse"},
    "ORG": {"Supplier", "Manufacturer"},
    "PRODUCT": {"Product"},
    "MISC": {"Product", "Supplier", "Manufacturer"},
    "PERSON": set(),
    "SOURCE": set(),
    "CARDINAL": set(),
    "QUANTITY": set(),
    "PERCENT": set(),
    "MONEY": set(),
    "DATE": set(),
    "TIME": set(),
}

# The canonical 18 supply-chain nodes in AtmoGraph Neo4j database
CANONICAL_NODES: Dict[str, Dict[str, Any]] = {
    # Ports (3)
    "Los Angeles Port": {"id": "P001", "name": "Los Angeles Port", "type": "Port"},
    "Chennai Port": {"id": "P002", "name": "Chennai Port", "type": "Port"},
    "Rotterdam Port": {"id": "P003", "name": "Rotterdam Port", "type": "Port"},
    # Warehouses (3)
    "California Distribution Center": {"id": "W001", "name": "California Distribution Center", "type": "Warehouse"},
    "Bangalore Distribution Center": {"id": "W002", "name": "Bangalore Distribution Center", "type": "Warehouse"},
    "Amsterdam Distribution Center": {"id": "W003", "name": "Amsterdam Distribution Center", "type": "Warehouse"},
    # Suppliers (3)
    "Global Electronics Components": {"id": "S001", "name": "Global Electronics Components", "type": "Supplier"},
    "Asia Semiconductor Supply": {"id": "S002", "name": "Asia Semiconductor Supply", "type": "Supplier"},
    "European Precision Parts": {"id": "S003", "name": "European Precision Parts", "type": "Supplier"},
    # Manufacturers (3)
    "North America Electronics": {"id": "M001", "name": "North America Electronics", "type": "Manufacturer"},
    "India Assembly Works": {"id": "M002", "name": "India Assembly Works", "type": "Manufacturer"},
    "European Consumer Devices": {"id": "M003", "name": "European Consumer Devices", "type": "Manufacturer"},
    # Countries (3)
    "India": {"id": None, "name": "India", "type": "Country"},
    "USA": {"id": None, "name": "USA", "type": "Country"},
    "Netherlands": {"id": None, "name": "Netherlands", "type": "Country"},
    # Products (3)
    "Microcontroller": {"id": "PR001", "name": "Microcontroller", "type": "Product"},
    "Power Management IC": {"id": "PR002", "name": "Power Management IC", "type": "Product"},
    "Electronic Sensor": {"id": "PR003", "name": "Electronic Sensor", "type": "Product"},
}

# Centralized graph alias dictionary mapping normalized alias strings to canonical node names
GRAPH_ALIASES: Dict[str, str] = {
    # Chennai Port
    "chennai port": "Chennai Port",
    "chennai port authority": "Chennai Port",
    "port of chennai": "Chennai Port",
    "chennai harbor": "Chennai Port",
    "chennai container terminal": "Chennai Port",
    "chennai": "Chennai Port",
    # Rotterdam Port
    "rotterdam port": "Rotterdam Port",
    "port of rotterdam": "Rotterdam Port",
    "rotterdam harbor": "Rotterdam Port",
    "rotterdam container terminal": "Rotterdam Port",
    "rotterdam": "Rotterdam Port",
    # Los Angeles Port
    "los angeles port": "Los Angeles Port",
    "port of los angeles": "Los Angeles Port",
    "la port": "Los Angeles Port",
    "port of la": "Los Angeles Port",
    "los angeles harbor": "Los Angeles Port",
    "los angeles container terminal": "Los Angeles Port",
    "los angeles": "Los Angeles Port",
    # Warehouses
    "california distribution center": "California Distribution Center",
    "california distribution centre": "California Distribution Center",
    "california dc": "California Distribution Center",
    "california warehouse": "California Distribution Center",
    "bangalore distribution center": "Bangalore Distribution Center",
    "bangalore distribution centre": "Bangalore Distribution Center",
    "bengaluru distribution center": "Bangalore Distribution Center",
    "bengaluru distribution centre": "Bangalore Distribution Center",
    "bangalore dc": "Bangalore Distribution Center",
    "bengaluru dc": "Bangalore Distribution Center",
    "bangalore warehouse": "Bangalore Distribution Center",
    "amsterdam distribution center": "Amsterdam Distribution Center",
    "amsterdam distribution centre": "Amsterdam Distribution Center",
    "amsterdam dc": "Amsterdam Distribution Center",
    "amsterdam warehouse": "Amsterdam Distribution Center",
    # Suppliers
    "global electronics components": "Global Electronics Components",
    "global electronics": "Global Electronics Components",
    "gec": "Global Electronics Components",
    "asia semiconductor supply": "Asia Semiconductor Supply",
    "asia semiconductor": "Asia Semiconductor Supply",
    "ass": "Asia Semiconductor Supply",
    "european precision parts": "European Precision Parts",
    "european precision": "European Precision Parts",
    "epp": "European Precision Parts",
    # Manufacturers
    "north america electronics": "North America Electronics",
    "north american electronics": "North America Electronics",
    "nae": "North America Electronics",
    "india assembly works": "India Assembly Works",
    "india assembly": "India Assembly Works",
    "iaw": "India Assembly Works",
    "european consumer devices": "European Consumer Devices",
    "european consumer": "European Consumer Devices",
    "ecd": "European Consumer Devices",
    # Countries
    "india": "India",
    "republic of india": "India",
    "usa": "USA",
    "united states": "USA",
    "united states of america": "USA",
    "u s a": "USA",
    "u s": "USA",
    "us": "USA",
    "netherlands": "Netherlands",
    "the netherlands": "Netherlands",
    "holland": "Netherlands",
    # Products
    "microcontroller": "Microcontroller",
    "microcontrollers": "Microcontroller",
    "mcu": "Microcontroller",
    "power management ic": "Power Management IC",
    "pmic": "Power Management IC",
    "power management ics": "Power Management IC",
    "electronic sensor": "Electronic Sensor",
    "electronic sensors": "Electronic Sensor",
    "sensors": "Electronic Sensor",
}


def normalize_string(s: str, strip_suffixes: bool = True) -> str:
    """
    Cleans and normalizes text for robust matching:
    - lowercases
    - normalizes hyphens and dashes to spaces
    - strips leading 'the '
    - strips punctuation
    - removes redundant whitespace
    - optionally strips corporate suffixes
    - normalizes common geographic variants:
        United States / U.S. / US -> USA
        Netherlands -> Netherlands
    """
    if not s:
        return ""
    norm = str(s).lower().strip()

    # Normalize hyphens, dashes, and slashes to spaces
    norm = re.sub(r"[\-–—/]+", " ", norm)

    # Remove leading article
    if norm.startswith("the "):
        norm = norm[4:].strip()

    # Remove punctuation except letters and numbers
    norm = re.sub(r"[^\w\s]", " ", norm)
    norm = re.sub(r"\s+", " ", norm).strip()

    if strip_suffixes:
        for suffix_pat in CORPORATE_SUFFIXES:
            norm = re.sub(suffix_pat, "", norm).strip()
        norm = re.sub(r"\s+", " ", norm).strip()

    # Geographic variant normalizations
    geo_variants = {
        "united states": "usa",
        "united states of america": "usa",
        "u s a": "usa",
        "u s": "usa",
        "us": "usa",
        "the netherlands": "netherlands",
        "republic of india": "india",
    }
    if norm in geo_variants:
        norm = geo_variants[norm]

    return norm


class EntityMatcher:
    """
    Type-aware, conservative supply-chain entity matcher.
    Maps NER entities to canonical Neo4j supply chain nodes with confidence scoring.
    """

    def __init__(self):
        self.canonical_nodes = CANONICAL_NODES
        self.aliases = GRAPH_ALIASES

        # Pre-build normalized canonical index: norm_name -> canonical_name
        self._canonical_norm_map: Dict[str, str] = {}
        for canon_name in self.canonical_nodes:
            self._canonical_norm_map[normalize_string(canon_name)] = canon_name
            node_id = self.canonical_nodes[canon_name].get("id")
            if node_id:
                self._canonical_norm_map[node_id.lower()] = canon_name

        # Pre-build normalized alias index: norm_alias -> canonical_name
        self._alias_norm_map: Dict[str, str] = {}
        for alias_key, canon_name in self.aliases.items():
            self._alias_norm_map[normalize_string(alias_key)] = canon_name

    def is_source_or_publisher(self, text: str, source: Optional[str] = None) -> bool:
        """Identifies news publishers, wire services, and article sources."""
        clean = text.strip().lower()
        if clean in KNOWN_NEWS_SOURCES:
            return True

        if source:
            clean_source = source.strip().lower()
            if clean == clean_source or clean in clean_source or clean_source in clean:
                return True

        # Common publisher token indicators
        publisher_tokens = [
            "shipping news",
            "trade magazine",
            "logistics weekly",
            "freight review",
            "journal of commerce",
            "wire service",
            "press agency",
            "news service",
            "maritime daily",
            "maritime news",
            "transport topics",
        ]
        for token in publisher_tokens:
            if token in clean:
                return True

        return False

    def classify_category(self, text: str, label: str, is_source: bool = False) -> str:
        """Classifies an extracted entity into SUPPLY_CHAIN_ENTITY or NON_GRAPH_ENTITY."""
        if is_source or label in ("SOURCE", "NEWS_SOURCE") or self.is_source_or_publisher(text):
            return "NON_GRAPH_ENTITY"
        if label in NON_GRAPH_LABELS:
            return "NON_GRAPH_ENTITY"
        return "SUPPLY_CHAIN_ENTITY"

    def match_entity(
        self,
        entity: Dict[str, Any],
        source: Optional[str] = None,
        fuzzy_threshold: float = 0.85,
    ) -> Dict[str, Any]:
        """
        Main type-aware matching entrypoint.
        Given an entity dict {"text": ..., "label": ...}, evaluates compatibility,
        canonical matches, alias matches, and high-confidence fuzzy matches.

        Returns standard schema:
        {
          "text": "Chennai Port",
          "label": "FAC",
          "category": "SUPPLY_CHAIN_ENTITY",
          "status": "matched",
          "graph_node": "Chennai Port",
          "graph_node_type": "Port",
          "confidence": 1.0,
          "node_id": "P002",
          "matched": True,
          "canonical_name": "Chennai Port",
          "graph_type": "Port"
        }
        """
        text = str(entity.get("text", "")).strip()
        label = str(entity.get("label", "MISC")).strip()

        # 0. Identify if news publisher / source
        is_source = bool(
            entity.get("is_source") or
            label in ("SOURCE", "NEWS_SOURCE") or
            self.is_source_or_publisher(text, source)
        )
        if is_source:
            label = "SOURCE"

        category = self.classify_category(text, label, is_source=is_source)

        # 1. Non-graph candidates (publishers, numbers, dates, times, generic persons)
        if category == "NON_GRAPH_ENTITY":
            return {
                "text": text,
                "entity_name": text,
                "label": label,
                "category": "NON_GRAPH_ENTITY",
                "status": "not_graph_candidate",
                "graph_node": None,
                "graph_node_type": None,
                "confidence": 0,
                "node_id": None,
                "matched": False,
                "canonical_name": None,
                "graph_type": None,
                "is_source": is_source,
            }

        # 2. Permissible graph types for this NER label
        allowed_types = NER_TO_GRAPH_TYPES.get(
            label, {"Port", "Warehouse", "Supplier", "Manufacturer", "Product", "Country"}
        )
        if not allowed_types:
            return {
                "text": text,
                "entity_name": text,
                "label": label,
                "category": "SUPPLY_CHAIN_ENTITY",
                "status": "not_in_graph",
                "graph_node": None,
                "graph_node_type": None,
                "confidence": 0,
                "node_id": None,
                "matched": False,
                "canonical_name": None,
                "graph_type": None,
                "is_source": False,
            }

        norm_text = normalize_string(text)
        norm_no_suffix = normalize_string(text, strip_suffixes=True)

        if not norm_text:
            return {
                "text": text,
                "entity_name": text,
                "label": label,
                "category": "SUPPLY_CHAIN_ENTITY",
                "status": "not_in_graph",
                "graph_node": None,
                "graph_node_type": None,
                "confidence": 0,
                "node_id": None,
                "matched": False,
                "canonical_name": None,
                "graph_type": None,
                "is_source": False,
            }

        # ─────────────────────────────────────────────────────────────────────
        # TIER 1: Exact Normalized Canonical Node Match (Confidence: 1.0 / 100%)
        # ─────────────────────────────────────────────────────────────────────
        for key in (norm_text, norm_no_suffix):
            if key in self._canonical_norm_map:
                canon_name = self._canonical_norm_map[key]
                candidate = self.canonical_nodes[canon_name]
                if candidate["type"] in allowed_types:
                    return {
                        "text": text,
                        "entity_name": text,
                        "label": label,
                        "category": "SUPPLY_CHAIN_ENTITY",
                        "status": "matched",
                        "graph_node": candidate["name"],
                        "graph_node_type": candidate["type"],
                        "confidence": 1.0,
                        "node_id": candidate.get("id"),
                        "matched": True,
                        "canonical_name": candidate["name"],
                        "graph_type": candidate["type"],
                        "is_source": False,
                    }

        # ─────────────────────────────────────────────────────────────────────
        # TIER 2: Alias Match from GRAPH_ALIASES (Confidence: 0.95 / 95%)
        # ─────────────────────────────────────────────────────────────────────
        for key in (norm_text, norm_no_suffix):
            if key in self._alias_norm_map:
                canon_name = self._alias_norm_map[key]
                candidate = self.canonical_nodes[canon_name]
                if candidate["type"] in allowed_types:
                    return {
                        "text": text,
                        "entity_name": text,
                        "label": label,
                        "category": "SUPPLY_CHAIN_ENTITY",
                        "status": "matched",
                        "graph_node": candidate["name"],
                        "graph_node_type": candidate["type"],
                        "confidence": 0.95,
                        "node_id": candidate.get("id"),
                        "matched": True,
                        "canonical_name": candidate["name"],
                        "graph_type": candidate["type"],
                        "is_source": False,
                    }

        # ─────────────────────────────────────────────────────────────────────
        # TIER 3: Controlled Type-Aware Fuzzy Match (Confidence: >= 0.85)
        # ─────────────────────────────────────────────────────────────────────
        best_candidate: Optional[Dict[str, Any]] = None
        best_ratio = 0.0

        for canon_name, candidate in self.canonical_nodes.items():
            if candidate["type"] not in allowed_types:
                continue

            # Compare against canonical name
            cand_norm = normalize_string(candidate["name"])
            ratio = difflib.SequenceMatcher(None, norm_no_suffix, cand_norm).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_candidate = candidate

            # Compare against aliases
            for alias_key, target_canon in self.aliases.items():
                if target_canon == canon_name:
                    alias_norm = normalize_string(alias_key)
                    alias_ratio = difflib.SequenceMatcher(None, norm_no_suffix, alias_norm).ratio()
                    if alias_ratio > best_ratio:
                        best_ratio = alias_ratio
                        best_candidate = candidate

        if best_candidate and best_ratio >= fuzzy_threshold:
            conf = round(best_ratio, 2)
            return {
                "text": text,
                "entity_name": text,
                "label": label,
                "category": "SUPPLY_CHAIN_ENTITY",
                "status": "matched",
                "graph_node": best_candidate["name"],
                "graph_node_type": best_candidate["type"],
                "confidence": conf,
                "node_id": best_candidate.get("id"),
                "matched": True,
                "canonical_name": best_candidate["name"],
                "graph_type": best_candidate["type"],
                "is_source": False,
            }

        # ─────────────────────────────────────────────────────────────────────
        # TIER 4: Supply Chain Entity Not in Graph (Confidence: 0)
        # ─────────────────────────────────────────────────────────────────────
        return {
            "text": text,
            "entity_name": text,
            "label": label,
            "category": "SUPPLY_CHAIN_ENTITY",
            "status": "not_in_graph",
            "graph_node": None,
            "graph_node_type": None,
            "confidence": 0,
            "node_id": None,
            "matched": False,
            "canonical_name": None,
            "graph_type": None,
            "is_source": False,
        }

    def match_entities(
        self,
        entities: List[Dict[str, Any]],
        source: Optional[str] = None,
        fuzzy_threshold: float = 0.85,
    ) -> List[Dict[str, Any]]:
        """Batch match a list of extracted entities."""
        return [
            self.match_entity(entity, source=source, fuzzy_threshold=fuzzy_threshold)
            for entity in entities
        ]

    # ── Backward-compatible specific type finders ────────────────────────────

    def find_country(self, name: str) -> Optional[Dict[str, Any]]:
        """Find Country node by exact name or alias."""
        res = self.match_entity({"text": name, "label": "GPE"})
        return {"name": res["canonical_name"], "type": "Country"} if res.get("matched") and res.get("graph_type") == "Country" else None

    def find_supplier(self, name: str) -> Optional[Dict[str, Any]]:
        """Find Supplier node by exact name or alias."""
        res = self.match_entity({"text": name, "label": "ORG"})
        return {"name": res["canonical_name"], "type": "Supplier"} if res.get("matched") and res.get("graph_type") == "Supplier" else None

    def find_manufacturer(self, name: str) -> Optional[Dict[str, Any]]:
        """Find Manufacturer node by exact name or alias."""
        res = self.match_entity({"text": name, "label": "ORG"})
        return {"name": res["canonical_name"], "type": "Manufacturer"} if res.get("matched") and res.get("graph_type") == "Manufacturer" else None

    def find_port(self, name: str) -> Optional[Dict[str, Any]]:
        """Find Port node by exact name or alias."""
        res = self.match_entity({"text": name, "label": "LOC"})
        return {"name": res["canonical_name"], "type": "Port"} if res.get("matched") and res.get("graph_type") == "Port" else None

    def find_warehouse(self, name: str) -> Optional[Dict[str, Any]]:
        """Find Warehouse node by exact name or alias."""
        res = self.match_entity({"text": name, "label": "FAC"})
        return {"name": res["canonical_name"], "type": "Warehouse"} if res.get("matched") and res.get("graph_type") == "Warehouse" else None