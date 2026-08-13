# 🌐 AtmoGraph — Supply Chain Ripple Effect Predictor

An AI-powered Supply Chain Intelligence Platform that combines Knowledge Graphs, NLP, and Graph-based Machine Learning to understand how disruptions propagate across global supply chains.

---

## 📖 Overview

AtmoGraph is an intelligent supply chain analysis platform designed to understand and visualize how disruptions in one part of a supply chain can affect connected companies, suppliers, manufacturers, ports, products, and countries.

Traditional supply chain analysis often focuses on individual companies or isolated time-series data. However, modern supply chains are highly interconnected. A disruption at a single supplier, port, or manufacturing location can propagate through multiple levels of the network and eventually affect businesses in completely different regions.

AtmoGraph addresses this problem by representing the supply chain as an interconnected knowledge graph and combining it with Natural Language Processing (NLP) to automatically extract entities and disruptions from news information.

---

## 🎯 Problem Statement

Global supply chains are complex networks consisting of thousands of interconnected:

- Suppliers
- Manufacturers
- Ports
- Countries
- Products
- Shipping routes
- Customers

A disruption in one location can create a chain reaction across multiple levels.

For example:

```text
Port Strike
     │
     ▼
Port Disruption
     │
     ▼
Supplier Delay
     │
     ▼
Manufacturer Delay
     │
     ▼
Product Shortage

     │
     ▼
Market Impactd


