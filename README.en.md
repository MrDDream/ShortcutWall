# ShorctutWall

## Overview
ShorctutWall is a Node.js web application that centralises shortcuts to websites and shared folders. It ships with a public dashboard and a password-protected admin area where you can manage shortcuts, upload custom logos, and generate `.url` files automatically.

## Key Features
- Shortcut wall for both websites and network folders with search capabilities.
- Simple admin authentication layer.
- Logo management via remote URLs or local uploads (stored under `public/uploads`).
- Automatic `.url` file export for website shortcuts.
- Built-in internationalisation (French and English).

## Tech Stack
- Node.js with Express 5
- EJS view engine
- Express Session (in-memory store)
- Multer for file uploads
- Dockerfile and docker-compose for containerised deployments

## Requirements
- Node.js 18 or newer
- npm (bundled with Node.js)
- (Optional) Docker and Docker Compose

## Getting Started
1. Clone the repository and move into the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment example and adjust the values:
   ```bash
   cp .env.example .env
   ```
   - `SESSION_SECRET`: random string used to secure sessions.
   - `ADMIN_USER` / `ADMIN_PASS`: credentials for the admin area.
   - `APP_NAME` and `APP_DEFAULT_LOCALE`: custom branding and default language.
4. Start the application in development mode:
   ```bash
   npm run dev
   ```
   The public interface is available at [http://localhost:3050](http://localhost:3050) by default.

## Usage
- The public view lists shortcuts stored in `data/shortcuts.json` and `data/folders.json`.
- The admin area lives under `/admin` and requires the credentials configured in `.env`.
- Uploaded images are saved to `public/uploads`; remove them manually if needed.

## Docker
```bash
docker compose up --build
```
The service uses the `PORT` and `HOST` values provided in your `.env`.

## Development Tips
Use `npm run dev` to run the server with Nodemon for automatic reloads. Back up the `data/*.json` files before migrating or redeploying to preserve your shortcuts.

## License
This project is released under the MIT License.
