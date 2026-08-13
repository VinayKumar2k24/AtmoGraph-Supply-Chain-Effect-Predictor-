// AtmoGraph - Database Constraints
// Ensures unique IDs for important entities.

// Manufacturer ID must be unique
CREATE CONSTRAINT manufacturer_id_unique IF NOT EXISTS
FOR (m:Manufacturer)
REQUIRE m.id IS UNIQUE;

// Port ID must be unique
CREATE CONSTRAINT port_id_unique IF NOT EXISTS
FOR (p:Port)
REQUIRE p.id IS UNIQUE;

// Product ID must be unique
CREATE CONSTRAINT product_id_unique IF NOT EXISTS
FOR (p:Product)
REQUIRE p.id IS UNIQUE;

// Supplier ID must be unique
CREATE CONSTRAINT supplier_id_unique IF NOT EXISTS
FOR (s:Supplier)
REQUIRE s.id IS UNIQUE;