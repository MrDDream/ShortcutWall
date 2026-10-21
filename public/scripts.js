const clientTranslations = readClientTranslations();

function readClientTranslations() {
  try {
    const node = document.getElementById('app-translations');
    return node ? JSON.parse(node.textContent) : {};
  } catch {
    return {};
  }
}

let currentSort = 'alpha';

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  setupSortControl();
  setupViewSwitch();
  setupSearchFilter();
  setupSearchShortcut();
  setupAdminTabs();
  setupAdminMenu();
  setupFaviconButtons();
  setupFaviconThumbnails();
  setupImageFilePreview();
  setupHelpModal();
  setupDeleteConfirmation();
  setupFormSubmitFeedback();
  setupAdminSearch();
  setupUndoDelete();
  setupToasts();
  setupUnsavedChangesWarning();
});

// The initial theme (saved choice, else the OS preference) is already applied
// to <html data-theme> by theme.js before first paint; this only handles the
// toggle. The sun/moon icon swap is pure CSS, keyed off the same attribute.
function initThemeToggle() {
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

function setupViewSwitch() {
  const switchButtons = Array.from(document.querySelectorAll('.view-switch__button'));
  if (!switchButtons.length) {
    return;
  }

  const grids = {
    sites: document.getElementById('sites-grid'),
    folders: document.getElementById('folders-grid'),
  };

  let currentView = switchButtons.find((btn) => btn.classList.contains('is-active'))?.dataset.view || 'sites';
  document.body.dataset.view = currentView;

  function activate(view) {
    if (!grids[view]) {
      return;
    }

    currentView = view;
    document.body.dataset.view = view;
    Object.entries(grids).forEach(([key, section]) => {
      if (!section) {
        return;
      }
      section.classList.toggle('is-active', key === view);
    });

    switchButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === view);
    });

    const url = new URL(window.location.href);
    url.searchParams.set('type', view);
    window.history.replaceState({}, '', url);

    applySearchFilter(view);
  }

  switchButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      activate(btn.dataset.view);
    });
  });

  activate(currentView);
}

function setupSearchFilter() {
  const input = document.getElementById('search-term');
  if (!input) {
    return;
  }

  input.addEventListener('input', () => {
    applySearchFilter();
  });

  applySearchFilter();
}

// Pressing "/" anywhere on the public page jumps focus to the search box,
// unless the user is already typing somewhere else.
function setupSearchShortcut() {
  const input = document.getElementById('search-term');
  if (!input) {
    return;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const active = document.activeElement;
    const isTyping =
      active instanceof HTMLElement &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

    if (isTyping) {
      return;
    }

    event.preventDefault();
    input.focus();
  });
}

function applySearchFilter(view) {
  const targetView =
    view ||
    document.body.dataset.view ||
    document.querySelector('.view-switch__button.is-active')?.dataset.view ||
    'sites';
  applySorting(targetView);

  const term = document.getElementById('search-term')?.value.trim().toLowerCase() || '';
  const grid = document.getElementById(`${targetView}-grid`);
  if (!grid) {
    return;
  }

  const cards = Array.from(grid.querySelectorAll('.shortcut-card'));
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = (card.dataset.name || '').toLowerCase();
    const description = (card.dataset.description || '').toLowerCase();

    const matches = !term || name.includes(term) || description.includes(term);

    card.style.display = matches ? '' : 'none';
    if (matches) {
      visibleCount += 1;
    }
  });

  toggleNoResultsMessage(grid, term.length > 0 && cards.length > 0 && visibleCount === 0);
}

function toggleNoResultsMessage(grid, shouldShow) {
  let message = grid.querySelector('.search-no-results');

  if (shouldShow) {
    if (!message) {
      message = document.createElement('p');
      message.className = 'empty-state search-no-results';
      message.textContent = clientTranslations.searchNoResults || '';
      grid.appendChild(message);
    }
  } else if (message) {
    message.remove();
  }
}

