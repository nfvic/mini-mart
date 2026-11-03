/**
 * Dashboard — dynamic stats from LocalStorage
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = mmRequirePage('dashboard', 'Dashboard');
  if (!user) return;
  renderQuickActions(user);
  renderStats();
  renderCharts();
  renderFeeds();
});

function renderQuickActions(user) {
  const host = document.getElementById('quickActions');
  const actions = [];
  if (mmCanAccess('sales')) actions.push({ href: 'sales.html', label: 'New Sale (POS)', className: 'btn-primary' });
  if (mmCanAccess('purchases')) actions.push({ href: 'purchases.html', label: 'Record Purchase', className: 'btn-success' });
  if (mmCanAccess('products')) actions.push({ href: 'products.html', label: 'Add Product', className: 'btn-secondary' });
  if (mmCanAccess('expenses')) actions.push({ href: 'expenses.html', label: 'Add Expense', className: 'btn-secondary' });
  if (mmCanAccess('reports')) actions.push({ href: 'reports.html', label: 'View Reports', className: 'btn-outline' });
  host.innerHTML = actions
    .map((a) => `<a class="btn ${a.className}" href="${a.href}">${a.label}</a>`)
    .join('');
}

function renderStats() {
  const today = mmTodayISO();
  const sales = mmGetSales().filter((s) => s.status === 'completed');
  const products = mmGetProducts();
  const expenses = mmGetExpenses();
  const purchases = mmGetPurchases();

  const salesToday = sales
    .filter((s) => mmIsSameDay(s.date, today))
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  const salesMonth = sales
    .filter((s) => mmIsSameMonth(s.date))
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  const purchaseTotal = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  let revenue = 0;
  let cogs = 0;
  sales.forEach((s) => {
    const t = mmCalcSaleTotals(s);
    revenue += t.revenue;
    cogs += t.cogs;
  });
  const gross = revenue - cogs;
  const net = gross - expenseTotal;

  const lowStock = products.filter(
    (p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock)
  ).length;

  const cards = [
    { label: 'Total sales today', value: mmFormatMoney(salesToday), meta: 'Completed POS transactions' },
    { label: 'Total sales this month', value: mmFormatMoney(salesMonth), meta: new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' }) },
    { label: 'Total purchases', value: mmFormatMoney(purchaseTotal), meta: purchases.length + ' purchase orders' },
    { label: 'Total expenses', value: mmFormatMoney(expenseTotal), meta: 'Operating expenses only' },
    { label: 'Total products', value: String(products.length), meta: 'SKU catalogue' },
    { label: 'Low-stock products', value: String(lowStock), meta: 'Below minimum level' },
    { label: 'Gross profit', value: mmFormatMoney(gross), meta: 'Revenue − COGS' },
    { label: 'Net profit', value: mmFormatMoney(net), meta: 'Gross − operating expenses' }
  ];

  document.getElementById('statGrid').innerHTML = cards
    .map(
      (c) => `
      <article class="stat-card">
        <div class="stat-label">${c.label}</div>
        <p class="stat-value">${c.value}</p>
        <div class="stat-meta">${c.meta}</div>
      </article>`
    )
    .join('');
}

function renderCharts() {
  const sales = mmGetSales().filter((s) => s.status === 'completed');

  const dailyLabels = [];
  const dailyValues = [];
  for (let i = 6; i >= 0; i--) {
    const iso = mmDaysAgoISO(i);
    dailyLabels.push(
      new Date(iso + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short' })
    );
    dailyValues.push(
      sales
        .filter((s) => mmIsSameDay(s.date, iso))
        .reduce((sum, s) => sum + Number(s.total || 0), 0)
    );
  }
  mmSimpleBarChart('dailySalesChart', dailyLabels, dailyValues, '#1e3a5f');

  const year = new Date().getFullYear();
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthValues = monthLabels.map((_, idx) =>
    sales
      .filter((s) => {
        const d = new Date(String(s.date).slice(0, 10) + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === idx;
      })
      .reduce((sum, s) => sum + Number(s.total || 0), 0)
  );
  const currentMonth = new Date().getMonth();
  mmSimpleLineChart(
    'monthlyRevenueChart',
    monthLabels.slice(0, currentMonth + 1),
    monthValues.slice(0, currentMonth + 1),
    '#2d6a4f'
  );
}

function renderFeeds() {
  const sales = [...mmGetSales()]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))
    .slice(0, 5);

  document.getElementById('recentSales').innerHTML = sales.length
    ? sales
        .map(
          (s) => `
      <div class="feed-item">
        <div>
          <strong>${s.receiptNo}</strong>
          <span>${s.customerName} · ${mmFormatDate(s.date)}</span>
        </div>
        <strong>${mmFormatMoney(s.total)}</strong>
      </div>`
        )
        .join('')
    : mmEmptyState('No sales yet.');

  const purchases = [...mmGetPurchases()]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  document.getElementById('recentPurchases').innerHTML = purchases.length
    ? purchases
        .map(
          (p) => `
      <div class="feed-item">
        <div>
          <strong>${p.purchaseNo}</strong>
          <span>${p.supplierName} · ${mmFormatDate(p.date)}</span>
        </div>
        <strong>${mmFormatMoney(p.total)}</strong>
      </div>`
        )
        .join('')
    : mmEmptyState('No purchases yet.');

  const alerts = mmGetProducts().filter(
    (p) => Number(p.stock) <= Number(p.minStock)
  );

  document.getElementById('lowStockAlerts').innerHTML = alerts.length
    ? alerts
        .map(
          (p) => `
      <div class="alert-item ${Number(p.stock) <= 0 ? 'danger' : ''}">
        <span>${p.name}</span>
        <strong>${p.stock} left</strong>
      </div>`
        )
        .join('')
    : '<div class="empty-state">All stock levels look healthy.</div>';
}
