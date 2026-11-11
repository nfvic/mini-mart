/**
 * Customer management
 */

let selectedCustomerId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await mmPreparePage('customers', 'Customer Management'))) return;

  document.getElementById('customerSearch').addEventListener('input', renderCustomers);
  document.getElementById('btnAddCustomer').addEventListener('click', () => openCustomerModal());
  document.getElementById('customerForm').addEventListener('submit', saveCustomer);

  renderCustomers();
});

function renderCustomers() {
  const q = document.getElementById('customerSearch').value.trim().toLowerCase();
  let list = mmGetCustomers();
  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById('customersTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5">${mmEmptyState('No customers found.')}</td></tr>`;
  } else {
    tbody.innerHTML = list
      .map(
        (c) => `
      <tr>
        <td><button class="btn btn-sm btn-outline" data-view="${c.id}">${c.name}</button></td>
        <td>${c.phone || '—'}</td>
        <td>${c.email || '—'}</td>
        <td>${c.isWalkIn ? '<span class="pill pill-info">Walk-in</span>' : '<span class="pill pill-success">Registered</span>'}</td>
        <td class="actions">
          ${
            c.isWalkIn
              ? '<span class="text-muted">Protected</span>'
              : `<button class="btn btn-sm btn-secondary" data-edit="${c.id}">Edit</button>
                 <button class="btn btn-sm btn-danger" data-del="${c.id}">Delete</button>`
          }
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-view]').forEach((b) =>
      b.addEventListener('click', () => showCustomerHistory(b.getAttribute('data-view')))
    );
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openCustomerModal(b.getAttribute('data-edit')))
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => deleteCustomer(b.getAttribute('data-del')))
    );
  }

  if (!selectedCustomerId && list[0]) selectedCustomerId = list[0].id;
  if (selectedCustomerId) showCustomerHistory(selectedCustomerId);
}

function showCustomerHistory(id) {
  selectedCustomerId = id;
  const customer = mmGetCustomers().find((c) => c.id === id);
  const sales = mmGetSales()
    .filter((s) => s.customerId === id && s.status === 'completed')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const host = document.getElementById('customerHistory');
  if (!customer) {
    host.innerHTML = mmEmptyState('Select a customer.');
    return;
  }

  const totalSpent = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  host.innerHTML =
    `<div class="mb-2"><strong>${customer.name}</strong>
      <div class="text-muted">${customer.phone || ''} · Spent ${mmFormatMoney(totalSpent)}</div>
     </div>` +
    (sales.length
      ? sales
          .map(
            (s) => `
        <div class="feed-item">
          <div>
            <strong>${s.receiptNo}</strong>
            <span>${mmFormatDate(s.date)} · ${s.paymentMethod}</span>
          </div>
          <strong>${mmFormatMoney(s.total)}</strong>
        </div>`
          )
          .join('')
      : mmEmptyState('No purchases yet for this customer.'));
}

function openCustomerModal(id) {
  document.getElementById('customerForm').reset();
  document.getElementById('customerId').value = '';
  document.getElementById('customerModalTitle').textContent = id ? 'Edit customer' : 'Register customer';
  if (id) {
    const c = mmGetCustomers().find((x) => x.id === id);
    if (!c || c.isWalkIn) return;
    document.getElementById('customerId').value = c.id;
    document.getElementById('customerName').value = c.name;
    document.getElementById('customerPhone').value = c.phone || '';
    document.getElementById('customerEmail').value = c.email || '';
    document.getElementById('customerAddress').value = c.address || '';
  }
  mmOpenModal('customerModal');
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('customerId').value;
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  if (!name || !phone) {
    mmShowToast('Name and phone are required.', 'error');
    return;
  }

  const payload = {
    name,
    phone,
    email: document.getElementById('customerEmail').value.trim(),
    address: document.getElementById('customerAddress').value.trim()
  };
  if (id) payload.id = id;

  const existing = id ? mmGetCustomers().find((c) => c.id === id) : null;
  if (existing?.isWalkIn) {
    mmShowToast('Walk-in customer cannot be edited.', 'error');
    return;
  }

  try {
    const item = await mmPersist('customers', payload, !id);
    mmSaveCustomers(mmUpsert(mmGetCustomers(), item));
    mmShowToast(id ? 'Customer updated.' : 'Customer registered.', 'success');
    mmCloseModal('customerModal');
    selectedCustomerId = item.id;
    renderCustomers();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}

async function deleteCustomer(id) {
  const c = mmGetCustomers().find((x) => x.id === id);
  if (!c || c.isWalkIn) {
    mmShowToast('Walk-in customer cannot be deleted.', 'error');
    return;
  }
  if (!mmConfirm(`Delete customer "${c.name}"?`)) return;
  try {
    await mmRemoveRecord('customers', id);
    mmSaveCustomers(mmGetCustomers().filter((x) => x.id !== id));
    if (selectedCustomerId === id) selectedCustomerId = null;
    mmShowToast('Customer deleted.', 'success');
    renderCustomers();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}
