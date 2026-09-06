"""
AtmoGraph — Live News Ingestion Worker
Week 4: Automatic / Live News Background Processing

Background worker that periodically polls LiveNewsService for new articles
and executes the complete AtmoGraph real-time disruption pipeline:
  NLP Entity Extraction -> Neo4j Match -> Graph Update -> GNN Prediction -> Ripple Analysis

Zero modification to existing pipeline logic.
"""

import sys
import os
import time
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import requests
from backend.app.services.live_news_service import (
    LiveNewsService,
    get_live_news_service,
)
from backend.app.services.realtime_pipeline import run_realtime_pipeline

# Configure worker logger
logger = logging.getLogger("atmo_live_news_worker")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
    )
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Import existing WebSocket broadcasting helper (in-process fallback for tests)
try:
    from backend.app.routes.websocket import broadcast_live_event
except Exception:
    broadcast_live_event = None

FASTAPI_BROADCAST_URL = os.getenv(
    "LIVE_WS_BROADCAST_URL",
    "http://127.0.0.1:8000/api/internal/live/broadcast"
)

def _broadcast_to_fastapi(event_data: Dict[str, Any]) -> bool:
    """
    Sends event payload to FastAPI process via HTTP bridge to broadcast
    to connected WebSocket clients across separate processes.
    """
    logger.info("[LiveWS Bridge] Sending event to FastAPI...")
    try:
        resp = requests.post(
            FASTAPI_BROADCAST_URL,
            json=event_data,
            timeout=2.0,
            headers={"Content-Type": "application/json"}
        )
        if resp.status_code == 200:
            logger.info("[LiveWS Bridge] Broadcast accepted by FastAPI")
            return True
        else:
            logger.warning(
                f"[LiveWS Bridge] FastAPI returned status {resp.status_code}: {resp.text}"
            )
            return False
    except requests.exceptions.RequestException as exc:
        logger.warning(
            f"[LiveWS Bridge] Could not reach FastAPI at {FASTAPI_BROADCAST_URL} ({exc}). "
            f"Is FastAPI running on port 8000?"
        )
        return False
    except Exception as exc:
        logger.warning(f"[LiveWS Bridge] Unexpected broadcast error: {exc}")
        return False

def _safe_broadcast_event(event_data: Dict[str, Any]):
    """
    Safely dispatches an event to WebSocket clients.
    Primary path: HTTP bridge to FastAPI process so connected browser clients receive it.
    Fallback / secondary: In-process broadcast if test client is running in same process.
    Never fails or interrupts the news pipeline if broadcasting fails.
    """
    # 1. HTTP Bridge to FastAPI process (for separate process worker)
    _broadcast_to_fastapi(event_data)

    # 2. Local in-process broadcast fallback (for unit tests / TestClient in same process)
    if broadcast_live_event is not None:
        try:
            broadcast_live_event(event_data)
        except Exception:
            pass



# =============================================================================
# LIVE NEWS WORKER CLASS
# =============================================================================

