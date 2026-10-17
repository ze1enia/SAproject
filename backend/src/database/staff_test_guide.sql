-- =============================================================================
-- Staff interface - TEST GUIDE  (read-only: only SELECT statements, changes nothing)
-- =============================================================================
-- The seed data now has a Staff member for each branch that has data, so no extra
-- setup is needed. Run this file to see who can work where and what each Staff
-- page has to work with. Accounts' passwords: SELECT username, password_ori FROM SA
--
--   USR002  Kittipong  Staff  -> B001 BKK            (fixed branch chip)
--   USR016  Manatsawi  Staff  -> B002 Samut Prakan   (fixed branch chip)
--   USR003..USR015     Staff  -> one branch each (B003..B015): pages show "no data"
--   USR001  Sunee      Owner  -> uses the Owner pages
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
--  Manatsawi, branch B002 (Samut Prakan)
--   FIFO Procedures       REQ0002, 0004, 0006, 0008, 0010, 0012 are Approved ->
--                         open one, read the plan, confirm, print the pick list
--   Purchase Orders       PO0004 is Draft -> "ส่งใบสั่งซื้อให้ Supplier";
--                         PO0002 is Sent -> cancel it, or receive it in Stock Arrival
--
--  Any Staff account (no branch data needed)
--   Product Info / Product Status / Category
-- =============================================================================

USE `saproject_db`;

-- who can work in which branch (Staff accounts only)
SELECT u.user_id, u.username, u.role_id, u.branch_id AS home_branch,
       GROUP_CONCAT(a.branch_id ORDER BY a.branch_id) AS can_access
FROM `users` u
JOIN `user_branch_access` a ON a.user_id = u.user_id
WHERE u.role_id = 'Staff' AND u.user_id IN ('USR002', 'USR016')
GROUP BY u.user_id, u.username, u.role_id, u.branch_id;

-- what each Staff page has to work with in the two branches that have data
SELECT 'Stock Request Review' AS page, 'Pending requests' AS what,
       SUM(branch_id = 'B001') AS B001, SUM(branch_id = 'B002') AS B002
FROM `stock_requests` WHERE status = 'Pending'
UNION ALL
SELECT 'FIFO Procedures', 'Approved requests not picked yet',
       SUM(branch_id = 'B001'), SUM(branch_id = 'B002')
FROM `stock_requests` r
WHERE status = 'Approved'
  AND NOT EXISTS (SELECT 1 FROM `stock_movements` m WHERE m.movement_type = 'OUT' AND m.reference_id = r.request_id)
UNION ALL
SELECT 'Purchase Orders', 'Draft orders (can be sent)',
       SUM(branch_id = 'B001'), SUM(branch_id = 'B002')
FROM `purchase_orders` WHERE status = 'Draft'
UNION ALL
SELECT 'Stock Arrival', 'Orders waiting for goods (Sent / PartiallyReceived)',
       SUM(branch_id = 'B001'), SUM(branch_id = 'B002')
FROM `purchase_orders` WHERE status IN ('Sent', 'PartiallyReceived')
UNION ALL
SELECT 'Quality Check', 'Arrivals not inspected yet',
       SUM(po.branch_id = 'B001'), SUM(po.branch_id = 'B002')
FROM `stock_arrivals` sa
JOIN `purchase_orders` po ON po.purchase_order_id = sa.purchase_order_id
WHERE NOT EXISTS (SELECT 1 FROM `quality_inspections` q WHERE q.arrival_id = sa.arrival_id)
UNION ALL
SELECT 'Expiry Check', 'Batches expiring within 30 days',
       SUM(branch_id = 'B001'), SUM(branch_id = 'B002')
FROM `stock_batches`
WHERE expiry_date <> '' AND CAST(quantity_remaining AS SIGNED) > 0
  AND STR_TO_DATE(expiry_date, '%e/%c/%Y') <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
UNION ALL
SELECT 'Manage Stock', 'Products at or below 15 units',
       SUM(branch_id = 'B001'), SUM(branch_id = 'B002')
FROM `branch_stocks` WHERE CAST(quantity_on_hand AS SIGNED) <= 15;
