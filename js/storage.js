/**
 * MiniMart Computerized Accounting System
 * In-memory workspace loaded from the PHP API (Supabase PostgreSQL).
 */

const MM_STORAGE_KEYS = {
  PRODUCTS: 'mm_products',
  SUPPLIERS: 'mm_suppliers',
  CUSTOMERS: 'mm_customers',
  SALES: 'mm_sales',
  PURCHASES: 'mm_purchases',
  EXPENSES: 'mm_expenses',
  USERS: 'mm_users',
  SETTINGS: 'mm_settings',
  SESSION: 'mm_session',
  INITIALIZED: 'mm_initialized'
};

const MM_CATEGORIES = [
  'Food and groceries',
  'Beverages',
  'Household products',
  'Personal care products',
  'Stationery',
  'Other products'
];

const MM_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity bills',
  'Water bills',
  'Salaries',
  'Transport',
  'Internet',
  'Maintenance',
  'Other expenses'
];

const MM_PAYMENT_METHODS = ['Cash', 'M-Pesa', 'Bank transfer', 'Card'];

const MM_ROLES = ['Administrator', 'Cashier', 'Accountant', 'Storekeeper'];

const MM_ROLE_PERMISSIONS = {
  Administrator: [
    'dashboard', 'products', 'inventory', 'sales', 'purchases',
    'suppliers', 'customers', 'expenses', 'accounting', 'reports',
    'users', 'settings', 'profile'
  ],
  Cashier: ['dashboard', 'sales', 'customers', 'profile'],
  Accountant: [
    'dashboard', 'accounting', 'reports', 'expenses', 'sales',
    'purchases', 'customers', 'suppliers', 'profile'
  ],
  Storekeeper: [
    'dashboard', 'products', 'inventory', 'purchases', 'suppliers', 'profile'
  ]
};

const MM_DEFAULT_SETTINGS = {
  supermarketName: 'MiniMart Supermarket',
  logoDataUrl: '',
  currency: 'KES',
  phone: '+254 712 345 678',
  email: 'info@minimart.co.ke',
  address: 'Moi Avenue, Nairobi, Kenya',
  receiptFooter: 'Thank you for shopping at MiniMart! Karibu tena.',
  taxRate: 0
};

const MM_STATE = {
  settings: { ...MM_DEFAULT_SETTINGS },
  products: [],
  suppliers: [],
  customers: [],
  sales: [],
  purchases: [],
  expenses: [],
  users: [],
  user: null,
  csrf: ''
};

try {
  MM_STATE.csrf = sessionStorage.getItem('mm_csrf') || '';
} catch (e) {
  MM_STATE.csrf = '';
}

function mmGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('mmGet error', key, e);
    return fallback;
  }
}

function mmSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function mmRemove(key) {
  localStorage.removeItem(key);
}

function mmGenerateId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function mmGenerateCode(prefix, length) {
  const n = Math.floor(Math.random() * Math.pow(10, length || 5))
    .toString()
    .padStart(length || 5, '0');
  return prefix + n;
}

function mmTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mmDaysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mmFormatMoney(amount) {
  const settings = mmGetSettings();
  const currency = settings.currency || 'KES';
  const n = Number(amount) || 0;
  return currency + ' ' + n.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function mmFormatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function mmFormatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function mmApiUrl(resource, query) {
  const params = new URLSearchParams({ r: resource });
  if (query) {
    Object.keys(query).forEach((key) => {
      if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
        params.set(key, String(query[key]));
      }
    });
  }
  return 'api/index.php?' + params.toString();
}

function mmRememberCsrf(token) {
  if (!token) return;
  MM_STATE.csrf = token;
  try {
    sessionStorage.setItem('mm_csrf', token);
  } catch (e) {
    /* session storage can be blocked; the in-memory token still works this tab */
  }
}

