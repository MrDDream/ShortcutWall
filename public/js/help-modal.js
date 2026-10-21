// "Need help?" dialog of the public wall.

export function setupHelpModal() {
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
