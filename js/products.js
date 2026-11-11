/**
 * Product management
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await mmPreparePage('products', 'Product Management'))) return;

  const catSelect = document.getElementById('categoryFilter');
  const formCat = document.getElementById('productCategory');
  const opts = ['<option value="">All categories</option>']
    .concat(MM_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`))
    .join('');
  catSelect.innerHTML = opts;
  formCat.innerHTML = MM_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('productSearch').addEventListener('input', renderProducts);
  catSelect.addEventListener('change', renderProducts);
  document.getElementById('btnAddProduct').addEventListener('click', () => openProductModal());
  document.getElementById('productForm').addEventListener('submit', saveProduct);

  renderProducts();
});

function renderProducts() {
  const q = document.getElementById('productSearch').value.trim().toLowerCase();
  const cat = document.getElementById('categoryFilter').value;
  let products = mmGetProducts();

  if (cat) products = products.filter((p) => p.category === cat);
  if (q) {
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById('productsTable');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="9">${mmEmptyState('No products found.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td><code>${p.code}</code></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${mmFormatMoney(p.buyingPrice)}</td>
      <td>${mmFormatMoney(p.sellingPrice)}</td>
      <td>${p.stock}</td>
      <td>${p.minStock}</td>
      <td>${mmStockBadge(p)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-secondary" data-edit="${p.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-del="${p.id}">Delete</button>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openProductModal(btn.getAttribute('data-edit')));
  });
  tbody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteProduct(btn.getAttribute('data-del')));
  });
}

function openProductModal(id) {
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModalTitle').textContent = id ? 'Edit product' : 'Add product';

  if (id) {
    const p = mmGetProductById(id);
    if (!p) return;
    document.getElementById('productId').value = p.id;
    document.getElementById('productCode').value = p.code;
    document.getElementById('productName').value = p.name;
    document.getElementById('productCategory').value = p.category;
    document.getElementById('buyingPrice').value = p.buyingPrice;
    document.getElementById('sellingPrice').value = p.sellingPrice;
    document.getElementById('stockQty').value = p.stock;
    document.getElementById('minStock').value = p.minStock;
    document.getElementById('productUnit').value = p.unit || '';
  } else {
    document.getElementById('productCode').value = mmGenerateCode('MM', 5);
    document.getElementById('minStock').value = 10;
    document.getElementById('stockQty').value = 0;
  }
  mmOpenModal('productModal');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const buying = Number(document.getElementById('buyingPrice').value);
  const selling = Number(document.getElementById('sellingPrice').value);
  const stock = Number(document.getElementById('stockQty').value);
  const minStock = Number(document.getElementById('minStock').value);
  const code = document.getElementById('productCode').value.trim();
  const name = document.getElementById('productName').value.trim();

  if (!code || !name) {
    mmShowToast('Code and name are required.', 'error');
    return;
  }
  if (selling < buying) {
    mmShowToast('Selling price should not be below buying price.', 'error');
    return;
  }

  const products = mmGetProducts();
  const duplicate = products.find(
    (p) => p.code.toLowerCase() === code.toLowerCase() && p.id !== id
  );
  if (duplicate) {
    mmShowToast('Product code already exists.', 'error');
    return;
  }

  const payload = {
    code,
    name,
    category: document.getElementById('productCategory').value,
    buyingPrice: buying,
    sellingPrice: selling,
    stock,
    minStock,
    unit: document.getElementById('productUnit').value.trim() || 'unit'
  };
  if (id) payload.id = id;

  try {
    const item = await mmPersist('products', payload, !id);
    mmSaveProducts(mmUpsert(mmGetProducts(), item).sort((a, b) => a.name.localeCompare(b.name)));
    mmShowToast(id ? 'Product updated.' : 'Product added.', 'success');
    mmCloseModal('productModal');
    renderProducts();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  const p = mmGetProductById(id);
  if (!p) return;
  if (!mmConfirm(`Delete product "${p.name}"? This cannot be undone.`)) return;
  try {
    await mmRemoveRecord('products', id);
    mmSaveProducts(mmGetProducts().filter((x) => x.id !== id));
    mmShowToast('Product deleted.', 'success');
    renderProducts();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}
