"""
AtmoGraph — Real-Time Intelligence & Disruption Pipeline
Week 4: Central Real-Time Orchestration Service

Orchestrates the complete real-time disruption cycle:
  News Ingestion / Disruption Event
        ↓
  spaCy NLP / Entity Extraction
        ↓
  Neo4j Entity Matching
        ↓
  Neo4j Graph Risk / Disruption Update
        ↓
  GraphSAGE GNN Delay Prediction
        ↓
  Supply Chain Ripple Effect Propagation Analysis
        ↓
  Consolidated Real-Time Supply-Chain Intelligence
"""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Union

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.news_ingestion_service import NewsIngestionService
from backend.app.services.nlp_service import NLPService
from backend.app.services.news_graph_service import NewsGraphService
from backend.app.services.entity_matcher import EntityMatcher
from backend.app.services.gnn_predictor import predict_supply_chain_risk
from backend.app.services.ripple_effect import (
    calculate_ripple_propagation,
    invalidate_ripple_cache,
    get_ripple_candidate_nodes,
    RIPPLE_DECAY,
    DEFAULT_MAX_DEPTH,
)


class RealtimePipeline:
    """
    Central orchestration service for AtmoGraph's real-time disruption pipeline.
    Executes one complete cycle connecting news ingestion, NLP, Neo4j graph updates,
    GraphSAGE GNN predictions, and ripple propagation analysis.
    """

    def __init__(self):
        self.news_service = NewsIngestionService()
        self.nlp_service = NLPService()
        self.news_graph_service = NewsGraphService()
        self.entity_matcher = EntityMatcher()

    def resolve_shock_node(
        self,
        requested_node: Optional[str],
        matched_entities: List[Dict[str, Any]],
        news_text: Optional[str] = None,
        article_source: Optional[str] = None,
    ) -> Optional[str]:
        """
        Resolves the most appropriate shock node for ripple simulation using strict priority:
        1. Explicit request shock_node (must match existing graph node candidate by id, name, or substring).
           If supplied, this is the authoritative selection and is never overridden.
        2. Explicit matched entity from news (if shock_node was omitted), prioritizing Ports and Suppliers.
        3. News text / entity inference (detecting mentions of candidate nodes directly in news text).
        4. Fallback candidate (highest disruption/risk candidate node in the graph).
        """
        candidates = get_ripple_candidate_nodes()
        if not candidates:
            return None

        cand_by_id = {c["id"].lower(): c for c in candidates if c.get("id")}
        cand_by_name = {c["name"].lower(): c for c in candidates if c.get("name")}

        # Distinguishing tokens: avoid generic supply-chain labels matching the wrong node
        stopwords = {
            "port", "center", "centre", "warehouse", "works", "plant",
            "assembly", "devices", "supply", "parts", "components",
            "distribution", "electronics", "management", "consumer",
        }

        # -----------------------------------------------------------------
        # 1. EXPLICIT REQUEST SHOCK NODE (Highest Priority - Authoritative)
        # -----------------------------------------------------------------
        if requested_node and str(requested_node).strip():
            req_clean = str(requested_node).strip().lower()

            # Pass 1: Exact match by ID or Name
            if req_clean in cand_by_id:
                name = cand_by_id[req_clean]["name"]
                print(f"[REALTIME] Authoritative shock node selected: {name}")
                return name

            if req_clean in cand_by_name:
                name = cand_by_name[req_clean]["name"]
                print(f"[REALTIME] Authoritative shock node selected: {name}")
                return name

            # Pass 2: Substring / containment match
            for c in candidates:
                c_name = c["name"].lower()
                c_id = (c.get("id") or "").lower()
                if req_clean == c_name or req_clean == c_id:
                    print(f"[REALTIME] Authoritative shock node selected: {c['name']}")
                    return c["name"]
                if c_name in req_clean or req_clean in c_name:
                    print(f"[REALTIME] Authoritative shock node selected: {c['name']}")
                    return c["name"]
                if c_id and (c_id in req_clean or req_clean in c_id):
                    print(f"[REALTIME] Authoritative shock node selected: {c['name']}")
                    return c["name"]

            # Pass 3: Distinguishing token match (ignoring generic stopwords)
            for c in candidates:
                c_name = c["name"].lower()
                for token in req_clean.split():
                    if len(token) >= 4 and token not in stopwords and token in c_name:
                        print(f"[REALTIME] Authoritative shock node selected: {c['name']}")
                        return c["name"]

        # -----------------------------------------------------------------
        # 2. EXPLICIT MATCHED ENTITIES FROM NEWS (If shock_node omitted)
        # -----------------------------------------------------------------
        # Filter strictly for genuine supply-chain entities (exclude news sources and non-graph items)
        matched_success = [
            m for m in (matched_entities or [])
            if (m.get("matched") or m.get("status") == "matched") and
            not m.get("is_source") and
            m.get("category") != "NON_GRAPH_ENTITY" and
            m.get("label") not in ("SOURCE", "NEWS_SOURCE")
        ]
        # Priority: Port (1), Warehouse (2), Supplier (3), Manufacturer (4), Product (5), Country (6)
        type_order = {"Port": 1, "Warehouse": 2, "Supplier": 3, "Manufacturer": 4, "Product": 5, "Country": 6}
        matched_success.sort(key=lambda m: type_order.get(m.get("graph_type") or m.get("graph_node_type"), 10))

        # Pass 1: Canonical name or exact match across all matched entities and candidates
        for m in matched_success:
            canon = str(m.get("canonical_name") or "").strip().lower()
            m_text = str(m.get("text", "")).strip().lower()
            for c in candidates:
                c_name = c["name"].lower()
                c_id = (c.get("id") or "").lower()
                if (canon and (canon == c_name or canon == c_id)) or m_text == c_name or m_text == c_id:
                    print(f"[REALTIME] Shock node resolved from matched news entity: {c['name']}")
                    return c["name"]

        # Pass 2: Substring containment across all matched entities and candidates
        for m in matched_success:
            m_text = str(m.get("text", "")).strip().lower()
            canon = str(m.get("canonical_name") or "").strip().lower()
            for c in candidates:
                c_name = c["name"].lower()
                if len(m_text) >= 4 and (c_name in m_text or m_text in c_name):
                    print(f"[REALTIME] Shock node resolved from matched news entity: {c['name']}")
                    return c["name"]
                if canon and len(canon) >= 4 and (c_name in canon or canon in c_name):
                    print(f"[REALTIME] Shock node resolved from matched news entity: {c['name']}")
                    return c["name"]

        # Pass 3: Distinguishing token match for non-Country candidates (ignoring generic stopwords)
        for m in matched_success:
            if m.get("graph_type") == "Country":
                continue  # Avoid loose country token matches overriding specific supply chain nodes
            m_text = str(m.get("text", "")).strip().lower()
            for token in m_text.split():
                if len(token) >= 4 and token not in stopwords:
                    for c in candidates:
                        if token in c["name"].lower():
                            print(f"[REALTIME] Shock node resolved from matched news entity token: {c['name']}")
                            return c["name"]

        # -----------------------------------------------------------------
        # 3. NEWS TEXT / ENTITY INFERENCE
        # -----------------------------------------------------------------
        if news_text:
            text_lower = news_text.lower()
            if article_source and str(article_source).strip():
                text_lower = text_lower.replace(str(article_source).strip().lower(), " ")
            # Strip known news publishers from text so publisher mentions don't trigger keyword matches
            for pub in ["india shipping news", "journal of commerce", "global trade magazine", "transport topics"]:
                text_lower = text_lower.replace(pub, " ")

            port_supplier_candidates = [c for c in candidates if c.get("entity_type") in ("Port", "Warehouse", "Supplier")]

            # Pass 1: Full candidate name mentioned in text
            for c in port_supplier_candidates:
                c_name = c["name"].lower()
                if c_name in text_lower:
                    print(f"[REALTIME] Shock node inferred from news text: {c['name']}")
                    return c["name"]

            # Pass 2: Distinguishing city or company name keyword in text
            for c in port_supplier_candidates:
                for token in c["name"].lower().split():
                    if len(token) >= 4 and token not in stopwords and token in text_lower:
                        print(f"[REALTIME] Shock node inferred from news text keyword: {c['name']}")
                        return c["name"]

        # -----------------------------------------------------------------
        # 4. FALLBACK CANDIDATE (Most critical candidate node in graph)
        # -----------------------------------------------------------------
        fallback = candidates[0]["name"]
        print(f"[REALTIME] Fallback shock node selected: {fallback}")
        return fallback

    def run(
        self,
        news_input: Union[str, Path, Dict[str, Any]],
        shock_node: Optional[str] = None,
        decay: float = RIPPLE_DECAY,
        max_depth: int = DEFAULT_MAX_DEPTH,
    ) -> Dict[str, Any]:
        """
        Runs one complete real-time pipeline cycle:
        1. Ingestion: parses news article (file path, dict, or raw text)
        2. NLP: extracts named entities
        3. Entity Matching: maps entities to Neo4j graph nodes
        4. Neo4j Graph Update: writes updated risk/status values into Neo4j
        5. GNN Prediction: predicts node-level delays across graph
        6. Ripple Effect Analysis: simulates downstream propagation from shock origin
        7. Consolidated Intelligence: returns unified payload with stage tracking
        """
        pipeline_start_time = time.time()
        timestamp_iso = datetime.now(timezone.utc).isoformat()
        current_stage = "INITIALIZATION"

        processed_news: Dict[str, Any] = {}
        extracted_entities: List[Dict[str, Any]] = []
        matched_entities: List[Dict[str, Any]] = []
        graph_update_status: Dict[str, Any] = {"status": "PENDING"}
        prediction_status: str = "PENDING"
        ripple_analysis_status: str = "PENDING"
        prediction_results: Dict[str, Any] = {}
        ripple_results: Optional[Dict[str, Any]] = None
        resolved_shock_node: Optional[str] = None

        print("\n[REALTIME] Starting pipeline")

        try:
            # ─────────────────────────────────────────────────────────────
            # STAGE 1: NEWS INGESTION / DISRUPTION
            # ─────────────────────────────────────────────────────────────
            current_stage = "NEWS_INGESTION"

            if isinstance(news_input, (str, Path)):
                file_path = Path(news_input)
                if file_path.is_file():
                    raw_news = self.news_service.load_news(str(file_path))
                else:
                    # Treat string input as raw text content
                    raw_news = {
                        "id": f"NEWS_CUSTOM_{int(time.time())}",
                        "title": "Real-time Disruption Event",
                        "source": "AtmoGraph Live Feed",
                        "published_at": timestamp_iso,
                        "text": str(news_input).strip(),
                    }
            elif isinstance(news_input, dict):
                raw_news = {
                    "id": news_input.get("id", f"NEWS_{int(time.time())}"),
                    "title": news_input.get("title", "Supply Chain Event"),
                    "source": news_input.get("source", "Realtime Pipeline"),
                    "published_at": news_input.get("published_at", timestamp_iso),
                    "text": news_input.get("text", ""),
                }
            else:
                raise ValueError(f"Unsupported news_input type: {type(news_input)}")

            processed_news = {
                "id": raw_news.get("id"),
                "title": raw_news.get("title"),
                "source": raw_news.get("source"),
                "published_at": raw_news.get("published_at"),
                "text": raw_news.get("text"),
            }
            print(f"[REALTIME] News ingestion completed: '{processed_news['title']}' (ID: {processed_news['id']})")

            # ─────────────────────────────────────────────────────────────
            # STAGE 2: NLP / ENTITY EXTRACTION
            # ─────────────────────────────────────────────────────────────
            current_stage = "NLP_EXTRACTION"
            text = processed_news.get("text", "")
            if not text:
                raise ValueError("News text is empty, cannot perform NLP extraction.")

            article_source = processed_news.get("source")
            extracted_entities = self.nlp_service.extract_entities(text, source=article_source)
            print(f"[REALTIME] NLP extraction completed: {len(extracted_entities)} entities identified")

            # ─────────────────────────────────────────────────────────────
            # STAGE 3: ENTITY MATCHING
            # ─────────────────────────────────────────────────────────────
            current_stage = "ENTITY_MATCHING"
            for entity in extracted_entities:
                matched = self.news_graph_service.match_entity(entity, source=article_source)
                matched_entities.append(matched)

            matched_count = sum(1 for m in matched_entities if m.get("matched"))
            print(f"[REALTIME] Entity matching completed: {matched_count}/{len(matched_entities)} entities mapped to graph")

            # ─────────────────────────────────────────────────────────────
            # STAGE 4: NEO4J GRAPH UPDATE
            # ─────────────────────────────────────────────────────────────
            current_stage = "GRAPH_UPDATE"
            nodes_updated = 0
            for matched in matched_entities:
                if matched.get("matched"):
                    self.news_graph_service.apply_news_risk(matched)
                    nodes_updated += 1

            # Apply port strike impact if scenario explicitly applies to Rotterdam
            port_strike_applied = False
            news_id = processed_news.get("id", "")
            lower_text = text.lower()
            if news_id == "NEWS001" or ("rotterdam" in lower_text and "port strike" in lower_text):
                self.news_graph_service.apply_port_strike_impact()
                port_strike_applied = True

            # Invalidate ripple and graph cache to force fresh state retrieval
            invalidate_ripple_cache()

            graph_update_status = {
                "status": "COMPLETED",
                "nodes_risk_updated": nodes_updated,
                "port_strike_impact_applied": port_strike_applied,
            }
            print(f"[REALTIME] Neo4j graph update completed: {nodes_updated} node risks updated (port strike impact: {port_strike_applied})")

            # ─────────────────────────────────────────────────────────────
            # STAGE 5: GNN PREDICTION
            # ─────────────────────────────────────────────────────────────
            current_stage = "GNN_PREDICTION"
            raw_predictions = predict_supply_chain_risk()

            if not raw_predictions:
                raise RuntimeError("GNN predictor returned empty predictions.")

            delays = [p.get("predicted_delay", 0.0) for p in raw_predictions]
            prediction_results = {
                "total_nodes": len(raw_predictions),
                "predictions": raw_predictions,
                "summary": {
                    "max_predicted_delay": round(max(delays), 2) if delays else 0.0,
                    "min_predicted_delay": round(min(delays), 2) if delays else 0.0,
                    "avg_predicted_delay": round(sum(delays) / len(delays), 2) if delays else 0.0,
                    "high_delay_nodes": [p["name"] for p in raw_predictions if p.get("predicted_delay", 0.0) >= 5.0],
                },
            }
            prediction_status = "COMPLETED"
            print(f"[REALTIME] GNN prediction completed: generated delay forecasts for {len(raw_predictions)} nodes (avg delay: {prediction_results['summary']['avg_predicted_delay']}d)")

            # ─────────────────────────────────────────────────────────────
            # STAGE 6: RIPPLE EFFECT ANALYSIS
            # ─────────────────────────────────────────────────────────────
            current_stage = "RIPPLE_ANALYSIS"
            resolved_shock_node = self.resolve_shock_node(
                requested_node=shock_node,
                matched_entities=matched_entities,
                news_text=text,
                article_source=article_source,
            )

            if not resolved_shock_node:
                raise RuntimeError("Could not resolve a valid shock node for ripple propagation.")

            ripple_results = calculate_ripple_propagation(
                source_identifier=resolved_shock_node,
                decay=decay,
                max_depth=max_depth,
            )

            if ripple_results is None:
                ripple_analysis_status = "NODE_NOT_FOUND"
                print(f"[REALTIME] Ripple effect analysis warning: shock node '{resolved_shock_node}' not found in graph")
            else:
                ripple_analysis_status = "COMPLETED"
                affected_cnt = ripple_results.get("total_affected_nodes", 0)
                max_d = ripple_results.get("max_depth", 0)
                print(f"[REALTIME] Ripple effect analysis completed: {affected_cnt} downstream entities affected from '{resolved_shock_node}' (depth: {max_d} hops)")

            # ─────────────────────────────────────────────────────────────
            # STAGE 7: CONSOLIDATED INTELLIGENCE
            # ─────────────────────────────────────────────────────────────
            duration_ms = round((time.time() - pipeline_start_time) * 1000, 1)
            print("[REALTIME] Pipeline completed successfully\n")

            return {
                "success": True,
                "timestamp": timestamp_iso,
                "duration_ms": duration_ms,
                "processed_news": processed_news,
                "extracted_entities": extracted_entities,
                "matched_entities": matched_entities,
                "graph_update_status": graph_update_status,
                "prediction_status": prediction_status,
                "ripple_analysis_status": ripple_analysis_status,
                "shock_origin": resolved_shock_node,
                "prediction_results": prediction_results,
                "ripple_results": ripple_results,
            }

        except Exception as err:
            duration_ms = round((time.time() - pipeline_start_time) * 1000, 1)
            error_msg = str(err)
            print(f"[REALTIME] Pipeline FAILED at stage '{current_stage}': {error_msg}")

            return {
                "success": False,
                "failed_stage": current_stage,
                "error": error_msg,
                "timestamp": timestamp_iso,
                "duration_ms": duration_ms,
                "processed_news": processed_news,
                "extracted_entities": extracted_entities,
                "matched_entities": matched_entities,
                "graph_update_status": graph_update_status,
                "prediction_status": prediction_status,
                "ripple_analysis_status": ripple_analysis_status,
                "shock_origin": resolved_shock_node,
                "prediction_results": prediction_results,
                "ripple_results": ripple_results,
            }


