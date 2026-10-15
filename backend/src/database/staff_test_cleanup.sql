-- =============================================================================
-- Staff interface - TEST CLEANUP
-- =============================================================================
-- After testing the Staff pages you can:
--
--   A) Run this file: drops the two tables the Staff pages create on first use
--      (stock_adjustments = Manage Stock audit trail, expiry_checks = Expiry Check
--      results). It does NOT touch stock, requests, purchase orders or arrivals that
--      were changed while testing, and it does not change any access rows.
--
--   B) Full reset of those test changes: re-import the seed file, which drops and
--      recreates the 21 seed tables from the CSV data (this also discards any
--      other manual change in them):
--          SOURCE backend/src/database/SAproject.sql;
--      supplier_claims (created by the Owner's Supplier / Claim page) is not part
--      of the seed - drop it too if you want it empty:
--          DROP TABLE IF EXISTS supplier_claims;
--      If logins stop working after a re-import, run: npm run seed:passwords
-- =============================================================================

USE `saproject_db`;

DROP TABLE IF EXISTS `stock_adjustments`;
DROP TABLE IF EXISTS `expiry_checks`;
