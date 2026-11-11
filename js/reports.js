/**
 * Reports & analytics
 */

const REPORT_TYPES = [
  { key: 'daily', label: 'Daily sales' },
  { key: 'weekly', label: 'Weekly sales' },
  { key: 'monthly', label: 'Monthly sales' },
  { key: 'annual', label: 'Annual sales' },
  { key: 'purchases', label: 'Purchase report' },
  { key: 'expenses', label: 'Expense report' },
  { key: 'inventory', label: 'Inventory report' },
  { key: 'lowstock', label: 'Low-stock report' },
  { key: 'pnl', label: 'Profit & loss' },
  { key: 'cashflow', label: 'Cash flow summary' },
  { key: 'customers', label: 'Customer report' },
  { key: 'suppliers', label: 'Supplier report' }
];

let activeReport = 'daily';
let lastExportRows = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await mmPreparePage('reports', 'Reports & Analytics'))) return;

  document.getElementById('reportFrom').value = mmDaysAgoISO(30);
  document.getElementById('reportTo').value = mmTodayISO();

  document.getElementById('reportTabs').innerHTML = REPORT_TYPES.map(
    (r) => `<button type="button" class="report-tab ${r.key === activeReport ? 'active' : ''}" data-report="${r.key}">${r.label}</button>`
  ).join('');

  document.getElementById('reportTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-report]');
    if (!btn) return;
    activeReport = btn.getAttribute('data-report');
    document.querySelectorAll('.report-tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    runReport();
  });

  document.getElementById('btnRunReport').addEventListener('click', runReport);
  document.getElementById('reportSearch').addEventListener('input', runReport);
  document.getElementById('btnPrintReport').addEventListener('click', () => {
    mmPrintElement('reportPrintArea', 'MiniMart Report');
  });
  document.getElementById('btnExportCSV').addEventListener('click', () => {
    mmExportCSV(`minimart-${activeReport}-report.csv`, lastExportRows);
  });

  runReport();
});

function periodBounds() {
  return {
    from: document.getElementById('reportFrom').value || null,
    to: document.getElementById('reportTo').value || null,
    q: document.getElementById('reportSearch').value.trim().toLowerCase()
  };
}

function setTable(headers, rowsHtml) {
  document.getElementById('reportHead').innerHTML =
    '<tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr>';
  document.getElementById('reportBody').innerHTML = rowsHtml;
}

function setSummary(cards) {
  document.getElementById('reportSummary').innerHTML = cards
    .map(
      (c) => `
    <article class="finance-card">
      <h4>${c.label}</h4>
      <div class="value">${c.value}</div>
    </article>`
    )
    .join('');
}

function completedSalesInRange(from, to) {
  return mmGetSales().filter(
    (s) => s.status === 'completed' && mmInDateRange(s.date, from, to)
  );
}

function runReport() {
  const { from, to, q } = periodBounds();
  const title = REPORT_TYPES.find((r) => r.key === activeReport)?.label || 'Report';
  document.getElementById('reportTitle').textContent = title;
  document.getElementById('reportChartTitle').textContent = title + ' overview';

  switch (activeReport) {
    case 'daily':
      return salesPeriodReport(from, to, q, 'day');
    case 'weekly':
      return salesPeriodReport(mmDaysAgoISO(7), to || mmTodayISO(), q, 'week');
    case 'monthly':
      return salesPeriodReport(from, to, q, 'month');
    case 'annual':
      return salesPeriodReport(`${new Date().getFullYear()}-01-01`, to || mmTodayISO(), q, 'year');
    case 'purchases':
      return purchasesReport(from, to, q);
    case 'expenses':
      return expensesReport(from, to, q);
    case 'inventory':
      return inventoryReport(q);
    case 'lowstock':
      return lowStockReport(q);
    case 'pnl':
      return pnlReport(from, to);
    case 'cashflow':
      return cashflowReport(from, to);
    case 'customers':
      return customersReport(q);
    case 'suppliers':
      return suppliersReport(q);
    default:
      break;
  }
}