function setupSortControl() {
  const select = document.getElementById('sort-order');

  const allowedValues = new Set(['alpha', 'recent']);
  if (select) {
    const url = new URL(window.location.href);
    const urlSort = url.searchParams.get('sort');
    if (urlSort && allowedValues.has(urlSort)) {
      select.value = urlSort;
    }

    currentSort = select.value;

    select.addEventListener('change', () => {
      currentSort = allowedValues.has(select.value) ? select.value : 'alpha';
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('sort', currentSort);
      window.history.replaceState({}, '', nextUrl);
      applySearchFilter();
    });
  } else {
    currentSort = 'alpha';
  }

  applySorting();
}

function applySorting(view) {
  const views = view ? [view] : ['sites', 'folders'];
  views.forEach((targetView) => {
    const grid = document.getElementById(`${targetView}-grid`);
    if (!grid) {
      return;
    }

    const cards = Array.from(grid.querySelectorAll('.shortcut-card'));
    const sorted = [...cards].sort((cardA, cardB) => compareCards(cardA, cardB, currentSort));
    // Re-appending a card restarts its entrance animation, so leave the DOM
    // alone when the order is unchanged (e.g. on every search keystroke).
    if (sorted.every((card, index) => card === cards[index])) {
      return;
    }
    sorted.forEach((card) => grid.appendChild(card));
  });
}

function compareCards(cardA, cardB, sortType) {
  if (sortType === 'recent') {
    const timeA = Date.parse(cardA.dataset.created || '') || 0;
    const timeB = Date.parse(cardB.dataset.created || '') || 0;
    const diff = timeB - timeA;
    if (diff !== 0) {
      return diff;
    }
  }

  const nameA = (cardA.dataset.sortName || cardA.dataset.name || '').toString();
  const nameB = (cardB.dataset.sortName || cardB.dataset.name || '').toString();
  return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
}

function setupAdminTabs() {
  const tabsContainer = document.querySelector('.admin-tabs');
  if (!tabsContainer) {
    return;
  }

  const buttons = Array.from(tabsContainer.querySelectorAll('.admin-tab'));
  const panels = Array.from(document.querySelectorAll('.admin-panel'));
  const defaultTab = tabsContainer.dataset.defaultTab || 'sites';

  function activate(tabId) {
    const targetPanel = panels.find((panel) => panel.id === `panel-${tabId}`);
    const targetButton = buttons.find((button) => button.dataset.tab === tabId);

    if (!targetPanel || !targetButton) {
      const fallback = buttons[0];
      if (fallback) {
        activate(fallback.dataset.tab);
      }
      return;
    }

    panels.forEach((panel) => panel.classList.toggle('is-active', panel === targetPanel));
    buttons.forEach((button) => button.classList.toggle('is-active', button === targetButton));

    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.tab));
  });

  activate(defaultTab);
}

function setupAdminMenu() {
  const menu = document.querySelector('.header-admin-menu');
  if (!menu) {
    return;
  }

  const toggle = menu.querySelector('.header-admin-menu__toggle');
  const dropdown = menu.querySelector('.header-admin-menu__dropdown');
  if (!toggle || !dropdown) {
    return;
  }

  function closeMenu() {
    dropdown.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleKeydown);
  }

  function openMenu() {
    dropdown.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeydown);
  }

  function handleOutsideClick(event) {
    if (!menu.contains(event.target)) {
      closeMenu();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  }

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    if (dropdown.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });
}

function setupDeleteConfirmation() {
  const forms = Array.from(document.querySelectorAll('.delete-form'));
  if (!forms.length) {
    return;
  }

  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      if (form.dataset.confirmed === 'true') {
        return;
      }
      event.preventDefault();

      const confirmed = await confirmDialog(clientTranslations.confirmDelete || '');
      if (confirmed) {
        form.dataset.confirmed = 'true';
        form.requestSubmit();
      }
    });
  });
}

