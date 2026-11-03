/**
 * Accounting module — revenue, COGS, gross/net profit
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!mmRequirePage('accounting', 'Accounting')) return;

  const from = document.getElementById('accFrom');
  const to = document.getElementById('accTo');
  from.value = mmDaysAgoISO(30);
  to.value = mmTodayISO();

  document.getElementById('btnAccRefresh').addEventListener('click', renderAccounting);
  from.addEventListener('change', renderAccounting);
  to.addEventListener('change', renderAccounting);

  renderAccounting();
});

function renderAccounting() {
  const from = document.getElementById('accFrom').value || null;
  const to = document.getElementById('accTo').value || null;
  const summary = mmGetAccountingSummary(from, to);

  document.getElementById('financeCards').innerHTML = [
    { label: 'Total revenue', value: mmFormatMoney(summary.revenue) },
    { label: 'Cost of goods sold', value: mmFormatMoney(summary.cogs) },
    { label: 'Gross profit', value: mmFormatMoney(summary.grossProfit) },
    { label: 'Operating expenses', value: mmFormatMoney(summary.operatingExpenses) },
    { label: 'Net profit', value: mmFormatMoney(summary.netProfit) },
    { label: 'Closing stock (cost)', value: mmFormatMoney(summary.closingStock) }
  ]
    .map(
      (c) => `
    <article class="finance-card">
      <h4>${c.label}</h4>
      <div class="value">${c.value}</div>
    </article>`
    )
    .join('');

  document.getElementById('incomeTable').innerHTML = `
    <tbody>
      <tr><td>Sales revenue</td><td class="text-right">${mmFormatMoney(summary.revenue)}</td></tr>
      <tr><td>Less: Cost of goods sold</td><td class="text-right">${mmFormatMoney(summary.cogs)}</td></tr>
      <tr><td><strong>Gross profit</strong></td><td class="text-right"><strong>${mmFormatMoney(summary.grossProfit)}</strong></td></tr>
      <tr><td>Less: Operating expenses</td><td class="text-right">${mmFormatMoney(summary.operatingExpenses)}</td></tr>
      <tr><td><strong>Net profit</strong></td><td class="text-right"><strong class="${summary.netProfit >= 0 ? 'text-success' : 'text-danger'}">${mmFormatMoney(summary.netProfit)}</strong></td></tr>
    </tbody>`;

  const expenses = mmGetExpenses().filter((e) => mmInDateRange(e.date, from, to));
  const byCat = {};
  expenses.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
  });
  const expenseRows = Object.keys(byCat)
    .sort()
    .map((k) => `<tr><td>${k}</td><td class="text-right">${mmFormatMoney(byCat[k])}</td></tr>`)
    .join('');

  document.getElementById('expenseSummaryTable').innerHTML = `
    <thead><tr><th>Category</th><th class="text-right">Amount</th></tr></thead>
    <tbody>
      ${expenseRows || '<tr><td colspan="2">No expenses in range.</td></tr>'}
      <tr><td><strong>Total</strong></td><td class="text-right"><strong>${mmFormatMoney(summary.operatingExpenses)}</strong></td></tr>
    </tbody>`;

  document.getElementById('salesSummary').innerHTML = `
    <div class="list-feed">
      <div class="feed-item"><div><strong>Completed sales</strong><span>In selected period</span></div><strong>${summary.salesCount}</strong></div>
      <div class="feed-item"><div><strong>Revenue</strong><span>From POS</span></div><strong>${mmFormatMoney(summary.revenue)}</strong></div>
      <div class="feed-item"><div><strong>COGS</strong><span>Buying cost of sold items</span></div><strong>${mmFormatMoney(summary.cogs)}</strong></div>
      <div class="feed-item"><div><strong>Gross margin</strong><span>On sales</span></div><strong>${mmFormatMoney(summary.grossProfit)}</strong></div>
    </div>`;

  document.getElementById('purchaseInventorySummary').innerHTML = `
    <div class="list-feed">
      <div class="feed-item"><div><strong>Purchases (inventory)</strong><span>${summary.purchaseCount} orders · not an operating expense</span></div><strong>${mmFormatMoney(summary.purchaseTotal)}</strong></div>
      <div class="feed-item"><div><strong>Inventory at cost</strong><span>Closing stock valuation</span></div><strong>${mmFormatMoney(summary.inventoryValueCost)}</strong></div>
      <div class="feed-item"><div><strong>Inventory at retail</strong><span>Potential sales value</span></div><strong>${mmFormatMoney(summary.inventoryValueRetail)}</strong></div>
      <div class="feed-item"><div><strong>Products / low stock</strong><span>Catalogue health</span></div><strong>${summary.productCount} / ${summary.lowStockCount}</strong></div>
    </div>
    <p class="text-muted mt-2" style="font-size:.85rem">
      Closing stock reflects current quantities after purchases and sales.
      Opening stock + purchases − goods sold is represented by the live inventory valuation.
    </p>`;
}
