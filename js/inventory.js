/**
 * Inventory management view
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await mmPreparePage('inventory', 'Inventory Management'))) return;

  document.getElementById('invCategory').innerHTML =
    '<option value="">All categories</option>' +
    MM_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');

  ['invSearch', 'invFilter', 'invCategory'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderInventory);
    document.getElementById(id).addEventListener('change', renderInventory);
  });

  renderInventory();
});

function renderInventory() {
  const products = mmGetProducts();
  const low = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock));
  const out = products.filter((p) => Number(p.stock) <= 0);
  const costVal = products.reduce((s, p) => s + Number(p.stock) * Number(p.buyingPrice), 0);
  const retailVal = products.reduce((s, p) => s + Number(p.stock) * Number(p.sellingPrice), 0);

  document.getElementById('inventoryStats').innerHTML = [
    { label: 'SKUs tracked', value: products.length },
    { label: 'Low stock', value: low.length },
    { label: 'Out of stock', value: out.length },
    { label: 'Inventory valuation (cost)', value: mmFormatMoney(costVal) },
    { label: 'Inventory valuation (retail)', value: mmFormatMoney(retailVal) },
    { label: 'Potential margin', value: mmFormatMoney(retailVal - costVal) },
    { label: 'Units in store', value: products.reduce((s, p) => s + Number(p.stock), 0) },
    { label: 'Categories', value: new Set(products.map((p) => p.category)).size }
  ]
    .slice(0, 8)
    .map(
      (c) => `
    <article class="stat-card">
      <div class="stat-label">${c.label}</div>
      <p class="stat-value">${c.value}</p>
    </article>`
    )
    .join('');

  const q = document.getElementById('invSearch').value.trim().toLowerCase();
  const filter = document.getElementById('invFilter').value;
  const cat = document.getElementById('invCategory').value;

  let list = [...products];
  if (cat) list = list.filter((p) => p.category === cat);
  if (q) {
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }
  if (filter === 'low') list = list.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock));
  if (filter === 'out') list = list.filter((p) => Number(p.stock) <= 0);
  if (filter === 'ok') list = list.filter((p) => Number(p.stock) > Number(p.minStock));

  const tbody = document.getElementById('inventoryTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8">${mmEmptyState('No inventory rows match your filters.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (p) => `
    <tr>
      <td><code>${p.code}</code></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td><strong>${p.stock}</strong> ${p.unit || ''}</td>
      <td>${p.minStock}</td>
      <td>${mmFormatMoney(Number(p.stock) * Number(p.buyingPrice))}</td>
      <td>${mmFormatMoney(Number(p.stock) * Number(p.sellingPrice))}</td>
      <td>${mmStockBadge(p)}</td>
    </tr>`
    )
    .join('');
}