function salesPeriodReport(from, to, q, mode) {
  let sales = completedSalesInRange(from, to);
  if (q) {
    sales = sales.filter(
      (s) =>
        s.receiptNo.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q)
    );
  }
  const total = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  setSummary([
    { label: 'Transactions', value: sales.length },
    { label: 'Sales total', value: mmFormatMoney(total) },
    { label: 'Period mode', value: mode },
    { label: 'Average ticket', value: mmFormatMoney(sales.length ? total / sales.length : 0) }
  ]);

  // Chart by day in range
  const labels = [];
  const values = [];
  const start = new Date((from || mmDaysAgoISO(6)) + 'T00:00:00');
  const end = new Date((to || mmTodayISO()) + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    labels.push(iso.slice(5));
    values.push(
      sales.filter((s) => mmIsSameDay(s.date, iso)).reduce((sum, s) => sum + Number(s.total), 0)
    );
  }
  mmSimpleBarChart('reportChart', labels.slice(-14), values.slice(-14));

  lastExportRows = sales.map((s) => ({
    Receipt: s.receiptNo,
    Date: s.date,
    Customer: s.customerName,
    Payment: s.paymentMethod,
    Total: s.total
  }));

  setTable(
    ['Receipt', 'Date', 'Customer', 'Payment', 'Total'],
    sales
      .map(
        (s) =>
          `<tr><td>${s.receiptNo}</td><td>${mmFormatDate(s.date)}</td><td>${s.customerName}</td><td>${s.paymentMethod}</td><td>${mmFormatMoney(s.total)}</td></tr>`
      )
      .join('') || `<tr><td colspan="5">${mmEmptyState('No sales in this period.')}</td></tr>`
  );
}

function purchasesReport(from, to, q) {
  let list = mmGetPurchases().filter((p) => mmInDateRange(p.date, from, to));
  if (q) {
    list = list.filter(
      (p) =>
        p.purchaseNo.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q)
    );
  }
  const total = list.reduce((sum, p) => sum + Number(p.total || 0), 0);
  setSummary([
    { label: 'Purchase orders', value: list.length },
    { label: 'Purchase total', value: mmFormatMoney(total) },
    { label: 'Note', value: 'Inventory asset' },
    { label: 'Suppliers', value: new Set(list.map((p) => p.supplierId)).size }
  ]);
  mmSimpleBarChart(
    'reportChart',
    list.slice(-8).map((p) => p.purchaseNo.slice(-3)),
    list.slice(-8).map((p) => Number(p.total))
  );
  lastExportRows = list.map((p) => ({
    PurchaseNo: p.purchaseNo,
    Date: p.date,
    Supplier: p.supplierName,
    Payment: p.paymentMethod,
    Total: p.total
  }));
  setTable(
    ['Purchase No', 'Date', 'Supplier', 'Payment', 'Total'],
    list
      .map(
        (p) =>
          `<tr><td>${p.purchaseNo}</td><td>${mmFormatDate(p.date)}</td><td>${p.supplierName}</td><td>${p.paymentMethod}</td><td>${mmFormatMoney(p.total)}</td></tr>`
      )
      .join('') || `<tr><td colspan="5">${mmEmptyState('No purchases found.')}</td></tr>`
  );
}

function expensesReport(from, to, q) {
  let list = mmGetExpenses().filter((e) => mmInDateRange(e.date, from, to));
  if (q) {
    list = list.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }
  const total = list.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  setSummary([
    { label: 'Expense records', value: list.length },
    { label: 'Total expenses', value: mmFormatMoney(total) },
    { label: 'Type', value: 'Operating only' },
    { label: 'Categories', value: new Set(list.map((e) => e.category)).size }
  ]);
  mmSimpleBarChart(
    'reportChart',
    list.slice(-8).map((e) => e.category.slice(0, 8)),
    list.slice(-8).map((e) => Number(e.amount))
  );
  lastExportRows = list.map((e) => ({
    Date: e.date,
    Description: e.description,
    Category: e.category,
    Payment: e.paymentMethod,
    Amount: e.amount
  }));
  setTable(
    ['Date', 'Description', 'Category', 'Payment', 'Amount'],
    list
      .map(
        (e) =>
          `<tr><td>${mmFormatDate(e.date)}</td><td>${e.description}</td><td>${e.category}</td><td>${e.paymentMethod}</td><td>${mmFormatMoney(e.amount)}</td></tr>`
      )
      .join('') || `<tr><td colspan="5">${mmEmptyState('No expenses found.')}</td></tr>`
  );
}

