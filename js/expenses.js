/**
 * Expense management — operating expenses only (not inventory purchases)
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await mmPreparePage('expenses', 'Expense Management'))) return;

  document.getElementById('expenseCategoryFilter').innerHTML =
    '<option value="">All categories</option>' +
    MM_EXPENSE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('expenseCategory').innerHTML = MM_EXPENSE_CATEGORIES.map(
    (c) => `<option value="${c}">${c}</option>`
  ).join('');
  document.getElementById('expensePayment').innerHTML = MM_PAYMENT_METHODS.map(
    (m) => `<option value="${m}">${m}</option>`
  ).join('');

  document.getElementById('expenseSearch').addEventListener('input', renderExpenses);
  document.getElementById('expenseCategoryFilter').addEventListener('change', renderExpenses);
  document.getElementById('btnAddExpense').addEventListener('click', () => openExpenseModal());
  document.getElementById('expenseForm').addEventListener('submit', saveExpense);

  renderExpenses();
});

function renderExpenses() {
  const expenses = mmGetExpenses();
  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const monthTotal = expenses
    .filter((e) => mmIsSameMonth(e.date))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  document.getElementById('expenseStats').innerHTML = [
    { label: 'Total operating expenses', value: mmFormatMoney(total) },
    { label: 'This month', value: mmFormatMoney(monthTotal) },
    { label: 'Records', value: expenses.length },
    { label: 'Categories used', value: new Set(expenses.map((e) => e.category)).size }
  ]
    .map(
      (c) => `
    <article class="stat-card">
      <div class="stat-label">${c.label}</div>
      <p class="stat-value">${c.value}</p>
    </article>`
    )
    .join('');

  const q = document.getElementById('expenseSearch').value.trim().toLowerCase();
  const cat = document.getElementById('expenseCategoryFilter').value;
  let list = [...expenses].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (cat) list = list.filter((e) => e.category === cat);
  if (q) {
    list = list.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById('expensesTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6">${mmEmptyState('No expenses found.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (e) => `
    <tr>
      <td>${mmFormatDate(e.date)}</td>
      <td>${e.description}</td>
      <td>${e.category}</td>
      <td>${e.paymentMethod}</td>
      <td>${mmFormatMoney(e.amount)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-secondary" data-edit="${e.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-del="${e.id}">Delete</button>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openExpenseModal(b.getAttribute('data-edit')))
  );
  tbody.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteExpense(b.getAttribute('data-del')))
  );
}

function openExpenseModal(id) {
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseId').value = '';
  document.getElementById('expenseDate').value = mmTodayISO();
  document.getElementById('expenseModalTitle').textContent = id ? 'Edit expense' : 'Record expense';
  if (id) {
    const e = mmGetExpenses().find((x) => x.id === id);
    if (!e) return;
    document.getElementById('expenseId').value = e.id;
    document.getElementById('expenseDescription').value = e.description;
    document.getElementById('expenseCategory').value = e.category;
    document.getElementById('expenseAmount').value = e.amount;
    document.getElementById('expenseDate').value = e.date;
    document.getElementById('expensePayment').value = e.paymentMethod;
  }
  mmOpenModal('expenseModal');
}

async function saveExpense(e) {
  e.preventDefault();
  const id = document.getElementById('expenseId').value;
  const description = document.getElementById('expenseDescription').value.trim();
  const amount = Number(document.getElementById('expenseAmount').value);
  if (!description || !(amount > 0)) {
    mmShowToast('Enter a description and a valid amount.', 'error');
    return;
  }

  const payload = {
    description,
    category: document.getElementById('expenseCategory').value,
    amount,
    date: document.getElementById('expenseDate').value || mmTodayISO(),
    paymentMethod: document.getElementById('expensePayment').value
  };
  if (id) payload.id = id;

  try {
    const item = await mmPersist('expenses', payload, !id);
    mmSaveExpenses(mmUpsert(mmGetExpenses(), item));
    mmShowToast(id ? 'Expense updated.' : 'Expense recorded.', 'success');
    mmCloseModal('expenseModal');
    renderExpenses();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!mmConfirm('Delete this expense record?')) return;
  try {
    await mmRemoveRecord('expenses', id);
    mmSaveExpenses(mmGetExpenses().filter((e) => e.id !== id));
    mmShowToast('Expense deleted.', 'success');
    renderExpenses();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}
