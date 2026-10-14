-- =============================================================================
-- Staff interface - TEST CLEANUP  (undoes staff_test_setup.sql)
-- =============================================================================
-- Run with the same tool as the setup file. Two levels:
--
--   A) This file: removes the test access rows and the two tables the Staff
--      pages create (stock_adjustments, expiry_checks). It does NOT touch
--      stock, requests, purchase orders or arrivals changed while testing.
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

-- remove exactly the rows staff_test_setup.sql adds (original access rows stay)
DELETE FROM `user_branch_access`
WHERE (user_id = 'USR002' AND branch_id IN ('B001', 'B002'))
   OR (user_id = 'USR003' AND branch_id = 'B002');

-- tables created by the Staff pages (adjustment audit trail, expiry check results)
DROP TABLE IF EXISTS `stock_adjustments`;
DROP TABLE IF EXISTS `expiry_checks`;

-- check: the access list is back to the seed state (one branch per Staff account)
SELECT u.user_id, u.username,
       GROUP_CONCAT(a.branch_id ORDER BY a.branch_id) AS branches
FROM `users` u
JOIN `user_branch_access` a ON a.user_id = u.user_id
WHERE u.user_id IN ('USR002', 'USR003')
GROUP BY u.user_id, u.username;
