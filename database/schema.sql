-- MiniMart Computerized Accounting System
-- Supabase / PostgreSQL schema
-- Run this entire script in the Supabase SQL Editor, then run seed_data.sql.
--
-- PHP connects with the database password. Row Level Security is enabled and
-- no policies are granted to anon/authenticated API roles, so the public
-- Supabase API cannot read these tables. The PHP application enforces roles.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET search_path TO public, extensions;

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- ---------------------------------------------------------------------------
-- Catalogue and parties
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expense_categories (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  is_walk_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_walk_in ON customers(is_walk_in) WHERE is_walk_in;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  buying_price NUMERIC(14,2) NOT NULL CHECK (buying_price >= 0),
  selling_price NUMERIC(14,2) NOT NULL CHECK (selling_price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  unit TEXT NOT NULL DEFAULT 'unit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_code_ci ON products (lower(code));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ---------------------------------------------------------------------------
-- Trading documents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  cashier_id TEXT NOT NULL REFERENCES users(id),
  sale_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Bank transfer', 'Card')),
  amount_paid NUMERIC(14,2) NOT NULL CHECK (amount_paid >= 0),
  change_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
  subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  client_request_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  buying_price NUMERIC(14,2) NOT NULL CHECK (buying_price >= 0),
  selling_price NUMERIC(14,2) NOT NULL CHECK (selling_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  purchase_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  received_by TEXT REFERENCES users(id),
  purchase_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Bank transfer', 'Card')),
  notes TEXT NOT NULL DEFAULT '',
  total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  client_request_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  buying_price NUMERIC(14,2) NOT NULL CHECK (buying_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES expense_categories(name),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Bank transfer', 'Card')),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sale', 'purchase', 'expense')),
  reference_id TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'M-Pesa', 'Bank transfer', 'Card')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reference_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS business_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username, created_at DESC);

-- ---------------------------------------------------------------------------
-- Reference data and default users
-- Passwords are bcrypt hashes of the documented demonstration passwords.
-- Change them after the first real deployment.
-- ---------------------------------------------------------------------------

INSERT INTO roles (id, name) VALUES
  ('role_admin', 'Administrator'),
  ('role_cashier', 'Cashier'),
  ('role_accountant', 'Accountant'),
  ('role_store', 'Storekeeper')
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (id, key, label) VALUES
  ('perm_dashboard', 'dashboard', 'Dashboard'),
  ('perm_products', 'products', 'Products'),
  ('perm_inventory', 'inventory', 'Inventory'),
  ('perm_sales', 'sales', 'Sales'),
  ('perm_purchases', 'purchases', 'Purchases'),
  ('perm_suppliers', 'suppliers', 'Suppliers'),
  ('perm_customers', 'customers', 'Customers'),
  ('perm_expenses', 'expenses', 'Expenses'),
  ('perm_accounting', 'accounting', 'Accounting'),
  ('perm_reports', 'reports', 'Reports'),
  ('perm_users', 'users', 'Users'),
  ('perm_settings', 'settings', 'Settings'),
  ('perm_profile', 'profile', 'Profile')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_cashier', id FROM permissions
WHERE key IN ('dashboard', 'sales', 'customers', 'products', 'inventory', 'profile')
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND rp.role_id = 'role_cashier'
  AND p.key IN ('products', 'inventory');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_accountant', id FROM permissions
WHERE key IN ('dashboard', 'accounting', 'reports', 'expenses', 'sales', 'purchases', 'customers', 'suppliers', 'profile')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_store', id FROM permissions
WHERE key IN ('dashboard', 'products', 'inventory', 'purchases', 'suppliers', 'profile')
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, name) VALUES
  ('cat_food', 'Food and groceries'),
  ('cat_bev', 'Beverages'),
  ('cat_house', 'Household products'),
  ('cat_care', 'Personal care products'),
  ('cat_stat', 'Stationery'),
  ('cat_other', 'Other products')
ON CONFLICT (id) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
  ('Rent'),
  ('Electricity bills'),
  ('Water bills'),
  ('Salaries'),
  ('Transport'),
  ('Internet'),
  ('Maintenance'),
  ('Other expenses')
ON CONFLICT (name) DO NOTHING;

INSERT INTO business_settings (key, value) VALUES
  ('supermarket_name', 'MiniMart Supermarket'),
  ('logo_data_url', ''),
  ('currency', 'KES'),
  ('phone', '+254 712 345 678'),
  ('email', 'info@minimart.co.ke'),
  ('address', 'Moi Avenue, Nairobi, Kenya'),
  ('receipt_footer', 'Thank you for shopping at MiniMart! Karibu tena.'),
  ('tax_rate', '0')
ON CONFLICT (key) DO NOTHING;

-- crypt() produces a $2a$ bcrypt hash that PHP password_verify() accepts.
INSERT INTO users (id, username, password_hash, full_name, role_id, email, phone, active)
VALUES
  ('usr_admin', 'admin', crypt('admin123', gen_salt('bf', 10)), 'Grace Wanjiku', 'role_admin', 'admin@minimart.co.ke', '+254 700 111 001', TRUE),
  ('usr_cashier', 'cashier', crypt('cashier123', gen_salt('bf', 10)), 'Brian Otieno', 'role_cashier', 'cashier@minimart.co.ke', '+254 700 111 002', TRUE),
  ('usr_accountant', 'accountant', crypt('account123', gen_salt('bf', 10)), 'Faith Njeri', 'role_accountant', 'accounts@minimart.co.ke', '+254 700 111 003', TRUE),
  ('usr_store', 'storekeeper', crypt('store123', gen_salt('bf', 10)), 'Daniel Kamau', 'role_store', 'store@minimart.co.ke', '+254 700 111 004', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Block the Supabase Data API (anon / authenticated) from these tables.
-- PHP uses the Postgres role and must enforce permissions itself.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE roles, permissions, role_permissions, users, categories, expense_categories,
  suppliers, customers, products, sales, sale_items, purchases, purchase_items, expenses, payments,
  business_settings, audit_logs, login_attempts FROM anon, authenticated;
