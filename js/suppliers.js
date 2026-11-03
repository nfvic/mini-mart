/**
 * Supplier management
 */

let selectedSupplierId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!mmRequirePage('suppliers', 'Supplier Management')) return;

  document.getElementById('supplierSearch').addEventListener('input', renderSuppliers);
  document.getElementById('btnAddSupplier').addEventListener('click', () => openSupplierModal());
  document.getElementById('supplierForm').addEventListener('submit', saveSupplier);

  renderSuppliers();
});

function renderSuppliers() {
  const q = document.getElementById('supplierSearch').value.trim().toLowerCase();
  let list = mmGetSuppliers();
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById('suppliersTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5">${mmEmptyState('No suppliers found.')}</td></tr>`;
  } else {
    tbody.innerHTML = list
      .map(
        (s) => `
      <tr>
        <td><button class="btn btn-sm btn-outline" data-view="${s.id}">${s.name}</button></td>
        <td>${s.phone || '—'}</td>
        <td>${s.email || '—'}</td>
        <td>${s.address || '—'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" data-edit="${s.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${s.id}">Delete</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-view]').forEach((b) =>
      b.addEventListener('click', () => showSupplierHistory(b.getAttribute('data-view')))
    );
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openSupplierModal(b.getAttribute('data-edit')))
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => deleteSupplier(b.getAttribute('data-del')))
    );
  }

  if (!selectedSupplierId && list[0]) selectedSupplierId = list[0].id;
  if (selectedSupplierId) showSupplierHistory(selectedSupplierId);
}

function showSupplierHistory(id) {
  selectedSupplierId = id;
  const supplier = mmGetSuppliers().find((s) => s.id === id);
  const purchases = mmGetPurchases()
    .filter((p) => p.supplierId === id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const host = document.getElementById('supplierHistory');
  if (!supplier) {
    host.innerHTML = mmEmptyState('Select a supplier.');
    return;
  }

  host.innerHTML =
    `<div class="mb-2"><strong>${supplier.name}</strong><div class="text-muted">${supplier.notes || ''}</div></div>` +
    (purchases.length
      ? purchases
          .map(
            (p) => `
        <div class="feed-item">
          <div>
            <strong>${p.purchaseNo}</strong>
            <span>${mmFormatDate(p.date)} · ${(p.items || []).length} items</span>
          </div>
          <strong>${mmFormatMoney(p.total)}</strong>
        </div>`
          )
          .join('')
      : mmEmptyState('No purchases from this supplier yet.'));
}

function openSupplierModal(id) {
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierId').value = '';
  document.getElementById('supplierModalTitle').textContent = id ? 'Edit supplier' : 'Add supplier';
  if (id) {
    const s = mmGetSuppliers().find((x) => x.id === id);
    if (!s) return;
    document.getElementById('supplierId').value = s.id;
    document.getElementById('supplierName').value = s.name;
    document.getElementById('supplierPhone').value = s.phone || '';
    document.getElementById('supplierEmail').value = s.email || '';
    document.getElementById('supplierAddress').value = s.address || '';
    document.getElementById('supplierNotes').value = s.notes || '';
  }
  mmOpenModal('supplierModal');
}

function saveSupplier(e) {
  e.preventDefault();
  const id = document.getElementById('supplierId').value;
  const name = document.getElementById('supplierName').value.trim();
  const phone = document.getElementById('supplierPhone').value.trim();
  if (!name || !phone) {
    mmShowToast('Name and phone are required.', 'error');
    return;
  }

  const payload = {
    id: id || mmGenerateId('sup'),
    name,
    phone,
    email: document.getElementById('supplierEmail').value.trim(),
    address: document.getElementById('supplierAddress').value.trim(),
    notes: document.getElementById('supplierNotes').value.trim()
  };

  const list = mmGetSuppliers();
  if (id) {
    const idx = list.findIndex((s) => s.id === id);
    list[idx] = payload;
    mmShowToast('Supplier updated.', 'success');
  } else {
    list.push(payload);
    mmShowToast('Supplier added.', 'success');
  }
  mmSaveSuppliers(list);
  mmCloseModal('supplierModal');
  selectedSupplierId = payload.id;
  renderSuppliers();
}

function deleteSupplier(id) {
  const s = mmGetSuppliers().find((x) => x.id === id);
  if (!s) return;
  if (!mmConfirm(`Delete supplier "${s.name}"?`)) return;
  mmSaveSuppliers(mmGetSuppliers().filter((x) => x.id !== id));
  if (selectedSupplierId === id) selectedSupplierId = null;
  mmShowToast('Supplier deleted.', 'success');
  renderSuppliers();
}