def run_realtime_pipeline(
    news_input: Union[str, Path, Dict[str, Any]],
    shock_node: Optional[str] = None,
    decay: float = RIPPLE_DECAY,
    max_depth: int = DEFAULT_MAX_DEPTH,
) -> Dict[str, Any]:
    """
    Convenience function to execute a single cycle of the RealtimePipeline.
    """
    pipeline = RealtimePipeline()
    return pipeline.run(
        news_input=news_input,
        shock_node=shock_node,
        decay=decay,
        max_depth=max_depth,
    )


if __name__ == "__main__":
    sample_news_file = ROOT_DIR / "data" / "news" / "port_strike_europe.json"
    print("=" * 70)
    print("AtmoGraph Week 4: Real-Time Supply Chain Disruption Pipeline Demo")
    print("=" * 70)
    print(f"Sample Input File: {sample_news_file}")

    if not sample_news_file.exists():
        print(f"Error: Sample file {sample_news_file} does not exist.")
        sys.exit(1)

    # Run pipeline with sample news
    result = run_realtime_pipeline(news_input=sample_news_file)

    print("\n" + "=" * 70)
    print("PIPELINE EXECUTION SUMMARY")
    print("=" * 70)
    print(f"Success               : {result.get('success')}")
    print(f"Timestamp             : {result.get('timestamp')}")
    print(f"Duration              : {result.get('duration_ms')}ms")
    print(f"Processed News Title  : {result.get('processed_news', {}).get('title')}")
    print(f"Extracted Entities    : {len(result.get('extracted_entities', []))}")
    print(f"Matched Entities      : {len([m for m in result.get('matched_entities', []) if m.get('matched')])}")
    print(f"Graph Update Status   : {result.get('graph_update_status', {}).get('status')}")
    print(f"Prediction Status     : {result.get('prediction_status')}")
    print(f"Total Predicted Nodes : {result.get('prediction_results', {}).get('total_nodes')}")
    print(f"Avg Predicted Delay   : {result.get('prediction_results', {}).get('summary', {}).get('avg_predicted_delay')} days")
    print(f"Ripple Shock Origin   : {result.get('shock_origin')}")
    print(f"Ripple Analysis Status: {result.get('ripple_analysis_status')}")
    print(f"Affected Nodes Count  : {result.get('ripple_results', {}).get('total_affected_nodes', 0)}")
    print(f"Max Propagation Depth : {result.get('ripple_results', {}).get('max_depth', 0)} hops")

    ripple_res = result.get("ripple_results")
    if ripple_res and ripple_res.get("affected_nodes"):
        print("\nTop Affected Downstream Entities:")
        print("-" * 70)
        for node in ripple_res["affected_nodes"][:5]:
            print(
                f" - {node['name']} ({node['entity_type']}) | "
                f"Hop: {node['depth']} | "
                f"Ripple Score: {node['ripple_score'] * 100:.1f}% | "
                f"GNN Delay: {node['predicted_delay']}d"
            )

    print("\n[REALTIME DEMO] Verification complete.")
