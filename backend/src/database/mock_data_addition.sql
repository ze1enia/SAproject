-- =============================================================================
-- Mock data addition (29/10/2026) - adds only the new rows (PO0009/PO0010 chains, BUD0005/BUD0006), keeps everything else
-- Safe to run more than once: each INSERT is skipped if the row already exists.
-- Run in MySQL:  SOURCE backend/src/database/mock_data_addition.sql;
-- (A full re-import of SAproject.sql also contains these rows.)
-- =============================================================================
USE `saproject_db`;

INSERT INTO `purchase_orders` (`purchase_order_id`, `branch_id`, `supplier_id`, `request_id`, `created_by`, `order_date`, `status`, `total_amount`)
SELECT 'PO0009', 'B002', 'SUP004', 'REQ0012', 'USR016', '8/10/2026 11:00', 'Received', '672' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_orders` WHERE `purchase_order_id` = 'PO0009');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0017', 'PO0009', 'PRD036', '24', '28' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0017');

INSERT INTO `stock_arrivals` (`arrival_id`, `purchase_order_id`, `received_by`, `arrival_date`, `delivery_status`, `notes`)
SELECT 'ARR0009', 'PO0009', 'USR016', '12/10/2026 14:00', 'Received', 'Mock delivery receipt; whole lot rejected at QC' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_arrivals` WHERE `arrival_id` = 'ARR0009');

INSERT INTO `stock_arrival_items` (`arrival_item_id`, `arrival_id`, `purchase_order_item_id`, `quantity_received`, `quantity_rejected`, `batch_id`)
SELECT 'ARI0009', 'ARR0009', 'POI0017', '24', '24', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_arrival_items` WHERE `arrival_item_id` = 'ARI0009');

INSERT INTO `quality_inspections` (`inspection_id`, `arrival_id`, `inspected_by`, `inspection_date`, `result`, `remarks`)
SELECT 'QIN0005', 'ARR0009', 'USR016', '12/10/2026 15:00', 'Fail', 'Leaking bottles in every carton; whole lot rejected; mock inspection' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `quality_inspections` WHERE `inspection_id` = 'QIN0005');

INSERT INTO `budgets` (`budget_id`, `branch_id`, `period_start`, `period_end`, `allocated_amount`, `budget_status`)
SELECT 'BUD0005', 'B001', '1/9/2026', '30/9/2026', '100000', 'Closed' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `budgets` WHERE `budget_id` = 'BUD0005');

INSERT INTO `purchase_orders` (`purchase_order_id`, `branch_id`, `supplier_id`, `request_id`, `created_by`, `order_date`, `status`, `total_amount`)
SELECT 'PO0010', 'B001', 'SUP003', '', 'USR002', '10/10/2026 11:00', 'Received', '497.16' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_orders` WHERE `purchase_order_id` = 'PO0010');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0018', 'PO0010', 'PRD040', '12', '41.43' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0018');

INSERT INTO `stock_arrivals` (`arrival_id`, `purchase_order_id`, `received_by`, `arrival_date`, `delivery_status`, `notes`)
SELECT 'ARR0010', 'PO0010', 'USR002', '14/10/2026 14:00', 'Received', 'Mock delivery receipt; whole lot rejected at QC' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_arrivals` WHERE `arrival_id` = 'ARR0010');

INSERT INTO `stock_arrival_items` (`arrival_item_id`, `arrival_id`, `purchase_order_item_id`, `quantity_received`, `quantity_rejected`, `batch_id`)
SELECT 'ARI0010', 'ARR0010', 'POI0018', '12', '12', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_arrival_items` WHERE `arrival_item_id` = 'ARI0010');

INSERT INTO `quality_inspections` (`inspection_id`, `arrival_id`, `inspected_by`, `inspection_date`, `result`, `remarks`)
SELECT 'QIN0006', 'ARR0010', 'USR002', '14/10/2026 15:00', 'Fail', 'Expired date printed on every pack; whole lot rejected; mock inspection' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `quality_inspections` WHERE `inspection_id` = 'QIN0006');

INSERT INTO `budgets` (`budget_id`, `branch_id`, `period_start`, `period_end`, `allocated_amount`, `budget_status`)
SELECT 'BUD0006', 'B002', '1/9/2026', '30/9/2026', '50000', 'Closed' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `budgets` WHERE `budget_id` = 'BUD0006');

-- Extra line items so PO0006 and PO0007 have 6 items each (totals updated to match)
INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0019', 'PO0007', 'PRD003', '48', '4' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0019');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0020', 'PO0007', 'PRD006', '48', '7' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0020');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0021', 'PO0007', 'PRD008', '24', '16' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0021');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0022', 'PO0007', 'PRD012', '24', '22' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0022');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0023', 'PO0006', 'PRD007', '24', '18' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0023');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0024', 'PO0006', 'PRD009', '24', '32' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0024');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0025', 'PO0006', 'PRD011', '36', '15' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0025');