// Styled replacement for window.confirm(), built on the native <dialog>
// element (focus trapping, Escape and ::backdrop for free). Falls back to
// window.confirm() on browsers without showModal().
function confirmDialog(message) {
  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(message));
  }

  dialog.className = 'confirm-dialog';

  const icon = document.createElement('span');
  icon.className = 'confirm-dialog__icon';
  icon.setAttribute('aria-hidden', 'true');
  const trashIcon = document.querySelector('.delete-form .icon');
  if (trashIcon) {
    icon.appendChild(trashIcon.cloneNode(true));
  }

  const text = document.createElement('p');
  text.className = 'confirm-dialog__message';
  text.textContent = message;

  const actions = document.createElement('form');
  actions.method = 'dialog';
  actions.className = 'confirm-dialog__actions';

  const cancel = document.createElement('button');
  cancel.type = 'submit';
  cancel.value = 'cancel';
  cancel.className = 'btn btn--secondary';
  cancel.textContent = clientTranslations.cancel || 'Cancel';

  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.value = 'confirm';
  confirm.className = 'btn btn--danger-solid';
  confirm.textContent = clientTranslations.confirmDeleteAction || 'OK';

  actions.append(cancel, confirm);
  dialog.append(icon, text, actions);
  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    // A click on the backdrop lands on the <dialog> element itself.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.close('cancel');
      }
    });
    dialog.showModal();
    cancel.focus();
  });
}

function setupFormSubmitFeedback() {
  const forms = Array.from(document.querySelectorAll('.admin-form'));
  if (!forms.length) {
    return;
  }

  forms.forEach((form) => {
    form.addEventListener('submit', (event) => {
      // The admin edit forms' submit button sits outside the <form> (form="…"),
      // so prefer the button that actually triggered the submission.
      const submitButton = event.submitter || form.querySelector('button[type="submit"]');
      if (!submitButton || submitButton.disabled) {
        return;
      }
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      submitButton.textContent = clientTranslations.saving || submitButton.textContent;
    });
  });
}

