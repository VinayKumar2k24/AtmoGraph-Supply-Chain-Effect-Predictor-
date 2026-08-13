// =====================================================
// AtmoGraph - Cypher Queries
// =====================================================


// =====================================================
// 1. View all nodes
// =====================================================

MATCH (n)
RETURN n;


// =====================================================
// 2. View complete graph
// =====================================================

MATCH p=()-[]->()
RETURN p
LIMIT 100;


// =====================================================
// 3. View all relationships
// =====================================================

MATCH (a)-[r]->(b)
RETURN a, r, b
LIMIT 50;


// =====================================================
// 4. Find suppliers and their manufacturers
// =====================================================

MATCH (s:Supplier)-[:SUPPLIES]->(m:Manufacturer)
RETURN
    s.name AS supplier,
    s.risk AS supplier_risk,
    m.name AS manufacturer
ORDER BY s.risk DESC;


// =====================================================
// 5. Risk analysis
// =====================================================

MATCH (s:Supplier)-[:SUPPLIES]->(m:Manufacturer)
WHERE s.risk > 0
RETURN
    s.name AS supplier,
    s.risk AS supplier_risk,
    m.name AS manufacturer
ORDER BY s.risk DESC;


// =====================================================
// 6. Find high-risk suppliers
// =====================================================

MATCH (s:Supplier)
WHERE s.risk >= 0.20
RETURN
    s.id AS supplier_id,
    s.name AS supplier,
    s.risk AS risk_level,
    s.status AS status
ORDER BY s.risk DESC;


// =====================================================
// 7. Count nodes by label
// =====================================================

MATCH (n)
RETURN labels(n) AS node_type,
       count(n) AS total_nodes;


// =====================================================
// 8. Count relationships by type
// =====================================================

MATCH ()-[r]->()
RETURN type(r) AS relationship_type,
       count(r) AS total_relationships;


// =====================================================
// 9. Find manufacturers supplied by high-risk suppliers
// =====================================================

MATCH (s:Supplier)-[:SUPPLIES]->(m:Manufacturer)
WHERE s.risk >= 0.20
RETURN
    s.name AS high_risk_supplier,
    s.risk AS risk,
    m.name AS affected_manufacturer
ORDER BY s.risk DESC;


// =====================================================
// 10. Find connected entities
// =====================================================

MATCH p=(s:Supplier)-[*1..3]-(x)
WHERE s.risk >= 0.20
RETURN p
LIMIT 50;