async function mmApi(resource, options) {
  const opts = options || {};
  const method = String(opts.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD' && resource !== 'login') {
    headers['X-CSRF-Token'] = MM_STATE.csrf || '';
  }
  let response;
  try {
    response = await fetch(mmApiUrl(resource, opts.query), {
      method,
      headers,
      credentials: 'same-origin',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    throw new Error('Cannot reach the PHP API. Start the PHP server and open MiniMart from its address.');
  }
  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }
  if (data && data.csrf) mmRememberCsrf(data.csrf);
  if (!response.ok || data.ok === false) {
    throw new Error((data && data.error) || 'Request failed.');
  }
  return data;
}

function mmApplyWorkspace(data) {
  MM_STATE.settings = { ...MM_DEFAULT_SETTINGS, ...(data.settings || {}) };
  MM_STATE.products = data.products || [];
  MM_STATE.suppliers = data.suppliers || [];
  MM_STATE.customers = data.customers || [];
  MM_STATE.sales = data.sales || [];
  MM_STATE.purchases = data.purchases || [];
  MM_STATE.expenses = data.expenses || [];
  MM_STATE.users = data.users || [];
  if (data.user) MM_STATE.user = data.user;
}

async function mmLoadWorkspace() {
  const data = await mmApi('workspace');
  mmApplyWorkspace(data);
  return data;
}

async function mmPersist(resource, payload, creating) {
  const data = await mmApi(resource, {
    method: creating ? 'POST' : 'PUT',
    body: payload
  });
  return data.item;
}

async function mmRemoveRecord(resource, id) {
  await mmApi(resource, { method: 'DELETE', query: { id } });
}

function mmUpsert(list, item) {
  return list.filter((row) => row.id !== item.id).concat([item]);
}

/* ---------- Settings ---------- */
function mmGetSettings() {
  return MM_STATE.settings || { ...MM_DEFAULT_SETTINGS };
}

function mmSaveSettings(settings) {
  MM_STATE.settings = settings;
}

/* ---------- Users ---------- */
function mmGetUsers() {
  return MM_STATE.users || [];
}

function mmSaveUsers(users) {
  MM_STATE.users = users;
}

function mmGetUserById(id) {
  return mmGetUsers().find((u) => u.id === id) || null;
}

function mmGetUserByUsername(username) {
  return mmGetUsers().find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  ) || null;
}

/* ---------- Products ---------- */
function mmGetProducts() {
  return MM_STATE.products || [];
}

function mmSaveProducts(products) {
  MM_STATE.products = products;
}

function mmGetProductById(id) {
  return mmGetProducts().find((p) => p.id === id) || null;
}

function mmUpdateProductStock(productId, delta) {
  const products = mmGetProducts();
  const idx = products.findIndex((p) => p.id === productId);
  if (idx === -1) return null;
  products[idx].stock = Math.max(0, Number(products[idx].stock) + Number(delta));
  mmSaveProducts(products);
  return products[idx];
}

/* ---------- Suppliers / Customers ---------- */
function mmGetSuppliers() {
  return MM_STATE.suppliers || [];
}

function mmSaveSuppliers(suppliers) {
  MM_STATE.suppliers = suppliers;
}

function mmGetCustomers() {
  return MM_STATE.customers || [];
}

function mmSaveCustomers(customers) {
  MM_STATE.customers = customers;
}

/* ---------- Sales / Purchases / Expenses ---------- */
function mmGetSales() {
  return MM_STATE.sales || [];
}

function mmSaveSales(sales) {
  MM_STATE.sales = sales;
}

function mmGetPurchases() {
  return MM_STATE.purchases || [];
}

function mmSavePurchases(purchases) {
  MM_STATE.purchases = purchases;
}

function mmGetExpenses() {
  return MM_STATE.expenses || [];
}

function mmSaveExpenses(expenses) {
  MM_STATE.expenses = expenses;
}

/* ---------- Accounting helpers ---------- */
function mmIsSameDay(isoDate, refISO) {
  const a = String(isoDate).slice(0, 10);
  const b = String(refISO || mmTodayISO()).slice(0, 10);
  return a === b;
}

function mmIsSameMonth(isoDate, refDate) {
  const d = new Date(String(isoDate).slice(0, 10) + 'T00:00:00');
  const r = refDate ? new Date(refDate) : new Date();
  return d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth();
}

