// Admin form helpers: favicon lookup, logo and file previews, submit state,
// unsaved-changes guard.

import { clientTranslations } from './i18n.js';

// Admin forms with edits not yet submitted (see setupUnsavedChangesWarning).
export const dirtyForms = new Set();

export function setupFormSubmitFeedback() {
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

export function restoreSubmitButton(button) {
  if (!button) {
    return;
  }
  button.disabled = false;
  button.classList.remove('is-loading');
  if (button.dataset.originalLabel) {
    button.innerHTML = button.dataset.originalLabel;
  }
}

export function setupFaviconButtons() {
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
        // POST + CSRF token: the lookup stores a file, so it must not be
        // triggerable by a mere cross-site link.
        const csrfToken = button.closest('form')?.querySelector('input[name="_csrf"]')?.value || '';
        const response = await fetch('/api/favicon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ url: url.toString(), _csrf: csrfToken }),
        });

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

// Shows the chosen file's name in its dropzone and, for images, a live preview
// before the admin form is submitted.
export function setupImageFilePreview() {
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
export function setupLogoPreview() {
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

// Warns before leaving the admin page if any form field was touched but not
// yet submitted, so an accidental navigation doesn't silently discard edits.
export function setupUnsavedChangesWarning() {
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
