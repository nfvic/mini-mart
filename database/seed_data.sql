
-- MiniMart demo seed data
-- Run AFTER schema.sql in Supabase SQL Editor.
-- Safe to re-run: does not delete existing records.
-- All names and contact details below are fictional demo data.

BEGIN;

SET search_path TO public, extensions;

-- ---------------------------------------------------------
-- 1. Business settings
-- ---------------------------------------------------------

INSERT INTO business_settings (key, value) VALUES
  ('supermarket_name', 'MiniMart Supermarket'),
  ('logo_data_url', ''),
  ('currency', 'KES'),
  ('phone', '+254 712 345 678'),
  ('email', 'info@minimart.co.ke'),
  ('address', 'Moi Avenue, Nairobi, Kenya'),
  ('receipt_footer', 'Thank you for shopping at MiniMart! Karibu tena.'),
  ('tax_rate', '0')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 2. Suppliers
-- ---------------------------------------------------------

INSERT INTO suppliers (id, name, phone, email, address, notes) VALUES
  ('sup_01', 'Bidco Africa Supplies', '+254 720 111 222', 'orders@bidco.ke', 'Thika Road, Nairobi', 'Cooking oil, detergents, soaps'),
  ('sup_02', 'Brookside Dairy Distributors', '+254 722 333 444', 'sales@brookside.ke', 'Ruiru, Kiambu', 'Milk and dairy products'),
  ('sup_03', 'Unga Limited Wholesale', '+254 733 555 666', 'wholesale@unga.ke', 'Industrial Area, Nairobi', 'Flour, maize meal, cereals'),
  ('sup_04', 'Coca-Cola Beverages Kenya', '+254 711 777 888', 'trade@ccbk.ke', 'Nairobi West', 'Soft drinks and bottled water')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 3. Customers
-- ---------------------------------------------------------

