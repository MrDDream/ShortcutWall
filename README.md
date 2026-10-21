# <img src="public/images/logo.svg" alt="ShortcutWall logo" style="width: 50px; height: auto;" /> ShortcutWall

This documentation is available in [French](README.fr.md) and in [English](README.md).

## Overview

ShortcutWall is a self-hosted wall of website shortcuts: one page where you and your users find every
useful site, each with its logo, plus an admin area to manage them. It runs as a single Node.js app
(or Docker container) with no database.

## Features

- 🧱 **Shortcut wall** — large cards with logo, name and description; one click opens the site.
- 🔎 **Search and sort** — instant search (press <kbd>/</kbd>) on names, descriptions and domains;
  alphabetical or most recent order.
- 🖼️ **Automatic logos** — "Fetch favicon" finds the best icon a site offers (SVG or largest PNG,
  checked to really be an image). Logos are **stored by the app** and **downsized to 256 px**, so a
  site's hotlink protection or `Cross-Origin-Resource-Policy` header can't break the wall. Manual
  uploads (PNG, JPG, GIF, WebP) work too.
- 🛠️ **Admin in dialogs** — add, edit and delete websites without leaving the list; server errors
  (unreachable site, invalid URL…) appear in the dialog without losing what you typed; deletion can be
  undone for 15 seconds.
- 💾 **Export / import** — one JSON file with every shortcut and its logos, to back up or move an
  install; import can merge or replace.
- 🌗 **Light and dark themes** — follows the system, can be switched by hand.
- 🌐 **French and English** — language picker in the header.
- 🔒 **Security** — CSRF protection, CSP and security headers, login rate limiting, SSRF guard on every
  outgoing request, logo uploads limited to raster formats.

## Screenshots

| Wall | Administration |
|------|----------------|
| ![Shortcut wall](screenshots/homepage.png) | ![Administration](screenshots/admin.png) |

![Shortcut wall, dark theme](screenshots/homepage-dark.png)

## Installation

### With Docker (recommended)

1. Get the `docker-compose.yml` file and create a `.env` next to it from
   [`.env.example`](.env.example). At least change `SESSION_SECRET`, `ADMIN_USER` and `ADMIN_PASS`:

   ```bash
   cp .env.example .env
   ```

2. Start the published image:

   ```bash
   docker compose up -d
   ```

The wall is available at `http://localhost:3050` and the admin area at `/admin`.
Data lives in `./data` (shortcuts, sessions) and logos in `./public/uploads`, both mounted as volumes.

To build the image from the sources instead (e.g. after modifying the code), use
`docker-compose-dev.yml`:

```bash
docker compose -f docker-compose-dev.yml up -d --build
```

### Without Docker

Requires **Node.js 26** or newer (see [`.nvmrc`](.nvmrc)).

```bash
git clone https://github.com/MrDDream/ShortcutWall.git
cd ShortcutWall
cp .env.example .env
npm ci
npm start
```

## Configuration

Everything is set through environment variables, usually in `.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | `change-me` | Secret signing the admin session. **Change it.** |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / `admin123` | Admin credentials. **Change them.** |
| `PORT` / `HOST` | `3050` / `0.0.0.0` | Listening port and address. |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy (HTTPS, client IP). |
| `APP_NAME` | `ShortcutWall` | Name shown in the header and page titles. |
| `APP_DEFAULT_LOCALE` | `fr` | Default language (`fr` or `en`). |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | — | Contacts shown in the "Need help?" dialog (hidden if empty). |
| `LOG_LEVEL` | `info` (`debug` in development) | `fatal`, `error`, `warn`, `info`, `debug` or `trace`. |
| `DATA_DIR` | `./data` | Folder for shortcuts and sessions. |
| `UPLOAD_DIR` | `./public/uploads` | Folder for logos (served at `/uploads`). |

The admin area shows a warning as long as the default credentials or secret are in use.

## Usage

- **Wall**: `/` — public, no account needed.
- **Admin**: `/admin` — add a website, fetch its favicon, edit or delete it.
- **Backup**: in the admin, *Export* downloads `shortcutwall-YYYY-MM-DD.json`; *Import* restores such
  a file, either merging it (sites whose URL already exists are skipped) or replacing every site.
- Logos that no longer belong to any site (e.g. a fetched favicon whose dialog was cancelled) are
  removed automatically, at startup and once a day.

### Known limitation

To prevent SSRF, the server refuses to contact private network addresses (`192.168.x.x`, `10.x.x.x`,
`localhost`…). Websites hosted on your local network therefore can't be added for now.

## Development

```bash
npm ci
npm run dev          # restarts on change (node --watch)
npm test             # Vitest
npm run lint         # ESLint
npm run format:check # Prettier
```

The CI runs lint, formatting, tests and `npm audit` on every push.

## Tech stack

| Category | Technologies |
|----------|--------------|
| Backend | Node.js 26, Express 5 |
| Views | EJS, vanilla CSS and JavaScript (no build step) |
| Storage | JSON files, file-based sessions |
| Images | sharp (resizing), Multer (uploads) |
| Security | Helmet, express-rate-limit, CSRF tokens, SSRF guard |
| Tests | Vitest, Supertest |
| Containers | Docker, Docker Compose |

## Project structure

```
.
├── server.js              # entry point
├── src/
│   ├── app.js             # Express app (middleware, routes)
│   ├── config.js          # environment variables
│   ├── lib/               # favicon, logo import/resize, SSRF guard, storage…
│   ├── locales/           # fr.json, en.json
│   ├── middleware/
│   └── routes/            # pages, admin, sites, backup, favicon…
├── views/                 # EJS templates and partials
├── public/                # styles.css, scripts.js, theme.js, images
├── tests/                 # unit and integration tests
├── data/                  # shortcuts and sessions (created at runtime)
└── docker-compose.yml     # published image; docker-compose-dev.yml builds it
```

## Contributing

Issues and pull requests are welcome. Please keep the existing code style and make sure
`npm run lint`, `npm run format:check` and `npm test` pass.

## License

[MIT](LICENSE)

## Contact

- [MrDDream](https://github.com/MrDDream)
