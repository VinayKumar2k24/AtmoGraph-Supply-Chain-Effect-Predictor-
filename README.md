# AtmoGraph — Supply Chain Ripple Effect Predictor

> An AI-powered supply-chain intelligence platform that transforms disruption-related news into an interconnected supply-chain graph and predicts potential downstream delays and ripple effects using Graph Neural Networks.

---

## 📌 Project Overview

AtmoGraph is an intelligent supply-chain monitoring and prediction platform designed to understand how disruptions in one part of a supply chain can propagate through connected suppliers, manufacturers, products, ports, warehouses, distribution centres, and countries.

Traditional supply-chain monitoring systems generally analyse individual events independently. However, supply chains are highly interconnected, meaning that a disruption at one entity can affect multiple downstream entities.

AtmoGraph addresses this problem by combining:

- Natural Language Processing (NLP)
- Named Entity Recognition (NER)
- Neo4j Graph Database
- Graph Neural Networks (GNN)
- GraphSAGE architecture
- FastAPI
- React
- Interactive graph visualisation
- Ripple-effect analysis

The system converts disruption-related news into structured information, maps the extracted entities to the supply-chain graph, updates disruption and risk information, and uses graph-based machine learning to estimate potential delays.

---

## 🎯 Problem Statement

Modern supply chains are vulnerable to disruptions such as:

- Port strikes
- Natural disasters
- Geopolitical events
- Transportation failures
- Supplier shutdowns
- Manufacturing interruptions
- Raw-material shortages
- Infrastructure failures
- Regional disruptions

The major challenge is not simply detecting that a disruption has occurred. 

The real challenge is determining:

> **How will the disruption propagate through the interconnected supply chain?**

For example:

```text
Port Disruption
       ↓
Shipping Delay
       ↓
Warehouse Delay
       ↓
Manufacturer Delay
       ↓
Product Availability Impact
       ↓
Downstream Supply Chain Ripple Effect
```
💡 Proposed Solution
AtmoGraph creates an end-to-end pipeline:
```text
News / Disruption Information
            ↓
        NLP Pipeline
            ↓
    Entity Extraction (spaCy)
            ↓
      Entity Matching
            ↓
       Neo4j Graph
            ↓
  Supply-Chain Relationships
            ↓
       GraphSAGE GNN
            ↓
     Delay Prediction
            ↓
   Ripple Effect Analysis
            ↓
        FastAPI
            ↓
      React Dashboard
            ↓
Interactive Supply-Chain Intelligence
```
🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────┐
│                  NEWS / EVENTS                      │
│      Disruption News / Structured Input             │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                  NLP PIPELINE                       │
│                                                     │
│  spaCy NER → Entity Extraction → Entity Matching    │
│  Disruption Detection → Severity / Risk Extraction  │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                NEO4J GRAPH DATABASE                 │
│                                                     │
│ Suppliers ── Manufacturers ── Products              │
│      │              │              │                │
│      ▼              ▼              ▼                │
│    Ports ───── Warehouses ───── Countries           │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│             GRAPH DATA PROCESSING                   │
│                                                     │
│ Node Features:                                      │
│ • Risk                                              │
│ • Disruption                                        │
│ • Capacity                                          │
│ • Delay                                             │
│                                                     │
│ Graph → PyTorch Geometric                           │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│             GRAPHSAGE GNN MODEL                     │
│                                                     │
│ Input Features                                      │
│       ↓                                             │
│ SAGEConv Layer                                      │
│       ↓                                             │
│ ReLU                                                │
│       ↓                                             │
│ SAGEConv Layer                                      │
│       ↓                                             │
│ ReLU                                                │
│       ↓                                             │
│ Linear Prediction Layer                             │
│       ↓                                             │
│ Predicted Delay                                     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│             RIPPLE EFFECT ANALYSIS                  │
│                                                     │
│ Disrupted Entity                                    │
│        ↓                                            │
│ Connected Entities                                  │
│        ↓                                            │
│ Downstream Dependencies                             │
│        ↓                                            │
│ Propagation / Impact Analysis                       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    FASTAPI                          │
│                                                     │
│ Graph API                                           │
│ News API                                            │
│ Risk API                                            │
│ Statistics API                                      │
│ GNN Prediction API                                  │
│ Ripple Effect API                                   │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                  REACT UI                           │
│                                                     │
│ Dashboard                                           │
│ Supply Chain Graph                                  │
│ News Intelligence                                   │
│ Risk Analysis                                       │
│ Ripple Effect Analysis                              │
│ Analytics                                           │
└─────────────────────────────────────────────────────┘
```
🧰 Technology Stack
```
| Category                     | Technology |