INSERT INTO customers (id, name, phone, email, address, is_walk_in) VALUES
  ('cust_walkin', 'Walk-in Customer', 'N/A', '', 'Nairobi', TRUE),
  ('cust_01', 'Mary Achieng', '+254 701 222 333', 'mary.achieng@email.com', 'Westlands, Nairobi', FALSE),
  ('cust_02', 'James Mwangi', '+254 702 444 555', 'jmwangi@email.com', 'Eastlands, Nairobi', FALSE),
  ('cust_03', 'Lucy Wambui', '+254 703 666 777', 'lucy.w@email.com', 'Ngong Road, Nairobi', FALSE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 4. Products
-- Stock values represent the final stock AFTER the
-- historical purchases and sales below have been applied.
-- ---------------------------------------------------------

INSERT INTO products (
  id, code, name, category_id,
  buying_price, selling_price, stock, min_stock, unit
) VALUES
  ('prd_01', 'MM10001', 'Sugar 2kg', 'cat_food', 140, 180, 85, 20, 'packet'),
  ('prd_02', 'MM10002', 'Rice 2kg', 'cat_food', 170, 220, 70, 15, 'packet'),
  ('prd_03', 'MM10003', 'Cooking Oil 1L', 'cat_food', 280, 350, 45, 12, 'bottle'),
  ('prd_04', 'MM10004', 'Maize Flour 2kg', 'cat_food', 110, 150, 90, 25, 'packet'),
  ('prd_05', 'MM10005', 'Wheat Flour 2kg', 'cat_food', 120, 160, 60, 15, 'packet'),
  ('prd_06', 'MM10006', 'Fresh Milk 500ml', 'cat_bev', 50, 70, 40, 20, 'packet'),
  ('prd_07', 'MM10007', 'Bread Loaf', 'cat_food', 45, 65, 35, 15, 'loaf'),
  ('prd_08', 'MM10008', 'Eggs (each)', 'cat_food', 14, 20, 120, 30, 'piece'),
  ('prd_09', 'MM10009', 'Bottled Water 500ml', 'cat_bev', 30, 50, 100, 25, 'bottle'),
  ('prd_10', 'MM10010', 'Bathing Soap', 'cat_care', 70, 100, 55, 15, 'bar'),
  ('prd_11', 'MM10011', 'Detergent 1kg', 'cat_house', 140, 180, 19, 10, 'packet'),
  ('prd_12', 'MM10012', 'Soft Drink 500ml', 'cat_bev', 55, 80, 75, 20, 'bottle'),
  ('prd_13', 'MM10013', 'Toilet Paper (4 pack)', 'cat_house', 90, 130, 40, 10, 'pack'),
  ('prd_14', 'MM10014', 'Toothpaste 100ml', 'cat_care', 80, 120, 5, 8, 'tube'),
  ('prd_15', 'MM10015', 'Exercise Book A4', 'cat_stat', 40, 60, 0, 10, 'book'),
  ('prd_16', 'MM10016', 'Ballpoint Pen', 'cat_stat', 10, 20, 150, 40, 'piece')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 5. Purchases
-- ---------------------------------------------------------

INSERT INTO purchases (
  id, purchase_no, supplier_id, received_by,
  purchase_date, payment_method, notes, total, stock_applied
) VALUES
  ('pur_01', 'PO-' || to_char(CURRENT_DATE, 'YYYY') || '-001',
   'sup_03', 'usr_store', CURRENT_DATE - 12,
   'Bank transfer', 'Monthly flour restock', 10300, TRUE),

  ('pur_02', 'PO-' || to_char(CURRENT_DATE, 'YYYY') || '-002',
   'sup_01', 'usr_store', CURRENT_DATE - 7,
   'M-Pesa', 'Oil and detergent', 11200, TRUE),

  ('pur_03', 'PO-' || to_char(CURRENT_DATE, 'YYYY') || '-003',
   'sup_04', 'usr_store', CURRENT_DATE - 3,
   'Cash', 'Soft drinks restock', 4440, TRUE)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 6. Purchase items
-- ---------------------------------------------------------

INSERT INTO purchase_items (
  id, purchase_id, product_id, product_name, qty, buying_price
) VALUES
  ('pi_01', 'pur_01', 'prd_04', 'Maize Flour 2kg', 50, 110),
  ('pi_02', 'pur_01', 'prd_05', 'Wheat Flour 2kg', 40, 120),
  ('pi_03', 'pur_02', 'prd_03', 'Cooking Oil 1L', 30, 280),
  ('pi_04', 'pur_02', 'prd_11', 'Detergent 1kg', 20, 140),
  ('pi_05', 'pur_03', 'prd_12', 'Soft Drink 500ml', 48, 55),
  ('pi_06', 'pur_03', 'prd_09', 'Bottled Water 500ml', 60, 30)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 7. Sales
-- ---------------------------------------------------------

INSERT INTO sales (
  id, receipt_no, customer_id, cashier_id, sale_date,
  payment_method, amount_paid, change_amount, status,
  subtotal, discount_amount, tax_rate, tax_amount,
  total, stock_applied, created_at
) VALUES
  ('sale_01', 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-1001',
   'cust_walkin', 'usr_cashier', CURRENT_DATE - 5,
   'Cash', 500, 50, 'completed',
   450, 0, 0, 0, 450, TRUE, now() - interval '5 days'),

  ('sale_02', 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-1002',
   'cust_01', 'usr_cashier', CURRENT_DATE - 2,
   'M-Pesa', 890, 0, 'completed',
   890, 0, 0, 0, 890, TRUE, now() - interval '2 days'),

  ('sale_03', 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-1003',
   'cust_02', 'usr_cashier', CURRENT_DATE,
   'Card', 430, 0, 'completed',
   430, 0, 0, 0, 430, TRUE, now() - interval '2 hours'),

  ('sale_04', 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-1004',
   'cust_walkin', 'usr_cashier', CURRENT_DATE,
   'Cash', 1000, 300, 'completed',
   700, 0, 0, 0, 700, TRUE, now() - interval '1 hour'),

  ('sale_05', 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-1005',
   'cust_03', 'usr_cashier', CURRENT_DATE - 1,
   'Bank transfer', 3090, 0, 'completed',
   3090, 0, 0, 0, 3090, TRUE, now() - interval '1 day'),

  ('sale_06', 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-1006',
   'cust_01', 'usr_cashier', CURRENT_DATE - 4,
   'M-Pesa', 2660, 0, 'completed',
   2660, 0, 0, 0, 2660, TRUE, now() - interval '4 days')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 8. Sale items
-- ---------------------------------------------------------

INSERT INTO sale_items (
  id, sale_id, product_id, product_name,
  qty, buying_price, selling_price
) VALUES
  ('si_01', 'sale_01', 'prd_01', 'Sugar 2kg', 1, 140, 180),
  ('si_02', 'sale_01', 'prd_07', 'Bread Loaf', 2, 45, 65),
  ('si_03', 'sale_01', 'prd_06', 'Fresh Milk 500ml', 2, 50, 70),

  ('si_04', 'sale_02', 'prd_02', 'Rice 2kg', 2, 170, 220),
  ('si_05', 'sale_02', 'prd_03', 'Cooking Oil 1L', 1, 280, 350),
  ('si_06', 'sale_02', 'prd_10', 'Bathing Soap', 1, 70, 100),

  ('si_07', 'sale_03', 'prd_04', 'Maize Flour 2kg', 2, 110, 150),
  ('si_08', 'sale_03', 'prd_12', 'Soft Drink 500ml', 1, 55, 80),
  ('si_09', 'sale_03', 'prd_09', 'Bottled Water 500ml', 1, 30, 50),

  ('si_10', 'sale_04', 'prd_05', 'Wheat Flour 2kg', 2, 120, 160),
  ('si_11', 'sale_04', 'prd_08', 'Eggs (each)', 10, 14, 20),
  ('si_12', 'sale_04', 'prd_11', 'Detergent 1kg', 1, 140, 180),

  ('si_13', 'sale_05', 'prd_01', 'Sugar 2kg', 5, 140, 180),
  ('si_14', 'sale_05', 'prd_02', 'Rice 2kg', 4, 170, 220),
  ('si_15', 'sale_05', 'prd_03', 'Cooking Oil 1L', 3, 280, 350),
  ('si_16', 'sale_05', 'prd_13', 'Toilet Paper (4 pack)', 2, 90, 130),

  ('si_17', 'sale_06', 'prd_04', 'Maize Flour 2kg', 6, 110, 150),
  ('si_18', 'sale_06', 'prd_06', 'Fresh Milk 500ml', 8, 50, 70),
  ('si_19', 'sale_06', 'prd_12', 'Soft Drink 500ml', 10, 55, 80),
  ('si_20', 'sale_06', 'prd_10', 'Bathing Soap', 4, 70, 100)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 9. Expenses
-- ---------------------------------------------------------

INSERT INTO expenses (
  id, description, category, amount,
  expense_date, payment_method, created_by
) VALUES
  ('exp_01', 'Shop rent - demo period share', 'Rent', 500,
   CURRENT_DATE - 20, 'Bank transfer', 'usr_accountant'),

  ('exp_02', 'KPLC electricity bill', 'Electricity bills', 200,
   CURRENT_DATE - 10, 'M-Pesa', 'usr_accountant'),

  ('exp_03', 'Nairobi Water bill', 'Water bills', 100,
   CURRENT_DATE - 9, 'M-Pesa', 'usr_accountant'),

  ('exp_04', 'Cashier wage - demo period', 'Salaries', 400,
   CURRENT_DATE - 4, 'Bank transfer', 'usr_accountant'),

  ('exp_05', 'Goods delivery transport', 'Transport', 150,
   CURRENT_DATE - 3, 'Cash', 'usr_accountant'),

  ('exp_06', 'Safaricom Fibre internet', 'Internet', 200,
   CURRENT_DATE - 6, 'M-Pesa', 'usr_accountant'),

  ('exp_07', 'Fridge maintenance', 'Maintenance', 200,
   CURRENT_DATE - 15, 'Cash', 'usr_accountant')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 10. Payments
-- Create one payment record for each demo sale, purchase,
-- and expense. The unique reference constraint prevents
-- duplicate payments for the same transaction.
-- ---------------------------------------------------------

INSERT INTO payments (
  id, reference_type, reference_id, amount, method, paid_at
)
SELECT
  'pay_' || id,
  'sale',
  id,
  total,
  payment_method,
  created_at
FROM sales
WHERE id IN ('sale_01', 'sale_02', 'sale_03', 'sale_04', 'sale_05', 'sale_06')

UNION ALL

SELECT
  'pay_' || id,
  'purchase',
  id,
  total,
  payment_method,
  created_at
FROM purchases
WHERE id IN ('pur_01', 'pur_02', 'pur_03')

UNION ALL

SELECT
  'pay_' || id,
  'expense',
  id,
  amount,
  payment_method,
  created_at
FROM expenses
WHERE id IN ('exp_01', 'exp_02', 'exp_03', 'exp_04', 'exp_05', 'exp_06', 'exp_07')

ON CONFLICT DO NOTHING;

COMMIT;

-- ---------------------------------------------------------
-- 11. Quick verification
-- ---------------------------------------------------------

SELECT 'Suppliers' AS record_type, COUNT(*) AS total FROM suppliers
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'Sales', COUNT(*) FROM sales
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments;
