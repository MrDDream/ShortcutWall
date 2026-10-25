// Add/edit/import dialogs of the admin area.

import { confirmDialog } from './dialogs.js';
import { dirtyForms, isLoginRedirect, restoreSubmitButton } from './forms.js';
import { clientTranslations } from './i18n.js';

// Add/edit forms live in native <dialog> modals ([data-modal-open="id"]
// opens one). They are submitted via fetch so a server-side validation error
// (unreachable site, invalid URL…) shows inside the dialog, with the typed
// values intact, instead of replacing the whole page; on success the server's
// redirect is followed as usual. Without JS the forms still post normally.
export function setupModals() {
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

export function openModal(modal) {
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

export async function requestModalClose(modal) {
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

export function showModalError(modal, message) {
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

export async function submitModalForm(event, modal, form) {
  event.preventDefault();
  showModalError(modal, '');

  const submitter = event.submitter;
  const data = new FormData(form);
  // Only the site routes parse multipart bodies (multer); anything else
  // expects a classic urlencoded form.
  const body = form.enctype === 'multipart/form-data' ? data : new URLSearchParams(data);

  try {
    const response = await fetch(form.action, { method: 'POST', body, credentials: 'same-origin' });

    // An expired session answers with the login page: keep the dialog and
    // its values instead of following it.
    if (isLoginRedirect(response)) {
      showModalError(modal, clientTranslations.sessionExpired || '');
      restoreSubmitButton(submitter);
      return;
    }

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
