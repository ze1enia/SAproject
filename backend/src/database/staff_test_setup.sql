-- =============================================================================
-- Staff interface - TEST SETUP  (test data only, NOT part of the seed data)
-- =============================================================================
-- Why: every Staff account in user_branch_access has ONE branch (B003..B016), but
-- all stock / request / purchase-order data is for B001 and B002 - so Staff pages
-- would be empty. This file gives two Staff accounts access to those branches.
-- It is safe to run more than once (no duplicate rows).
--
-- Run (MySQL Workbench / VS Code SQL tool: open the file and execute it), or
--   mysql -u root < backend/src/database/staff_test_setup.sql
-- Undo with staff_test_cleanup.sql
--
-- Accounts (passwords are in the SA table: SELECT username, password_ori FROM SA)
-- The rows below are ADDED to each account's own branch, so the Staff pages show a
-- branch dropdown for both:
--   USR002  Kittipong  Staff  -> B001 BKK + B002 Samut Prakan + own B016
--   USR003  Pimchanok  Staff  -> B002 Samut Prakan + own B003
-- A Staff account with a single branch (e.g. USR004 Thanakorn -> B004) shows a fixed
-- branch chip instead of a dropdown, and empty states because B004 has no data.
--
-- Walk-through (log in as the Staff account, then use the sidebar):
--
--  Kittipong, branch B001 (BKK)
--   Stock Request Review  REQ0001, REQ0005, REQ0009 are Pending -> approve one,
--                         cancel one (reason is required), see the feedback in the
--                         Owner's Stock Request > History
--   Purchase Orders       "+ New purchase order" (pick an approved request to prefill),
--                         then send it; PO0007 is already Sent
--   Stock Arrival         "Receive goods" on PO0007 (try received 12, rejected 2,
--                         then the rest) -> stock goes up, PO becomes Received
--   Quality Check         the new arrival shows under "To inspect": try No Good with
--                         no remarks (blocked), then with remarks -> it appears in the
--                         Owner's Supplier / Claim > QC issues
--   Manage Stock          Eggs are low stock; Adjust: set count / add / damaged
--   Expiry Check          "Within 30 days" lists 9 batches; tick some and save
--
--  Pimchanok, branch B002 (Samut Prakan)
--   FIFO Procedures       REQ0002, 0004, 0006, 0008, 0010, 0012 are Approved ->
--                         open one, read the plan, confirm, print the pick list
--   Purchase Orders       PO0004 is Draft -> "ส่งใบสั่งซื้อให้ Supplier";
--                         PO0002 is Sent -> cancel it, or receive it in Stock Arrival
--
--  Any Staff account (no branch data needed)
--   Product Info / Product Status / Category
-- =============================================================================

USE `saproject_db`;

-- 1) grant access (skips rows that already exist)
INSERT INTO `user_branch_access` (`user_id`, `branch_id`)
SELECT t.user_id, t.branch_id
FROM (
    SELECT 'USR002' AS user_id, 'B001' AS branch_id
    UNION ALL SELECT 'USR002', 'B002'
    UNION ALL SELECT 'USR003', 'B002'
) AS t
WHERE NOT EXISTS (
    SELECT 1 FROM `user_branch_access` a
    WHERE a.user_id = t.user_id AND a.branch_id = t.branch_id
);

-- 2) check: who can work in which branch now
SELECT u.user_id, u.username, u.role_id,
       GROUP_CONCAT(a.branch_id ORDER BY a.branch_id) AS branches
FROM `users` u
JOIN `user_branch_access` a ON a.user_id = u.user_id
WHERE u.user_id IN ('USR002', 'USR003')
GROUP BY u.user_id, u.username, u.role_id;

-- 3) check: what each Staff page has to work with in the two branches
--    (BR001 = B001 BKK, BR002 = B002 Samut Prakan: stock tables use BR###)
SELECT 'Stock Request Review' AS page, 'Pending requests' AS what,
       SUM(branch_id = 'BR001') AS BR001, SUM(branch_id = 'BR002') AS BR002
FROM `stock_requests` WHERE status = 'Pending'
UNION ALL
SELECT 'FIFO Procedures', 'Approved requests not picked yet',
       SUM(branch_id = 'BR001'), SUM(branch_id = 'BR002')
FROM `stock_requests` r
WHERE status = 'Approved'
  AND NOT EXISTS (SELECT 1 FROM `stock_movements` m WHERE m.movement_type = 'OUT' AND m.reference_id = r.request_id)
UNION ALL
SELECT 'Purchase Orders', 'Draft orders (can be sent)',
       SUM(branch_id = 'BR001'), SUM(branch_id = 'BR002')
FROM `purchase_orders` WHERE status = 'Draft'
UNION ALL
SELECT 'Stock Arrival', 'Orders waiting for goods (Sent / PartiallyReceived)',
       SUM(branch_id = 'BR001'), SUM(branch_id = 'BR002')
FROM `purchase_orders` WHERE status IN ('Sent', 'PartiallyReceived')
UNION ALL
SELECT 'Quality Check', 'Arrivals not inspected yet',
       SUM(po.branch_id = 'BR001'), SUM(po.branch_id = 'BR002')
FROM `stock_arrivals` sa
JOIN `purchase_orders` po ON po.purchase_order_id = sa.purchase_order_id
WHERE NOT EXISTS (SELECT 1 FROM `quality_inspections` q WHERE q.arrival_id = sa.arrival_id)
UNION ALL
SELECT 'Expiry Check', 'Batches expiring within 30 days',
       SUM(branch_id = 'BR001'), SUM(branch_id = 'BR002')
FROM `stock_batches`
WHERE expiry_date <> '' AND CAST(quantity_remaining AS SIGNED) > 0
  AND STR_TO_DATE(expiry_date, '%e/%c/%Y') <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
UNION ALL
SELECT 'Manage Stock', 'Products at or below 15 units',
       SUM(branch_id = 'BR001'), SUM(branch_id = 'BR002')
FROM `branch_stocks` WHERE CAST(quantity_on_hand AS SIGNED) <= 15;
