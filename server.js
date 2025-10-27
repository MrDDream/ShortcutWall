require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = Number(process.env.PORT) || 3050;
const HOST = process.env.HOST || '0.0.0.0';
const SITES_FILE = path.join(__dirname, 'data', 'shortcuts.json');
const FOLDERS_FILE = path.join(__dirname, 'data', 'folders.json');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const APP_NAME = (process.env.APP_NAME && process.env.APP_NAME.trim()) || 'ShorctutWall';
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL && process.env.SUPPORT_EMAIL.trim()) || '';
const SUPPORT_PHONE = (process.env.SUPPORT_PHONE && process.env.SUPPORT_PHONE.trim()) || '';
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

const SUPPORTED_LOCALES = ['fr', 'en'];
const DEFAULT_LOCALE = normalizeLocale(process.env.APP_DEFAULT_LOCALE) || 'fr';
const LANGUAGE_FLAGS = {
  fr: { icon: '/images/flags/fr.svg' },
  en: { icon: '/images/flags/gb.svg' },
};

fs.mkdir(UPLOAD_DIR, { recursive: true }).catch((error) => {
  console.error('Unable to ensure upload directory', error);
});

const uploadStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const { name, ext } = path.parse(file.originalname);
    const safeName = sanitizeFilename(name || 'image');
    const timestamp = Date.now();
    cb(null, `${safeName}-${timestamp}${ext.toLowerCase()}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seuls les fichiers image sont autorisés.'));
    }
    cb(null, true);
  },
});

const TRANSLATIONS = {
  fr: {
    app: {
      homeTitle: 'Accueil',
      adminTitle: 'Administration',
      loginTitle: 'Connexion',
      notFoundTitle: 'Page introuvable',
    },
    header: {
      viewSites: 'Raccourci Internet',
      viewFolders: 'Raccourci Dossier',
      login: 'Connexion',
      logout: 'Se déconnecter',
    },
    search: {
      label: 'Recherche',
      placeholder: 'Rechercher un raccourci...',
      sortLabel: 'Trier',
      sortAlphabetical: 'Ordre alphabétique',
      sortRecent: 'Ajout récent',
      helpLink: "Besoin d'aide ?",
    },
    help: {
      titlePrefix: 'Vous rencontrez un problème avec le site',
      titleSuffix: ' ?',
      contactIntro: 'Vous pouvez nous contacter via :',
      phoneLabel: 'Téléphone',
      emailLabel: 'E-mail',
      close: 'Fermer',
    },
    shortcuts: {
      siteEmpty: 'Aucun raccourci Internet pour le moment.',
      folderEmpty: 'Aucun raccourci dossier pour le moment.',
      siteDownloadTitle: 'Télécharger',
      siteAccessTitle: 'Accéder au site',
    },
    admin: {
      tabsSites: 'Gestion des sites',
      tabsFolders: 'Gestion des dossiers',
      addSite: 'Ajouter un site',
      existingSites: 'Sites existants',
      addFolder: 'Ajouter un dossier',
      existingFolders: 'Dossiers existants',
      emptySites: 'Aucun site pour le moment.',
      emptyFolders: 'Aucun dossier pour le moment.',
    },
    forms: {
      name: 'Nom',
      descriptionOptional: 'Description (optionnel)',
      url: 'URL',
      networkPath: 'Chemin réseau',
      logoUrlOptional: 'URL du logo (optionnel)',
      siteUrlPlaceholder: 'https://exemple.com',
      siteImagePlaceholder: 'https://exemple.com/logo.png',
      networkPathPlaceholder: '\\\\serveur\\partage',
      save: 'Enregistrer',
      update: 'Mettre à jour',
      delete: 'Supprimer',
      fetchFavicon: 'Récupérer le favicon',
      uploadFile: 'Importer une image',
      uploadHint: 'Un fichier téléversé remplace l\'URL ci-dessus.',
      currentImage: 'Aperçu actuel',
    },
    login: {
      adminArea: 'Espace administrateur',
      username: "Nom d'utilisateur",
      password: 'Mot de passe',
      submit: 'Se connecter',
      invalidCredentials: 'Identifiants invalides',
    },
    notFound: {
      message: 'La ressource demandée est introuvable.',
      backHome: "Retour à l'accueil",
    },
    alerts: {
      invalidUrl: 'URL invalide. Veuillez saisir une adresse valide avant de récupérer le favicon.',
    },
    errors: {
      siteNotFound: 'Site introuvable.',
      folderNotFound: 'Dossier introuvable.',
      missingSiteFields: "Le nom et l'URL sont obligatoires.",
      missingFolderFields: 'Le nom et le chemin sont obligatoires.',
      shortcutGeneration: 'Impossible de générer le raccourci.',
      languageNotSupported: 'Langue non prise en charge.',
    },
    language: {
      name: { fr: 'Français', en: 'Anglais' },
      switch: 'Passer en {language}',
    },
  },
  en: {
    app: {
      homeTitle: 'Home',
      adminTitle: 'Administration',
      loginTitle: 'Sign in',
      notFoundTitle: 'Page not found',
    },
    header: {
      viewSites: 'Website Shortcuts',
      viewFolders: 'Folder Shortcuts',
      login: 'Sign in',
      logout: 'Sign out',
    },
    search: {
      label: 'Search',
      placeholder: 'Search a shortcut...',
      sortLabel: 'Sort',
      sortAlphabetical: 'Alphabetical',
      sortRecent: 'Recently added',
      helpLink: 'Need help?',
    },
    help: {
      titlePrefix: 'Having trouble with',
      titleSuffix: '?',
      contactIntro: 'You can reach us via:',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      close: 'Close',
    },
    shortcuts: {
      siteEmpty: 'No website shortcuts yet.',
      folderEmpty: 'No folder shortcuts yet.',
      siteDownloadTitle: 'Download',
      siteAccessTitle: 'Open site',
    },
    admin: {
      tabsSites: 'Website management',
      tabsFolders: 'Folder management',
      addSite: 'Add a website',
      existingSites: 'Existing websites',
      addFolder: 'Add a folder',
      existingFolders: 'Existing folders',
      emptySites: 'No websites yet.',
      emptyFolders: 'No folders yet.',
    },
    forms: {
      name: 'Name',
      descriptionOptional: 'Description (optional)',
      url: 'URL',
      networkPath: 'Network path',
      logoUrlOptional: 'Logo URL (optional)',
      siteUrlPlaceholder: 'https://example.com',
      siteImagePlaceholder: 'https://example.com/logo.png',
      networkPathPlaceholder: '\\\\server\\share',
      save: 'Save',
      update: 'Update',
      delete: 'Delete',
      fetchFavicon: 'Fetch favicon',
      uploadFile: 'Upload an image',
      uploadHint: 'An uploaded file replaces the URL above.',
      currentImage: 'Current preview',
    },
    login: {
      adminArea: 'Administrator area',
      username: 'Username',
      password: 'Password',
      submit: 'Sign in',
      invalidCredentials: 'Invalid credentials',
    },
    notFound: {
      message: 'The requested resource could not be found.',
      backHome: 'Back to home',
    },
    alerts: {
      invalidUrl: 'Invalid URL. Please enter a valid address before fetching the favicon.',
    },
    errors: {
      siteNotFound: 'Website not found.',
      folderNotFound: 'Folder not found.',
      missingSiteFields: 'Name and URL are required.',
      missingFolderFields: 'Name and path are required.',
      shortcutGeneration: 'Unable to generate the shortcut.',
      languageNotSupported: 'Unsupported language.',
    },
    language: {
      name: { fr: 'French', en: 'English' },
      switch: 'Switch to {language}',
    },
  },
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);

app.use((req, res, next) => {
  const sessionLocale = normalizeLocale(req.session?.locale) || DEFAULT_LOCALE;
  if (req.session) {
    req.session.locale = sessionLocale;
  }

  res.locals.locale = sessionLocale;
  res.locals.appName = APP_NAME;
  res.locals.t = (key, vars) => translate(sessionLocale, key, vars);
  res.locals.supportEmail = SUPPORT_EMAIL;
  res.locals.supportPhone = SUPPORT_PHONE;

  const nextLocale = sessionLocale === 'fr' ? 'en' : 'fr';
  const nextLanguageName = translate(sessionLocale, `language.name.${nextLocale}`);
  const currentLanguageName = translate(sessionLocale, `language.name.${sessionLocale}`);
  const currentFlag = LANGUAGE_FLAGS[sessionLocale] || {};
  res.locals.languageToggle = {
    next: nextLocale,
    currentIcon: currentFlag.icon || null,
    currentLabel: currentLanguageName,
    title: translate(sessionLocale, 'language.switch', { language: nextLanguageName }),
  };
  res.locals.clientTranslations = {
    invalidUrl: translate(sessionLocale, 'alerts.invalidUrl'),
  };
  next();
});

app.use(async (req, res, next) => {
  try {
    const [sites, folders] = await Promise.all([readJson(SITES_FILE), readJson(FOLDERS_FILE)]);
    res.locals.sites = Array.isArray(sites)
      ? [...sites].sort((a, b) => {
          const nameA = (a?.name || '').toString();
          const nameB = (b?.name || '').toString();
          return nameA.localeCompare(nameB, res.locals.locale || DEFAULT_LOCALE, { sensitivity: 'base' });
        })
      : [];
    res.locals.folders = folders;
  } catch (error) {
    console.error('Unable to load data files', error);
    res.locals.sites = [];
    res.locals.folders = [];
  }
  res.locals.includeViewSwitch = false;
  res.locals.viewMode = 'sites';
  res.locals.isAuthenticated = req.session?.isAuthenticated;
  next();
});

app.get('/language/:locale', (req, res) => {
  const locale = normalizeLocale(req.params.locale);
  if (!locale) {
    return res.status(400).send(res.locals.t('errors.languageNotSupported'));
  }
  if (req.session) {
    req.session.locale = locale;
  }
  const redirectTarget = req.get('Referer') || '/';
  return res.redirect(redirectTarget);
});

app.get('/', (req, res) => {
  const viewMode = req.query.type === 'folders' ? 'folders' : 'sites';
  res.locals.includeViewSwitch = true;
  res.locals.viewMode = viewMode;
  res.render('index', {
    sites: res.locals.sites,
    folders: res.locals.folders,
    viewMode,
    pageTitle: res.locals.t('app.homeTitle'),
  });
});

app.get('/site/:id/download', ensureSiteExists, (req, res) => {
  const site = res.locals.site;
  const filename = `${buildDownloadFilename(site.name, 'site')}.url`;
  const payload = createInternetShortcutPayload(site.targetUrl);

  sendInternetShortcut(res, filename, payload);
});

app.get('/folder/:id/download', ensureFolderExists, (req, res) => {
  const folder = res.locals.folder;
  const filename = `${buildDownloadFilename(folder.name, 'dossier')}.url`;
  const payload = createInternetShortcutPayload(normalizeNetworkPath(folder.networkPath));

  sendInternetShortcut(res, filename, payload);
});

app.get('/admin/login', (req, res) => {
  if (req.session?.isAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('login', { pageTitle: res.locals.t('app.loginTitle'), errorKey: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAuthenticated = true;
    return res.redirect('/admin');
  }

  res.render('login', {
    pageTitle: res.locals.t('app.loginTitle'),
    errorKey: 'login.invalidCredentials',
  });
});

app.post('/admin/logout', ensureAuthenticated, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

app.get('/admin', ensureAuthenticated, (req, res) => {
  const activeTab = req.query.tab === 'folders' ? 'folders' : 'sites';
  res.render('admin', {
    sites: res.locals.sites,
    folders: res.locals.folders,
    activeTab,
    pageTitle: res.locals.t('app.adminTitle'),
  });
});

app.post('/admin/site', ensureAuthenticated, upload.single('imageFile'), async (req, res) => {
  const uploadedPath = req.file ? buildUploadedPath(req.file.filename) : null;
  try {
    const { name, targetUrl } = req.body;
    const descriptionInput = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const imageUrlInput = req.body.imageUrl?.trim();

    if (!name || !targetUrl) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }
      return res.status(400).send(res.locals.t('errors.missingSiteFields'));
    }

    const sites = await readJson(SITES_FILE);
    sites.push({
      id: uuidv4(),
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      description: descriptionInput,
      imageUrl: uploadedPath || imageUrlInput || '',
      createdAt: new Date().toISOString(),
    });

    await writeJson(SITES_FILE, sites);
    res.redirect('/admin?tab=sites');
  } catch (error) {
    console.error('Erreur lors de la création du site', error);
    if (uploadedPath) {
      await deleteUploadedAsset(uploadedPath);
    }
    res.status(500).send(res.locals.t('errors.shortcutGeneration'));
  }
});

app.post('/admin/site/:id', ensureAuthenticated, upload.single('imageFile'), async (req, res) => {
  const uploadedPath = req.file ? buildUploadedPath(req.file.filename) : null;
  try {
    const { id } = req.params;
    const { name, targetUrl } = req.body;
    const descriptionInput = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;
    const imageUrlInput = req.body.imageUrl?.trim();
    const sites = await readJson(SITES_FILE);
    const index = sites.findIndex((site) => site.id === id);

    if (index === -1) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }
      return res.status(404).send(res.locals.t('errors.siteNotFound'));
    }

    const previousImage = sites[index].imageUrl;
    let nextImage = previousImage;
    let shouldDeletePrevious = false;

    if (uploadedPath) {
      nextImage = uploadedPath;
      shouldDeletePrevious = true;
    } else if (typeof req.body.imageUrl !== 'undefined') {
      nextImage = imageUrlInput || '';
      if (nextImage !== previousImage) {
        shouldDeletePrevious = true;
      }
    }

    sites[index] = {
      ...sites[index],
      name: name?.trim() || sites[index].name,
      targetUrl: targetUrl?.trim() || sites[index].targetUrl,
      description: typeof descriptionInput === 'undefined' ? sites[index].description || '' : descriptionInput,
      imageUrl: nextImage,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(SITES_FILE, sites);

    if (shouldDeletePrevious) {
      await deleteUploadedAsset(previousImage);
    }

    res.redirect('/admin?tab=sites');
  } catch (error) {
    console.error('Erreur lors de la mise à jour du site', error);
    if (uploadedPath) {
      await deleteUploadedAsset(uploadedPath);
    }
    res.status(500).send(res.locals.t('errors.shortcutGeneration'));
  }
});

app.post('/admin/site/:id/delete', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const sites = await readJson(SITES_FILE);
  const targetSite = sites.find((site) => site.id === id);
  const nextSites = sites.filter((site) => site.id !== id);

  if (sites.length === nextSites.length) {
    return res.status(404).send(res.locals.t('errors.siteNotFound'));
  }

  await writeJson(SITES_FILE, nextSites);
  if (targetSite) {
    await deleteUploadedAsset(targetSite.imageUrl);
  }
  res.redirect('/admin?tab=sites');
});

app.post('/admin/folder', ensureAuthenticated, async (req, res) => {
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
  res.redirect('/admin?tab=folders');
});

app.post('/admin/folder/:id', ensureAuthenticated, async (req, res) => {
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
  res.redirect('/admin?tab=folders');
});

app.post('/admin/folder/:id/delete', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const folders = await readJson(FOLDERS_FILE);
  const nextFolders = folders.filter((folder) => folder.id !== id);

  if (folders.length === nextFolders.length) {
    return res.status(404).send(res.locals.t('errors.folderNotFound'));
  }

  await writeJson(FOLDERS_FILE, nextFolders);
  res.redirect('/admin?tab=folders');
});

app.use((req, res) => {
  res.status(404).render('404', { pageTitle: res.locals.t('app.notFoundTitle') });
});

app.listen(PORT, HOST, () => {
  const hostText = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`Serveur pret sur http://${hostText}:${PORT}`);
});

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeJson(filePath, []);
      return [];
    }
    throw error;
  }
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function ensureAuthenticated(req, res, next) {
  if (req.session?.isAuthenticated) {
    return next();
  }
  return res.redirect('/admin/login');
}

