/**
 * MiniMart authentication (frontend demo only)
 * Credentials and sessions are stored in LocalStorage — NOT secure for production.
 */

function mmGetSession() {
  return mmGet(MM_STORAGE_KEYS.SESSION, null);
}

function mmSaveSession(session) {
  mmSet(MM_STORAGE_KEYS.SESSION, session);
}

function mmClearSession() {
  mmRemove(MM_STORAGE_KEYS.SESSION);
}

function mmIsLoggedIn() {
  const session = mmGetSession();
  return !!(session && session.userId);
}

function mmGetCurrentUser() {
  const session = mmGetSession();
  if (!session) return null;
  const user = mmGetUserById(session.userId);
  if (!user || user.active === false) return null;
  return user;
}

function mmLogin(username, password, remember) {
  const user = mmGetUserByUsername(username);
  if (!user) {
    return { ok: false, message: 'Invalid username or password.' };
  }
  if (user.active === false) {
    return { ok: false, message: 'This account is disabled. Contact the administrator.' };
  }
  if (String(user.password) !== String(password)) {
    return { ok: false, message: 'Invalid username or password.' };
  }

  const session = {
    userId: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    loginAt: new Date().toISOString(),
    remember: !!remember
  };
  mmSaveSession(session);

  if (remember) {
    localStorage.setItem('mm_remember_username', user.username);
  } else {
    localStorage.removeItem('mm_remember_username');
  }

  return { ok: true, user, session };
}

function mmLogout() {
  mmClearSession();
  window.location.href = 'login.html';
}

function mmRequireAuth(allowedRoles) {
  if (!mmIsLoggedIn()) {
    window.location.href = 'login.html';
    return null;
  }
  const user = mmGetCurrentUser();
  if (!user) {
    mmClearSession();
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
    mmShowToast('You do not have permission to access this page.', 'error');
    window.location.href = 'dashboard.html';
    return null;
  }
  return user;
}

function mmCanAccess(pageKey) {
  const user = mmGetCurrentUser();
  if (!user) return false;
  const perms = MM_ROLE_PERMISSIONS[user.role] || [];
  return perms.includes(pageKey);
}

function mmRedirectIfLoggedIn() {
  if (mmIsLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

function mmChangePassword(userId, currentPassword, newPassword) {
  const users = mmGetUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return { ok: false, message: 'User not found.' };
  if (String(users[idx].password) !== String(currentPassword)) {
    return { ok: false, message: 'Current password is incorrect.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, message: 'New password must be at least 6 characters.' };
  }
  users[idx].password = newPassword;
  mmSaveUsers(users);
  return { ok: true, message: 'Password updated successfully.' };
}
