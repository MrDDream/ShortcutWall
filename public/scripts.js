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

// Admin forms with edits not yet submitted (see setupUnsavedChangesWarning).
const dirtyForms = new Set();

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  setupSortControl();
  setupSearchFilter();
  setupSearchShortcut();
  setupMenus();
  setupFaviconButtons();
  setupFaviconThumbnails();
  setupImageFilePreview();
  setupLogoPreview();
  setupHelpModal();
  setupDeleteConfirmation();
  setupFormSubmitFeedback();
  setupModals();
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

function applySearchFilter() {
  applySorting();

  const term = document.getElementById('search-term')?.value.trim().toLowerCase() || '';
  const grid = document.getElementById('sites-grid');
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

function applySorting() {
  const grid = document.getElementById('sites-grid');
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

// Header dropdowns ([data-menu]: language picker, admin menu). Opening one
// closes the others; Escape or a click outside closes it.
function setupMenus() {
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

const DIALOG_ICONS = {
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

// Styled replacement for window.confirm(), built on the native <dialog>
// element (focus trapping, Escape and ::backdrop for free). Falls back to
// window.confirm() on browsers without showModal().
function confirmDialog(message, { confirmLabel, cancelLabel, icon: iconName = 'trash' } = {}) {
  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(message));
  }

  dialog.className = 'confirm-dialog';

  const icon = document.createElement('span');
  icon.className = 'confirm-dialog__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${DIALOG_ICONS[iconName] || ''}</svg>`;

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
  cancel.textContent = cancelLabel || clientTranslations.cancel || 'Cancel';

  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.value = 'confirm';
  confirm.className = 'btn btn--danger-solid';
  confirm.textContent = confirmLabel || clientTranslations.confirmDeleteAction || 'OK';

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
      submitButton.dataset.originalLabel = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      submitButton.textContent = clientTranslations.saving || submitButton.textContent;
    });
  });
}

function restoreSubmitButton(button) {
  if (!button) {
    return;
  }
  button.disabled = false;
  button.classList.remove('is-loading');
  if (button.dataset.originalLabel) {
    button.innerHTML = button.dataset.originalLabel;
  }
}

// Add/edit forms live in native <dialog> modals ([data-modal-open="id"]
// opens one). They are submitted via fetch so a server-side validation error
// (unreachable site, invalid URL…) shows inside the dialog, with the typed
// values intact, instead of replacing the whole page; on success the server's
// redirect is followed as usual. Without JS the forms still post normally.
function setupModals() {
  const modals = Array.from(document.querySelectorAll('dialog.modal'));
  if (!modals.length) {
    return;
  }

  document.querySelectorAll('[data-modal-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => openModal(document.getElementById(trigger.dataset.modalOpen)));
  });

  modals.forEach((modal) => {
    const form = modal.querySelector('form.admin-form');

    modal.querySelectorAll('[data-modal-close]').forEach((button) => {
      button.addEventListener('click', () => requestModalClose(modal));
    });

    // The dialog box is fully covered by its content, so a click whose target
    // is the <dialog> itself landed on the backdrop.
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        requestModalClose(modal);
      }
    });

    modal.addEventListener('cancel', (event) => {
      event.preventDefault();
      requestModalClose(modal);
    });

    // Closing without saving discards the edits, so reopening shows the
    // stored values again.
    modal.addEventListener('close', () => {
      form?.reset();
      showModalError(modal, '');
      modal.querySelectorAll('[data-favicon-feedback]').forEach((feedback) => {
        feedback.hidden = true;
      });
    });

    if (form) {
      form.addEventListener('submit', (event) => submitModalForm(event, modal, form));
    }
  });

  // "?add=1" (the public page's empty-state button) opens the add dialog.
  const url = new URL(window.location.href);
  if (url.searchParams.get('add') === '1') {
    url.searchParams.delete('add');
    window.history.replaceState({}, '', url);
    openModal(document.getElementById('modal-site-new'));
  }
}

function openModal(modal) {
  if (!modal || modal.open || typeof modal.showModal !== 'function') {
    return;
  }
  modal.showModal();
  // showModal() would focus the header's close button; start on the first
  // field instead, except on touch screens where that pops the keyboard up.
  if (window.matchMedia('(pointer: fine)').matches) {
    modal.querySelector('.admin-form .input')?.focus();
  }
}

async function requestModalClose(modal) {
  const form = modal.querySelector('form.admin-form');
  if (form && dirtyForms.has(form)) {
    const discard = await confirmDialog(clientTranslations.discardChanges || '', {
      confirmLabel: clientTranslations.discardAction,
      cancelLabel: clientTranslations.keepEditing,
      icon: 'alert',
    });
    if (!discard) {
      return;
    }
  }
  modal.close();
}