function ensureSiteExists(req, res, next) {
  const site = res.locals.sites.find((item) => item.id === req.params.id);
  if (!site) {
    return res.status(404).send(res.locals.t('errors.siteNotFound'));
  }
  res.locals.site = site;
  next();
}

function ensureFolderExists(req, res, next) {
  const folder = res.locals.folders.find((item) => item.id === req.params.id);
  if (!folder) {
    return res.status(404).send(res.locals.t('errors.folderNotFound'));
  }
  res.locals.folder = folder;
  next();
}

function sanitizeFilename(name) {
  if (!name) {
    return '';
  }
  return name
    .toString()
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '');
}

function normalizeNetworkPath(value = '') {
  if (!value) {
    return '';
  }
  let target = value.trim();
  if (!target) {
    return '';
  }
  if (target.startsWith('file://')) {
    return target;
  }
  if (target.startsWith('\\\\')) {
    return toDosPath(target);
  }
  if (/^[a-zA-Z]:[\\/]/.test(target)) {
    return toDosPath(target);
  }
  return target;
}

function toDosPath(input) {
  return input
    .replace(/^\s+|\s+$/g, '')
    .replace(/\//g, '\\')
    .replace(/\\\\+/g, '\\\\');
}

function buildUploadedPath(filename) {
  return `/uploads/${filename}`;
}

function isUploadedAsset(value) {
  return typeof value === 'string' && value.startsWith('/uploads/');
}

async function deleteUploadedAsset(value) {
  if (!isUploadedAsset(value)) {
    return;
  }
  const absolutePath = path.join(__dirname, 'public', value.replace(/^\//, ''));
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Unable to delete uploaded asset', absolutePath, error);
    }
  }
}

function normalizeLocale(value) {
  if (!value) {
    return null;
  }
  const lowered = value.toString().trim().toLowerCase();
  return SUPPORTED_LOCALES.includes(lowered) ? lowered : null;
}

function translate(locale, key, vars = {}) {
  const dictionary = TRANSLATIONS[locale] || TRANSLATIONS[DEFAULT_LOCALE];
  const parts = key.split('.');
  let current = dictionary;
  for (const part of parts) {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      current = null;
      break;
    }
  }
  if (typeof current !== 'string') {
    return key;
  }
  return current.replace(/\{(\w+)\}/g, (_, token) => (token in vars ? vars[token] : `{${token}}`));
}

function buildDownloadFilename(name, fallback) {
  const base = sanitizeFilename(name) || fallback;
  return base.replace(/[\s']+/g, '_');
}

function createInternetShortcutPayload(target) {
  const cleaned = target.toString().replace(/\r?\n/g, '').trim();
  const normalized = cleaned.normalize('NFKC');
  return `[InternetShortcut]\r\nURL=${normalized}\r\n`;
}

function sendInternetShortcut(res, filename, payload) {
  const fileLabel = filename.replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  const buffer = Buffer.from(`\uFEFF${payload}`, 'utf16le');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileLabel}"; filename*=UTF-8''${encoded}`,
  );
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
