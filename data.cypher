// =====================================================
// AtmoGraph - Sample Supply Chain Data
// =====================================================

// -----------------------------------------------------
// SUPPLIERS
// -----------------------------------------------------

MERGE (s1:Supplier {id: "S001"})
SET s1.name = "Global Electronics Components",
    s1.risk = 0.15,
    s1.status = "ACTIVE";

MERGE (s2:Supplier {id: "S002"})
SET s2.name = "Asia Semiconductor Supply",
    s2.risk = 0.25,
    s2.status = "ACTIVE";

MERGE (s3:Supplier {id: "S003"})
SET s3.name = "European Precision Parts",
    s3.risk = 0.10,
    s3.status = "ACTIVE";

// -----------------------------------------------------
// MANUFACTURERS
// -----------------------------------------------------

MERGE (m1:Manufacturer {id: "M001"})
SET m1.name = "North America Electronics";

MERGE (m2:Manufacturer {id: "M002"})
SET m2.name = "India Assembly Works";

MERGE (m3:Manufacturer {id: "M003"})
SET m3.name = "European Consumer Devices";

// -----------------------------------------------------
// SUPPLIES RELATIONSHIPS
// -----------------------------------------------------

MATCH (s1:Supplier {id: "S001"})
MATCH (m1:Manufacturer {id: "M001"})
MERGE (s1)-[:SUPPLIES]->(m1);

MATCH (s1:Supplier {id: "S001"})
MATCH (m2:Manufacturer {id: "M002"})
MERGE (s1)-[:SUPPLIES]->(m2);

MATCH (s2:Supplier {id: "S002"})
MATCH (m1:Manufacturer {id: "M001"})
MERGE (s2)-[:SUPPLIES]->(m1);

MATCH (s3:Supplier {id: "S003"})
MATCH (m3:Manufacturer {id: "M003"})
MERGE (s3)-[:SUPPLIES]->(m3);