const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { FOLDERS_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { updateJson, NotFoundError } = require('../lib/store');
const { stash } = require('../lib/trash');

const router = express.Router();

router.post('/', ensureAuthenticated, verifyCsrfToken, async (req, res, next) => {
  try {
    const { name, networkPath } = req.body;
    if (!name || !networkPath) {
      return res.status(400).send(res.locals.t('errors.missingFolderFields'));
    }

    await updateJson(FOLDERS_FILE, (folders) => {
      folders.push({
        id: uuidv4(),
        name: name.trim(),
        networkPath: networkPath.trim(),
        createdAt: new Date().toISOString(),
      });
      return folders;
    });

    res.redirect('/admin?tab=folders&status=created');
  } catch (error) {
    next(error);
  }
});

router.post('/:id', ensureAuthenticated, verifyCsrfToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, networkPath } = req.body;

    await updateJson(FOLDERS_FILE, (folders) => {
      const index = folders.findIndex((folder) => folder.id === id);
      if (index === -1) {
        throw new NotFoundError();
      }

      folders[index] = {
        ...folders[index],
        name: name?.trim() || folders[index].name,
        networkPath: networkPath?.trim() || folders[index].networkPath,
        updatedAt: new Date().toISOString(),
      };

      return folders;
    });

    res.redirect('/admin?tab=folders&status=updated');
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).send(res.locals.t('errors.folderNotFound'));
    }
    next(error);
  }
});

router.post('/:id/delete', ensureAuthenticated, verifyCsrfToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    let deletedFolder = null;

    await updateJson(FOLDERS_FILE, (folders) => {
      const index = folders.findIndex((folder) => folder.id === id);
      if (index === -1) {
        throw new NotFoundError();
      }
      deletedFolder = folders[index];
      return folders.filter((folder) => folder.id !== id);
    });

    const undoToken = deletedFolder ? stash({ type: 'folder', item: deletedFolder }) : null;
    const undoParam = undoToken ? `&undoToken=${encodeURIComponent(undoToken)}` : '';

    res.redirect(`/admin?tab=folders&status=deleted${undoParam}`);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).send(res.locals.t('errors.folderNotFound'));
    }
    next(error);
  }
});

module.exports = router;
