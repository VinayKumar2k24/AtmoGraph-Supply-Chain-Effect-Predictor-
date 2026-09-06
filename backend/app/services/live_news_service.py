"""
AtmoGraph — Live News Ingestion Service
Week 4: Automatic / Live News Ingestion Layer

Fetches live supply-chain news from configurable RSS or HTTP feeds,
normalizes articles into AtmoGraph pipeline format, and detects duplicates.

Zero external paid APIs required.
"""

import sys
import os
import re
import html
import time
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
import urllib.request
import xml.etree.ElementTree as ET

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Configure logger
logger = logging.getLogger("atmo_live_news_service")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Optional feedparser with graceful fallback
try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    HAS_FEEDPARSER = False

# Requests library for robust HTTP requests
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


# =============================================================================
# DEFAULT CONFIGURATION & DEMO SOURCE
# =============================================================================

# Default free public RSS feed (Google News supply-chain search query)
DEFAULT_RSS_FEED_URL = (
    "https://news.google.com/rss/search?q=supply+chain+port+disruption&hl=en-US&gl=US&ceid=US:en"
)

# Realistic fallback/demo articles for safe local testing and network-offline runs
DEMO_ARTICLES = [
    {
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
    },
    {
        "id": "LIVE_DEMO_ROTTERDAM_02",
        "title": "Rotterdam Port Dockworkers Extend 48-Hour Walkout Over Wage Dispute",
        "text": (
            "Labor union walkouts at the Port of Rotterdam have halted key container terminal "
            "handling. European freight operators warn that import shipments bound for German "
            "and Dutch manufacturers face mounting shipping backlogs."
        ),
        "source": "European Freight Review",
        "published_at": "2026-09-06T18:30:00Z",
    },
    {
        "id": "LIVE_DEMO_LA_03",
        "title": "Los Angeles Port Trucker Shortage Causes Multi-Day Logistics Backlog",
        "text": (
            "Critical drayage and rail carrier shortages at the Los Angeles Port have caused "
            "average container dwell times to surge past 7 days, stalling regional distribution "
            "across North American supply chains."
        ),
        "source": "Pacific Shipping Journal",
        "published_at": "2026-09-06T19:00:00Z",
    },
]


def clean_html(raw_html: str) -> str:
    """Strips HTML tags, unescapes HTML entities, and normalizes whitespace."""
    if not raw_html:
        return ""
    # Strip script and style blocks
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw_html, flags=re.DOTALL | re.IGNORECASE)
    # Strip general HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode entities like &amp;, &quot;, &#39;
    text = html.unescape(text)
    # Collapse multiple whitespaces
    return re.sub(r"\s+", " ", text).strip()


# =============================================================================
# LIVE NEWS SERVICE CLASS
# =============================================================================

