<div align="center">

<img src="public/images/logo.svg" alt="ShortcutWall logo" width="96" />

# ShortcutWall

**Your self-hosted wall of website shortcuts.**<br />
One page with every useful site and its logo, plus a simple admin area to manage them.

[![CI](https://github.com/MrDDream/ShortcutWall/actions/workflows/ci.yml/badge.svg)](https://github.com/MrDDream/ShortcutWall/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/MrDDream/ShortcutWall?label=release)](https://github.com/MrDDream/ShortcutWall/releases)
[![Docker image](https://img.shields.io/badge/image-ghcr.io%2Fmrddream%2Fshortcutwall-2496ED?logo=docker&logoColor=white)](https://github.com/MrDDream/ShortcutWall/pkgs/container/shortcutwall)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

English · [Français](README.fr.md)

<img src="screenshots/homepage.png" alt="The shortcut wall" width="900" />

</div>

## ✨ Features

- 🧱 **Shortcut wall**: large cards with logo, name and description; one click opens the site.
- 🔎 **Instant search and sort**: press <kbd>/</kbd> to search names, descriptions and domains; alphabetical or most recent order.
- 🖼️ **Automatic logos**: *Fetch favicon* finds the best icon a site offers, stores it in the app and downsizes it to 256 px, so the wall stays fast and never shows a broken image.
- 🛠️ **Admin in dialogs**: add, edit and delete without leaving the list; a deletion can be undone for 15 seconds.
- 💾 **Export / import**: one JSON file with every shortcut and its logos, to back up or move an install.
- 🌗 **Light and dark themes**, 🌐 **French and English**, 📱 **mobile-friendly**.
- 🔒 **Secure by default**: CSRF protection, strict CSP, login rate limiting, SSRF guard, refuses to start with default credentials.

## 🚀 Installation

ShortcutWall ships as a ready-to-use Docker image (`linux/amd64` and `linux/arm64`, e.g. a Raspberry Pi):
**`ghcr.io/mrddream/shortcutwall`**. All you need is Docker with Compose.

### 1. Create a folder with this `docker-compose.yml`

```bash
mkdir shortcutwall && cd shortcutwall
```

```yaml
services:
  shortcutwall:
    image: ghcr.io/mrddream/shortcutwall:latest
    container_name: ShortcutWall
    ports:
      - "${PORT:-3050}:${PORT:-3050}"
    # ADMIN_USER, ADMIN_PASS, SESSION_SECRET… come from .env (see .env.example):
    # the app refuses to start in production without real values.
    env_file:
      - path: .env
        required: false
    environment:
      NODE_ENV: production
      PORT: ${PORT:-3050}
      HOST: ${HOST:-0.0.0.0}
    volumes:
      - ./data:/app/data
      - ./public/uploads:/app/public/uploads
    restart: unless-stopped
```

### 2. Create the data folders and the `.env` file

The container runs as an unprivileged user (uid 1000): create the folders yourself, otherwise Docker
creates them as `root` and the app can't write to them.

```bash
mkdir -p data public/uploads
```

```bash
printf 'ADMIN_USER=admin\nADMIN_PASS=%s\nSESSION_SECRET=%s\n' 'choose-a-strong-password' "$(openssl rand -hex 32)" > .env
```

Replace `choose-a-strong-password` with your own password. Every other setting is optional (see
[Configuration](#%EF%B8%8F-configuration)).

### 3. Start

```bash
docker compose up -d
```

The wall is available at **http://localhost:3050** and the admin area at **http://localhost:3050/admin**.

### Update

```bash
docker compose pull && docker compose up -d
```

To stay on a given version, replace `latest` with a version number, for example
`ghcr.io/mrddream/shortcutwall:1.1.0`. The available versions are listed on the
[releases page](https://github.com/MrDDream/ShortcutWall/releases).

## 📸 Screenshots

| Administration | Editing a website |
|:---:|:---:|
| <img src="screenshots/admin.png" alt="Administration" width="440" /> | <img src="screenshots/admin-edit.png" alt="Editing a website" width="440" /> |
| **Dark theme** | **On a phone** |
| <img src="screenshots/homepage-dark.png" alt="Dark theme" width="440" /> | <img src="screenshots/mobile.png" alt="On a phone" width="200" /> |

## ⚙️ Configuration

All settings go in the `.env` file next to `docker-compose.yml`, then `docker compose up -d` to apply.

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_USER` | `admin` | Admin login. |
| `ADMIN_PASS` | — | Admin password. **Required**: the app refuses to start with the default one. |
| `SESSION_SECRET` | — | Random secret of at least 32 characters (`openssl rand -hex 32`). **Required.** |
| `PORT` | `3050` | Port of the app (and of the published port). |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy (HTTPS, real client IP for the login rate limit). |
| `APP_NAME` | `ShortcutWall` | Name shown in the header and page titles. |
| `APP_DEFAULT_LOCALE` | `fr` | Default language: `fr` or `en`. |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | — | Contacts shown in a "Need help?" dialog (hidden when empty). |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug` or `trace`. |

## 🧭 Usage

- **Wall** (`/`): public, no account needed. Click a card to open the site.
- **Admin** (`/admin`): *Add a website*, then *Fetch favicon* to get its logo automatically; click a tile
  to edit it.
- **Backup**: *Export* downloads `shortcutwall-YYYY-MM-DD.json` (logos included); *Import* restores it,
  either merging it with the current sites or replacing them (that can be undone for 15 seconds).
- **Data**: shortcuts live in `./data`, logos in `./public/uploads`. Back up these two folders, or use *Export*.

## 🔒 Security

- Admin password, session secret: required in production; sessions are only created on login.
- CSRF tokens on every form, strict Content-Security-Policy, cookies `HttpOnly` / `SameSite`.
- Login limited to 10 failed attempts per IP every 15 minutes.
- Outgoing requests (favicons, logos) can't reach private networks or follow redirects to them (SSRF guard).
- Uploaded files are checked to really be images, and stored under generated names.
- The image runs as a non-root user, with the application code read-only.

> [!NOTE]
> Because of the SSRF guard, websites hosted on your local network (`192.168.x.x`, `10.x.x.x`…) can't be
> added for now.

## 🩺 Troubleshooting

- **The container stops with `EACCES: permission denied`**: the `data` or `public/uploads` folder belongs to
  `root`. Fix it with `sudo chown -R 1000:1000 data public/uploads`, then `docker compose up -d`.
- **It refuses to start ("Refusing to start in production…")**: `ADMIN_PASS` or `SESSION_SECRET` is missing,
  left at its default value, or the secret is shorter than 32 characters. Check the `.env` file.
- **Logs**: `docker compose logs -f`.

## 🛠️ Contributing

Issues and pull requests are welcome. To build the image from the sources, use `docker-compose-dev.yml`:

```bash
docker compose -f docker-compose-dev.yml up -d --build
```

Before opening a pull request, run the checks the CI runs (Node.js 26):

```bash
npm ci && npm run lint && npm run format:check && npm test
```

## 📄 License

[MIT](LICENSE) © [MrDDream](https://github.com/MrDDream)
