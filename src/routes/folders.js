const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { FOLDERS_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { readJson, writeJson } = require('../lib/store');

const router = express.Router();

router.post('/', ensureAuthenticated, async (req, res) => {
  const { name, networkPath } = req.body;
  if (!name || !networkPath) {
    return res.status(400).send(res.locals.t('errors.missingFolderFields'));
  }

  const folders = await readJson(FOLDERS_FILE);
  folders.push({
    id: uuidv4(),
    name: name.trim(),
    networkPath: networkPath.trim(),
    createdAt: new Date().toISOString(),
  });

  await writeJson(FOLDERS_FILE, folders);
  res.redirect('/admin?tab=folders&status=created');
});

router.post('/:id', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { name, networkPath } = req.body;
  const folders = await readJson(FOLDERS_FILE);
  const index = folders.findIndex((folder) => folder.id === id);

  if (index === -1) {
    return res.status(404).send(res.locals.t('errors.folderNotFound'));
  }

  folders[index] = {
    ...folders[index],
    name: name?.trim() || folders[index].name,
    networkPath: networkPath?.trim() || folders[index].networkPath,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(FOLDERS_FILE, folders);
  res.redirect('/admin?tab=folders&status=updated');
});

router.post('/:id/delete', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const folders = await readJson(FOLDERS_FILE);
  const nextFolders = folders.filter((folder) => folder.id !== id);

  if (folders.length === nextFolders.length) {
    return res.status(404).send(res.locals.t('errors.folderNotFound'));
  }

  await writeJson(FOLDERS_FILE, nextFolders);
  res.redirect('/admin?tab=folders&status=deleted');
});

module.exports = router;
