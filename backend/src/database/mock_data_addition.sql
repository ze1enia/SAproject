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

-- Staff for branch B016 (Prae), which had none. Login: Kanokwan
INSERT INTO `users` (`user_id`, `username`, `password_hash`, `role_id`, `branch_id`)
SELECT 'USR017', 'Kanokwan', '$2a$10$kDTYK.RJl6iJmC0XRn1tWO22DXRTnU5/J0S0H0ps7CyseEvdAM/9W', 'Staff', 'B016' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `user_id` = 'USR017');

INSERT INTO `user_branch_access` (`user_id`, `branch_id`)
SELECT 'USR017', 'B016' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `user_branch_access` WHERE `user_id` = 'USR017' AND `branch_id` = 'B016');

-- Mock data for the 3 tables the services normally create on first use
CREATE TABLE IF NOT EXISTS `supplier_claims` (`claim_id` TEXT, `arrival_id` TEXT, `purchase_order_id` TEXT, `supplier_id` TEXT, `issue_type` TEXT, `details` TEXT, `claim_status` TEXT, `created_by` TEXT, `created_at` TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `supplier_claims` (`claim_id`, `arrival_id`, `purchase_order_id`, `supplier_id`, `issue_type`, `details`, `claim_status`, `created_by`, `created_at`)
SELECT 'CLM0001', 'ARR0003', 'PO0003', 'SUP003', 'อื่นๆ', 'Tomato Ketchup 300g 1 bottle rejected at QC; asked supplier to credit the unit', 'Open', 'USR001', '3/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `supplier_claims` WHERE `claim_id` = 'CLM0001');

INSERT INTO `supplier_claims` (`claim_id`, `arrival_id`, `purchase_order_id`, `supplier_id`, `issue_type`, `details`, `claim_status`, `created_by`, `created_at`)
SELECT 'CLM0002', 'ARR0005', 'PO0005', 'SUP005', 'สินค้าไม่ครบ', 'Tofu 200g and Shampoo 180ml 1 unit each rejected; asked for replacement', 'Open', 'USR001', '5/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `supplier_claims` WHERE `claim_id` = 'CLM0002');

INSERT INTO `supplier_claims` (`claim_id`, `arrival_id`, `purchase_order_id`, `supplier_id`, `issue_type`, `details`, `claim_status`, `created_by`, `created_at`)
SELECT 'CLM0003', 'ARR0009', 'PO0009', 'SUP004', 'สินค้าชำรุด', 'Toilet Cleaner 500ml leaking in every carton; whole lot of 24 rejected', 'Open', 'USR001', '13/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `supplier_claims` WHERE `claim_id` = 'CLM0003');

INSERT INTO `supplier_claims` (`claim_id`, `arrival_id`, `purchase_order_id`, `supplier_id`, `issue_type`, `details`, `claim_status`, `created_by`, `created_at`)
SELECT 'CLM0004', 'ARR0010', 'PO0010', 'SUP003', 'สินค้าใกล้หมดอายุ/หมดอายุ', 'Toilet Paper packs printed with expired date; whole lot of 12 rejected', 'Open', 'USR001', '15/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `supplier_claims` WHERE `claim_id` = 'CLM0004');

INSERT INTO `supplier_claims` (`claim_id`, `arrival_id`, `purchase_order_id`, `supplier_id`, `issue_type`, `details`, `claim_status`, `created_by`, `created_at`)
SELECT 'CLM0005', 'ARR0008', 'PO0008', 'SUP003', 'สินค้าชำรุด', 'Toilet Paper 6 rolls 1 pack arrived torn and was rejected at QC; asked supplier to credit the unit', 'Open', 'USR001', '8/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `supplier_claims` WHERE `claim_id` = 'CLM0005');

CREATE TABLE IF NOT EXISTS `expiry_checks` (`check_id` TEXT, `batch_id` TEXT, `branch_id` TEXT, `product_id` TEXT, `status` TEXT, `note` TEXT, `checked_by` TEXT, `checked_at` TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0001', 'BAT0051', 'B001', 'PRD026', 'Normal', 'Routine weekly check', 'USR002', '5/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0001');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0002', 'BAT0049', 'B001', 'PRD025', 'Near Expiry', 'Expires 14/10, moved to front shelf', 'USR002', '8/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0002');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0003', 'BAT0050', 'B002', 'PRD025', 'Near Expiry', 'Expires 14/10, moved to front shelf', 'USR016', '8/10/2026 10:30' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0003');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0004', 'BAT0033', 'B001', 'PRD017', 'Near Expiry', 'Expires 16/10, discount sale started', 'USR002', '12/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0004');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0005', 'BAT0034', 'B002', 'PRD017', 'Near Expiry', 'Expires 16/10, discount sale started', 'USR016', '12/10/2026 10:30' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0005');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0006', 'BAT0049', 'B001', 'PRD025', 'Expired', 'Past expiry date, pulled from shelf', 'USR002', '15/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0006');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0007', 'BAT0050', 'B002', 'PRD025', 'Expired', 'Past expiry date, pulled from shelf', 'USR016', '15/10/2026 10:30' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0007');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0008', 'BAT0033', 'B001', 'PRD017', 'Expired', 'Past expiry date, pulled from shelf', 'USR002', '17/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0008');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0009', 'BAT0034', 'B002', 'PRD017', 'Expired', 'Past expiry date, pulled from shelf', 'USR016', '17/10/2026 10:30' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0009');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0010', 'BAT0053', 'B001', 'PRD027', 'Near Expiry', 'Eggs expire 23/10, sell first', 'USR002', '18/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0010');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0011', 'BAT0054', 'B002', 'PRD027', 'Near Expiry', 'Eggs expire 23/10, sell first', 'USR016', '18/10/2026 10:30' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0011');

