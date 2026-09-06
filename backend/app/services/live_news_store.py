"""
AtmoGraph — Live News Store Service
Thread-safe in-memory and disk-persisted store for live news disruption articles.

Enables GET /api/news/{article_id} to instantly locate and return live news
articles ingested via RSS feeds, LiveNewsWorker, and real-time disruption pipelines,
resolving the 404 error on the News Detail / NLP Inspection page.
"""

import sys
import os
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logger = logging.getLogger("atmo_live_news_store")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [LiveNewsStore] [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Default path for persistent store
DEFAULT_STORE_FILE = ROOT_DIR / "data" / "live_news_store.json"

# Demo fallback articles definitions (synced with live_news_service.py)
BUILTIN_DEMO_ARTICLES = {
    "live_demo_chennai_01": {
        "id": "LIVE_DEMO_CHENNAI_01",
        "title": "Chennai Port Container Terminal Paralyzed Following Cyclone Warning",
        "text": (
            "Severe cyclone conditions along the Bay of Bengal have forced Chennai Port to "
            "suspend all container freight vessel operations. Harbor authorities report high "
            "berthing delays affecting automotive parts and electronic component distribution "
            "to inland hubs."
        ),
        "source": "Maritime Logistics Daily",
        "published_at": "2026-09-06T18:00:00Z",
        "shock_origin": "Chennai Port",
        "risk_level": "HIGH",
        "entities": [
            {"text": "Chennai Port", "label": "LOC", "matched": True, "graph_type": "Port", "confidence": 0.98},
            {"text": "Bay of Bengal", "label": "LOC", "matched": False, "graph_type": None, "confidence": 0.85},
            {"text": "automotive parts", "label": "MISC", "matched": False, "graph_type": None, "confidence": 0.70},
            {"text": "electronic component", "label": "MISC", "matched": False, "graph_type": None, "confidence": 0.70},
        ],
        "matched_count": 1,
        "unmatched_count": 3,
        "total_entities": 4,
        "neo4j_updated": True,
        "gnn_updated": True,
        "avg_predicted_delay": 5.2,
        "ripple_updated": True,
        "affected_nodes": 6,
        "max_depth": 2,
        "duration_ms": 120,
        "status": "COMPLETED",
        "is_live": True,
    },
    "live_demo_rotterdam_02": {
        "id": "LIVE_DEMO_ROTTERDAM_02",
        "title": "Rotterdam Port Dockworkers Extend 48-Hour Walkout Over Wage Dispute",
        "text": (
            "Labor union walkouts at the Port of Rotterdam have halted key container terminal "
            "handling. European freight operators warn that import shipments bound for German "
            "and Dutch manufacturers face mounting shipping backlogs."
        ),
        "source": "European Freight Review",
        "published_at": "2026-09-06T18:30:00Z",
        "shock_origin": "Rotterdam Port",
        "risk_level": "HIGH",
        "entities": [
            {"text": "Port of Rotterdam", "label": "LOC", "matched": True, "graph_type": "Port", "confidence": 0.98},
            {"text": "Rotterdam", "label": "LOC", "matched": True, "graph_type": "Port", "confidence": 0.98},
            {"text": "German", "label": "GPE", "matched": True, "graph_type": "Country", "confidence": 0.92},
            {"text": "Dutch", "label": "GPE", "matched": False, "graph_type": None, "confidence": 0.80},
        ],
        "matched_count": 3,
        "unmatched_count": 1,
        "total_entities": 4,
        "neo4j_updated": True,
        "gnn_updated": True,
        "avg_predicted_delay": 4.8,
        "ripple_updated": True,
        "affected_nodes": 8,
        "max_depth": 2,
        "duration_ms": 115,
        "status": "COMPLETED",
        "is_live": True,
    },
    "live_demo_la_03": {
        "id": "LIVE_DEMO_LA_03",
        "title": "Los Angeles Port Trucker Shortage Causes Multi-Day Logistics Backlog",
        "text": (
            "Critical drayage and rail carrier shortages at the Los Angeles Port have caused "
            "average container dwell times to surge past 7 days, stalling regional distribution "
            "across North American supply chains."
        ),
        "source": "Pacific Shipping Journal",
        "published_at": "2026-09-06T19:00:00Z",
        "shock_origin": "Los Angeles Port",
        "risk_level": "HIGH",
        "entities": [
            {"text": "Los Angeles Port", "label": "LOC", "matched": True, "graph_type": "Port", "confidence": 0.98},
            {"text": "North American", "label": "LOC", "matched": False, "graph_type": None, "confidence": 0.75},
        ],
        "matched_count": 1,
        "unmatched_count": 1,
        "total_entities": 2,
        "neo4j_updated": True,
        "gnn_updated": True,
        "avg_predicted_delay": 6.1,
        "ripple_updated": True,
        "affected_nodes": 5,
        "max_depth": 2,
        "duration_ms": 110,
        "status": "COMPLETED",
        "is_live": True,
    },
}


class LiveNewsStore:
    """
    Singleton repository managing live news articles with in-memory caching
    and JSON disk persistence to support multi-process environments (e.g. FastAPI + separate worker).
    """

    def __init__(self, store_file: Optional[Path] = None):
        self.store_file = Path(store_file) if store_file else DEFAULT_STORE_FILE
        self._lock = threading.RLock()
        self._articles: Dict[str, Dict[str, Any]] = {}
        self._last_mtime: float = 0.0

        # Ensure directory exists
        try:
            self.store_file.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"Failed to create directory {self.store_file.parent}: {e}")

        # Seed builtin demo articles
        for key, demo_art in BUILTIN_DEMO_ARTICLES.items():
            self._articles[key] = dict(demo_art)

        # Load existing articles from disk
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Loads stored articles from JSON file if available."""
        if not self.store_file.exists():
            return

        try:
            mtime = os.path.getmtime(self.store_file)
            if mtime == self._last_mtime:
                return

            with open(self.store_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("id"):
                        cid = str(item["id"]).strip().lower()
                        self._articles[cid] = item
            elif isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, dict):
                        cid = str(v.get("id", k)).strip().lower()
                        self._articles[cid] = v

            self._last_mtime = mtime
            logger.debug(f"Loaded {len(self._articles)} articles from {self.store_file.name}")
        except Exception as e:
            logger.warning(f"Failed loading live news store from {self.store_file}: {e}")

    def _save_to_disk(self) -> None:
        """Persists current articles to JSON file."""
        try:
            temp_file = self.store_file.with_suffix(".tmp")
            articles_list = list(self._articles.values())
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(articles_list, f, indent=2, ensure_ascii=False)
            temp_file.replace(self.store_file)
            self._last_mtime = os.path.getmtime(self.store_file)
        except Exception as e:
            logger.warning(f"Failed saving live news store to {self.store_file}: {e}")

    def register_article(self, article_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalizes and registers a live news article into the store.
        Persists to disk and returns the stored article.
        """
        if not article_data or not isinstance(article_data, dict):
            return {}

        art_id = str(article_data.get("id") or article_data.get("article_id") or f"NEWS_LIVE_{int(datetime.now(timezone.utc).timestamp())}").strip()
        clean_id = art_id.lower()

        title = str(article_data.get("title") or "Supply Chain Disruption Event").strip()
        text = str(article_data.get("text") or article_data.get("content") or article_data.get("description") or "").strip()
        source = str(article_data.get("source") or "Live Logistics Feed").strip()
        published_at = str(article_data.get("published_at") or datetime.now(timezone.utc).isoformat()).strip()
        url = article_data.get("url")
        shock_origin = str(article_data.get("shock_origin") or "None").strip()

        # Process entities with deduplication and source handling
        raw_entities = article_data.get("entities")
        if not raw_entities:
            raw_entities = article_data.get("matched_entities") or article_data.get("extracted_entities") or []

        normalized_entities: List[Dict[str, Any]] = []
        seen_entity_texts: Set[str] = set()

        for e in raw_entities:
            if isinstance(e, dict):
                text_val = e.get("text") or e.get("name") or "Unknown"
                norm_key = text_val.strip().lower()
                if norm_key in seen_entity_texts:
                    continue
                seen_entity_texts.add(norm_key)

                label_val = e.get("label") or e.get("type") or "MISC"
                is_source = bool(e.get("is_source") or label_val in ("SOURCE", "NEWS_SOURCE"))

                if is_source:
                    is_matched = False
                    graph_type_val = None
                    conf = 0.0
                    category_val = "NON_GRAPH_ENTITY"
                    status_val = "not_graph_candidate"
                else:
                    is_matched = bool(e.get("matched") and (e.get("graph_type") or e.get("graph_node_type")))
                    graph_type_val = e.get("graph_type") or e.get("graph_node_type")
                    conf = e.get("confidence")
                    if conf is None or not isinstance(conf, (int, float)):
                        conf = 0.95 if is_matched else 0.0
                    category_val = e.get("category") or ("NON_GRAPH_ENTITY" if label_val in ("CARDINAL", "QUANTITY", "PERCENT", "MONEY", "DATE", "TIME", "PERSON") else "SUPPLY_CHAIN_ENTITY")
                    if category_val == "NON_GRAPH_ENTITY":
                        status_val = "not_graph_candidate"
                    elif is_matched:
                        status_val = "matched"
                    else:
                        status_val = "not_in_graph"

                canon_name = e.get("canonical_name") or e.get("graph_node") or (text_val if is_matched else None)

                normalized_entities.append({
                    "text": text_val,
                    "entity_name": text_val,
                    "label": label_val,
                    "category": category_val,
                    "status": status_val,
                    "graph_node": canon_name if is_matched else None,
                    "graph_node_type": graph_type_val,
                    "matched": is_matched,
                    "graph_type": graph_type_val,
                    "canonical_name": canon_name,
                    "node_id": e.get("node_id"),
                    "confidence": conf,
                    "is_source": is_source,
                })

        matched_count = sum(1 for e in normalized_entities if e.get("matched"))
        candidate_count = sum(1 for e in normalized_entities if e.get("category") == "SUPPLY_CHAIN_ENTITY")
        total_entities = len(normalized_entities)
        unmatched_count = total_entities - matched_count

        # Compute risk level
        raw_risk = article_data.get("risk_level") or article_data.get("risk")
        if raw_risk and isinstance(raw_risk, str) and raw_risk.upper() in ("HIGH", "MEDIUM", "LOW"):
            risk_level = raw_risk.upper()
        else:
            cand_total = candidate_count if candidate_count > 0 else total_entities
            ratio = (matched_count / cand_total) if cand_total > 0 else 0
            avg_delay = float(article_data.get("avg_predicted_delay") or 0.0)
            if ratio >= 0.7 or avg_delay >= 4.0:
                risk_level = "HIGH"
            elif ratio >= 0.4 or avg_delay >= 2.0:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

        record: Dict[str, Any] = {
            "id": art_id,
            "title": title,
            "text": text,
            "source": source,
            "published_at": published_at,
            "url": url,
            "risk_level": risk_level,
            "entities": normalized_entities,
            "matched_entities": [e for e in normalized_entities if e.get("matched")],
            "extracted_entities": normalized_entities,
            "matched_count": matched_count,
            "candidate_count": candidate_count,
            "unmatched_count": unmatched_count,
            "total_entities": total_entities,
            "shock_origin": shock_origin,
            "neo4j_updated": bool(article_data.get("neo4j_updated", True)),
            "gnn_updated": bool(article_data.get("gnn_updated", True)),
            "avg_predicted_delay": round(float(article_data.get("avg_predicted_delay") or 0.0), 2),
            "ripple_updated": bool(article_data.get("ripple_updated", True)),
            "affected_nodes": article_data.get("affected_nodes", 0),
            "max_depth": int(article_data.get("max_depth") or 0),
            "duration_ms": int(article_data.get("duration_ms") or 0),
            "status": str(article_data.get("status") or "COMPLETED"),
            "is_live": True,
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }

        with self._lock:
            self._articles[clean_id] = record
            self._save_to_disk()

        logger.info(f"Registered live news article [{art_id}] '{title}' (Risk: {risk_level})")
        return record

    def register_from_pipeline(
        self, article: Dict[str, Any], pipeline_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Converts the output of run_realtime_pipeline into a registered live article.
        """
        art_id = article.get("id") or pipeline_result.get("processed_news", {}).get("id")
        title = article.get("title") or pipeline_result.get("processed_news", {}).get("title")
        text = article.get("text") or pipeline_result.get("processed_news", {}).get("text")
        source = article.get("source") or pipeline_result.get("processed_news", {}).get("source")
        published_at = article.get("published_at") or pipeline_result.get("processed_news", {}).get("published_at")
        shock_origin = pipeline_result.get("shock_origin", "None")

        matched_ents = pipeline_result.get("matched_entities") or []
        extracted_ents = pipeline_result.get("extracted_entities") or []

        entities = []
        if matched_ents:
            for m in matched_ents:
                is_m = bool(m.get("matched"))
                entities.append({
                    "text": m.get("text", "Unknown"),
                    "label": m.get("label", "MISC"),
                    "matched": is_m,
                    "graph_type": m.get("graph_type"),
                    "canonical_name": m.get("canonical_name"),
                    "node_id": m.get("node_id"),
                    "confidence": m.get("confidence", 0.95 if is_m else 0.40),
                    "is_source": bool(m.get("is_source")),
                })
        elif extracted_ents:
            for e in extracted_ents:
                entities.append({
                    "text": e.get("text", "Unknown"),
                    "label": e.get("label", "MISC"),
                    "matched": False,
                    "graph_type": None,
                    "canonical_name": None,
                    "node_id": None,
                    "confidence": 0.40,
                    "is_source": bool(e.get("is_source")),
                })

        pred_summary = pipeline_result.get("prediction_results", {}).get("summary", {})
        avg_delay = pred_summary.get("avg_predicted_delay", 0.0)
        ripple_res = pipeline_result.get("ripple_results") or {}
        affected_count = ripple_res.get("total_affected_nodes", 0)
        max_depth = ripple_res.get("max_depth", 0)
        duration_ms = pipeline_result.get("duration_ms", 0)

        graph_status = pipeline_result.get("graph_update_status", {}).get("status", "")
        success = pipeline_result.get("success", True)
        neo4j_updated = graph_status == "COMPLETED" or success
        gnn_updated = pipeline_result.get("prediction_status") == "COMPLETED" or success
        ripple_updated = pipeline_result.get("ripple_analysis_status") == "COMPLETED" or success

        payload = {
            "id": art_id,
            "title": title,
            "text": text,
            "source": source,
            "published_at": published_at,
            "url": article.get("url"),
            "shock_origin": shock_origin,
            "entities": entities,
            "neo4j_updated": neo4j_updated,
            "gnn_updated": gnn_updated,
            "avg_predicted_delay": avg_delay,
            "ripple_updated": ripple_updated,
            "affected_nodes": affected_count,
            "max_depth": max_depth,
            "duration_ms": duration_ms,
            "status": "COMPLETED" if success else "FAILED",
            "is_live": True,
        }
        return self.register_article(payload)

    def register_from_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Registers an article from a live_news_processed WebSocket broadcast event."""
        if not event_data or not isinstance(event_data, dict):
            return {}

        if "article" in event_data and isinstance(event_data["article"], dict):
            return self.register_article(event_data["article"])

        art_id = event_data.get("article_id")
        if not art_id:
            return {}

        payload = {
            "id": art_id,
            "title": event_data.get("title", "Supply Chain Disruption"),
            "source": event_data.get("source", "Live Operational Feed"),
            "published_at": event_data.get("published_at") or event_data.get("timestamp"),
            "shock_origin": event_data.get("shock_origin", "None"),
            "neo4j_updated": event_data.get("neo4j_updated", True),
            "gnn_updated": event_data.get("gnn_updated", True),
            "avg_predicted_delay": event_data.get("avg_predicted_delay", 0.0),
            "ripple_updated": event_data.get("ripple_updated", True),
            "affected_nodes": event_data.get("affected_nodes", 0),
            "max_depth": event_data.get("max_depth", 0),
            "duration_ms": event_data.get("duration_ms", 0),
            "status": "COMPLETED",
            "is_live": True,
        }
        return self.register_article(payload)

    def get_article(self, article_id: str) -> Optional[Dict[str, Any]]:
        """
        Look up a single live news article by ID (case-insensitive).
        Checks in-memory cache first, reloads from disk if missing,
        and falls back to known demo articles if ID matches.
        """
        if not article_id:
            return None

        clean_id = str(article_id).strip().lower()

        with self._lock:
            # 1. In-memory check
            if clean_id in self._articles:
                return dict(self._articles[clean_id])

            # 2. Reload disk if modified
            self._load_from_disk()
            if clean_id in self._articles:
                return dict(self._articles[clean_id])

            # 3. Check builtin demo articles
            if clean_id in BUILTIN_DEMO_ARTICLES:
                demo_rec = dict(BUILTIN_DEMO_ARTICLES[clean_id])
                self._articles[clean_id] = demo_rec
                self._save_to_disk()
                return demo_rec

            # 4. Partial / suffix / prefix matching for demo articles (e.g. "chennai" or "rotterdam")
            for k, demo_rec in BUILTIN_DEMO_ARTICLES.items():
                if clean_id in k or k in clean_id:
                    self._articles[clean_id] = dict(demo_rec)
                    return dict(demo_rec)

            return None

    def list_articles(self) -> List[Dict[str, Any]]:
        """
        Returns all registered live articles, sorted by publication or registration date descending.
        """
        with self._lock:
            self._load_from_disk()
            articles = list(self._articles.values())

        # Sort descending by published_at or registered_at
        def sort_key(a):
            return str(a.get("published_at") or a.get("registered_at") or "")

        articles.sort(key=sort_key, reverse=True)
        return articles


# Singleton instance
_store_instance: Optional[LiveNewsStore] = None
_store_lock = threading.Lock()


def get_live_news_store() -> LiveNewsStore:
    """Returns singleton LiveNewsStore instance."""
    global _store_instance
    if _store_instance is None:
        with _store_lock:
            if _store_instance is None:
                _store_instance = LiveNewsStore()
    return _store_instance