function setupFaviconButtons() {
  const buttons = Array.from(document.querySelectorAll('.fetch-favicon'));

  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    const feedback = button.closest('.image-field')?.querySelector('[data-favicon-feedback]');

    const showFeedback = (message) => {
      if (!feedback) {
        if (message) {
          window.alert(message);
        }
        return;
      }
      if (!message) {
        feedback.hidden = true;
        feedback.textContent = '';
        return;
      }
      feedback.hidden = false;
      feedback.textContent = message;
    };

    button.addEventListener('click', async () => {
      showFeedback('');

      const sourceSelector = button.dataset.source;
      const targetSelector = button.dataset.target;

      if (!sourceSelector || !targetSelector) {
        return;
      }

      let source;
      let target;

      if (sourceSelector.startsWith('#')) {
        source = document.querySelector(sourceSelector);
      } else {
        source = button.closest('form')?.querySelector(sourceSelector);
      }

      if (targetSelector.startsWith('#')) {
        target = document.querySelector(targetSelector);
      } else {
        target = button.closest('form')?.querySelector(targetSelector);
      }

      if (!source || !target) {
        return;
      }

      const rawUrl = source.value.trim();

      if (!rawUrl) {
        showFeedback(clientTranslations.invalidUrl);
        return;
      }

      let url;

      try {
        url = new URL(rawUrl);
      } catch {
        showFeedback(clientTranslations.invalidUrl);
        return;
      }

      if (!['http:', 'https:'].includes(url.protocol)) {
        showFeedback(clientTranslations.invalidUrl);
        return;
      }

      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = clientTranslations.faviconLoading;

      try {
        const response = await fetch(`/api/favicon?url=${encodeURIComponent(url.toString())}`);

        const result = await response.json();

        if (!response.ok || !result.success) {
          showFeedback(result.message || clientTranslations.faviconError);
          return;
        }

        if (!result.faviconUrl) {
          showFeedback(clientTranslations.faviconNotFound);
          return;
        }

        target.value = result.faviconUrl;

        target.dispatchEvent(
          new Event('input', {
            bubbles: true,
          }),
        );
      } catch (error) {
        console.error('Error while fetching the favicon', error);

        showFeedback(clientTranslations.faviconError);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

// Fades each shortcut logo in once it has actually loaded (CSS shows a
// pulsing placeholder on .shortcut-thumb until then) and falls back to the
// letter avatar on error. Handled here rather than inline onerror/onload
// attributes, which the app's Content-Security-Policy (script-src-attr
// 'none') blocks outright.
function setupFaviconThumbnails() {
  const images = Array.from(document.querySelectorAll('.shortcut-thumb__image'));

  images.forEach((img) => {
    const thumb = img.closest('.shortcut-thumb');
    if (!thumb) {
      return;
    }

    if (img.complete && img.naturalWidth > 0) {
      thumb.classList.add('is-loaded');
      return;
    }

    img.addEventListener('load', () => {
      thumb.classList.add('is-loaded');
    });

    img.addEventListener('error', () => {
      thumb.classList.add('shortcut-thumb--fallback');
      img.remove();
    });
  });
}

// Shows a live preview of a chosen file before the admin form is submitted.
function setupImageFilePreview() {
  const inputs = Array.from(document.querySelectorAll('[data-file-preview-input]'));

  inputs.forEach((input) => {
    const group = input.closest('.image-upload-group');
    const preview = group?.querySelector('[data-file-preview]');
    const previewImg = preview?.querySelector('[data-file-preview-img]');
    if (!preview || !previewImg) {
      return;
    }

    // The file input is stretched invisibly over its dropzone, so native
    // drag-and-drop works; these only drive the hover styling and file name.
    const dropzone = input.closest('.dropzone');
    const fileName = dropzone?.querySelector('[data-file-name]');
    const defaultFileName = fileName?.textContent || '';

    if (dropzone) {
      input.addEventListener('dragenter', () => dropzone.classList.add('is-dragover'));
      ['dragleave', 'drop'].forEach((type) => {
        input.addEventListener(type, () => dropzone.classList.remove('is-dragover'));
      });
    }

    let objectUrl = null;

    input.addEventListener('change', () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }

      const file = input.files?.[0];
      if (fileName) {
        fileName.textContent = file ? file.name : defaultFileName;
      }

      if (!file) {
        preview.hidden = true;
        previewImg.removeAttribute('src');
        return;
      }

      objectUrl = URL.createObjectURL(file);
      previewImg.src = objectUrl;
      preview.hidden = false;
    });
  });
}

function setupHelpModal() {
  const trigger = document.querySelector('[data-help-trigger]');
  const modal = document.getElementById('help-modal');

  if (!trigger || !modal) {
    return;
  }

  const dialog = modal.querySelector('.help-modal__dialog');
  const urlSlot = modal.querySelector('[data-help-url]');
  const closeElements = Array.from(modal.querySelectorAll('[data-help-close]'));

  let previousActive = null;
  let bodyOverflow = '';

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'help-modal');

  function openModal() {
    if (!modal.hidden) {
      return;
    }

    previousActive = document.activeElement;
    bodyOverflow = document.body.style.overflow;

    if (urlSlot) {
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      urlSlot.textContent = baseUrl;
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      dialog?.focus();
    });

    document.addEventListener('keydown', handleKeydown);
  }

  function closeModal() {
    if (modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.body.style.overflow = bodyOverflow;
    document.removeEventListener('keydown', handleKeydown);

    const target = previousActive && typeof previousActive.focus === 'function' ? previousActive : trigger;

    requestAnimationFrame(() => target.focus());
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  }

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openModal();
  });

  closeElements.forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal();
    });
  });

  modal.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.helpClose !== undefined) {
      event.preventDefault();
      closeModal();
    }
  });
}

