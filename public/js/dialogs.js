// Confirmation dialogs (delete, discard changes).

import { clientTranslations } from './i18n.js';

export const DIALOG_ICONS = {
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

// Styled replacement for window.confirm(), built on the native <dialog>
// element (focus trapping, Escape and ::backdrop for free). Falls back to
// window.confirm() on browsers without showModal().
export function confirmDialog(message, { confirmLabel, cancelLabel, icon: iconName = 'trash' } = {}) {
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

export function setupDeleteConfirmation() {
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
