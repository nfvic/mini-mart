/**
 * Settings & profile
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = mmRequireAuth();
  if (!user) return;

  // Settings page is admin-only for business config; profile available to all via hash
  const canSettings = mmCanAccess('settings');
  if (!canSettings && !window.location.hash.includes('profile')) {
    // Allow any logged-in user to open profile section
    mmBuildShell('settings', 'My Profile');
  } else if (canSettings) {
    mmBuildShell('settings', 'Settings & Profile');
  } else {
    mmBuildShell('dashboard', 'My Profile');
  }

  const settings = mmGetSettings();
  document.getElementById('supermarketName').value = settings.supermarketName || '';
  document.getElementById('currency').value = settings.currency || 'KES';
  document.getElementById('businessPhone').value = settings.phone || '';
  document.getElementById('businessEmail').value = settings.email || '';
  document.getElementById('businessAddress').value = settings.address || '';
  document.getElementById('receiptFooter').value = settings.receiptFooter || '';
  if (settings.logoDataUrl) {
    document.getElementById('logoPreview').innerHTML =
      `<img src="${settings.logoDataUrl}" alt="Logo" style="max-height:64px;border-radius:10px;border:1px solid #e2e8f0"/>`;
  }

  if (!canSettings) {
    document.getElementById('businessSettingsCard')?.classList.add('hidden');
    document.getElementById('demoDataCard')?.classList.add('hidden');
  }

  document.getElementById('profileDetails').innerHTML = `
    <div class="list-feed">
      <div class="feed-item"><div><strong>Name</strong></div><span>${user.fullName}</span></div>
      <div class="feed-item"><div><strong>Username</strong></div><span>${user.username}</span></div>
      <div class="feed-item"><div><strong>Role</strong></div><span>${user.role}</span></div>
      <div class="feed-item"><div><strong>Email</strong></div><span>${user.email || '—'}</span></div>
      <div class="feed-item"><div><strong>Phone</strong></div><span>${user.phone || '—'}</span></div>
    </div>`;

  document.getElementById('logoFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      mmShowToast('Please choose an image under 500KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('logoPreview').innerHTML =
        `<img src="${reader.result}" alt="Logo preview" style="max-height:64px;border-radius:10px;border:1px solid #e2e8f0"/>`;
      document.getElementById('logoPreview').dataset.logo = reader.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!canSettings) {
      mmShowToast('Only administrators can change business settings.', 'error');
      return;
    }
    const next = {
      ...mmGetSettings(),
      supermarketName: document.getElementById('supermarketName').value.trim(),
      currency: 'KES',
      phone: document.getElementById('businessPhone').value.trim(),
      email: document.getElementById('businessEmail').value.trim(),
      address: document.getElementById('businessAddress').value.trim(),
      receiptFooter: document.getElementById('receiptFooter').value.trim()
    };
    const logo = document.getElementById('logoPreview').dataset.logo;
    if (logo) next.logoDataUrl = logo;
    mmSaveSettings(next);
    mmShowToast('Settings saved.', 'success');
    setTimeout(() => location.reload(), 600);
  });

  document.getElementById('passwordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (newPassword !== confirmPassword) {
      mmShowToast('New passwords do not match.', 'error');
      return;
    }
    const result = mmChangePassword(user.id, currentPassword, newPassword);
    mmShowToast(result.message, result.ok ? 'success' : 'error');
    if (result.ok) e.target.reset();
  });

  document.getElementById('btnResetDemo')?.addEventListener('click', () => {
    if (!canSettings) return;
    if (!mmConfirm('Reset all demonstration data to the original sample set?')) return;
    const session = mmGetSession();
    mmResetDemoData();
    if (session) mmSaveSession(session);
    mmShowToast('Demonstration data restored.', 'success');
    setTimeout(() => (window.location.href = 'dashboard.html'), 700);
  });

  if (window.location.hash === '#profile') {
    document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth' });
  }
});