INSERT INTO `expiry_checks` (`check_id`, `batch_id`, `branch_id`, `product_id`, `status`, `note`, `checked_by`, `checked_at`)
SELECT 'CHK0012', 'BAT0053', 'B001', 'PRD027', 'Expired', 'Past expiry date, pulled from shelf', 'USR002', '24/10/2026 10:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expiry_checks` WHERE `check_id` = 'CHK0012');

CREATE TABLE IF NOT EXISTS `stock_adjustments` (`adjustment_id` TEXT, `branch_id` TEXT, `product_id` TEXT, `adjust_type` TEXT, `quantity_before` TEXT, `quantity_after` TEXT, `reason` TEXT, `created_by` TEXT, `created_at` TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock adjustments + their effect on batches, branch_stocks and stock_movements (applied once: guarded by MOV00241)
SET @adj_applied = (SELECT COUNT(*) FROM `stock_movements` WHERE `movement_id` = 'MOV00241');

DELETE FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0001' AND @adj_applied = 0;
INSERT INTO `stock_adjustments` (`adjustment_id`, `branch_id`, `product_id`, `adjust_type`, `quantity_before`, `quantity_after`, `reason`, `created_by`, `created_at`)
SELECT 'ADJ0001', 'B001', 'PRD028', 'Set count', '15', '13', 'Stock count correction after weekly count', 'USR002', '9/10/2026 14:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0001');
UPDATE `stock_batches` SET `quantity_remaining` = '13' WHERE `batch_id` = 'BAT0055' AND @adj_applied = 0;
UPDATE `branch_stocks` SET `quantity_on_hand` = '13', `updated_at` = '9/10/2026 14:30' WHERE `branch_id` = 'B001' AND `product_id` = 'PRD028' AND @adj_applied = 0;
INSERT INTO `stock_movements` (`movement_id`, `branch_id`, `product_id`, `batch_id`, `movement_type`, `quantity_change`, `reference_id`, `created_by`, `created_at`)
SELECT 'MOV00241', 'B001', 'PRD028', 'BAT0055', 'ADJUST', '-2', 'ADJ0001', 'USR002', '9/10/2026 14:00' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_movements` WHERE `movement_id` = 'MOV00241');

DELETE FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0002' AND @adj_applied = 0;
INSERT INTO `stock_adjustments` (`adjustment_id`, `branch_id`, `product_id`, `adjust_type`, `quantity_before`, `quantity_after`, `reason`, `created_by`, `created_at`)
SELECT 'ADJ0002', 'B001', 'PRD022', 'Damaged', '44', '42', '2 ice cream bars melted after freezer outage', 'USR002', '9/10/2026 14:05' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0002');
UPDATE `stock_batches` SET `quantity_remaining` = '42' WHERE `batch_id` = 'BAT0043' AND @adj_applied = 0;
UPDATE `branch_stocks` SET `quantity_on_hand` = '42', `updated_at` = '9/10/2026 14:30' WHERE `branch_id` = 'B001' AND `product_id` = 'PRD022' AND @adj_applied = 0;
INSERT INTO `stock_movements` (`movement_id`, `branch_id`, `product_id`, `batch_id`, `movement_type`, `quantity_change`, `reference_id`, `created_by`, `created_at`)
SELECT 'MOV00242', 'B001', 'PRD022', 'BAT0043', 'DAMAGE', '-2', 'ADJ0002', 'USR002', '9/10/2026 14:05' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_movements` WHERE `movement_id` = 'MOV00242');

