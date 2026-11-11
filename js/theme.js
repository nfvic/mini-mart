/* Applies the saved theme before stylesheets render and keeps the toggle shared across pages. */
(function () {
  const storageKey = 'mm_theme';
  const darkPreference = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      button.title = `Switch to ${nextTheme} mode`;
      button.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
      button.innerHTML = window.mmThemeIcon(theme);
    });
  }

  function savedTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (error) {
      // The system preference remains available when browser storage is disabled.
    }
    return darkPreference && darkPreference.matches ? 'dark' : 'light';
  }

  window.mmThemeIcon = function (theme) {
    return theme === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg>';
  };

  window.mmToggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(storageKey, next);
    } catch (error) {
      // Keep the selected theme for this page even if persistence is unavailable.
    }
    applyTheme(next);
  };

  applyTheme(savedTheme());

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-theme-toggle]')) window.mmToggleTheme();
  });

  if (darkPreference && typeof darkPreference.addEventListener === 'function') {
    darkPreference.addEventListener('change', (event) => {
      let hasSavedTheme = false;
      try {
        hasSavedTheme = localStorage.getItem(storageKey) === 'dark'
          || localStorage.getItem(storageKey) === 'light';
      } catch (error) {
        hasSavedTheme = false;
      }
      if (!hasSavedTheme) applyTheme(event.matches ? 'dark' : 'light');
    });
  }
})();
