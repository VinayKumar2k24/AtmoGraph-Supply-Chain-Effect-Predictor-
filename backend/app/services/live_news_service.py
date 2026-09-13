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
import email.utils
import urllib.request
import urllib.parse
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
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", str(raw_html), flags=re.DOTALL | re.IGNORECASE)
    # Strip general HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode entities like &amp;, &quot;, &#39;
    text = html.unescape(text)
    if "&" in text:
        text = html.unescape(text)
    text = text.replace("\xa0", " ")
    # Strip zero-width / invisible control characters
    text = re.sub(r"[\u200b\u200c\u200d\u200e\u200f\ufeff]", "", text)
    # Collapse multiple whitespaces
    return re.sub(r"\s+", " ", text).strip()


def normalize_title(raw_title: Optional[str]) -> str:
    """
    Normalizes article headline/title:
    - Cleans HTML markup and unescapes entities.
    - Removes zero-width and invisible control characters.
    - Strips surrounding quotes, brackets, and extraneous whitespace.
    """
    if not raw_title:
        return ""
    title = clean_html(str(raw_title))
    # Strip surrounding quotes if wrapped
    if (title.startswith('"') and title.endswith('"')) or (title.startswith("'") and title.endswith("'")):
        title = title[1:-1].strip()
    return title


def normalize_source(raw_source: Any, default: str = "Live News Feed") -> str:
    """
    Normalizes publisher/source name:
    - Safely handles string or dict input (e.g. feedparser source metadata).
    - Cleans HTML and extraneous whitespace.
    - Falls back to default if empty or generic placeholder.
    """
    if not raw_source:
        return default

    if isinstance(raw_source, dict):
        source_val = (
            raw_source.get("title")
            or raw_source.get("value")
            or raw_source.get("name")
            or ""
        )
    else:
        source_val = str(raw_source)

    source = clean_html(source_val)
    if not source or source.lower() in ("none", "unknown", "null", "undefined", "n/a"):
        return default

    return source


def normalize_url(raw_url: Optional[str]) -> str:
    """
    Normalizes article URL:
    - Strips whitespace, control characters, and surrounding quotes/brackets.
    - Resolves protocol-relative URLs (//example.com -> https://example.com).
    - Unescapes HTML entities in query string.
    - Strips common marketing/tracking parameters (utm_*, fbclid, etc.) to produce canonical URLs.
    """
    if not raw_url:
        return ""

    url = str(raw_url).strip()
    # Strip wrapping quotes or brackets
    url = re.sub(r"^[\"\'<(\[]+|[\"'>)\]]+$", "", url).strip()
    if not url:
        return ""

    url = html.unescape(url).strip()
    if url.startswith("//"):
        url = "https:" + url

    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme and parsed.netloc:
            query_pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            filtered_pairs = [
                (k, v) for k, v in query_pairs
                if not k.lower().startswith("utm_")
                and k.lower() not in ("fbclid", "gclid", "_hsenc", "_hsmi", "mc_cid", "mc_eid")
            ]
            clean_query = urllib.parse.urlencode(filtered_pairs)
            path = parsed.path.rstrip("/") if (parsed.path and parsed.path != "/") else parsed.path
            clean_url = urllib.parse.urlunparse((
                parsed.scheme.lower(),
                parsed.netloc.lower(),
                path,
                parsed.params,
                clean_query,
                parsed.fragment,
            ))
            return clean_url
    except Exception:
        pass

    return url


def normalize_description(raw_text: Optional[str], title: str = "") -> str:
    """
    Normalizes news description/content:
    - Cleans HTML markup, tags, scripts, and unescapes entities.
    - Collapses whitespace and removes zero-width characters.
    - Contextually incorporates title if not present, ensuring clean punctuation.
    """
    cleaned = clean_html(str(raw_text or ""))
    norm_title = str(title or "").strip()

    if not cleaned:
        return norm_title
    if not norm_title:
        return cleaned

    # Check if headline is already part of the description
    if norm_title.lower() in cleaned.lower():
        return cleaned

    # Contextually prepend title if it adds essential supply-chain context
    if norm_title.rstrip().endswith((".", "!", "?", ":", ";")):
        return f"{norm_title} {cleaned}".strip()
    else:
        return f"{norm_title}. {cleaned}".strip()


