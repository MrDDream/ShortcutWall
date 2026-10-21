// Header light/dark theme toggle.

// The initial theme (saved choice, else the OS preference) is already applied
// to <html data-theme> by theme.js before first paint; this only handles the
// toggle. The sun/moon icon swap is pure CSS, keyed off the same attribute.
export function initThemeToggle() {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) {
    return;
  }

  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', `theme-${next}`);
    } catch {
      // Storage unavailable: the choice simply won't persist across pages.
    }
  });
}
