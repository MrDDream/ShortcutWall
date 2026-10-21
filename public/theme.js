// Loaded synchronously from <head>, before the stylesheet paints anything, so
// a stored or OS-level dark preference never flashes the light theme first.
// An explicit choice (saved by the header toggle in scripts.js) wins; otherwise
// the page follows the OS setting, live.
(function applyInitialTheme() {
  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readStoredTheme() {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'theme-dark') {
        return 'dark';
      }
      if (stored === 'theme-light') {
        return 'light';
      }
    } catch {
      // Storage can be unavailable (private mode, blocked site data).
    }
    return null;
  }

  function apply() {
    root.dataset.theme = readStoredTheme() || (media && media.matches ? 'dark' : 'light');
  }

  apply();

  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', apply);
  }
})();