// Filters the admin site/folder lists client-side, matching against each
// item's visible summary (name + description) only — not its full edit form,
// which would otherwise match on static field labels too.
function setupAdminSearch() {
  const inputs = Array.from(document.querySelectorAll('[data-admin-search]'));

  inputs.forEach((input) => {
    const key = input.dataset.adminSearch;
    const list = document.querySelector(`[data-admin-list="${key}"]`);
    if (!list) {
      return;
    }

    const items = Array.from(list.querySelectorAll('.admin-item'));

    input.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      let visibleCount = 0;

      items.forEach((item) => {
        const summaryText = item.querySelector('.admin-item__text, summary')?.textContent.toLowerCase() || '';
        const matches = !term || summaryText.includes(term);
        item.style.display = matches ? '' : 'none';
        if (matches) {
          visibleCount += 1;
        }
      });

      toggleAdminSearchNoResults(list, term.length > 0 && items.length > 0 && visibleCount === 0);
    });
  });
}

function toggleAdminSearchNoResults(list, shouldShow) {
  let message = list.querySelector('.admin-search-no-results');

  if (shouldShow) {
    if (!message) {
      message = document.createElement('p');
      message.className = 'empty-state small admin-search-no-results';
      message.textContent = clientTranslations.searchNoResults || '';
      list.appendChild(message);
    }
  } else if (message) {
    message.remove();
  }
}

// Lets the "Undo" button on the post-delete banner restore the item via the
// short-lived server-side trash, without a full page reload for the click itself.
function setupUndoDelete() {
  const button = document.querySelector('[data-undo-token]');
  if (!button) {
    return;
  }

  const UNDO_WINDOW_MS = 15000; // keep in sync with src/lib/trash.js TTL_MS
  const hideTimer = setTimeout(() => {
    button.remove();
  }, UNDO_WINDOW_MS);

  button.addEventListener('click', async () => {
    clearTimeout(hideTimer);

    const token = button.dataset.undoToken;
    const csrfToken = document.querySelector('input[name="_csrf"]')?.value;
    if (!token || !csrfToken) {
      return;
    }

    button.disabled = true;

    try {
      const response = await fetch(`/admin/trash/${encodeURIComponent(token)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `_csrf=${encodeURIComponent(csrfToken)}`,
      });

      if (response.redirected) {
        window.location.href = response.url;
      } else if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error while restoring the deleted item', error);
    } finally {
      button.disabled = false;
    }
  });
}

// Admin status toasts (created/updated/deleted…) dismiss themselves; one
// carrying an undo button stays for the whole undo window. The status query
// parameters are dropped from the URL so a reload doesn't replay the toast.
function setupToasts() {
  const toasts = Array.from(document.querySelectorAll('[data-toast]'));
  if (!toasts.length) {
    return;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.has('status') || url.searchParams.has('undoToken')) {
    url.searchParams.delete('status');
    url.searchParams.delete('undoToken');
    window.history.replaceState({}, '', url);
  }

  toasts.forEach((toast) => {
    const hasUndo = Boolean(toast.querySelector('[data-undo-token]'));
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) {
        return;
      }
      dismissed = true;
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      // Reduced-motion or interrupted animations: make sure it still goes away.
      setTimeout(() => toast.remove(), 400);
    };

    const timer = setTimeout(dismiss, hasUndo ? 15000 : 5000);

    toast.querySelector('[data-toast-close]')?.addEventListener('click', () => {
      clearTimeout(timer);
      dismiss();
    });
  });
}

// Warns before leaving the admin page if any form field was touched but not
// yet submitted, so an accidental navigation doesn't silently discard edits.
function setupUnsavedChangesWarning() {
  const forms = Array.from(document.querySelectorAll('.admin-form'));
  if (!forms.length) {
    return;
  }

  let dirty = false;

  forms.forEach((form) => {
    form.addEventListener('input', () => {
      dirty = true;
    });
    form.addEventListener('submit', () => {
      dirty = false;
    });
  });

  window.addEventListener('beforeunload', (event) => {
    if (!dirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  });
}
