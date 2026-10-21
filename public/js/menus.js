// Header dropdown menus.

// Header dropdowns ([data-menu]: language picker, admin menu). Opening one
// closes the others; Escape or a click outside closes it.
export function setupMenus() {
  const menus = Array.from(document.querySelectorAll('[data-menu]'))
    .map((root) => ({
      root,
      toggle: root.querySelector('[data-menu-toggle]'),
      panel: root.querySelector('[data-menu-panel]'),
    }))
    .filter(({ toggle, panel }) => toggle && panel);
  if (!menus.length) {
    return;
  }

  const close = (menu) => {
    menu.panel.hidden = true;
    menu.toggle.setAttribute('aria-expanded', 'false');
  };

  menus.forEach((menu) => {
    menu.toggle.addEventListener('click', (event) => {
      event.preventDefault();
      const opening = menu.panel.hidden;
      menus.forEach(close);
      if (opening) {
        menu.panel.hidden = false;
        menu.toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (event) => {
    menus.filter((menu) => !menu.root.contains(event.target)).forEach(close);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    const open = menus.find((menu) => !menu.panel.hidden);
    if (open) {
      close(open);
      open.toggle.focus();
    }
  });
}