function showModalError(modal, message) {
  const box = modal.querySelector('[data-form-error]');
  const text = box?.querySelector('[data-form-error-text]');
  if (!box || !text) {
    return;
  }
  text.textContent = message;
  box.hidden = !message;
  if (message) {
    box.scrollIntoView({ block: 'nearest' });
  }
}

async function submitModalForm(event, modal, form) {
  event.preventDefault();
  showModalError(modal, '');

  const submitter = event.submitter;
  const data = new FormData(form);
  // Only the site routes parse multipart bodies (multer); anything else
  // expects a classic urlencoded form.
  const body = form.enctype === 'multipart/form-data' ? data : new URLSearchParams(data);

  try {
    const response = await fetch(form.action, { method: 'POST', body, credentials: 'same-origin' });

    if (response.ok) {
      window.location.href = response.redirected ? response.url : window.location.href;
      return;
    }

    // Errors are short plain-text messages; anything else (an HTML page) is
    // not worth showing verbatim.
    const text = (await response.text()).trim();
    showModalError(modal, text && !text.startsWith('<') ? text : clientTranslations.unexpectedError || '');
  } catch (error) {
    console.error('Error while saving the form', error);
    showModalError(modal, clientTranslations.unexpectedError || '');
  }

  restoreSubmitButton(submitter);
  dirtyForms.add(form);
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

      const originalLabel = button.innerHTML;

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
        button.innerHTML = originalLabel;
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

    const showFallback = () => {
      thumb.classList.add('shortcut-thumb--fallback');
      img.remove();
    };

    // The image may already have settled before this script ran: a failed
    // one is "complete" with no size, and its error event has already fired.
    if (img.complete) {
      if (img.naturalWidth > 0) {
        thumb.classList.add('is-loaded');
      } else {
        showFallback();
      }
      return;
    }

    img.addEventListener('load', () => {
      thumb.classList.add('is-loaded');
    });

    img.addEventListener('error', showFallback);
  });
}

// Shows the chosen file's name in its dropzone and, for images, a live preview
// before the admin form is submitted.
function setupImageFilePreview() {
  const inputs = Array.from(document.querySelectorAll('.dropzone__input'));

  inputs.forEach((input) => {
    const group = input.closest('.image-upload-group');
    const preview = group?.querySelector('[data-file-preview]');
    const previewImg = preview?.querySelector('[data-file-preview-img]');

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

    // form.reset() clears the file input without a "change" event.
    input.form?.addEventListener('reset', () => {
      setTimeout(() => input.dispatchEvent(new Event('change')));
    });

    input.addEventListener('change', () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }

      const file = input.files?.[0];
      if (fileName) {
        fileName.textContent = file ? file.name : defaultFileName;
      }

      if (!preview || !previewImg) {
        return;
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

// Live preview of the logo URL field, so a fetched favicon (or a pasted URL)
// is visibly confirmed before saving. Hidden while empty. A remote image the
// browser can't show (often a site forbidding embedding) gets a note instead:
// the server imports it on save, which usually works around that.
function setupLogoPreview() {
  document.querySelectorAll('[data-logo-preview]').forEach((preview) => {
    const img = preview.querySelector('[data-logo-preview-img]');
    const caption = preview.querySelector('figcaption');
    const input = preview.closest('.image-field')?.querySelector('input[name="imageUrl"]');
    if (!img || !input) {
      return;
    }

    const defaultCaption = caption?.textContent || '';
    let timer = null;

    const setState = (ok) => {
      preview.classList.toggle('is-unavailable', !ok);
      if (caption) {
        caption.textContent = ok ? defaultCaption : clientTranslations.logoPreviewUnavailable || defaultCaption;
      }
    };

    const update = () => {
      const value = input.value.trim();
      if (!value) {
        preview.hidden = true;
        img.removeAttribute('src');
        return;
      }
      if (img.getAttribute('src') !== value) {
        img.src = value;
      }
    };

    img.addEventListener('load', () => {
      setState(true);
      preview.hidden = !input.value.trim();
    });
    img.addEventListener('error', () => {
      setState(false);
      preview.hidden = !input.value.trim();
    });

    // Rendered with the stored logo, which may have failed before this ran.
    if (img.getAttribute('src') && img.complete && img.naturalWidth === 0) {
      setState(false);
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(update, 300);
    });
    // form.reset() restores the stored URL without an "input" event.
    input.form?.addEventListener('reset', () => setTimeout(update));
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

// Filters the admin list client-side, matching against each item's visible
// name + description only.
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

  forms.forEach((form) => {
    form.addEventListener('input', () => dirtyForms.add(form));
    form.addEventListener('submit', () => dirtyForms.delete(form));
    form.addEventListener('reset', () => dirtyForms.delete(form));
  });

  window.addEventListener('beforeunload', (event) => {
    if (!dirtyForms.size) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  });
}
