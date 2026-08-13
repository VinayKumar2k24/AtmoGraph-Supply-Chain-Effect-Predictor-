// =====================================================
// AtmoGraph - Graph Database Schema
// =====================================================

// -----------------------------------------------------
// NODE TYPES
// -----------------------------------------------------
//
// Country
// Manufacturer
// Port
// Product
// Supplier
// Warehouse
//
// -----------------------------------------------------
// IMPORTANT PROPERTIES
// -----------------------------------------------------
//
// Supplier:
//   id
//   name
//   risk
//   status
//
// Manufacturer:
//   id
//   name
//
// Product:
//   id
//   name
//
// Port:
//   id
//   name
//
// Country:
//   id
//   name
//
// Warehouse:
//   id
//   name
//
// -----------------------------------------------------
// RELATIONSHIP TYPES
// -----------------------------------------------------
//
// CONNECTED_TO
// LOCATED_IN
// PRODUCES
// SHIPS_THROUGH
// SUPPLIES
//
// -----------------------------------------------------
// GRAPH MODEL
// -----------------------------------------------------
//
// Supplier ──SUPPLIES──> Manufacturer
// Manufacturer ──PRODUCES──> Product
// Product ──SHIPS_THROUGH──> Port
// Port ──LOCATED_IN──> Country
// Warehouse ──CONNECTED_TO──> Port
//
// -----------------------------------------------------
// BUSINESS PURPOSE
// -----------------------------------------------------
//
// AtmoGraph represents supply-chain entities and their
// relationships as a graph. This allows connected data
// analysis and supplier-risk identification using Cypher.
//
// =====================================================