def normalize_timestamp(raw_timestamp: Any) -> str:
    """
    Normalizes publication timestamps into standard ISO-8601 UTC string.
    Safely handles None, empty strings, RFC-822 / RFC-2822 dates, ISO-8601 strings,
    and time.struct_time tuples.
    """
    if raw_timestamp is None:
        return datetime.now(timezone.utc).isoformat()

    if isinstance(raw_timestamp, datetime):
        if raw_timestamp.tzinfo is None:
            raw_timestamp = raw_timestamp.replace(tzinfo=timezone.utc)
        return raw_timestamp.astimezone(timezone.utc).isoformat()

    if isinstance(raw_timestamp, (time.struct_time, tuple)):
        try:
            return datetime(*raw_timestamp[:6], tzinfo=timezone.utc).isoformat()
        except Exception:
            pass

    if isinstance(raw_timestamp, str):
        ts_str = raw_timestamp.strip()
        if not ts_str:
            return datetime.now(timezone.utc).isoformat()

        # 1. Try ISO-8601 parsing
        try:
            clean_iso = ts_str.replace("Z", "+00:00") if ts_str.endswith("Z") else ts_str
            dt = datetime.fromisoformat(clean_iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except Exception:
            pass

        # 2. Try RFC-2822 / RFC-822 (standard RSS pubDate format)
        try:
            dt = email.utils.parsedate_to_datetime(ts_str)
            if dt is not None:
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat()
        except Exception:
            pass

        # 3. Fallback common date formats
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%SZ",
            "%Y-%m-%d",
            "%d %b %Y %H:%M:%S",
            "%d %b %Y %H:%M:%S %z",
        ):
            try:
                dt = datetime.strptime(ts_str, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat()
            except Exception:
                continue

    return datetime.now(timezone.utc).isoformat()


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
        self._seen_urls: Set[str] = set()

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
        norm_title = " ".join(str(title or "").split()).strip().lower()
        norm_text = " ".join(str(text or "").split()).strip().lower()
        normalized = f"{norm_title}|{norm_text}"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def is_processed(
        self,
        article_id: str,
        title: str = "",
        text: str = "",
        url: str = "",
    ) -> bool:
        """Checks whether an article has already been processed."""
        clean_id = str(article_id or "").strip()
        if clean_id and clean_id in self._processed_ids:
            return True

        clean_url = normalize_url(url)
        if clean_url and clean_url in self._seen_urls:
            return True

        if title or text:
            content_hash = self.compute_content_hash(title, text)
            if content_hash in self._seen_hashes:
                return True

        return False

    def mark_processed(
        self,
        article_id: str,
        article: Optional[Dict[str, Any]] = None,
    ):
        """Marks an article ID and content hash as processed in memory."""
        clean_id = str(article_id or "").strip()
        if clean_id:
            self._processed_ids.add(clean_id)

        if article:
            title = article.get("title", "")
            text = article.get("text", "")
            if title or text:
                content_hash = self.compute_content_hash(title, text)
                self._seen_hashes.add(content_hash)

            clean_url = normalize_url(article.get("url", ""))
            if clean_url:
                self._seen_urls.add(clean_url)

    def reset_processed(self):
        """Resets deduplication cache (useful for tests or demo resets)."""
        self._processed_ids.clear()
        self._seen_hashes.clear()
        self._seen_urls.clear()
        logger.info("LiveNewsService: Deduplication cache reset.")

    def add_mock_article(self, article: Dict[str, Any]):
        """Injects a mock article into the service queue for instant testing."""
        self._mock_articles.append(article)

    # ─────────────────────────────────────────────────────────────────────────
    # RSS / HTTP FETCHING & PARSING
    # ─────────────────────────────────────────────────────────────────────────

    def _fetch_rss_raw(self, url: str) -> Optional[str]:
        """Fetches raw RSS XML using requests or urllib with standard headers and cache-busting."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AtmoGraph/1.0",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        }

        # Cache-busting timestamp query parameter to bypass stale caching
        sep = "&" if "?" in url else "?"
        bust_url = f"{url}{sep}_ts={int(time.time())}"

        try:
            if HAS_REQUESTS:
                resp = requests.get(bust_url, headers=headers, timeout=self.timeout)
                if resp.status_code == 200:
                    return resp.text
                logger.warning(f"HTTP {resp.status_code} received when fetching RSS feed from {bust_url}")
                return None
            else:
                req = urllib.request.Request(bust_url, headers=headers)
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    return response.read().decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Network error while fetching RSS feed from {bust_url}: {e}")
            return None

    def _parse_with_feedparser(self, xml_content_or_url: str) -> List[Dict[str, Any]]:
        """Parses feed content using feedparser if available."""
        feed = feedparser.parse(xml_content_or_url)
        if getattr(feed, "bozo", 0) and not getattr(feed, "entries", None):
            logger.warning(f"feedparser encountered an error: {getattr(feed, 'bozo_exception', 'Unknown')}")
            return []

        articles = []
        raw_feed_title = feed.feed.get("title") if hasattr(feed, "feed") else "Live RSS Feed"
        feed_title = normalize_source(raw_feed_title, default="Live RSS Feed")

        for entry in feed.entries:
            raw_title = getattr(entry, "title", "")
            title = normalize_title(raw_title)

            raw_text = (
                getattr(entry, "summary", "")
                or getattr(entry, "description", "")
                or ""
            )
            # Check content list if description/summary is missing
            if not raw_text and hasattr(entry, "content") and entry.content:
                if isinstance(entry.content, list) and len(entry.content) > 0:
                    raw_text = entry.content[0].get("value", "")

            # Safely handle missing title or text
            if not title and not raw_text:
                continue

            if not title:
                cleaned_desc = clean_html(raw_text)
                title = cleaned_desc[:80] + "..." if len(cleaned_desc) > 80 else cleaned_desc
                title = normalize_title(title)

            full_text = normalize_description(raw_text, title=title)
            if not full_text:
                full_text = title

            # Normalize URL / Link
            raw_url = (
                getattr(entry, "link", "")
                or (entry.links[0].get("href", "") if hasattr(entry, "links") and entry.links else "")
            )
            url = normalize_url(raw_url)

            # Determine stable ID
            raw_id = (
                getattr(entry, "id", "")
                or getattr(entry, "guid", "")
                or url
                or getattr(entry, "link", "")
                or f"RSS_{self.compute_content_hash(title, full_text)[:12]}"
            )
            article_id = f"NEWS_LIVE_{hashlib.md5(str(raw_id).strip().encode('utf-8')).hexdigest()[:10]}"

            # Normalize publication timestamp
            published_val = (
                getattr(entry, "published_parsed", None)
                or getattr(entry, "updated_parsed", None)
                or getattr(entry, "published", None)
                or getattr(entry, "updated", None)
            )
            published_at = normalize_timestamp(published_val)

            # Normalize source
            raw_source = getattr(entry, "source", None)
            author = getattr(entry, "author", None)
            source = normalize_source(raw_source or author or feed_title, default=feed_title)

            articles.append({
                "id": article_id,
                "title": title,
                "text": full_text,
                "source": source,
                "published_at": published_at,
                "url": url,
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
                feed_title = normalize_source(t_node.text, default="Live RSS Feed")
            items = channel.findall("item")
        else:
            items = root.findall(".//{http://www.w3.org/2005/Atom}entry") or root.findall("item")

        for item in items:
            title_node = item.find("title") or item.find("{http://www.w3.org/2005/Atom}title")
            raw_title = title_node.text if title_node is not None and title_node.text else ""
            title = normalize_title(raw_title)

            desc_node = (
                item.find("description")
                or item.find("{http://www.w3.org/2005/Atom}summary")
                or item.find("{http://www.w3.org/2005/Atom}content")
            )
            raw_text = desc_node.text if desc_node is not None and desc_node.text else ""

            if not title and not raw_text:
                continue

            if not title:
                cleaned_desc = clean_html(raw_text)
                title = cleaned_desc[:80] + "..." if len(cleaned_desc) > 80 else cleaned_desc
                title = normalize_title(title)

            full_text = normalize_description(raw_text, title=title)
            if not full_text:
                full_text = title

            # Normalize URL / Link
            link_node = item.find("link") or item.find("{http://www.w3.org/2005/Atom}link")
            raw_url = ""
            if link_node is not None:
                raw_url = link_node.text.strip() if link_node.text else (link_node.get("href") or "").strip()
            url = normalize_url(raw_url)

            # Determine stable ID
            guid_node = (
                item.find("guid")
                or item.find("{http://www.w3.org/2005/Atom}id")
            )
            raw_id = (guid_node.text.strip() if guid_node is not None and guid_node.text else "")
            if not raw_id:
                raw_id = url or raw_url or f"ET_{self.compute_content_hash(title, full_text)[:12]}"

            article_id = f"NEWS_LIVE_{hashlib.md5(str(raw_id).strip().encode('utf-8')).hexdigest()[:10]}"

            pub_node = (
                item.find("pubDate")
                or item.find("{http://www.w3.org/2005/Atom}published")
                or item.find("{http://www.w3.org/2005/Atom}updated")
            )
            raw_pub = pub_node.text.strip() if pub_node is not None and pub_node.text else None
            published_at = normalize_timestamp(raw_pub)

            source_node = item.find("source") or item.find("{http://www.w3.org/2005/Atom}source")
            author_node = item.find("author") or item.find("{http://www.w3.org/2005/Atom}author")
            raw_src = (
                (source_node.text.strip() if source_node is not None and source_node.text else "")
                or (author_node.text.strip() if author_node is not None and author_node.text else "")
                or feed_title
            )
            source = normalize_source(raw_src, default=feed_title)

            articles.append({
                "id": article_id,
                "title": title,
                "text": full_text,
                "source": source,
                "published_at": published_at,
                "url": url,
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
            return [dict(a) for a in DEMO_ARTICLES]

        # 3. Fetch from remote RSS feed
        feed_url = self.feed_url
        if not feed_url or str(feed_url).lower() == "demo":
            return [dict(a) for a in DEMO_ARTICLES]

        logger.info(f"LiveNewsService: Fetching live news from {feed_url}")
        xml_content = self._fetch_rss_raw(feed_url)

        if xml_content:
            if HAS_FEEDPARSER:
                results = self._parse_with_feedparser(xml_content)
            if not results:
                results = self._parse_with_elementtree(xml_content)

        # 4. Handle case where remote fetch returned 0 articles
        if not results:
            if self.demo_mode or self.fallback_to_demo:
                logger.info(
                    "LiveNewsService: Demo mode or fallback active. Returning built-in demo articles."
                )
                return [dict(a) for a in DEMO_ARTICLES]
            else:
                logger.info(f"LiveNewsService: 0 articles found from {feed_url}. Monitoring continuously.")
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
        batch_seen_ids: Set[str] = set()
        batch_seen_hashes: Set[str] = set()
        batch_seen_urls: Set[str] = set()

        for article in all_articles:
            art_id = str(article.get("id", "")).strip()
            title = article.get("title", "")
            text = article.get("text", "")
            url = normalize_url(article.get("url", ""))

            content_hash = self.compute_content_hash(title, text) if (title or text) else ""

            # Intra-batch duplicate check
            if (art_id and art_id in batch_seen_ids) or \
               (content_hash and content_hash in batch_seen_hashes) or \
               (url and url in batch_seen_urls):
                continue

            # Historical duplicate check
            if self.is_processed(art_id, title=title, text=text, url=url):
                continue

            if art_id:
                batch_seen_ids.add(art_id)
            if content_hash:
                batch_seen_hashes.add(content_hash)
            if url:
                batch_seen_urls.add(url)

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