function mmInDateRange(isoDate, from, to) {
  const d = String(isoDate).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function mmCalcSaleTotals(sale) {
  const items = sale.items || [];
  let revenue = 0;
  let cogs = 0;
  items.forEach((item) => {
    revenue += Number(item.qty) * Number(item.sellingPrice);
    cogs += Number(item.qty) * Number(item.buyingPrice);
  });
  const discount = Number(sale.discount || 0);
  revenue = Math.max(0, revenue - discount);
  return { revenue, cogs, gross: revenue - cogs };
}

function mmGetAccountingSummary(from, to) {
  const sales = mmGetSales().filter(
    (s) => s.status === 'completed' && mmInDateRange(s.date, from, to)
  );
  const purchases = mmGetPurchases().filter((p) => mmInDateRange(p.date, from, to));
  const expenses = mmGetExpenses().filter((e) => mmInDateRange(e.date, from, to));
  const products = mmGetProducts();

  let revenue = 0;
  let cogs = 0;
  sales.forEach((s) => {
    const t = mmCalcSaleTotals(s);
    revenue += t.revenue;
    cogs += t.cogs;
  });

  const purchaseTotal = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;

  const inventoryValueCost = products.reduce(
    (sum, p) => sum + Number(p.stock) * Number(p.buyingPrice),
    0
  );
  const inventoryValueRetail = products.reduce(
    (sum, p) => sum + Number(p.stock) * Number(p.sellingPrice),
    0
  );

  // Closing stock valuation at cost (current stock after all movements)
  const closingStock = inventoryValueCost;

  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses: expenseTotal,
    netProfit,
    purchaseTotal,
    salesCount: sales.length,
    purchaseCount: purchases.length,
    expenseCount: expenses.length,
    inventoryValueCost,
    inventoryValueRetail,
    closingStock,
    productCount: products.length,
    lowStockCount: products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock)).length,
    outOfStockCount: products.filter((p) => Number(p.stock) <= 0).length
  };
}

