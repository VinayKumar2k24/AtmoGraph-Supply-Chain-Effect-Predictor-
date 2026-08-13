# AtmoGraph

## Graph-Based Supply Chain Risk Analysis System

AtmoGraph is a graph database project built using Neo4j to represent supply-chain entities and their relationships.

The main purpose of the project is to understand how suppliers, manufacturers, products, ports, countries and warehouses are connected and to identify suppliers that may create higher supply-chain risk.

---

## Why AtmoGraph?

Traditional databases store information mainly in rows and tables. Understanding complex connections between different supply-chain entities can become difficult when many relationships are involved.

AtmoGraph uses a graph database approach where:

- Entities are represented as nodes.
- Connections between entities are represented as relationships.
- Cypher queries are used to explore connected information.
- Supplier risk values can be analysed using graph relationships.

This makes it easier to understand how a supplier can affect manufacturers and the wider supply chain.

---

## Main Objectives

The project aims to:

1. Model supply-chain entities using a graph database.
2. Represent relationships between suppliers and manufacturers.
3. Store supplier risk information.
4. Identify high-risk suppliers.
5. Analyse which manufacturers are affected by risky suppliers.
6. Demonstrate graph-based querying using Cypher.
7. Improve data consistency using constraints.
8. Improve query performance using indexes.

---

## Technology Used

- Neo4j
- Cypher Query Language
- Python
- FastAPI
- Graph Database
- REST API

---

## Graph Model

### Nodes

The project contains the following major node types:

- Supplier
- Manufacturer
- Product
- Port
- Country
- Warehouse

### Relationships

The graph contains relationships such as:

- SUPPLIES
- PRODUCES
- SHIPS_THROUGH
- LOCATED_IN
- CONNECTED_TO

---

## Example Graph Flow

```text
Supplier
   |
   | SUPPLIES
   ↓
Manufacturer
   |
   | PRODUCES
   ↓
Product
   |
   | SHIPS_THROUGH
   ↓
Port
   |
   | LOCATED_IN
   ↓
Country