function inventoryReport(q) {
  let list = mmGetProducts();
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  const cost = list.reduce((s, p) => s + Number(p.stock) * Number(p.buyingPrice), 0);
  const retail = list.reduce((s, p) => s + Number(p.stock) * Number(p.sellingPrice), 0);
  setSummary([
    { label: 'Products', value: list.length },
    { label: 'Cost valuation', value: mmFormatMoney(cost) },
    { label: 'Retail valuation', value: mmFormatMoney(retail) },
    { label: 'Units', value: list.reduce((s, p) => s + Number(p.stock), 0) }
  ]);
  mmSimpleBarChart(
    'reportChart',
    list.slice(0, 10).map((p) => p.name.slice(0, 8)),
    list.slice(0, 10).map((p) => Number(p.stock))
  );
  lastExportRows = list.map((p) => ({
    Code: p.code,
    Name: p.name,
    Category: p.category,
    Stock: p.stock,
    CostValue: Number(p.stock) * Number(p.buyingPrice),
    RetailValue: Number(p.stock) * Number(p.sellingPrice)
  }));
  setTable(
    ['Code', 'Name', 'Category', 'Stock', 'Cost value', 'Retail value'],
    list
      .map(
        (p) =>
          `<tr><td>${p.code}</td><td>${p.name}</td><td>${p.category}</td><td>${p.stock}</td><td>${mmFormatMoney(Number(p.stock) * Number(p.buyingPrice))}</td><td>${mmFormatMoney(Number(p.stock) * Number(p.sellingPrice))}</td></tr>`
      )
      .join('')
  );
}

function lowStockReport(q) {
  let list = mmGetProducts().filter((p) => Number(p.stock) <= Number(p.minStock));
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
  setSummary([
    { label: 'Alert items', value: list.length },
    { label: 'Out of stock', value: list.filter((p) => Number(p.stock) <= 0).length },
    { label: 'Low stock', value: list.filter((p) => Number(p.stock) > 0).length },
    { label: 'Action', value: 'Restock' }
  ]);
  mmSimpleBarChart(
    'reportChart',
    list.slice(0, 10).map((p) => p.name.slice(0, 8)),
    list.slice(0, 10).map((p) => Number(p.stock))
  );
  lastExportRows = list.map((p) => ({
    Code: p.code,
    Name: p.name,
    Stock: p.stock,
    MinStock: p.minStock,
    Status: Number(p.stock) <= 0 ? 'Out' : 'Low'
  }));
  setTable(
    ['Code', 'Name', 'Stock', 'Minimum', 'Status'],
    list
      .map(
        (p) =>
          `<tr><td>${p.code}</td><td>${p.name}</td><td>${p.stock}</td><td>${p.minStock}</td><td>${mmStockBadge(p)}</td></tr>`
      )
      .join('') || `<tr><td colspan="5">${mmEmptyState('No low-stock items.')}</td></tr>`
  );
}

function pnlReport(from, to) {
  const s = mmGetAccountingSummary(from, to);
  setSummary([
    { label: 'Revenue', value: mmFormatMoney(s.revenue) },
    { label: 'COGS', value: mmFormatMoney(s.cogs) },
    { label: 'Gross profit', value: mmFormatMoney(s.grossProfit) },
    { label: 'Net profit', value: mmFormatMoney(s.netProfit) }
  ]);
  mmSimpleBarChart(
    'reportChart',
    ['Revenue', 'COGS', 'Gross', 'Expenses', 'Net'],
    [s.revenue, s.cogs, s.grossProfit, s.operatingExpenses, Math.max(s.netProfit, 0)]
  );
  lastExportRows = [
    { Item: 'Sales revenue', Amount: s.revenue },
    { Item: 'Cost of goods sold', Amount: s.cogs },
    { Item: 'Gross profit', Amount: s.grossProfit },
    { Item: 'Operating expenses', Amount: s.operatingExpenses },
    { Item: 'Net profit', Amount: s.netProfit }
  ];
  setTable(
    ['Particulars', 'Amount (KES)'],
    lastExportRows
      .map((r) => `<tr><td>${r.Item}</td><td>${mmFormatMoney(r.Amount)}</td></tr>`)
      .join('')
  );
}

