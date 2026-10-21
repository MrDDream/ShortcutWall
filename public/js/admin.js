// Admin list search, undo after delete and status toasts.

import { clientTranslations } from './i18n.js';

// Filters the admin list client-side, matching against each item's visible
// name + description only.
export function setupAdminSearch() {
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

export function toggleAdminSearchNoResults(list, shouldShow) {
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

// Length of the server's undo window (src/lib/trash.js), sent with the toast.
function undoWindowMs(element) {
  return Number(element?.closest('[data-undo-window]')?.dataset.undoWindow) || 15000;
}

// Lets the "Undo" button on the post-delete banner restore the item via the
// short-lived server-side trash, without a full page reload for the click itself.
export function setupUndoDelete() {
  const button = document.querySelector('[data-undo-token]');
  if (!button) {
    return;
  }

  const hideTimer = setTimeout(() => {
    button.remove();
  }, undoWindowMs(button));

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
export function setupToasts() {
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

    const timer = setTimeout(dismiss, hasUndo ? undoWindowMs(toast) : 5000);

    toast.querySelector('[data-toast-close]')?.addEventListener('click', () => {
      clearTimeout(timer);
      dismiss();
    });
  });
}
