// Public wall: search, sort, "/" shortcut and logo loading.

import { clientTranslations } from './i18n.js';

let currentSort = 'alpha';

export function setupSearchFilter() {
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
export function setupSearchShortcut() {
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

export function applySearchFilter() {
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

export function toggleNoResultsMessage(grid, shouldShow) {
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

export function setupSortControl() {
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

export function applySorting() {
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

export function compareCards(cardA, cardB, sortType) {
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

// Fades each shortcut logo in once it has actually loaded (CSS shows a
// pulsing placeholder on .shortcut-thumb until then) and falls back to the
// letter avatar on error. Handled here rather than inline onerror/onload
// attributes, which the app's Content-Security-Policy (script-src-attr
// 'none') blocks outright.
export function setupFaviconThumbnails() {
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
