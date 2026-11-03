/**
 * Point of Sale / Sales
 */

let cart = [];
let lastReceiptSale = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = mmRequirePage('sales', 'Point of Sale');
  if (!user) return;

  document.getElementById('paymentMethod').innerHTML = MM_PAYMENT_METHODS.map(
    (m) => `<option value="${m}">${m}</option>`
  ).join('');

  const customers = mmGetCustomers();
  document.getElementById('saleCustomer').innerHTML = customers
    .map((c) => `<option value="${c.id}">${c.name}${c.isWalkIn ? ' (default)' : ''}</option>`)
    .join('');

  document.getElementById('posSearch').addEventListener('input', renderPicker);
  document.getElementById('amountPaid').addEventListener('input', updateTotals);
  document.getElementById('btnClearCart').addEventListener('click', () => {
    cart = [];
    renderCart();
  });
  document.getElementById('btnCompleteSale').addEventListener('click', completeSale);
  document.getElementById('btnPrintReceipt').addEventListener('click', () => {
    mmPrintElement('receiptContent', 'MiniMart Receipt');
  });

  renderPicker();
  renderCart();
  renderSalesHistory();
});

function renderPicker() {
  const q = document.getElementById('posSearch').value.trim().toLowerCase();
  let products = mmGetProducts();
  if (q) {
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }

  const host = document.getElementById('productPicker');
  if (!products.length) {
    host.innerHTML = mmEmptyState('No products found.');
    return;
  }

  host.innerHTML = products
    .map((p) => {
      const out = Number(p.stock) <= 0;
      return `
      <button type="button" class="product-tile ${out ? 'disabled' : ''}" data-add="${p.id}" ${out ? 'disabled' : ''}>
        <div class="name">${p.name}</div>
        <div class="price">${mmFormatMoney(p.sellingPrice)}</div>
        <div class="stock">${out ? 'Out of stock' : `Stock: ${p.stock}`}</div>
      </button>`;
    })
    .join('');

  host.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.getAttribute('data-add')));
  });
}

function addToCart(productId) {
  const product = mmGetProductById(productId);
  if (!product) return;
  if (Number(product.stock) <= 0) {
    mmShowToast('This product is out of stock.', 'error');
    return;
  }

  const existing = cart.find((l) => l.productId === productId);
  const nextQty = existing ? existing.qty + 1 : 1;
  if (nextQty > Number(product.stock)) {
    mmShowToast('Cannot sell more than available stock.', 'error');
    return;
  }

  if (existing) existing.qty = nextQty;
  else {
    cart.push({
      productId: product.id,
      productName: product.name,
      buyingPrice: Number(product.buyingPrice),
      sellingPrice: Number(product.sellingPrice),
      qty: 1,
      maxStock: Number(product.stock)
    });
  }
  renderCart();
}

function changeQty(productId, delta) {
  const line = cart.find((l) => l.productId === productId);
  if (!line) return;
  const product = mmGetProductById(productId);
  const max = product ? Number(product.stock) : line.maxStock;
  const next = line.qty + delta;
  if (next <= 0) {
    cart = cart.filter((l) => l.productId !== productId);
  } else if (next > max) {
    mmShowToast('Quantity exceeds available stock.', 'error');
    return;
  } else {
    line.qty = next;
  }
  renderCart();
}

function removeLine(productId) {
  cart = cart.filter((l) => l.productId !== productId);
  renderCart();
}

function cartSubtotal() {
  return cart.reduce((sum, l) => sum + l.qty * l.sellingPrice, 0);
}

function renderCart() {
  const host = document.getElementById('cartLines');
  if (!cart.length) {
    host.innerHTML = mmEmptyState('Cart is empty. Select products to begin.');
  } else {
    host.innerHTML = cart
      .map(
        (l) => `
      <div class="cart-line">
        <div>
          <strong>${l.productName}</strong>
          <div class="text-muted">${mmFormatMoney(l.sellingPrice)} each</div>
          <div class="qty-controls mt-1">
            <button type="button" data-dec="${l.productId}">−</button>
            <span>${l.qty}</span>
            <button type="button" data-inc="${l.productId}">+</button>
            <button type="button" class="btn btn-sm btn-danger" data-rm="${l.productId}">Remove</button>
          </div>
        </div>
        <strong>${mmFormatMoney(l.qty * l.sellingPrice)}</strong>
      </div>`
      )
      .join('');

    host.querySelectorAll('[data-inc]').forEach((b) =>
      b.addEventListener('click', () => changeQty(b.getAttribute('data-inc'), 1))
    );
    host.querySelectorAll('[data-dec]').forEach((b) =>
      b.addEventListener('click', () => changeQty(b.getAttribute('data-dec'), -1))
    );
    host.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => removeLine(b.getAttribute('data-rm')))
    );
  }
  updateTotals();
}

