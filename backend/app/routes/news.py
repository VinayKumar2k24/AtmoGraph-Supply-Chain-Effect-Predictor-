"""
AtmoGraph — News API Routes
GET  /api/news           — list all processed news
GET  /api/news/{news_id} — single news article with entity mappings
POST /api/news/process   — process a news file on demand
"""
import sys
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import APIRouter, HTTPException
from backend.app.services.news_graph_service import NewsGraphService
from backend.app.services.live_news_store import get_live_news_store

router = APIRouter()

# Path to news data folder
NEWS_DIR = ROOT_DIR / "data" / "news"

# Singleton service
_service = None

def get_service() -> NewsGraphService:
    global _service
    if _service is None:
        _service = NewsGraphService()
    return _service


def _load_all_news() -> list:
    """Scan the data/news/ directory and process all JSON files."""
    articles = []
    if not NEWS_DIR.exists():
        return articles

    for json_file in sorted(NEWS_DIR.glob("*.json")):
        try:
            result = get_service().process_news(str(json_file))
            # Add computed risk level
            matched = [e for e in result["entities"] if e.get("matched")]
            candidates = [e for e in result["entities"] if e.get("category") == "SUPPLY_CHAIN_ENTITY"]
            total = len(result["entities"])
            candidate_count = len(candidates) if candidates else total
            match_ratio = len(matched) / candidate_count if candidate_count > 0 else 0

            if match_ratio >= 0.8:
                risk_level = "HIGH"
            elif match_ratio >= 0.5:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            result["risk_level"] = risk_level
            result["matched_count"] = len(matched)
            result["candidate_count"] = candidate_count
            result["unmatched_count"] = total - len(matched)
            result["total_entities"] = total

            articles.append(result)
        except Exception as e:
            articles.append({
                "id": json_file.stem,
                "title": f"Error loading {json_file.name}",
                "error": str(e),
            })

    return articles


@router.get("")
def list_news():
    """List all processed news articles with entity mappings, including live news."""
    try:
        # 1. Fetch live articles from LiveNewsStore
        live_articles = get_live_news_store().list_articles()

        # 2. Fetch static file-based articles
        static_articles = _load_all_news()

        # 3. Merge with live disruption events at top (deduplicated by lowercase ID)
        seen_ids = set()
        merged = []

        for item in live_articles:
            cid = str(item.get("id", "")).strip().lower()
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                merged.append(item)

        for item in static_articles:
            cid = str(item.get("id", "")).strip().lower()
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                merged.append(item)

        return {"articles": merged, "total": len(merged)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{news_id}")
def get_news(news_id: str):
    """
    Get a single news article by ID.
    Checks the real-time LiveNewsStore first, then falls back to static news files.
    """
    try:
        clean_id = news_id.strip().lower()

        # 1. First check LiveNewsStore (O(1) in-memory lookup for live disruption events)
        live_article = get_live_news_store().get_article(clean_id)
        if live_article is not None:
            return live_article

        # 2. Check static file-based news in data/news/
        articles = _load_all_news()
        article = next(
            (a for a in articles if (a.get("id") or "").lower() == clean_id),
            None
        )
        if not article:
            raise HTTPException(status_code=404, detail=f"News {news_id} not found")
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

