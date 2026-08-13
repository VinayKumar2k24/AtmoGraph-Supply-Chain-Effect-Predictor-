// AtmoGraph - Indexes

// Index for faster Supplier risk analysis
CREATE INDEX supplier_risk_index IF NOT EXISTS
FOR (s:Supplier)
ON (s.risk);

// Index for faster Manufacturer name searches
CREATE INDEX manufacturer_name_index IF NOT EXISTS
FOR (m:Manufacturer)
ON (m.name);

// Index for faster Product name searches
CREATE INDEX product_name_index IF NOT EXISTS
FOR (p:Product)
ON (p.name);

// Index for faster Port name searches
CREATE INDEX port_name_index IF NOT EXISTS
FOR (p:Port)
ON (p.name);