class LiveNewsService:
    """
    Service responsible for discovering, fetching, and normalizing live supply chain news
    articles from RSS / HTTP feeds into AtmoGraph's standard realtime pipeline format.
    
    Includes in-memory duplicate detection and a safe demo fallback mode.
    """

    def __init__(
        self,
        feed_url: Optional[str] = None,
        timeout: float = 10.0,
        demo_mode: Optional[bool] = None,
        fallback_to_demo: bool = True,
    ):
        """
        Initialize LiveNewsService.
        
        :param feed_url: RSS feed URL or 'demo' for synthetic supply-chain news.
                         Defaults to LIVE_NEWS_RSS_URL or DEFAULT_RSS_FEED_URL.
        :param timeout: Network request timeout in seconds.
        :param demo_mode: Explicitly enable demo mode (yields built-in demo articles).
        :param fallback_to_demo: If True, falls back to demo articles if RSS is unreachable.
        """
        # Configurable via environment variable or argument
        env_url = os.getenv("LIVE_NEWS_RSS_URL") or os.getenv("NEWS_FEED_URL")
        self.feed_url = feed_url or env_url or DEFAULT_RSS_FEED_URL

        env_timeout = os.getenv("LIVE_NEWS_TIMEOUT")
        self.timeout = float(env_timeout) if env_timeout else timeout

        if demo_mode is not None:
            self.demo_mode = demo_mode
        else:
            env_demo = os.getenv("LIVE_NEWS_DEMO_MODE", "").lower()
            self.demo_mode = (
                env_demo in ("1", "true", "yes")
                or str(self.feed_url).strip().lower() == "demo"
            )

        self.fallback_to_demo = fallback_to_demo

        # In-memory deduplication registries
        self._processed_ids: Set[str] = set()
        self._seen_hashes: Set[str] = set()

        # Injected mock/custom articles queue for testing
        self._mock_articles: List[Dict[str, Any]] = []

        logger.info(
            f"LiveNewsService initialized | Demo Mode: {self.demo_mode} | "
            f"Feed: {self.feed_url} | Timeout: {self.timeout}s"
        )

    # ─────────────────────────────────────────────────────────────────────────
    # DEDUPLICATION & HASHING
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def compute_content_hash(title: str, text: str) -> str:
        """Computes a SHA-256 fingerprint from title and content to catch duplicates."""
        normalized = f"{title.strip().lower()}|{text.strip().lower()}"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def is_processed(self, article_id: str, title: str = "", text: str = "") -> bool:
        """Checks whether an article has already been processed."""
        if article_id and article_id in self._processed_ids:
            return True
        if title or text:
            content_hash = self.compute_content_hash(title, text)
            if content_hash in self._seen_hashes:
                return True
        return False

    def mark_processed(self, article_id: str, article: Optional[Dict[str, Any]] = None):
        """Marks an article ID and content hash as processed in memory."""
        if article_id:
            self._processed_ids.add(str(article_id).strip())

        if article:
            title = article.get("title", "")
            text = article.get("text", "")
            if title or text:
                content_hash = self.compute_content_hash(title, text)
                self._seen_hashes.add(content_hash)

    def reset_processed(self):
        """Resets deduplication cache (useful for tests or demo resets)."""
        self._processed_ids.clear()
        self._seen_hashes.clear()
        logger.info("LiveNewsService: Deduplication cache reset.")

    def add_mock_article(self, article: Dict[str, Any]):
        """Injects a mock article into the service queue for instant testing."""
        self._mock_articles.append(article)

    # ─────────────────────────────────────────────────────────────────────────
    # RSS / HTTP FETCHING & PARSING
    # ─────────────────────────────────────────────────────────────────────────

    def _fetch_rss_raw(self, url: str) -> Optional[str]:
        """Fetches raw RSS XML using requests or urllib with standard headers."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AtmoGraph/1.0",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        }

        try:
            if HAS_REQUESTS:
                resp = requests.get(url, headers=headers, timeout=self.timeout)
                if resp.status_code == 200:
                    return resp.text
                logger.warning(f"HTTP {resp.status_code} received when fetching RSS feed from {url}")
                return None
            else:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    return response.read().decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Network error while fetching RSS feed from {url}: {e}")
            return None

    def _parse_with_feedparser(self, xml_content_or_url: str) -> List[Dict[str, Any]]:
        """Parses feed content using feedparser if available."""
        feed = feedparser.parse(xml_content_or_url)
        if getattr(feed, "bozo", 0) and not getattr(feed, "entries", None):
            logger.warning(f"feedparser encountered an error: {getattr(feed, 'bozo_exception', 'Unknown')}")
            return []

        articles = []
        feed_title = feed.feed.get("title", "Live RSS Feed") if hasattr(feed, "feed") else "Live RSS Feed"

        for entry in feed.entries:
            title = clean_html(getattr(entry, "title", ""))
            raw_text = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
            text = clean_html(raw_text)

            # Require either title or text
            if not title and not text:
                continue

            if not title:
                title = text[:80] + "..." if len(text) > 80 else text

            # Combine title into text if headline contains essential entity context
            full_text = text
            if title and title.lower() not in text.lower():
                full_text = f"{title}. {text}".strip()
            if not full_text:
                full_text = title

            # Determine stable ID
            raw_id = (
                getattr(entry, "id", "")
                or getattr(entry, "guid", "")
                or getattr(entry, "link", "")
                or f"RSS_{self.compute_content_hash(title, text)[:12]}"
            )
            article_id = f"NEWS_LIVE_{hashlib.md5(raw_id.encode('utf-8')).hexdigest()[:10]}"

            # Published timestamp
            published_at = datetime.now(timezone.utc).isoformat()
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
                except Exception:
                    pass

            source = (
                getattr(entry, "source", {}).get("title")
                if isinstance(getattr(entry, "source", None), dict)
                else getattr(entry, "author", None) or feed_title
            )

            articles.append({
                "id": article_id,
                "title": title,
                "text": full_text,
                "source": str(source or "Live News Feed"),
                "published_at": published_at,
            })

        return articles

    def _parse_with_elementtree(self, xml_text: str) -> List[Dict[str, Any]]:
        """Fallback standard-library RSS XML parser (RSS 2.0 and Atom compatible)."""
        articles = []
        try:
            root = ET.fromstring(xml_text)
        except Exception as err:
            logger.warning(f"ElementTree failed to parse RSS XML: {err}")
            return []

        # Look for RSS items or Atom entries
        channel = root.find("channel")
        feed_title = "Live RSS Feed"
        if channel is not None:
            t_node = channel.find("title")
            if t_node is not None and t_node.text:
                feed_title = t_node.text.strip()
            items = channel.findall("item")
        else:
            items = root.findall(".//{http://www.w3.org/2005/Atom}entry") or root.findall("item")

        for item in items:
            title_node = item.find("title") or item.find("{http://www.w3.org/2005/Atom}title")
            title = clean_html(title_node.text if title_node is not None and title_node.text else "")

            desc_node = (
                item.find("description")
                or item.find("{http://www.w3.org/2005/Atom}summary")
                or item.find("{http://www.w3.org/2005/Atom}content")
            )
            raw_text = desc_node.text if desc_node is not None and desc_node.text else ""
            text = clean_html(raw_text)

            if not title and not text:
                continue

            if not title:
                title = text[:80] + "..." if len(text) > 80 else text

            full_text = text
            if title and title.lower() not in text.lower():
                full_text = f"{title}. {text}".strip()
            if not full_text:
                full_text = title

            guid_node = (
                item.find("guid")
                or item.find("link")
                or item.find("{http://www.w3.org/2005/Atom}id")
            )
            raw_id = (guid_node.text.strip() if guid_node is not None and guid_node.text else "")
            if not raw_id:
                raw_id = f"ET_{self.compute_content_hash(title, text)[:12]}"

            article_id = f"NEWS_LIVE_{hashlib.md5(raw_id.encode('utf-8')).hexdigest()[:10]}"

            pub_node = item.find("pubDate") or item.find("{http://www.w3.org/2005/Atom}published")
            published_at = datetime.now(timezone.utc).isoformat()
            if pub_node is not None and pub_node.text:
                published_at = pub_node.text.strip()

            articles.append({
                "id": article_id,
                "title": title,
                "text": full_text,
                "source": feed_title,
                "published_at": published_at,
            })

        return articles

    # ─────────────────────────────────────────────────────────────────────────
    # PUBLIC INTERFACE
    # ─────────────────────────────────────────────────────────────────────────

    def fetch_latest_news(self) -> List[Dict[str, Any]]:
        """
        Fetches the latest articles from the configured news source.
        Gracefully handles network errors and returns an empty list or fallback demo articles.
        
        :return: List of normalized article dictionaries:
                 [{"id": ..., "title": ..., "text": ..., "source": ..., "published_at": ...}]
        """
        results: List[Dict[str, Any]] = []

        # 1. Pop any injected mock articles first
        if self._mock_articles:
            while self._mock_articles:
                results.append(self._mock_articles.pop(0))
            return results

        # 2. If explicit demo mode, return curated demo articles
        if self.demo_mode:
            logger.info("LiveNewsService: Returning curated demo supply-chain articles.")
            return list(DEMO_ARTICLES)

        # 3. Fetch from remote RSS feed
        feed_url = self.feed_url
        if not feed_url or str(feed_url).lower() == "demo":
            return list(DEMO_ARTICLES)

        logger.info(f"LiveNewsService: Fetching live news from {feed_url}")
        xml_content = self._fetch_rss_raw(feed_url)

        if xml_content:
            if HAS_FEEDPARSER:
                results = self._parse_with_feedparser(xml_content)
            if not results:
                results = self._parse_with_elementtree(xml_content)

        # 4. Safe fallback if remote fetch failed or returned 0 articles
        if not results:
            if self.fallback_to_demo:
                logger.warning(
                    f"LiveNewsService: Unable to parse remote feed from {feed_url}. "
                    "Falling back to built-in demo disruption articles."
                )
                return list(DEMO_ARTICLES)
            else:
                logger.info(f"LiveNewsService: No articles found from {feed_url}.")
                return []

        logger.info(f"LiveNewsService: Successfully parsed {len(results)} articles from feed.")
        return results

    def get_new_articles(self) -> List[Dict[str, Any]]:
        """
        Fetches latest news and filters out any articles that have already been processed.
        Does NOT automatically mark articles as processed, allowing the caller/worker
        to mark them upon successful pipeline execution.
        
        :return: List of un-processed normalized articles.
        """
        all_articles = self.fetch_latest_news()
        new_articles = []

        for article in all_articles:
            art_id = article.get("id", "")
            title = article.get("title", "")
            text = article.get("text", "")

            if self.is_processed(art_id, title=title, text=text):
                continue

            new_articles.append(article)

        logger.info(
            f"LiveNewsService: {len(new_articles)} new un-processed article(s) "
            f"(out of {len(all_articles)} total fetched)."
        )
        return new_articles


# Singleton helper
_default_live_news_service: Optional[LiveNewsService] = None


def get_live_news_service() -> LiveNewsService:
    """Returns a module-level singleton instance of LiveNewsService."""
    global _default_live_news_service
    if _default_live_news_service is None:
        _default_live_news_service = LiveNewsService()
    return _default_live_news_service


# =============================================================================
# CLI TEST EXECUTION
# =============================================================================

if __name__ == "__main__":
    import json
    print("=" * 70)
    print("AtmoGraph Week 4: LiveNewsService Standalone Test")
    print("=" * 70)

    # Allow passing --demo from CLI
    use_demo = "--demo" in sys.argv or "-d" in sys.argv
    service = LiveNewsService(demo_mode=use_demo)

    print(f"Service Mode : {'DEMO' if service.demo_mode else 'LIVE RSS'}")
    print(f"Target Feed  : {service.feed_url}")
    print("\n[1] Testing fetch_latest_news()...")
    articles = service.fetch_latest_news()
    print(f"Total articles fetched: {len(articles)}")

    if articles:
        print("\nFirst Article Sample:")
        print(json.dumps(articles[0], indent=2))

    print("\n[2] Testing get_new_articles()...")
    new_items = service.get_new_articles()
    print(f"New un-processed items: {len(new_items)}")

    print("\n[3] Testing duplicate detection...")
    if new_items:
        first_id = new_items[0]["id"]
        print(f"Marking [{first_id}] as processed...")
        service.mark_processed(first_id, article=new_items[0])

        remaining = service.get_new_articles()
        print(f"Remaining new articles after marking 1 item: {len(remaining)}")
        assert len(remaining) == len(new_items) - 1, "Duplicate filtering failed!"
        print("[PASS] Duplicate detection verified successfully!")

    print("\n[TEST COMPLETED SUCCESSFULLY]")
