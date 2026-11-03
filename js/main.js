/**
 * Shared UI helpers: layout, toasts, modals, navigation, role gating
 */

const MM_NAV_ITEMS = [
  { key: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: 'grid' },
  { key: 'products', href: 'products.html', label: 'Products', icon: 'box' },
  { key: 'inventory', href: 'inventory.html', label: 'Inventory', icon: 'layers' },
  { key: 'sales', href: 'sales.html', label: 'POS / Sales', icon: 'cart' },
  { key: 'purchases', href: 'purchases.html', label: 'Purchases', icon: 'truck' },
  { key: 'suppliers', href: 'suppliers.html', label: 'Suppliers', icon: 'building' },
  { key: 'customers', href: 'customers.html', label: 'Customers', icon: 'users' },
  { key: 'expenses', href: 'expenses.html', label: 'Expenses', icon: 'wallet' },
  { key: 'accounting', href: 'accounting.html', label: 'Accounting', icon: 'calc' },
  { key: 'reports', href: 'reports.html', label: 'Reports', icon: 'chart' },
  { key: 'users', href: 'users.html', label: 'Users', icon: 'shield' },
  { key: 'settings', href: 'settings.html', label: 'Settings', icon: 'gear' }
];

function mmIcon(name) {
  const icons = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 22v-4h6v4"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="16" y2="18"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
  };
  return icons[name] || '';
}

function mmShowToast(message, type) {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'info');
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function mmConfirm(message) {
  return window.confirm(message);
}

function mmOpenModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function mmCloseModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function mmBindModalClosers() {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-modal');
      if (id) mmCloseModal(id);
      else btn.closest('.modal')?.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
}

function mmInitials(name) {
  return String(name || 'U')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function mmBuildShell(activeKey, pageTitle) {
  const user = mmGetCurrentUser();
  const settings = mmGetSettings();
  if (!user) return;

  const allowed = MM_NAV_ITEMS.filter((item) => mmCanAccess(item.key));
  const lowStock = mmGetProducts().filter(
    (p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock)
  ).length;
  const outStock = mmGetProducts().filter((p) => Number(p.stock) <= 0).length;
  const alertCount = lowStock + outStock;

  const sidebar = document.getElementById('appSidebar');
  const topbar = document.getElementById('appTopbar');
  if (!sidebar || !topbar) return;

  const logoHtml = settings.logoDataUrl
    ? `<img src="${settings.logoDataUrl}" alt="Logo" class="brand-logo-img"/>`
    : `<div class="brand-mark">MM</div>`;

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      ${logoHtml}
      <div>
        <div class="brand-name">${settings.supermarketName || 'MiniMart'}</div>
        <div class="brand-sub">Accounting System</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${allowed
        .map(
          (item) => `
        <a class="nav-link ${item.key === activeKey ? 'active' : ''}" href="${item.href}">
          <span class="nav-icon">${mmIcon(item.icon)}</span>
          <span>${item.label}</span>
        </a>`
        )
        .join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="demo-note">Frontend demo · LocalStorage</div>
    </div>
  `;

  topbar.innerHTML = `
    <div class="topbar-left">
      <button type="button" class="icon-btn" id="sidebarToggle" aria-label="Toggle menu">${mmIcon('menu')}</button>
      <div>
        <h1 class="page-title">${pageTitle}</h1>
        <p class="page-sub">Welcome back, ${user.fullName}</p>
      </div>
    </div>
    <div class="topbar-right">
      <div class="alert-badge-wrap" title="Stock alerts">
        <span class="icon-btn static">${mmIcon('bell')}</span>
        ${alertCount ? `<span class="badge-count">${alertCount}</span>` : ''}
      </div>
      <div class="user-menu">
        <div class="user-avatar">${mmInitials(user.fullName)}</div>
        <div class="user-meta">
          <strong>${user.fullName}</strong>
          <span>${user.role}</span>
        </div>
        <div class="user-dropdown">
          <a href="settings.html#profile">My Profile</a>
          <button type="button" id="logoutBtn">${mmIcon('logout')} Logout</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    document.body.classList.toggle('sidebar-open');
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (mmConfirm('Log out of MiniMart?')) mmLogout();
  });

  mmBindModalClosers();
}

function mmRequirePage(pageKey, title) {
  const user = mmRequireAuth();
  if (!user) return null;
  if (!mmCanAccess(pageKey)) {
    mmShowToast('Access denied for your role.', 'error');
    window.location.href = 'dashboard.html';
    return null;
  }
  mmBuildShell(pageKey, title);
  return user;
}

function mmEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function mmStockBadge(product) {
  const stock = Number(product.stock);
  const min = Number(product.minStock);
  if (stock <= 0) return '<span class="pill pill-danger">Out of stock</span>';
  if (stock <= min) return '<span class="pill pill-warning">Low stock</span>';
  return '<span class="pill pill-success">In stock</span>';
}

function mmPrintElement(elementId, title) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const settings = mmGetSettings();
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) {
    mmShowToast('Please allow pop-ups to print.', 'error');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>${title || 'Print'}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
      h1,h2,h3{margin:0 0 8px} table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:13px}
      th{background:#f1f5f9} .muted{color:#64748b;font-size:12px}
      .receipt{max-width:360px;margin:0 auto} .right{text-align:right}
      @media print{button{display:none}}
    </style></head><body>
    <div class="muted">${settings.supermarketName} · ${settings.address || ''}</div>
    ${el.innerHTML}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
  win.document.close();
}

function mmSimpleBarChart(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const max = Math.max(...values, 1);
  const pad = 36;
  const barW = (w - pad * 2) / values.length - 10;

  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - 10, h - pad);
  ctx.stroke();

  values.forEach((v, i) => {
    const x = pad + i * (barW + 10);
    const bh = ((h - pad * 2) * v) / max;
    const y = h - pad - bh;
    const grad = ctx.createLinearGradient(0, y, 0, h - pad);
    grad.addColorStop(0, color || '#1e3a5f');
    grad.addColorStop(1, '#2d6a4f');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW, bh);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, h - pad + 14);
  });
}

function mmSimpleLineChart(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...values, 1);
  const pad = 36;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;

  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - 10, h - pad);
  ctx.stroke();

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((h - pad * 2) * v) / max;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color || '#2d6a4f';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  values.forEach((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((h - pad * 2) * v) / max;
    ctx.fillStyle = color || '#2d6a4f';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x, h - pad + 14);
  });
}
