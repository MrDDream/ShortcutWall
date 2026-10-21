# <img src="public/images/logo.svg" alt="Logo ShortcutWall" style="width: 50px; height: auto;" /> ShortcutWall

Cette documentation est disponible en [français](README.fr.md) et en [anglais](README.md).

## Présentation

ShortcutWall est un mur de raccourcis vers des sites web, à héberger soi-même : une page où vous et vos
utilisateurs retrouvez tous les sites utiles, chacun avec son logo, et un espace d'administration pour
les gérer. C'est une seule application Node.js (ou un conteneur Docker), sans base de données.

## Fonctionnalités

- 🧱 **Mur de raccourcis** : de grandes cartes avec logo, nom et description ; un clic ouvre le site.
- 🔎 **Recherche et tri** : recherche instantanée (touche <kbd>/</kbd>) sur les noms, descriptions et
  domaines ; ordre alphabétique ou du plus récent.
- 🖼️ **Logos automatiques** : « Récupérer le favicon » trouve la meilleure icône proposée par le site
  (SVG ou plus grand PNG, vérifiée comme étant bien une image). Les logos sont **stockés par l'app** et
  **réduits à 256 px** : la protection anti-hotlink ou l'en-tête `Cross-Origin-Resource-Policy` d'un
  site ne peuvent pas casser le mur. L'import manuel (PNG, JPG, GIF, WebP) reste possible.
- 🛠️ **Administration en pop-ups** : ajout, modification et suppression sans quitter la liste ; les
  erreurs du serveur (site inaccessible, URL invalide…) s'affichent dans la pop-up sans perdre la
  saisie ; une suppression peut être annulée pendant 15 secondes.
- 💾 **Export / import** : un fichier JSON avec tous les raccourcis et leurs logos, pour sauvegarder ou
  déménager une installation ; l'import peut fusionner ou remplacer.
- 🌗 **Thèmes clair et sombre** : suit le système, modifiable à la main.
- 🌐 **Français et anglais** : sélecteur de langue dans l'en-tête.
- 🔒 **Sécurité** : protection CSRF, CSP et en-têtes de sécurité, limitation des tentatives de
  connexion, garde-fou SSRF sur chaque requête sortante, logos limités aux formats d'image matriciels.

## Captures d'écran

| Mur | Administration |
|-----|----------------|
| ![Mur de raccourcis](screenshots/homepage.png) | ![Administration](screenshots/admin.png) |

![Mur de raccourcis, thème sombre](screenshots/homepage-dark.png)

## Installation

### Avec Docker (recommandé)

1. Récupérez le fichier `docker-compose.yml` et créez un `.env` à côté, à partir de
   [`.env.example`](.env.example). Changez au minimum `SESSION_SECRET`, `ADMIN_USER` et `ADMIN_PASS` :

   ```bash
   cp .env.example .env
   ```

2. Lancez l'image publiée :

   ```bash
   docker compose up -d
   ```

Le mur est accessible sur `http://localhost:3050` et l'administration sur `/admin`.
Les données sont dans `./data` (raccourcis, sessions) et les logos dans `./public/uploads`, tous deux
montés en volumes.

Pour construire l'image depuis les sources (par exemple après avoir modifié le code), utilisez
`docker-compose-dev.yml` :

```bash
docker compose -f docker-compose-dev.yml up -d --build
```

### Sans Docker

Nécessite **Node.js 26** ou plus récent (voir [`.nvmrc`](.nvmrc)).

```bash
git clone https://github.com/MrDDream/ShortcutWall.git
cd ShortcutWall
cp .env.example .env
npm ci
npm start
```

## Configuration

Tout se règle par variables d'environnement, en général dans `.env`.

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SESSION_SECRET` | `change-me` | Secret qui signe la session d'administration. **À changer.** |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / `admin123` | Identifiants d'administration. **À changer.** |
| `PORT` / `HOST` | `3050` / `0.0.0.0` | Port et adresse d'écoute. |
| `TRUST_PROXY` | `false` | À mettre à `true` derrière un reverse proxy (HTTPS, IP du client). |
| `APP_NAME` | `ShortcutWall` | Nom affiché dans l'en-tête et le titre des pages. |
| `APP_DEFAULT_LOCALE` | `fr` | Langue par défaut (`fr` ou `en`). |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | — | Contacts de la fenêtre « Besoin d'aide ? » (masquée si vides). |
| `LOG_LEVEL` | `info` (`debug` en développement) | `fatal`, `error`, `warn`, `info`, `debug` ou `trace`. |
| `DATA_DIR` | `./data` | Dossier des raccourcis et des sessions. |
| `UPLOAD_DIR` | `./public/uploads` | Dossier des logos (servis sur `/uploads`). |

L'administration affiche un avertissement tant que les identifiants ou le secret par défaut sont utilisés.

## Utilisation

- **Mur** : `/`, public, sans compte.
- **Administration** : `/admin`, pour ajouter un site, récupérer son favicon, le modifier ou le supprimer.
- **Sauvegarde** : dans l'administration, *Exporter* télécharge `shortcutwall-AAAA-MM-JJ.json` ;
  *Importer* restaure un tel fichier, soit en le fusionnant (les sites dont l'URL existe déjà sont
  ignorés), soit en remplaçant tous les sites.
- Les logos qui n'appartiennent plus à aucun site (par exemple un favicon récupéré dans une pop-up
  annulée) sont supprimés automatiquement, au démarrage puis une fois par jour.

### Limite connue

Pour éviter les attaques SSRF, le serveur refuse de contacter les adresses du réseau privé
(`192.168.x.x`, `10.x.x.x`, `localhost`…). Les sites hébergés sur votre réseau local ne peuvent donc
pas encore être ajoutés.

## Développement

```bash
npm ci
npm run dev          # redémarre à chaque modification (node --watch)
npm test             # Vitest
npm run lint         # ESLint
npm run format:check # Prettier
```

La CI lance le lint, le formatage, les tests et `npm audit` à chaque push.

## Technologies

| Catégorie | Technologies |
|-----------|--------------|
| Backend | Node.js 26, Express 5 |
| Vues | EJS, CSS et JavaScript natifs (sans étape de build) |
| Stockage | Fichiers JSON, sessions sur disque |
| Images | sharp (redimensionnement), Multer (imports) |
| Sécurité | Helmet, express-rate-limit, jetons CSRF, garde-fou SSRF |
| Tests | Vitest, Supertest |
| Conteneurs | Docker, Docker Compose |

## Structure du projet

```
.
├── server.js              # point d'entrée
├── src/
│   ├── app.js             # application Express (middlewares, routes)
│   ├── config.js          # variables d'environnement
│   ├── lib/               # favicon, import/redimensionnement des logos, garde-fou SSRF, stockage…
│   ├── locales/           # fr.json, en.json
│   ├── middleware/
│   └── routes/            # pages, admin, sites, sauvegarde, favicon…
├── views/                 # gabarits EJS et partiels
├── public/                # styles.css, scripts.js, theme.js, images
├── tests/                 # tests unitaires et d'intégration
├── data/                  # raccourcis et sessions (créé à l'exécution)
└── docker-compose.yml     # image publiée ; docker-compose-dev.yml la construit
```

## Contribuer

Les issues et pull requests sont les bienvenues. Merci de garder le style de code existant et de
vérifier que `npm run lint`, `npm run format:check` et `npm test` passent.

## Licence

[MIT](LICENSE)

## Contact

- [MrDDream](https://github.com/MrDDream)