| Programming Language         | Python |
| Frontend                     | React |
| Backend                      | FastAPI |
| NLP                          | spaCy |
| Graph Database               | Neo4j |
| Deep Learning                | PyTorch |
| Graph ML                     | PyTorch Geometric |
| GNN Architecture             | GraphSAGE |
| Graph Visualisation          | React-based graph visualisation |
| API Documentation            | FastAPI / Swagger |
| Version Control              | Git |
| Repository Hosting           | GitHub |
```

📁 Project Structure
```text
AtmoGraph Building/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   │
│   │   ├── models/
│   │   │   └── gnn_model.py
│   │   │
│   │   ├── routes/
│   │   │   ├── graph.py
│   │   │   ├── news.py
│   │   │   ├── stats.py
│   │   │   ├── risk.py
│   │   │   ├── prediction.py
│   │   │   └── ripple.py
│   │   │
│   │   ├── services/
│   │   │   ├── graph_data.py
│   │   │   ├── gnn_predictor.py
│   │   │   ├── news_graph_service.py
│   │   │   └── ripple_effect.py
│   │   │
│   │   └── main.py
│   │
│   └── gnn_model.pth
│
├── data/
│   └── ...
│
├── ui/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── data/
│   │   └── utils/
│   │
│   └── package.json
│
├── constraints.cypher
├── data.cypher
├── indexes.cypher
├── queries.cypher
├── schema.cypher
├── README.md
└── .env
```
🗺️ Development Roadmap
```text
Week 1 — Graph Foundation
Completed: Neo4j setup, Graph schema, Constraints and indexes, Supply-chain graph, Cypher data ingestion, React dashboard, Interactive graph, Node inspection, Graph filtering.

Week 2 — NLP and Intelligence
Completed: News ingestion, spaCy NER, Entity matching, Neo4j entity mapping, Disruption extraction, Risk updates, News intelligence UI, FastAPI integration.

Week 3 — Graph Neural Network
Implemented: GraphSAGE architecture, Neo4j → PyTorch Geometric graph conversion, GNN training pipeline, Model checkpoint generation, GNN prediction service/API, Delay prediction, MAE / RMSE / R² evaluation, Ripple-effect service/API/frontend.
Remaining refinement: Production-quality train/test evaluation, Larger graph dataset, Improved risk prediction, Prediction visualisation, Advanced ripple propagation modelling.

Week 4 — Real-Time Intelligence
Planned: Live news ingestion, Automatic disruption detection, Automatic Neo4j graph updates, Automatic GNN prediction triggering, Real-time risk recalculation, WebSocket/live dashboard updates, Alerts and notifications, 30/60/90-day prediction views, End-to-end deployment, Performance optimisation.
```

🔮 Future Improvements

Future versions of AtmoGraph can include:
Larger Graphs: Support thousands or millions of supply-chain relationships.
Real-Time News: Automatically ingest continuously updated disruption information.
Advanced GNN Models: Experiment with GAT, GCN, Temporal GNN, Graph Transformers.
Better Prediction: Use historical disruption and delay datasets for stronger generalisation.
Temporal Modelling: Model how disruptions evolve over time.
Multi-Horizon Forecasting: Predict for 30 Days, 60 Days, 90 Days.
Explainable AI: Show why a particular entity received a high predicted delay or risk.
Automated Alerts: Notify users when critical supply-chain nodes are affected.

🌍 Potential Applications

AtmoGraph can be adapted for: Electronics supply chains, Automotive supply chains, Pharmaceutical logistics, Semiconductor supply chains, Manufacturing networks, Global shipping, Port monitoring, Warehouse management, Critical infrastructure, and Procurement intelligence.

🎓 Academic / Research Contribution
```text
The primary contribution of AtmoGraph is the integration of:
Unstructured News + Natural Language Processing + Knowledge Graph + Graph Neural Network + Ripple Effect Analysis + Interactive Visualisation
```
📜 License
```text
                    ┌─────────────────┐
                    │  NEWS / EVENTS  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   spaCy NLP     │
                    │   NER + Match   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │      Neo4j      │
                    │ Supply Chain KG │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             ┌─────────────┐   ┌───────────────┐
             │ Graph Data  │   │ Ripple Effect │
             │   Loader    │   │    Engine     │
             └──────┬──────┘   └───────┬───────┘
                    │                  │
                    ▼                  │
             ┌─────────────┐           │
             │  GraphSAGE  │           │
             │     GNN     │           │
             └──────┬──────┘           │
                    │                  │
                    ▼                  ▼
             ┌─────────────────────────────┐
             │          FastAPI            │
             │ Prediction + Risk + Ripple  │
             └──────────────┬──────────────┘
                            │
                            ▼
             ┌─────────────────────────────┐
             │        React Dashboard      │
             │                             │
             │ Graph | News | Risk |       │
             │ Ripple Effect | Analytics   │
             └─────────────────────────────┘
```
📌 Conclusion

AtmoGraph provides an integrated architecture for supply-chain disruption intelligence. The platform combines natural language understanding, graph databases, graph neural networks, predictive analytics, and interactive visualisation.
