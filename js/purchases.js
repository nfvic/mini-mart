/**
 * Purchase management — increases stock on save
 */

let purchaseLines = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!mmRequirePage('purchases', 'Purchase Management')) return;

  document.getElementById('purchasePayment').innerHTML = MM_PAYMENT_METHODS.map(
    (m) => `<option value="${m}">${m}</option>`
  ).join('');

  document.getElementById('purchaseSupplier').innerHTML = mmGetSuppliers()
    .map((s) => `<option value="${s.id}">${s.name}</option>`)
    .join('');

  document.getElementById('btnNewPurchase').addEventListener('click', openPurchaseModal);
  document.getElementById('btnAddPurchaseLine').addEventListener('click', () => {
    purchaseLines.push({ productId: '', qty: 1, buyingPrice: 0 });
    renderPurchaseLines();
  });
  document.getElementById('purchaseForm').addEventListener('submit', savePurchase);
  document.getElementById('purchaseSearch').addEventListener('input', renderPurchases);

  renderPurchases();
});

function renderPurchases() {
  const q = document.getElementById('purchaseSearch').value.trim().toLowerCase();
  let list = [...mmGetPurchases()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (q) {
    list = list.filter(
      (p) =>
        p.purchaseNo.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById('purchasesTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7">${mmEmptyState('No purchases found.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (p) => `
    <tr>
      <td>${p.purchaseNo}</td>
      <td>${mmFormatDate(p.date)}</td>
      <td>${p.supplierName}</td>
      <td>${(p.items || []).length}</td>
      <td>${p.paymentMethod}</td>
      <td>${mmFormatMoney(p.total)}</td>
      <td>${p.notes || '—'}</td>
    </tr>`
    )
    .join('');
}

function openPurchaseModal() {
  document.getElementById('purchaseForm').reset();
  document.getElementById('purchaseDate').value = mmTodayISO();
  purchaseLines = [{ productId: '', qty: 1, buyingPrice: 0 }];
  renderPurchaseLines();
  mmOpenModal('purchaseModal');
}

function productOptions(selected) {
  return (
    '<option value="">Select product</option>' +
    mmGetProducts()
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${p.name} (${p.code})</option>`
      )
      .join('')
  );
}

function renderPurchaseLines() {
  const host = document.getElementById('purchaseLines');
  host.innerHTML = purchaseLines
    .map(
      (line, idx) => `
    <div class="grid grid-3 mb-2" style="align-items:end">
      <div class="form-group mb-0">
        <label>Product</label>
        <select class="form-control" data-pl-product="${idx}">${productOptions(line.productId)}</select>
      </div>
      <div class="form-group mb-0">
        <label>Quantity</label>
        <input type="number" min="1" class="form-control" data-pl-qty="${idx}" value="${line.qty}" />
      </div>
      <div class="form-group mb-0">
        <label>Buying price</label>
        <div style="display:flex;gap:6px">
          <input type="number" min="0" step="0.01" class="form-control" data-pl-price="${idx}" value="${line.buyingPrice}" />
          <button type="button" class="btn btn-sm btn-danger" data-pl-rm="${idx}">×</button>
        </div>
      </div>
    </div>`
    )
    .join('');

  host.querySelectorAll('[data-pl-product]').forEach((el) => {
    el.addEventListener('change', () => {
      const i = Number(el.getAttribute('data-pl-product'));
      purchaseLines[i].productId = el.value;
      const p = mmGetProductById(el.value);
      if (p) {
        purchaseLines[i].buyingPrice = Number(p.buyingPrice);
        renderPurchaseLines();
      } else updatePurchaseTotal();
    });
  });
  host.querySelectorAll('[data-pl-qty]').forEach((el) => {
    el.addEventListener('input', () => {
      const i = Number(el.getAttribute('data-pl-qty'));
      purchaseLines[i].qty = Number(el.value) || 0;
      updatePurchaseTotal();
    });
  });
  host.querySelectorAll('[data-pl-price]').forEach((el) => {
    el.addEventListener('input', () => {
      const i = Number(el.getAttribute('data-pl-price'));
      purchaseLines[i].buyingPrice = Number(el.value) || 0;
      updatePurchaseTotal();
    });
  });
  host.querySelectorAll('[data-pl-rm]').forEach((el) => {
    el.addEventListener('click', () => {
      const i = Number(el.getAttribute('data-pl-rm'));
      purchaseLines.splice(i, 1);
      if (!purchaseLines.length) purchaseLines.push({ productId: '', qty: 1, buyingPrice: 0 });
      renderPurchaseLines();
    });
  });
  updatePurchaseTotal();
}

function updatePurchaseTotal() {
  const total = purchaseLines.reduce(
    (sum, l) => sum + Number(l.qty || 0) * Number(l.buyingPrice || 0),
    0
  );
  document.getElementById('purchaseTotal').textContent = mmFormatMoney(total);
  return total;
}

function nextPurchaseNo() {
  const n = mmGetPurchases().length + 1;
  return 'PO-' + new Date().getFullYear() + '-' + String(n).padStart(3, '0');
}

function savePurchase(e) {
  e.preventDefault();
  const supplierId = document.getElementById('purchaseSupplier').value;
  const supplier = mmGetSuppliers().find((s) => s.id === supplierId);
  if (!supplier) {
    mmShowToast('Select a supplier.', 'error');
    return;
  }

  const validLines = purchaseLines.filter((l) => l.productId && Number(l.qty) > 0);
  if (!validLines.length) {
    mmShowToast('Add at least one purchase line.', 'error');
    return;
  }

  const items = validLines.map((l) => {
    const p = mmGetProductById(l.productId);
    return {
      productId: l.productId,
      productName: p ? p.name : 'Unknown',
      qty: Number(l.qty),
      buyingPrice: Number(l.buyingPrice)
    };
  });

  const total = items.reduce((sum, i) => sum + i.qty * i.buyingPrice, 0);
  const purchase = {
    id: mmGenerateId('pur'),
    purchaseNo: nextPurchaseNo(),
    supplierId: supplier.id,
    supplierName: supplier.name,
    date: document.getElementById('purchaseDate').value || mmTodayISO(),
    paymentMethod: document.getElementById('purchasePayment').value,
    notes: document.getElementById('purchaseNotes').value.trim(),
    items,
    total
  };

  // Increase stock & optionally sync buying price
  items.forEach((item) => {
    mmUpdateProductStock(item.productId, item.qty);
    const products = mmGetProducts();
    const idx = products.findIndex((p) => p.id === item.productId);
    if (idx !== -1) {
      products[idx].buyingPrice = item.buyingPrice;
      mmSaveProducts(products);
    }
  });

  const purchases = mmGetPurchases();
  purchases.push(purchase);
  mmSavePurchases(purchases);

  mmCloseModal('purchaseModal');
  mmShowToast('Purchase saved. Stock updated.', 'success');
  renderPurchases();
}