DELETE FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0003' AND @adj_applied = 0;
INSERT INTO `stock_adjustments` (`adjustment_id`, `branch_id`, `product_id`, `adjust_type`, `quantity_before`, `quantity_after`, `reason`, `created_by`, `created_at`)
SELECT 'ADJ0003', 'B002', 'PRD003', 'Damaged', '37', '35', '2 bottles dented in storage', 'USR016', '9/10/2026 14:10' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0003');
UPDATE `stock_batches` SET `quantity_remaining` = '35' WHERE `batch_id` = 'BAT0006' AND @adj_applied = 0;
UPDATE `branch_stocks` SET `quantity_on_hand` = '35', `updated_at` = '9/10/2026 14:30' WHERE `branch_id` = 'B002' AND `product_id` = 'PRD003' AND @adj_applied = 0;
INSERT INTO `stock_movements` (`movement_id`, `branch_id`, `product_id`, `batch_id`, `movement_type`, `quantity_change`, `reference_id`, `created_by`, `created_at`)
SELECT 'MOV00243', 'B002', 'PRD003', 'BAT0006', 'DAMAGE', '-2', 'ADJ0003', 'USR016', '9/10/2026 14:10' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_movements` WHERE `movement_id` = 'MOV00243');

DELETE FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0004' AND @adj_applied = 0;
INSERT INTO `stock_adjustments` (`adjustment_id`, `branch_id`, `product_id`, `adjust_type`, `quantity_before`, `quantity_after`, `reason`, `created_by`, `created_at`)
SELECT 'ADJ0004', 'B001', 'PRD039', 'Add', '16', '20', 'Found 4 boxes misplaced in the back room', 'USR002', '9/10/2026 14:15' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0004');
UPDATE `stock_batches` SET `quantity_remaining` = '20', `quantity_received` = '22' WHERE `batch_id` = 'BAT0077' AND @adj_applied = 0;
UPDATE `branch_stocks` SET `quantity_on_hand` = '20', `updated_at` = '9/10/2026 14:30' WHERE `branch_id` = 'B001' AND `product_id` = 'PRD039' AND @adj_applied = 0;
INSERT INTO `stock_movements` (`movement_id`, `branch_id`, `product_id`, `batch_id`, `movement_type`, `quantity_change`, `reference_id`, `created_by`, `created_at`)
SELECT 'MOV00244', 'B001', 'PRD039', 'BAT0077', 'ADJUST', '4', 'ADJ0004', 'USR002', '9/10/2026 14:15' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_movements` WHERE `movement_id` = 'MOV00244');

DELETE FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0005' AND @adj_applied = 0;
INSERT INTO `stock_adjustments` (`adjustment_id`, `branch_id`, `product_id`, `adjust_type`, `quantity_before`, `quantity_after`, `reason`, `created_by`, `created_at`)
SELECT 'ADJ0005', 'B002', 'PRD020', 'Remove', '31', '29', '2 packs used as in-store samples', 'USR016', '9/10/2026 14:20' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_adjustments` WHERE `adjustment_id` = 'ADJ0005');
UPDATE `stock_batches` SET `quantity_remaining` = '29' WHERE `batch_id` = 'BAT0040' AND @adj_applied = 0;
UPDATE `branch_stocks` SET `quantity_on_hand` = '29', `updated_at` = '9/10/2026 14:30' WHERE `branch_id` = 'B002' AND `product_id` = 'PRD020' AND @adj_applied = 0;
INSERT INTO `stock_movements` (`movement_id`, `branch_id`, `product_id`, `batch_id`, `movement_type`, `quantity_change`, `reference_id`, `created_by`, `created_at`)
SELECT 'MOV00245', 'B002', 'PRD020', 'BAT0040', 'ADJUST', '-2', 'ADJ0005', 'USR016', '9/10/2026 14:20' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `stock_movements` WHERE `movement_id` = 'MOV00245');

-- Check: should print 1 for every row
SELECT 'purchase_orders' t, COUNT(*) n FROM purchase_orders WHERE purchase_order_id='PO0010'
UNION ALL SELECT 'purchase_order_items', COUNT(*) FROM purchase_order_items WHERE purchase_order_item_id='POI0018'
UNION ALL SELECT 'po_items_PO0006_PO0007 (expect 12)', COUNT(*) FROM purchase_order_items WHERE purchase_order_id IN ('PO0006','PO0007')
UNION ALL SELECT 'budget_transactions BTX0009-12 (expect 4)', COUNT(*) FROM budget_transactions WHERE transaction_id IN ('BTX0009','BTX0010','BTX0011','BTX0012')
UNION ALL SELECT 'USR017 (users / access = expect 2)', (SELECT COUNT(*) FROM users WHERE user_id='USR017') + (SELECT COUNT(*) FROM user_branch_access WHERE user_id='USR017')
UNION ALL SELECT 'supplier_claims (expect 5)', (SELECT COUNT(*) FROM supplier_claims)
UNION ALL SELECT 'expiry_checks (expect 12)', (SELECT COUNT(*) FROM expiry_checks)
UNION ALL SELECT 'stock_adjustments (expect 5)', (SELECT COUNT(*) FROM stock_adjustments)
UNION ALL SELECT 'adjustment movements (expect 5)', (SELECT COUNT(*) FROM stock_movements WHERE reference_id LIKE 'ADJ%')
UNION ALL SELECT 'stock_arrivals', COUNT(*) FROM stock_arrivals WHERE arrival_id='ARR0010'
UNION ALL SELECT 'stock_arrival_items', COUNT(*) FROM stock_arrival_items WHERE arrival_item_id='ARI0010'
UNION ALL SELECT 'quality_inspections', COUNT(*) FROM quality_inspections WHERE inspection_id='QIN0006'
UNION ALL SELECT 'budgets', COUNT(*) FROM budgets WHERE budget_id='BUD0006'
;