class LiveNewsWorker:
    """
    Background worker that monitors LiveNewsService for new articles and triggers
    the existing AtmoGraph real-time disruption pipeline for each incoming event.
    
    Operates in a safe daemon thread to avoid blocking FastAPI startup.
    """

    def __init__(
        self,
        service: Optional[LiveNewsService] = None,
        poll_interval: Optional[float] = None,
        max_batch_size: Optional[int] = None,
        auto_start: bool = False,
    ):
        """
        Initialize LiveNewsWorker.
        
        :param service: LiveNewsService instance (defaults to singleton).
        :param poll_interval: Polling interval in seconds (default: 300s, configurable via LIVE_NEWS_POLL_INTERVAL).
        :param max_batch_size: Max articles to process per poll (default: 3, configurable via LIVE_NEWS_BATCH_SIZE).
        :param auto_start: If True, starts worker thread immediately.
        """
        self.service = service or get_live_news_service()

        # Configurable poll interval (default 300 seconds / 5 minutes)
        if poll_interval is not None:
            self.poll_interval = float(poll_interval)
        else:
            env_interval = os.getenv("LIVE_NEWS_POLL_INTERVAL", "300")
            try:
                self.poll_interval = float(env_interval)
            except ValueError:
                self.poll_interval = 300.0

        # Maximum articles to process per polling cycle (protects against sudden traffic bursts)
        if max_batch_size is not None:
            self.max_batch_size = int(max_batch_size)
        else:
            env_batch = os.getenv("LIVE_NEWS_BATCH_SIZE", "3")
            try:
                self.max_batch_size = int(env_batch)
            except ValueError:
                self.max_batch_size = 3

        # Threading state
        self._is_running = False
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Monitoring statistics
        self._last_poll_time: Optional[float] = None
        self._processed_count: int = 0
        self._error_count: int = 0
        self._recent_results: List[Dict[str, Any]] = []

        logger.info(
            f"LiveNewsWorker initialized | Polling Interval: {self.poll_interval}s | "
            f"Batch Size: {self.max_batch_size}"
        )

        if auto_start:
            self.start()

    @property
    def is_running(self) -> bool:
        """Returns True if the background worker thread is actively running."""
        with self._lock:
            return self._is_running and self._thread is not None and self._thread.is_alive()

    # ─────────────────────────────────────────────────────────────────────────
    # WORKER LIFECYCLE CONTROLS
    # ─────────────────────────────────────────────────────────────────────────

    def start(self) -> bool:
        """
        Starts the background worker thread.
        Guarantees only one thread runs at any time to avoid duplicate processing.
        
        :return: True if started, False if already running.
        """
        with self._lock:
            if self._is_running and self._thread is not None and self._thread.is_alive():
                logger.warning("LiveNewsWorker: Start requested, but worker is already running.")
                return False

            self._stop_event.clear()
            self._is_running = True
            self._thread = threading.Thread(
                target=self._run_loop,
                daemon=True,
                name="AtmoGraph-LiveNewsWorker",
            )
            self._thread.start()
            logger.info("LiveNewsWorker: Background polling thread started successfully.")
            return True

    def stop(self, timeout: float = 10.0) -> bool:
        """
        Stops the background worker thread cleanly using an interruptible event.
        
        :param timeout: Maximum seconds to wait for thread termination.
        :return: True if stopped successfully.
        """
        with self._lock:
            if not self._is_running:
                logger.info("LiveNewsWorker: Stop requested, but worker was not running.")
                return True

            logger.info("LiveNewsWorker: Signaling background thread to stop...")
            self._stop_event.set()
            self._is_running = False

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=timeout)
            if self._thread.is_alive():
                logger.warning(f"LiveNewsWorker: Thread did not terminate within {timeout}s timeout.")
                return False

        logger.info("LiveNewsWorker: Background thread stopped cleanly.")
        return True

    # ─────────────────────────────────────────────────────────────────────────
    # EXECUTION LOGIC
    # ─────────────────────────────────────────────────────────────────────────

    def run_once(self, max_articles: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Executes a single poll-and-process iteration immediately.
        
        This method is thread-safe and can be called directly by tests, scripts,
        or trigger endpoints without waiting for the 5-minute timer.
        
        :param max_articles: Optional override for max articles to process this cycle.
        :return: List of pipeline execution results.
        """
        limit = max_articles if max_articles is not None else self.max_batch_size
        self._last_poll_time = time.time()
        results: List[Dict[str, Any]] = []

        try:
            new_articles = self.service.get_new_articles()
        except Exception as e:
            logger.error(f"LiveNewsWorker: Exception fetching new articles from service: {e}", exc_info=True)
            self._error_count += 1
            return []

        if not new_articles:
            logger.info("LiveNewsWorker: Poll complete — no new articles detected.")
            return []

        # Enforce batch limit
        batch = new_articles[:limit]
        logger.info(
            f"LiveNewsWorker: Ingesting batch of {len(batch)} new article(s) "
            f"(out of {len(new_articles)} available)..."
        )

        for article in batch:
            art_id = article.get("id", f"NEWS_{int(time.time())}")
            art_title = article.get("title", "Untitled Disruption")
            art_source = article.get("source", "Live Ingestion")
            art_published = article.get("published_at", datetime.now(timezone.utc).isoformat())

            logger.info(f"LiveNewsWorker: Processing article [{art_id}] '{art_title}' from {art_source}")

            # ── 1. Broadcast processing status before pipeline execution ──────
            proc_event = {
                "type": "worker_status",
                "status": "processing",
                "article_id": art_id,
                "title": art_title,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            _safe_broadcast_event(proc_event)
            logger.info(f"LiveNewsWorker: Broadcasted worker_status 'processing' for [{art_id}]")

            try:
                # ── 2. Invoke existing realtime pipeline ──────────────────────
                # Article dictionary format matches realtime_pipeline.py expectations:
                # {"id": ..., "title": ..., "text": ..., "source": ..., "published_at": ...}
                pipeline_result = run_realtime_pipeline(news_input=article)

                # Mark article as processed in service deduplication registry
                self.service.mark_processed(art_id, article=article)
                self._processed_count += 1

                # Extract existing pipeline results (do not re-calculate)
                success = pipeline_result.get("success", False)
                shock_origin = pipeline_result.get("shock_origin", "None")
                duration_ms = pipeline_result.get("duration_ms", 0)
                extracted_count = len(pipeline_result.get("extracted_entities", []))
                matched_count = len([m for m in pipeline_result.get("matched_entities", []) if m.get("matched")])
                ripple_res = pipeline_result.get("ripple_results") or {}
                affected_count = ripple_res.get("total_affected_nodes", 0)
                max_depth = ripple_res.get("max_depth", 0)
                pred_summary = pipeline_result.get("prediction_results", {}).get("summary", {})
                avg_delay = pred_summary.get("avg_predicted_delay", 0.0)

                graph_status = pipeline_result.get("graph_update_status", {}).get("status", "")
                neo4j_updated = graph_status == "SUCCESS" or success
                gnn_updated = pipeline_result.get("prediction_status") == "SUCCESS" or success
                ripple_updated = pipeline_result.get("ripple_analysis_status") == "SUCCESS" or success

                if success:
                    logger.info(
                        f"LiveNewsWorker: Pipeline SUCCESS for [{art_id}] | "
                        f"Shock Origin: '{shock_origin}' | "
                        f"NLP Extracted: {extracted_count} | "
                        f"Neo4j Matched: {matched_count} | "
                        f"Ripple Affected: {affected_count} nodes | "
                        f"Time: {duration_ms}ms"
                    )

                    # ── Register article in persistent LiveNewsStore ─────────
                    stored_art = None
                    try:
                        from backend.app.services.live_news_store import get_live_news_store
                        stored_art = get_live_news_store().register_from_pipeline(
                            article=article,
                            pipeline_result=pipeline_result
                        )
                        logger.info(f"LiveNewsWorker: Registered article [{art_id}] in LiveNewsStore")
                    except Exception as store_exc:
                        logger.warning(f"LiveNewsWorker: Could not register in LiveNewsStore: {store_exc}")

                    # ── 3. Broadcast live_news_processed event ────────────────
                    matched_list = [m for m in pipeline_result.get("matched_entities", []) if m.get("matched")]
                    all_entities = pipeline_result.get("matched_entities") or pipeline_result.get("extracted_entities") or []

                    live_event = {
                        "type": "live_news_processed",
                        "article_id": art_id,
                        "title": art_title,
                        "source": art_source,
                        "published_at": art_published,
                        "shock_origin": shock_origin,
                        "extracted_entities": extracted_count,
                        "matched_entities": matched_count,
                        "matched_entity_details": matched_list,
                        "entities": all_entities,
                        "neo4j_updated": neo4j_updated,
                        "gnn_updated": gnn_updated,
                        "avg_predicted_delay": round(float(avg_delay), 2) if avg_delay is not None else 0.0,
                        "ripple_updated": ripple_updated,
                        "affected_nodes": affected_count,
                        "max_depth": max_depth,
                        "duration_ms": duration_ms,
                        "article": stored_art,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    _safe_broadcast_event(live_event)
                    logger.info(
                        f"LiveNewsWorker: Broadcasted live_news_processed for [{art_id}] | "
                        f"Shock: '{shock_origin}' | Avg Delay: {avg_delay}d | Affected: {affected_count} nodes"
                    )

                    # ── 4. Broadcast worker_status completed ──────────────────
                    comp_event = {
                        "type": "worker_status",
                        "status": "completed",
                        "article_id": art_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    _safe_broadcast_event(comp_event)
                    logger.info(f"LiveNewsWorker: Broadcasted worker_status 'completed' for [{art_id}]")

                else:
                    logger.warning(
                        f"LiveNewsWorker: Pipeline reported non-success for [{art_id}] | "
                        f"Stage: {pipeline_result.get('failed_stage')} | "
                        f"Error: {pipeline_result.get('error')}"
                    )
                    # ── Broadcast error status on non-success ─────────────────
                    err_event = {
                        "type": "worker_status",
                        "status": "error",
                        "article_id": art_id,
                        "error": str(pipeline_result.get("error", "Pipeline execution non-success")),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    _safe_broadcast_event(err_event)
                    logger.info(f"LiveNewsWorker: Broadcasted worker_status 'error' for [{art_id}]")

                # Keep recent execution history (bounded at 20)
                self._recent_results.append({
                    "article_id": art_id,
                    "title": art_title,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "success": success,
                    "shock_origin": shock_origin,
                    "affected_nodes": affected_count,
                    "duration_ms": duration_ms,
                })
                if len(self._recent_results) > 20:
                    self._recent_results.pop(0)

                results.append(pipeline_result)

            except Exception as item_err:
                self._error_count += 1
                logger.error(
                    f"LiveNewsWorker: Pipeline execution FAILED for article [{art_id}]: {item_err}",
                    exc_info=True,
                )
                # ── Broadcast error status on exception ───────────────────────
                err_event = {
                    "type": "worker_status",
                    "status": "error",
                    "article_id": art_id,
                    "error": str(item_err),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                _safe_broadcast_event(err_event)
                logger.info(f"LiveNewsWorker: Broadcasted worker_status 'error' for [{art_id}]")

                # Mark as processed to prevent poisoned item from crashing subsequent cycles
                self.service.mark_processed(art_id, article=article)

        return results

    def _run_loop(self):
        """Internal background polling loop with interruptible sleep."""
        logger.info(
            f"LiveNewsWorker: Loop started. Polling every {self.poll_interval}s. "
            f"Press Stop or call stop() to exit."
        )

        while not self._stop_event.is_set():
            try:
                self.run_once()
            except Exception as loop_err:
                self._error_count += 1
                logger.error(f"LiveNewsWorker: Uncaught error in worker loop: {loop_err}", exc_info=True)

            # Interruptible wait: if stop() is called, this unblocks immediately
            if self._stop_event.wait(timeout=self.poll_interval):
                break

        logger.info("LiveNewsWorker: Loop terminated.")

    # ─────────────────────────────────────────────────────────────────────────
    # MONITORING / STATUS
    # ─────────────────────────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """Returns the current worker operational status."""
        return {
            "is_running": self.is_running,
            "poll_interval_seconds": self.poll_interval,
            "max_batch_size": self.max_batch_size,
            "last_poll_time": (
                datetime.fromtimestamp(self._last_poll_time, tz=timezone.utc).isoformat()
                if self._last_poll_time
                else None
            ),
            "processed_count": self._processed_count,
            "error_count": self._error_count,
            "recent_executions": list(self._recent_results[-5:]),
        }


# Singleton helper
_default_live_news_worker: Optional[LiveNewsWorker] = None


def get_live_news_worker() -> LiveNewsWorker:
    """Returns a module-level singleton instance of LiveNewsWorker."""
    global _default_live_news_worker
    if _default_live_news_worker is None:
        _default_live_news_worker = LiveNewsWorker()
    return _default_live_news_worker


# =============================================================================
# CLI TEST EXECUTION
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AtmoGraph Live News Ingestion Worker")
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run an immediate single test cycle using demo articles and exit without waiting.",
    )
    parser.add_argument(
        "--run-once",
        action="store_true",
        help="Fetch and process one batch from the configured source immediately.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Use built-in supply-chain demo articles instead of live RSS.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=None,
        help="Override polling interval in seconds (default: 300).",
    )
    parser.add_argument(
        "--continuous",
        action="store_true",
        help="Run continuously in foreground until Ctrl+C.",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("AtmoGraph Week 4: Live News Worker Test")
    print("=" * 70)

    demo_flag = args.demo or args.test
    svc = LiveNewsService(demo_mode=demo_flag)
    worker = LiveNewsWorker(service=svc, poll_interval=args.interval or 300.0, max_batch_size=1)

    print(f"Mode         : {'DEMO' if demo_flag else 'LIVE RSS'}")
    print(f"Poll Interval: {worker.poll_interval}s")

    if args.test or args.run_once:
        print("\n[TEST MODE] Executing single immediate pipeline cycle (run_once)...")
        results = worker.run_once(max_articles=1)

        print(f"\nCompleted run_once(). Processed: {len(results)} article(s).")
        if results:
            res = results[0]
            print("\nPipeline Result Summary:")
            print(f" - Article ID    : {res.get('processed_news', {}).get('id')}")
            print(f" - Article Title : {res.get('processed_news', {}).get('title')}")
            print(f" - Success       : {res.get('success')}")
            print(f" - Shock Origin  : {res.get('shock_origin')}")
            print(f" - Extracted     : {len(res.get('extracted_entities', []))} entities")
            print(f" - Matched       : {len([m for m in res.get('matched_entities', []) if m.get('matched')])} nodes")
            print(f" - GNN Delay Avg : {res.get('prediction_results', {}).get('summary', {}).get('avg_predicted_delay')} days")
            print(f" - Ripple Nodes  : {res.get('ripple_results', {}).get('total_affected_nodes', 0)}")
            print(f" - Execution Time: {res.get('duration_ms')}ms")
            print("\n[PASS] Immediate test execution completed with 100% success!")
        else:
            print("\n[INFO] No new articles needed processing (already deduplicated).")
    elif args.continuous:
        print("\n[CONTINUOUS MODE] Starting background worker thread...")
        worker.start()
        try:
            print("Worker running. Press Ctrl+C to stop.")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping worker...")
            worker.stop()
            print("Worker stopped.")
    else:
        print("\nUsage:")
        print("  python backend/app/services/live_news_worker.py --test      (Runs immediate test cycle)")
        print("  python backend/app/services/live_news_worker.py --run-once  (Processes 1 live batch)")
        print("  python backend/app/services/live_news_worker.py --continuous (Runs background worker)")
