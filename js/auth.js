/**
 * MiniMart authentication against the PHP session API.
 */

function mmGetCurrentUser() {
  return MM_STATE.user || null;
}

function mmIsLoggedIn() {
  return !!mmGetCurrentUser();
}

async function mmRestoreSession() {
  try {
    const data = await mmApi('session');
    MM_STATE.user = data.user || null;
    return MM_STATE.user;
  } catch (e) {
    MM_STATE.user = null;
    return null;
  }
}

async function mmLogin(username, password, remember) {
  try {
    const data = await mmApi('login', {
      method: 'POST',
      body: { username, password, remember: !!remember }
    });
    MM_STATE.user = data.user;
    if (remember) {
      localStorage.setItem('mm_remember_username', data.user.username);
    } else {
      localStorage.removeItem('mm_remember_username');
    }
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, message: e.message || 'Invalid username or password.' };
  }
}

async function mmLogout() {
  try {
    await mmApi('logout', { method: 'POST', body: {} });
  } catch (e) {
    /* still leave the screen if the session is already gone */
  }
  MM_STATE.user = null;
  MM_STATE.csrf = '';
  try {
    sessionStorage.removeItem('mm_csrf');
  } catch (err) {
    /* ignore */
  }
  window.location.href = 'login.html';
}

function mmCanAccess(pageKey) {
  const user = mmGetCurrentUser();
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.length) {
    return user.permissions.includes(pageKey);
  }
  const perms = MM_ROLE_PERMISSIONS[user.role] || [];
  return perms.includes(pageKey);
}

async function mmChangePassword(currentPassword, newPassword) {
  try {
    await mmApi('password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    });
    return { ok: true, message: 'Password updated successfully.' };
  } catch (e) {
    return { ok: false, message: e.message || 'Could not update the password.' };
  }
}