INSERT INTO `purchase_order_items` (`purchase_order_item_id`, `purchase_order_id`, `product_id`, `ordered_quantity`, `unit_cost`)
SELECT 'POI0026', 'PO0006', 'PRD013', '12', '42' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `purchase_order_items` WHERE `purchase_order_item_id` = 'POI0026');

UPDATE `purchase_orders` SET `total_amount` = '4478.28' WHERE `purchase_order_id` = 'PO0006' AND `total_amount` = '2234.28';
UPDATE `purchase_orders` SET `total_amount` = '3185.04' WHERE `purchase_order_id` = 'PO0007' AND `total_amount` = '1745.04';

-- Budget transactions for the two closed September budgets
INSERT INTO `budget_transactions` (`transaction_id`, `budget_id`, `transaction_type`, `amount`, `description`, `transaction_date`, `recorded_by`)
SELECT 'BTX0009', 'BUD0005', 'Expense', '8450.25', 'Mock inventory purchase expense', '28/9/2026 16:00', 'USR002' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `budget_transactions` WHERE `transaction_id` = 'BTX0009');

INSERT INTO `budget_transactions` (`transaction_id`, `budget_id`, `transaction_type`, `amount`, `description`, `transaction_date`, `recorded_by`)
SELECT 'BTX0010', 'BUD0005', 'Income', '12360.5', 'Mock sales income allocation', '29/9/2026 16:00', 'USR001' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `budget_transactions` WHERE `transaction_id` = 'BTX0010');

INSERT INTO `budget_transactions` (`transaction_id`, `budget_id`, `transaction_type`, `amount`, `description`, `transaction_date`, `recorded_by`)
SELECT 'BTX0011', 'BUD0006', 'Expense', '5230.8', 'Mock inventory purchase expense', '28/9/2026 16:00', 'USR016' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `budget_transactions` WHERE `transaction_id` = 'BTX0011');

INSERT INTO `budget_transactions` (`transaction_id`, `budget_id`, `transaction_type`, `amount`, `description`, `transaction_date`, `recorded_by`)
SELECT 'BTX0012', 'BUD0006', 'Income', '9875.4', 'Mock sales income allocation', '29/9/2026 16:00', 'USR001' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `budget_transactions` WHERE `transaction_id` = 'BTX0012');

-- PO0010 supplier fix (toilet paper comes from Everyday Grocery, as in PO0008)
UPDATE `purchase_orders` SET `supplier_id` = 'SUP003' WHERE `purchase_order_id` = 'PO0010' AND `supplier_id` = 'SUP005';

-- Staff for branch B016 (Prae), which had none. Login: Kanokwan / Staff@016
INSERT INTO `SA` (`user_id`, `username`, `password_ori`, `role_id`, `branch_id`, `password_hash`)
SELECT 'USR017', 'Kanokwan', 'Staff@016', 'Staff', 'B016', '$2a$10$kDTYK.RJl6iJmC0XRn1tWO22DXRTnU5/J0S0H0ps7CyseEvdAM/9W' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `SA` WHERE `user_id` = 'USR017');

INSERT INTO `users` (`user_id`, `username`, `password_hash`, `role_id`, `branch_id`)
SELECT 'USR017', 'Kanokwan', '$2a$10$kDTYK.RJl6iJmC0XRn1tWO22DXRTnU5/J0S0H0ps7CyseEvdAM/9W', 'Staff', 'B016' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `user_id` = 'USR017');

INSERT INTO `user_branch_access` (`user_id`, `branch_id`)
SELECT 'USR017', 'B016' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `user_branch_access` WHERE `user_id` = 'USR017' AND `branch_id` = 'B016');

-- Check: should print 1 for every row
SELECT 'purchase_orders' t, COUNT(*) n FROM purchase_orders WHERE purchase_order_id='PO0010'
UNION ALL SELECT 'purchase_order_items', COUNT(*) FROM purchase_order_items WHERE purchase_order_item_id='POI0018'
UNION ALL SELECT 'po_items_PO0006_PO0007 (expect 12)', COUNT(*) FROM purchase_order_items WHERE purchase_order_id IN ('PO0006','PO0007')
UNION ALL SELECT 'budget_transactions BTX0009-12 (expect 4)', COUNT(*) FROM budget_transactions WHERE transaction_id IN ('BTX0009','BTX0010','BTX0011','BTX0012')
UNION ALL SELECT 'USR017 (users / SA / access = expect 3)', (SELECT COUNT(*) FROM users WHERE user_id='USR017') + (SELECT COUNT(*) FROM SA WHERE user_id='USR017') + (SELECT COUNT(*) FROM user_branch_access WHERE user_id='USR017')
UNION ALL SELECT 'stock_arrivals', COUNT(*) FROM stock_arrivals WHERE arrival_id='ARR0010'
UNION ALL SELECT 'stock_arrival_items', COUNT(*) FROM stock_arrival_items WHERE arrival_item_id='ARI0010'
UNION ALL SELECT 'quality_inspections', COUNT(*) FROM quality_inspections WHERE inspection_id='QIN0006'
UNION ALL SELECT 'budgets', COUNT(*) FROM budgets WHERE budget_id='BUD0006'
;
