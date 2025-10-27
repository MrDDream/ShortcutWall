const clientTranslations =
  (typeof window !== "undefined" && window.appTranslations) || {};

let currentSort = "alpha";

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  setupSortControl();
  setupViewSwitch();
  setupSearchFilter();
  setupAdminTabs();
  setupFaviconButtons();
  setupHelpModal();
});

function initThemeToggle() {
  const body = document.body;
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "theme-dark" || savedTheme === "theme-light") {
    body.classList.remove("theme-dark", "theme-light");
    body.classList.add(savedTheme);
  }

  updateThemeIcon(toggle, body.classList.contains("theme-dark"));

  toggle.addEventListener("click", () => {
    const isDark = body.classList.toggle("theme-dark");
    if (!isDark) {
      body.classList.add("theme-light");
    } else {
      body.classList.remove("theme-light");
    }

    localStorage.setItem("theme", isDark ? "theme-dark" : "theme-light");
    updateThemeIcon(toggle, isDark);
  });
}

function updateThemeIcon(button, isDark) {
  button.textContent = isDark ? "\u2600" : "\u263E";
}

function setupViewSwitch() {
  const switchButtons = Array.from(document.querySelectorAll(".view-switch__button"));
  if (!switchButtons.length) {
    return;
  }

  const grids = {
    sites: document.getElementById("sites-grid"),
    folders: document.getElementById("folders-grid"),
  };

  let currentView =
    switchButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.view || "sites";
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
      section.classList.toggle("is-active", key === view);
    });

    switchButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === view);
    });

    const url = new URL(window.location.href);
    url.searchParams.set("type", view);
    window.history.replaceState({}, "", url);

    applySorting(view);
    applySearchFilter();
  }

  switchButtons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      activate(btn.dataset.view);
    });
  });

  activate(currentView);
}

function setupSearchFilter() {
  const input = document.getElementById("search-term");
  if (!input) {
    return;
  }

  input.addEventListener("input", () => {
    applySearchFilter();
  });

  applySearchFilter();
}

function applySearchFilter(view) {
  const targetView =
    view || document.body.dataset.view || document.querySelector(".view-switch__button.is-active")?.dataset.view || "sites";
  applySorting(targetView);

  const term = document.getElementById("search-term")?.value.trim().toLowerCase() || "";
  const grid = document.getElementById(`${targetView}-grid`);
  if (!grid) {
    return;
  }

  const cards = Array.from(grid.querySelectorAll(".shortcut-card"));
  cards.forEach((card) => {
    const matches =
      !term ||
      card.dataset.name.includes(term) ||
      (card.dataset.description && card.dataset.description.includes(term));
    card.style.display = matches ? "" : "none";
  });
}

function setupSortControl() {
  const select = document.getElementById("sort-order");

  const allowedValues = new Set(["alpha", "recent"]);
  if (select) {
    const url = new URL(window.location.href);
    const urlSort = url.searchParams.get("sort");
    if (urlSort && allowedValues.has(urlSort)) {
      select.value = urlSort;
    }

    currentSort = select.value;

    select.addEventListener("change", () => {
      currentSort = allowedValues.has(select.value) ? select.value : "alpha";
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("sort", currentSort);
      window.history.replaceState({}, "", nextUrl);
      applySorting();
      applySearchFilter();
    });
  } else {
    currentSort = "alpha";
  }

  applySorting();
}

function applySorting(view) {
  const views = view ? [view] : ["sites", "folders"];
  views.forEach((targetView) => {
    const grid = document.getElementById(`${targetView}-grid`);
    if (!grid) {
      return;
    }

    const cards = Array.from(grid.querySelectorAll(".shortcut-card"));
    cards.sort((cardA, cardB) => compareCards(cardA, cardB, currentSort));
    cards.forEach((card) => grid.appendChild(card));
  });
}

function compareCards(cardA, cardB, sortType) {
  if (sortType === "recent") {
    const timeA = Date.parse(cardA.dataset.created || "") || 0;
    const timeB = Date.parse(cardB.dataset.created || "") || 0;
    const diff = timeB - timeA;
    if (diff !== 0) {
      return diff;
    }
  }

  const nameA = (cardA.dataset.sortName || cardA.dataset.name || "").toString();
  const nameB = (cardB.dataset.sortName || cardB.dataset.name || "").toString();
  return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
}

function setupAdminTabs() {
  const tabsContainer = document.querySelector(".admin-tabs");
  if (!tabsContainer) {
    return;
  }

  const buttons = Array.from(tabsContainer.querySelectorAll(".admin-tab"));
  const panels = Array.from(document.querySelectorAll(".admin-panel"));
  const defaultTab = tabsContainer.dataset.defaultTab || "sites";

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

    panels.forEach((panel) => panel.classList.toggle("is-active", panel === targetPanel));
    buttons.forEach((button) => button.classList.toggle("is-active", button === targetButton));

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.replaceState({}, "", url);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button.dataset.tab));
  });

  activate(defaultTab);
}

function setupFaviconButtons() {
  const buttons = Array.from(document.querySelectorAll(".fetch-favicon"));
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const sourceSelector = button.dataset.source;
      const targetSelector = button.dataset.target;

      if (!sourceSelector || !targetSelector) {
        return;
      }

      let source;
      let target;

      if (sourceSelector.startsWith("#")) {
        source = document.querySelector(sourceSelector);
      } else {
        source = button.closest("form")?.querySelector(sourceSelector);
      }

      if (targetSelector.startsWith("#")) {
        target = document.querySelector(targetSelector);
      } else {
        target = button.closest("form")?.querySelector(targetSelector);
      }

      if (!source || !target) {
        return;
      }

      try {
        const url = new URL(source.value.trim());
        const faviconUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(
          url.origin,
        )}&sz=128`;
        target.value = faviconUrl;
      } catch (error) {
        const fallbackMessage =
          "Invalid URL. Please enter a valid address before fetching the favicon.";
        alert(clientTranslations.invalidUrl || fallbackMessage);
      }
    });
  });
}

function setupHelpModal() {
  const trigger = document.querySelector("[data-help-trigger]");
  const modal = document.getElementById("help-modal");
  if (!trigger || !modal) {
    return;
  }

  const dialog = modal.querySelector(".help-modal__dialog");
  const urlSlot = modal.querySelector("[data-help-url]");
  const closeElements = Array.from(modal.querySelectorAll("[data-help-close]"));
  let previousActive = null;
  let bodyOverflow = "";

  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "help-modal");

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
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      dialog?.focus();
    });
    document.addEventListener("keydown", handleKeydown);
  }

  function closeModal() {
    if (modal.hidden) {
      return;
    }
    modal.hidden = true;
    document.body.style.overflow = bodyOverflow;
    document.removeEventListener("keydown", handleKeydown);
    const target = previousActive && typeof previousActive.focus === "function" ? previousActive : trigger;
    requestAnimationFrame(() => target.focus());
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  closeElements.forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      closeModal();
    });
  });

  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.helpClose !== undefined) {
      event.preventDefault();
      closeModal();
    }
  });
}
