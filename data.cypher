// =====================================================
// AtmoGraph - Complete Sample Supply Chain Data
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
// PORTS
// -----------------------------------------------------

MERGE (p1:Port {id: "P001"})
SET p1.name = "Los Angeles Port",
    p1.country = "USA";

MERGE (p2:Port {id: "P002"})
SET p2.name = "Chennai Port",
    p2.country = "India";

MERGE (p3:Port {id: "P003"})
SET p3.name = "Rotterdam Port",
    p3.country = "Netherlands";


// -----------------------------------------------------
// PRODUCTS
// -----------------------------------------------------

MERGE (pr1:Product {id: "PR001"})
SET pr1.name = "Microcontroller";

MERGE (pr2:Product {id: "PR002"})
SET pr2.name = "Power Management IC";

MERGE (pr3:Product {id: "PR003"})
SET pr3.name = "Electronic Sensor";


// -----------------------------------------------------
// WAREHOUSES
// -----------------------------------------------------

MERGE (w1:Warehouse {id: "W001"})
SET w1.name = "California Distribution Center",
    w1.location = "California, USA";

MERGE (w2:Warehouse {id: "W002"})
SET w2.name = "Bangalore Distribution Center",
    w2.location = "Bangalore, India";

MERGE (w3:Warehouse {id: "W003"})
SET w3.name = "Amsterdam Distribution Center",
    w3.location = "Amsterdam, Netherlands";


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


// -----------------------------------------------------
// MANUFACTURER -> PRODUCT
// -----------------------------------------------------

MATCH (m1:Manufacturer {id: "M001"})
MATCH (pr1:Product {id: "PR001"})
MERGE (m1)-[:PRODUCES]->(pr1);

MATCH (m1:Manufacturer {id: "M001"})
MATCH (pr2:Product {id: "PR002"})
MERGE (m1)-[:PRODUCES]->(pr2);

MATCH (m2:Manufacturer {id: "M002"})
MATCH (pr2:Product {id: "PR002"})
MERGE (m2)-[:PRODUCES]->(pr2);

MATCH (m2:Manufacturer {id: "M002"})
MATCH (pr3:Product {id: "PR003"})
MERGE (m2)-[:PRODUCES]->(pr3);

MATCH (m3:Manufacturer {id: "M003"})
MATCH (pr1:Product {id: "PR001"})
MERGE (m3)-[:PRODUCES]->(pr1);


// -----------------------------------------------------
// SUPPLIER -> PRODUCT
// -----------------------------------------------------

MATCH (s1:Supplier {id: "S001"})
MATCH (pr1:Product {id: "PR001"})
MERGE (s1)-[:PROVIDES]->(pr1);

MATCH (s2:Supplier {id: "S002"})
MATCH (pr2:Product {id: "PR002"})
MERGE (s2)-[:PROVIDES]->(pr2);

MATCH (s3:Supplier {id: "S003"})
MATCH (pr3:Product {id: "PR003"})
MERGE (s3)-[:PROVIDES]->(pr3);


// -----------------------------------------------------
// MANUFACTURER -> WAREHOUSE
// -----------------------------------------------------

MATCH (m1:Manufacturer {id: "M001"})
MATCH (w1:Warehouse {id: "W001"})
MERGE (m1)-[:SHIPS_TO]->(w1);

MATCH (m2:Manufacturer {id: "M002"})
MATCH (w2:Warehouse {id: "W002"})
MERGE (m2)-[:SHIPS_TO]->(w2);

MATCH (m3:Manufacturer {id: "M003"})
MATCH (w3:Warehouse {id: "W003"})
MERGE (m3)-[:SHIPS_TO]->(w3);


// -----------------------------------------------------
// PORT -> WAREHOUSE
// -----------------------------------------------------

MATCH (p1:Port {id: "P001"})
MATCH (w1:Warehouse {id: "W001"})
MERGE (p1)-[:SERVES]->(w1);

MATCH (p2:Port {id: "P002"})
MATCH (w2:Warehouse {id: "W002"})
MERGE (p2)-[:SERVES]->(w2);

MATCH (p3:Port {id: "P003"})
MATCH (w3:Warehouse {id: "W003"})
MERGE (p3)-[:SERVES]->(w3);


// -----------------------------------------------------
// PRODUCT -> WAREHOUSE
// -----------------------------------------------------

MATCH (pr1:Product {id: "PR001"})
MATCH (w1:Warehouse {id: "W001"})
MERGE (pr1)-[:STORED_AT]->(w1);

MATCH (pr2:Product {id: "PR002"})
MATCH (w2:Warehouse {id: "W002"})
MERGE (pr2)-[:STORED_AT]->(w2);

MATCH (pr3:Product {id: "PR003"})
MATCH (w3:Warehouse {id: "W003"})
MERGE (pr3)-[:STORED_AT]->(w3);