function mmExportCSV(filename, rows) {
  if (!rows || !rows.length) {
    alert('No data to export.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Sample data bootstrap ---------- */
function mmBuildSampleData() {
  const users = [
    {
      id: 'usr_admin',
      username: 'admin',
      password: 'admin123',
      fullName: 'Grace Wanjiku',
      role: 'Administrator',
      email: 'admin@minimart.co.ke',
      phone: '+254 700 111 001',
      active: true
    },
    {
      id: 'usr_cashier',
      username: 'cashier',
      password: 'cashier123',
      fullName: 'Brian Otieno',
      role: 'Cashier',
      email: 'cashier@minimart.co.ke',
      phone: '+254 700 111 002',
      active: true
    },
    {
      id: 'usr_accountant',
      username: 'accountant',
      password: 'account123',
      fullName: 'Faith Njeri',
      role: 'Accountant',
      email: 'accounts@minimart.co.ke',
      phone: '+254 700 111 003',
      active: true
    },
    {
      id: 'usr_store',
      username: 'storekeeper',
      password: 'store123',
      fullName: 'Daniel Kamau',
      role: 'Storekeeper',
      email: 'store@minimart.co.ke',
      phone: '+254 700 111 004',
      active: true
    }
  ];

  const products = [
    { id: 'prd_01', code: 'MM10001', name: 'Sugar 2kg', category: 'Food and groceries', buyingPrice: 140, sellingPrice: 180, stock: 85, minStock: 20, unit: 'packet' },
    { id: 'prd_02', code: 'MM10002', name: 'Rice 2kg', category: 'Food and groceries', buyingPrice: 170, sellingPrice: 220, stock: 70, minStock: 15, unit: 'packet' },
    { id: 'prd_03', code: 'MM10003', name: 'Cooking Oil 1L', category: 'Food and groceries', buyingPrice: 280, sellingPrice: 350, stock: 45, minStock: 12, unit: 'bottle' },
    { id: 'prd_04', code: 'MM10004', name: 'Maize Flour 2kg', category: 'Food and groceries', buyingPrice: 110, sellingPrice: 150, stock: 90, minStock: 25, unit: 'packet' },
    { id: 'prd_05', code: 'MM10005', name: 'Wheat Flour 2kg', category: 'Food and groceries', buyingPrice: 120, sellingPrice: 160, stock: 60, minStock: 15, unit: 'packet' },
    { id: 'prd_06', code: 'MM10006', name: 'Fresh Milk 500ml', category: 'Beverages', buyingPrice: 50, sellingPrice: 70, stock: 40, minStock: 20, unit: 'packet' },
    { id: 'prd_07', code: 'MM10007', name: 'Bread Loaf', category: 'Food and groceries', buyingPrice: 45, sellingPrice: 65, stock: 35, minStock: 15, unit: 'loaf' },
    { id: 'prd_08', code: 'MM10008', name: 'Eggs (each)', category: 'Food and groceries', buyingPrice: 14, sellingPrice: 20, stock: 120, minStock: 30, unit: 'piece' },
    { id: 'prd_09', code: 'MM10009', name: 'Bottled Water 500ml', category: 'Beverages', buyingPrice: 30, sellingPrice: 50, stock: 100, minStock: 25, unit: 'bottle' },
    { id: 'prd_10', code: 'MM10010', name: 'Bathing Soap', category: 'Personal care products', buyingPrice: 70, sellingPrice: 100, stock: 55, minStock: 15, unit: 'bar' },
    { id: 'prd_11', code: 'MM10011', name: 'Detergent 1kg', category: 'Household products', buyingPrice: 140, sellingPrice: 180, stock: 8, minStock: 10, unit: 'packet' },
    { id: 'prd_12', code: 'MM10012', name: 'Soft Drink 500ml', category: 'Beverages', buyingPrice: 55, sellingPrice: 80, stock: 75, minStock: 20, unit: 'bottle' },
    { id: 'prd_13', code: 'MM10013', name: 'Toilet Paper (4 pack)', category: 'Household products', buyingPrice: 90, sellingPrice: 130, stock: 40, minStock: 10, unit: 'pack' },
    { id: 'prd_14', code: 'MM10014', name: 'Toothpaste 100ml', category: 'Personal care products', buyingPrice: 80, sellingPrice: 120, stock: 5, minStock: 8, unit: 'tube' },
    { id: 'prd_15', code: 'MM10015', name: 'Exercise Book A4', category: 'Stationery', buyingPrice: 40, sellingPrice: 60, stock: 0, minStock: 10, unit: 'book' },
    { id: 'prd_16', code: 'MM10016', name: 'Ballpoint Pen', category: 'Stationery', buyingPrice: 10, sellingPrice: 20, stock: 150, minStock: 40, unit: 'piece' }
  ];

  const suppliers = [
    {
      id: 'sup_01',
      name: 'Bidco Africa Supplies',
      phone: '+254 720 111 222',
      email: 'orders@bidco.ke',
      address: 'Thika Road, Nairobi',
      notes: 'Cooking oil, detergents, soaps'
    },
    {
      id: 'sup_02',
      name: 'Brookside Dairy Distributors',
      phone: '+254 722 333 444',
      email: 'sales@brookside.ke',
      address: 'Ruiru, Kiambu',
      notes: 'Milk and dairy products'
    },
    {
      id: 'sup_03',
      name: 'Unga Limited Wholesale',
      phone: '+254 733 555 666',
      email: 'wholesale@unga.ke',
      address: 'Industrial Area, Nairobi',
      notes: 'Flour, maize meal, cereals'
    },
    {
      id: 'sup_04',
      name: 'Coca-Cola Beverages Kenya',
      phone: '+254 711 777 888',
      email: 'trade@ccbk.ke',
      address: 'Nairobi West',
      notes: 'Soft drinks and bottled water'
    }
  ];

  const customers = [
    {
      id: 'cust_walkin',
      name: 'Walk-in Customer',
      phone: 'N/A',
      email: '',
      address: 'Nairobi',
      isWalkIn: true
    },
    {
      id: 'cust_01',
      name: 'Mary Achieng',
      phone: '+254 701 222 333',
      email: 'mary.achieng@email.com',
      address: 'Westlands, Nairobi',
      isWalkIn: false
    },
    {
      id: 'cust_02',
      name: 'James Mwangi',
      phone: '+254 702 444 555',
      email: 'jmwangi@email.com',
      address: 'Eastlands, Nairobi',
      isWalkIn: false
    },
    {
      id: 'cust_03',
      name: 'Lucy Wambui',
      phone: '+254 703 666 777',
      email: 'lucy.w@email.com',
      address: 'Ngong Road, Nairobi',
      isWalkIn: false
    }
  ];

  // Build purchases that already increased stock conceptually — stocks above are post-movement figures
  const purchases = [
    {
      id: 'pur_01',
      purchaseNo: 'PO-2026-001',
      supplierId: 'sup_03',
      supplierName: 'Unga Limited Wholesale',
      date: mmDaysAgoISO(12),
      paymentMethod: 'Bank transfer',
      notes: 'Monthly flour restock',
      items: [
        { productId: 'prd_04', productName: 'Maize Flour 2kg', qty: 50, buyingPrice: 110 },
        { productId: 'prd_05', productName: 'Wheat Flour 2kg', qty: 40, buyingPrice: 120 }
      ],
      total: 50 * 110 + 40 * 120
    },
    {
      id: 'pur_02',
      purchaseNo: 'PO-2026-002',
      supplierId: 'sup_01',
      supplierName: 'Bidco Africa Supplies',
      date: mmDaysAgoISO(7),
      paymentMethod: 'M-Pesa',
      notes: 'Oil and detergent',
      items: [
        { productId: 'prd_03', productName: 'Cooking Oil 1L', qty: 30, buyingPrice: 280 },
        { productId: 'prd_11', productName: 'Detergent 1kg', qty: 20, buyingPrice: 140 }
      ],
      total: 30 * 280 + 20 * 140
    },
    {
      id: 'pur_03',
      purchaseNo: 'PO-2026-003',
      supplierId: 'sup_04',
      supplierName: 'Coca-Cola Beverages Kenya',
      date: mmDaysAgoISO(3),
      paymentMethod: 'Cash',
      notes: 'Soft drinks restock',
      items: [
        { productId: 'prd_12', productName: 'Soft Drink 500ml', qty: 48, buyingPrice: 55 },
        { productId: 'prd_09', productName: 'Bottled Water 500ml', qty: 60, buyingPrice: 30 }
      ],
      total: 48 * 55 + 60 * 30
    }
  ];

  const sales = [
    {
      id: 'sale_01',
      receiptNo: 'RCP-2026-1001',
      customerId: 'cust_walkin',
      customerName: 'Walk-in Customer',
      cashierId: 'usr_cashier',
      cashierName: 'Brian Otieno',
      date: mmDaysAgoISO(5),
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      paymentMethod: 'Cash',
      amountPaid: 500,
      change: 55,
      status: 'completed',
      items: [
        { productId: 'prd_01', productName: 'Sugar 2kg', qty: 1, buyingPrice: 140, sellingPrice: 180 },
        { productId: 'prd_07', productName: 'Bread Loaf', qty: 2, buyingPrice: 45, sellingPrice: 65 },
        { productId: 'prd_06', productName: 'Fresh Milk 500ml', qty: 2, buyingPrice: 50, sellingPrice: 70 }
      ],
      subtotal: 450,
      total: 450
    },
    {
      id: 'sale_02',
      receiptNo: 'RCP-2026-1002',
      customerId: 'cust_01',
      customerName: 'Mary Achieng',
      cashierId: 'usr_cashier',
      cashierName: 'Brian Otieno',
      date: mmDaysAgoISO(2),
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      paymentMethod: 'M-Pesa',
      amountPaid: 760,
      change: 0,
      status: 'completed',
      items: [
        { productId: 'prd_02', productName: 'Rice 2kg', qty: 2, buyingPrice: 170, sellingPrice: 220 },
        { productId: 'prd_03', productName: 'Cooking Oil 1L', qty: 1, buyingPrice: 280, sellingPrice: 350 },
        { productId: 'prd_10', productName: 'Bathing Soap', qty: 1, buyingPrice: 70, sellingPrice: 100 }
      ],
      subtotal: 890,
      total: 890
    },
    {
      id: 'sale_03',
      receiptNo: 'RCP-2026-1003',
      customerId: 'cust_02',
      customerName: 'James Mwangi',
      cashierId: 'usr_cashier',
      cashierName: 'Brian Otieno',
      date: mmTodayISO(),
      createdAt: new Date().toISOString(),
      paymentMethod: 'Card',
      amountPaid: 430,
      change: 0,
      status: 'completed',
      items: [
        { productId: 'prd_04', productName: 'Maize Flour 2kg', qty: 2, buyingPrice: 110, sellingPrice: 150 },
        { productId: 'prd_12', productName: 'Soft Drink 500ml', qty: 1, buyingPrice: 55, sellingPrice: 80 },
        { productId: 'prd_09', productName: 'Bottled Water 500ml', qty: 1, buyingPrice: 30, sellingPrice: 50 }
      ],
      subtotal: 430,
      total: 430
    },
    {
      id: 'sale_04',
      receiptNo: 'RCP-2026-1004',
      customerId: 'cust_walkin',
      customerName: 'Walk-in Customer',
      cashierId: 'usr_cashier',
      cashierName: 'Brian Otieno',
      date: mmTodayISO(),
      createdAt: new Date().toISOString(),
      paymentMethod: 'Cash',
      amountPaid: 1000,
      change: 245,
      status: 'completed',
      items: [
        { productId: 'prd_05', productName: 'Wheat Flour 2kg', qty: 2, buyingPrice: 120, sellingPrice: 160 },
        { productId: 'prd_08', productName: 'Eggs (each)', qty: 10, buyingPrice: 14, sellingPrice: 20 },
        { productId: 'prd_11', productName: 'Detergent 1kg', qty: 1, buyingPrice: 140, sellingPrice: 180 }
      ],
      subtotal: 700,
      total: 700
    },
    {
      id: 'sale_05',
      receiptNo: 'RCP-2026-1005',
      customerId: 'cust_03',
      customerName: 'Lucy Wambui',
      cashierId: 'usr_cashier',
      cashierName: 'Brian Otieno',
      date: mmDaysAgoISO(1),
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      paymentMethod: 'Bank transfer',
      amountPaid: 0,
      change: 0,
      status: 'completed',
      items: [
        { productId: 'prd_01', productName: 'Sugar 2kg', qty: 5, buyingPrice: 140, sellingPrice: 180 },
        { productId: 'prd_02', productName: 'Rice 2kg', qty: 4, buyingPrice: 170, sellingPrice: 220 },
        { productId: 'prd_03', productName: 'Cooking Oil 1L', qty: 3, buyingPrice: 280, sellingPrice: 350 },
        { productId: 'prd_13', productName: 'Toilet Paper (4 pack)', qty: 2, buyingPrice: 90, sellingPrice: 130 }
      ],
      subtotal: 0,
      total: 0
    },
    {
      id: 'sale_06',
      receiptNo: 'RCP-2026-1006',
      customerId: 'cust_01',
      customerName: 'Mary Achieng',
      cashierId: 'usr_cashier',
      cashierName: 'Brian Otieno',
      date: mmDaysAgoISO(4),
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      paymentMethod: 'M-Pesa',
      amountPaid: 0,
      change: 0,
      status: 'completed',
      items: [
        { productId: 'prd_04', productName: 'Maize Flour 2kg', qty: 6, buyingPrice: 110, sellingPrice: 150 },
        { productId: 'prd_06', productName: 'Fresh Milk 500ml', qty: 8, buyingPrice: 50, sellingPrice: 70 },
        { productId: 'prd_12', productName: 'Soft Drink 500ml', qty: 10, buyingPrice: 55, sellingPrice: 80 },
        { productId: 'prd_10', productName: 'Bathing Soap', qty: 4, buyingPrice: 70, sellingPrice: 100 }
      ],
      subtotal: 0,
      total: 0
    }
  ];

  // Fix sale_02 totals consistency
  sales[1].subtotal = 2 * 220 + 350 + 100;
  sales[1].total = sales[1].subtotal;
  sales[1].amountPaid = sales[1].total;
  sales[1].change = 0;

  // Fix sale_04
  sales[3].subtotal = 2 * 160 + 10 * 20 + 180;
  sales[3].total = sales[3].subtotal;
  sales[3].change = 1000 - sales[3].total;

  // Fix sale_05
  sales[4].subtotal = 5 * 180 + 4 * 220 + 3 * 350 + 2 * 130;
  sales[4].total = sales[4].subtotal;
  sales[4].amountPaid = sales[4].total;
  sales[4].change = 0;

  // Fix sale_06
  sales[5].subtotal = 6 * 150 + 8 * 70 + 10 * 80 + 4 * 100;
  sales[5].total = sales[5].subtotal;
  sales[5].amountPaid = sales[5].total;
  sales[5].change = 0;

  // Demo-period operating expenses (kept proportional so sample Net Profit stays positive)
  const expenses = [
    {
      id: 'exp_01',
      description: 'Shop rent – demo period share',
      category: 'Rent',
      amount: 500,
      date: mmDaysAgoISO(20),
      paymentMethod: 'Bank transfer'
    },
    {
      id: 'exp_02',
      description: 'KPLC electricity bill',
      category: 'Electricity bills',
      amount: 200,
      date: mmDaysAgoISO(10),
      paymentMethod: 'M-Pesa'
    },
    {
      id: 'exp_03',
      description: 'Nairobi Water bill',
      category: 'Water bills',
      amount: 100,
      date: mmDaysAgoISO(9),
      paymentMethod: 'M-Pesa'
    },
    {
      id: 'exp_04',
      description: 'Cashier wage – demo period',
      category: 'Salaries',
      amount: 400,
      date: mmDaysAgoISO(4),
      paymentMethod: 'Bank transfer'
    },
    {
      id: 'exp_05',
      description: 'Goods delivery transport',
      category: 'Transport',
      amount: 150,
      date: mmDaysAgoISO(3),
      paymentMethod: 'Cash'
    },
    {
      id: 'exp_06',
      description: 'Safaricom Fibre internet',
      category: 'Internet',
      amount: 200,
      date: mmDaysAgoISO(6),
      paymentMethod: 'M-Pesa'
    },
    {
      id: 'exp_07',
      description: 'Fridge maintenance',
      category: 'Maintenance',
      amount: 200,
      date: mmDaysAgoISO(15),
      paymentMethod: 'Cash'
    }
  ];

  const settings = {
    supermarketName: 'MiniMart Supermarket',
    logoDataUrl: '',
    currency: 'KES',
    phone: '+254 712 345 678',
    email: 'info@minimart.co.ke',
    address: 'Moi Avenue, Nairobi, Kenya',
    receiptFooter: 'Thank you for shopping at MiniMart! Karibu tena.',
    taxRate: 0
  };

  return { users, products, suppliers, customers, purchases, sales, expenses, settings };
}

function mmInitializeData(force) {
  const already = localStorage.getItem(MM_STORAGE_KEYS.INITIALIZED) === 'true';
  if (already && !force) return false;

  const data = mmBuildSampleData();
  mmSaveUsers(data.users);
  mmSaveProducts(data.products);
  mmSaveSuppliers(data.suppliers);
  mmSaveCustomers(data.customers);
  mmSavePurchases(data.purchases);
  mmSaveSales(data.sales);
  mmSaveExpenses(data.expenses);
  mmSaveSettings(data.settings);
  localStorage.setItem(MM_STORAGE_KEYS.INITIALIZED, 'true');
  return true;
}

async function mmResetDemoData() {
  await mmApi('seed', { method: 'POST', body: {} });
  await mmLoadWorkspace();
}

function mmBuildLegacyExport() {
  const readList = (key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error(`Legacy data "${key}" is not a list.`);
    return value;
  };
  const rawSettings = localStorage.getItem(MM_STORAGE_KEYS.SETTINGS);
  const settings = rawSettings ? JSON.parse(rawSettings) : undefined;
  if (settings !== undefined && (!settings || Array.isArray(settings) || typeof settings !== 'object')) {
    throw new Error('Legacy business settings are invalid.');
  }
  return {
    format: 'minimart-localstorage-v1',
    exportedAt: new Date().toISOString(),
    products: readList(MM_STORAGE_KEYS.PRODUCTS),
    suppliers: readList(MM_STORAGE_KEYS.SUPPLIERS),
    customers: readList(MM_STORAGE_KEYS.CUSTOMERS),
    sales: readList(MM_STORAGE_KEYS.SALES),
    purchases: readList(MM_STORAGE_KEYS.PURCHASES),
    expenses: readList(MM_STORAGE_KEYS.EXPENSES),
    ...(settings ? { settings } : {})
  };
}

function mmDownloadLegacyExport() {
  const data = mmBuildLegacyExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `minimart-legacy-${mmTodayISO()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
