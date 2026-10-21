// Entry point (loaded as an ES module, so it runs once the page is parsed).
// Each setup function only acts on the elements present on the current page.

import { setupAdminSearch, setupToasts, setupUndoDelete } from './admin.js';
import { setupDeleteConfirmation } from './dialogs.js';
import {
  setupFaviconButtons,
  setupFormSubmitFeedback,
  setupImageFilePreview,
  setupLogoPreview,
  setupUnsavedChangesWarning,
} from './forms.js';
import { setupHelpModal } from './help-modal.js';
import { setupMenus } from './menus.js';
import { setupModals } from './modals.js';
import { initThemeToggle } from './theme-toggle.js';
import { setupFaviconThumbnails, setupSearchFilter, setupSearchShortcut, setupSortControl } from './wall.js';

// Order matters for the admin forms' submit handlers: the button's loading
// state is set first, then the dialog's fetch submission, then the
// unsaved-changes guard clears the form.
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