function cashflowReport(from, to) {
  const salesIn = completedSalesInRange(from, to).reduce((sum, s) => sum + Number(s.total), 0);
  const purchasesOut = mmGetPurchases()
    .filter((p) => mmInDateRange(p.date, from, to))
    .reduce((sum, p) => sum + Number(p.total), 0);
  const expensesOut = mmGetExpenses()
    .filter((e) => mmInDateRange(e.date, from, to))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const net = salesIn - purchasesOut - expensesOut;
  setSummary([
    { label: 'Cash in (sales)', value: mmFormatMoney(salesIn) },
    { label: 'Cash out (purchases)', value: mmFormatMoney(purchasesOut) },
    { label: 'Cash out (expenses)', value: mmFormatMoney(expensesOut) },
    { label: 'Net cash movement', value: mmFormatMoney(net) }
  ]);
  mmSimpleBarChart('reportChart', ['Sales in', 'Purchases', 'Expenses', 'Net'], [
    salesIn,
    purchasesOut,
    expensesOut,
    Math.max(net, 0)
  ]);
  lastExportRows = [
    { Flow: 'Sales receipts', Amount: salesIn },
    { Flow: 'Supplier payments (purchases)', Amount: purchasesOut },
    { Flow: 'Operating expenses', Amount: expensesOut },
    { Flow: 'Net cash movement', Amount: net }
  ];
  setTable(
    ['Cash flow item', 'Amount'],
    lastExportRows
      .map((r) => `<tr><td>${r.Flow}</td><td>${mmFormatMoney(r.Amount)}</td></tr>`)
      .join('')
  );
}

function customersReport(q) {
  let customers = mmGetCustomers();
  if (q) customers = customers.filter((c) => c.name.toLowerCase().includes(q));
  const sales = mmGetSales().filter((s) => s.status === 'completed');
  lastExportRows = customers.map((c) => {
    const custSales = sales.filter((s) => s.customerId === c.id);
    return {
      Name: c.name,
      Phone: c.phone,
      Orders: custSales.length,
      Spent: custSales.reduce((sum, s) => sum + Number(s.total), 0),
      Type: c.isWalkIn ? 'Walk-in' : 'Registered'
    };
  });
  setSummary([
    { label: 'Customers', value: customers.length },
    { label: 'Registered', value: customers.filter((c) => !c.isWalkIn).length },
    { label: 'Walk-in option', value: 'Available' },
    { label: 'Total spent', value: mmFormatMoney(lastExportRows.reduce((s, r) => s + r.Spent, 0)) }
  ]);
  mmSimpleBarChart(
    'reportChart',
    lastExportRows.slice(0, 8).map((r) => r.Name.slice(0, 8)),
    lastExportRows.slice(0, 8).map((r) => r.Spent)
  );
  setTable(
    ['Name', 'Phone', 'Orders', 'Total spent', 'Type'],
    lastExportRows
      .map(
        (r) =>
          `<tr><td>${r.Name}</td><td>${r.Phone}</td><td>${r.Orders}</td><td>${mmFormatMoney(r.Spent)}</td><td>${r.Type}</td></tr>`
      )
      .join('')
  );
}

function suppliersReport(q) {
  let suppliers = mmGetSuppliers();
  if (q) suppliers = suppliers.filter((s) => s.name.toLowerCase().includes(q));
  const purchases = mmGetPurchases();
  lastExportRows = suppliers.map((s) => {
    const rows = purchases.filter((p) => p.supplierId === s.id);
    return {
      Name: s.name,
      Phone: s.phone,
      Orders: rows.length,
      Total: rows.reduce((sum, p) => sum + Number(p.total), 0),
      Email: s.email || ''
    };
  });
  setSummary([
    { label: 'Suppliers', value: suppliers.length },
    { label: 'Purchase orders', value: purchases.length },
    { label: 'Spend total', value: mmFormatMoney(lastExportRows.reduce((s, r) => s + r.Total, 0)) },
    { label: 'Active suppliers', value: lastExportRows.filter((r) => r.Orders > 0).length }
  ]);
  mmSimpleBarChart(
    'reportChart',
    lastExportRows.map((r) => r.Name.slice(0, 10)),
    lastExportRows.map((r) => r.Total)
  );
  setTable(
    ['Name', 'Phone', 'Orders', 'Total purchased', 'Email'],
    lastExportRows
      .map(
        (r) =>
          `<tr><td>${r.Name}</td><td>${r.Phone}</td><td>${r.Orders}</td><td>${mmFormatMoney(r.Total)}</td><td>${r.Email}</td></tr>`
      )
      .join('')
  );
}
