/**
 * User management — Administrator only
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await mmPreparePage('users', 'User Management'))) return;

  document.getElementById('userRole').innerHTML = MM_ROLES.map(
    (r) => `<option value="${r}">${r}</option>`
  ).join('');

  document.getElementById('btnAddUser').addEventListener('click', () => openUserModal());
  document.getElementById('userForm').addEventListener('submit', saveUser);

  renderUsers();
  renderPermissions();
});

function renderUsers() {
  const users = mmGetUsers();
  const tbody = document.getElementById('usersTable');
  tbody.innerHTML = users
    .map(
      (u) => `
    <tr>
      <td>${u.fullName}</td>
      <td><code>${u.username}</code></td>
      <td><span class="pill pill-info">${u.role}</span></td>
      <td>${u.email || '—'}</td>
      <td>${u.phone || '—'}</td>
      <td>${u.active === false ? '<span class="pill pill-danger">Disabled</span>' : '<span class="pill pill-success">Active</span>'}</td>
      <td class="actions">
        <button class="btn btn-sm btn-secondary" data-edit="${u.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-del="${u.id}">Delete</button>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openUserModal(b.getAttribute('data-edit')))
  );
  tbody.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteUser(b.getAttribute('data-del')))
  );
}

function renderPermissions() {
  const pages = [
    'dashboard', 'products', 'inventory', 'sales', 'purchases', 'suppliers',
    'customers', 'expenses', 'accounting', 'reports', 'users', 'settings'
  ];
  const head =
    '<thead><tr><th>Module</th>' +
    MM_ROLES.map((r) => `<th>${r}</th>`).join('') +
    '</tr></thead>';
  const body =
    '<tbody>' +
    pages
      .map((page) => {
        const cells = MM_ROLES.map((role) => {
          const ok = (MM_ROLE_PERMISSIONS[role] || []).includes(page);
          return `<td>${ok ? '✓' : '—'}</td>`;
        }).join('');
        return `<tr><td>${page}</td>${cells}</tr>`;
      })
      .join('') +
    '</tbody>';
  document.getElementById('permissionsTable').innerHTML = head + body;
}

function openUserModal(id) {
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('userActive').checked = true;
  document.getElementById('userModalTitle').textContent = id ? 'Edit user' : 'Add user';
  if (id) {
    const u = mmGetUserById(id);
    if (!u) return;
    document.getElementById('userId').value = u.id;
    document.getElementById('userFullName').value = u.fullName;
    document.getElementById('userUsername').value = u.username;
    document.getElementById('userRole').value = u.role;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Leave blank to keep the current password';
    document.getElementById('userEmail').value = u.email || '';
    document.getElementById('userPhone').value = u.phone || '';
    document.getElementById('userActive').checked = u.active !== false;
  }
  mmOpenModal('userModal');
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const username = document.getElementById('userUsername').value.trim();
  const password = document.getElementById('userPassword').value;
  const fullName = document.getElementById('userFullName').value.trim();

  if (!username || !fullName || (!id && password.length < 6) || (password && password.length < 6)) {
    mmShowToast('Provide a name, username and a password of at least 6 characters.', 'error');
    return;
  }

  const users = mmGetUsers();
  const duplicate = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== id
  );
  if (duplicate) {
    mmShowToast('Username already exists.', 'error');
    return;
  }

  const payload = {
    username,
    fullName,
    role: document.getElementById('userRole').value,
    email: document.getElementById('userEmail').value.trim(),
    phone: document.getElementById('userPhone').value.trim(),
    active: document.getElementById('userActive').checked
  };
  if (password) payload.password = password;
  if (id) payload.id = id;

  try {
    const item = await mmPersist('users', payload, !id);
    mmSaveUsers(mmUpsert(mmGetUsers(), item).sort((a, b) => a.fullName.localeCompare(b.fullName)));
    if (mmGetCurrentUser() && mmGetCurrentUser().id === item.id) {
      MM_STATE.user = { ...mmGetCurrentUser(), ...item, permissions: mmGetCurrentUser().permissions };
    }
    mmShowToast(id ? 'User updated.' : 'User added.', 'success');
    mmCloseModal('userModal');
    renderUsers();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}

async function deleteUser(id) {
  const current = mmGetCurrentUser();
  if (current && current.id === id) {
    mmShowToast('You cannot delete your own logged-in account.', 'error');
    return;
  }
  const u = mmGetUserById(id);
  if (!u) return;
  if (!mmConfirm(`Delete user "${u.fullName}"?`)) return;
  try {
    await mmRemoveRecord('users', id);
    mmSaveUsers(mmGetUsers().filter((x) => x.id !== id));
    mmShowToast('User deleted.', 'success');
    renderUsers();
  } catch (err) {
    mmShowToast(err.message, 'error');
  }
}