function updateTotals() {
  const total = cartSubtotal();
  const paid = Number(document.getElementById('amountPaid').value || 0);
  const change = paid - total;
  document.getElementById('cartTotals').innerHTML = `
    <div class="row"><span>Subtotal</span><span>${mmFormatMoney(total)}</span></div>
    <div class="row grand"><span>Total</span><span>${mmFormatMoney(total)}</span></div>
  `;
  const changeEl = document.getElementById('changeDisplay');
  if (!cart.length) {
    changeEl.textContent = '';
    return;
  }
  if (paid <= 0) {
    changeEl.textContent = 'Enter amount paid to calculate change.';
    changeEl.className = 'text-muted';
  } else if (change < 0) {
    changeEl.textContent = `Balance due: ${mmFormatMoney(Math.abs(change))}`;
    changeEl.className = 'text-danger';
  } else {
    changeEl.textContent = `Customer change: ${mmFormatMoney(change)}`;
    changeEl.className = 'text-success';
  }
}

function nextReceiptNo() {
  const sales = mmGetSales();
  const n = sales.length + 1001;
  return 'RCP-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0');
}

function completeSale() {
  const user = mmGetCurrentUser();
  if (!cart.length) {
    mmShowToast('Cart is empty.', 'error');
    return;
  }

  // Re-validate stock
  for (const line of cart) {
    const product = mmGetProductById(line.productId);
    if (!product || Number(product.stock) < line.qty) {
      mmShowToast(`Insufficient stock for ${line.productName}.`, 'error');
      return;
    }
  }

  const total = cartSubtotal();
  const amountPaid = Number(document.getElementById('amountPaid').value || 0);
  if (amountPaid < total) {
    mmShowToast('Amount paid is less than the total.', 'error');
    return;
  }

  const customerId = document.getElementById('saleCustomer').value;
  const customer = mmGetCustomers().find((c) => c.id === customerId);

  const sale = {
    id: mmGenerateId('sale'),
    receiptNo: nextReceiptNo(),
    customerId: customer ? customer.id : 'cust_walkin',
    customerName: customer ? customer.name : 'Walk-in Customer',
    cashierId: user.id,
    cashierName: user.fullName,
    date: mmTodayISO(),
    createdAt: new Date().toISOString(),
    paymentMethod: document.getElementById('paymentMethod').value,
    amountPaid,
    change: amountPaid - total,
    status: 'completed',
    items: cart.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      qty: l.qty,
      buyingPrice: l.buyingPrice,
      sellingPrice: l.sellingPrice
    })),
    subtotal: total,
    total
  };

  // Decrease stock
  sale.items.forEach((item) => mmUpdateProductStock(item.productId, -item.qty));

  const sales = mmGetSales();
  sales.push(sale);
  mmSaveSales(sales);

  lastReceiptSale = sale;
  showReceipt(sale);

  cart = [];
  document.getElementById('amountPaid').value = '';
  renderCart();
  renderPicker();
  renderSalesHistory();
  mmShowToast('Sale completed successfully.', 'success');
}

function showReceipt(sale) {
  const settings = mmGetSettings();
  const lines = (sale.items || [])
    .map(
      (i) =>
        `${i.productName}<br/>${i.qty} x ${mmFormatMoney(i.sellingPrice)} = <strong>${mmFormatMoney(i.qty * i.sellingPrice)}</strong>`
    )
    .join('<hr/>');

  document.getElementById('receiptContent').innerHTML = `
    <div class="center">
      <strong>${settings.supermarketName}</strong><br/>
      ${settings.address || ''}<br/>
      ${settings.phone || ''}<br/>
      ${settings.email || ''}
    </div>
    <hr/>
    <div>Receipt: <strong>${sale.receiptNo}</strong></div>
    <div>Date: ${mmFormatDateTime(sale.createdAt)}</div>
    <div>Cashier: ${sale.cashierName}</div>
    <div>Customer: ${sale.customerName}</div>
    <div>Payment: ${sale.paymentMethod}</div>
    <hr/>
    ${lines}
    <hr/>
    <div class="right">Total: <strong>${mmFormatMoney(sale.total)}</strong></div>
    <div class="right">Paid: ${mmFormatMoney(sale.amountPaid)}</div>
    <div class="right">Change: ${mmFormatMoney(sale.change)}</div>
    <hr/>
    <div class="center">${settings.receiptFooter || 'Thank you!'}</div>
    <div class="center text-muted" style="font-size:11px;margin-top:8px">Demo receipt · LocalStorage</div>
  `;
  mmOpenModal('receiptModal');
}

function renderSalesHistory() {
  const sales = [...mmGetSales()]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));

  const tbody = document.getElementById('salesHistory');
  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="6">${mmEmptyState('No sales recorded yet.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = sales
    .slice(0, 30)
    .map(
      (s) => `
    <tr>
      <td>${s.receiptNo}</td>
      <td>${mmFormatDate(s.date)}</td>
      <td>${s.customerName}</td>
      <td>${s.paymentMethod}</td>
      <td>${mmFormatMoney(s.total)}</td>
      <td><button class="btn btn-sm btn-secondary" data-receipt="${s.id}">Receipt</button></td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-receipt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sale = mmGetSales().find((s) => s.id === btn.getAttribute('data-receipt'));
      if (sale) showReceipt(sale);
    });
  });
}
