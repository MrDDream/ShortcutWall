# ShortcutWall
A Node.js web application for centralizing shortcuts to websites and shared folders, featuring an administration page for managing shortcuts.

## Overview
ShortcutWall allows users to access their favorite websites and network folders from a single interface. The application includes an admin area for adding, modifying, and deleting shortcuts, as well as uploading custom logos.

## Features
* 🔗 Shortcut wall for both websites and network folders with search capabilities
* 🔒 Simple admin authentication layer
* 📸 Logo management via remote URLs or local uploads
* 📝 Automatic `.url` file export for website shortcuts
* 🌎 Built-in internationalization (French and English)

## Tech Stack
| Category | Technologies |
|----------|-------------|
| Backend  | Node.js, Express |
| Database | JSON files (data/shortcuts.json, data/folders.json) |
| Template | EJS view engine |
| Utilities | Multer for file uploads, Dotenv for environment variables |

## Installation & Setup
### Prerequisites
* Node.js 18 or newer
* npm (bundled with Node.js)
* Docker and Docker Compose (optional)

### Step-by-Step Instructions
1. Clone the repository and navigate to the project directory.
2. Install dependencies: `npm install`
3. Copy the environment example and adjust the values: `cp .env.example .env`
	* `SESSION_SECRET`: a random string for securing sessions
	* `ADMIN_USER` / `ADMIN_PASS`: credentials for the admin area
	* `APP_NAME` and `APP_DEFAULT_LOCALE`: custom branding and default language
4. Start the application in development mode: `npm run dev`
	* The public interface is available at [http://localhost:3050](http://localhost:3050) by default.

## Usage
* The public view displays shortcuts stored in `data/shortcuts.json` and `data/folders.json`.
* The admin area is accessible at `/admin` and requires the credentials configured in `.env`.
* Uploaded images are saved to `public/uploads`; remove them manually if needed.

## Project Structure
```
.
├── data
│   ├── folders.json
│   └── shortcuts.json
├── docker
│   ├── Dockerfile
│   └── docker-compose.yml
├── public
│   ├── scripts.js
│   ├── styles.css
│   └── uploads
├── server.js
├── views
│   ├── 404.ejs
│   ├── admin.ejs
│   ├── index.ejs
│   ├── login.ejs
│   └── partials
│       ├── footer.ejs
│       └── head.ejs
├── .dockerignore
├── .env.example
├── LICENSE
├── package.json
└── README.md
```

## API Documentation
Not applicable, as this is a web application with a graphical interface.

## Screenshots
[Insert screenshot of the public view]
[Insert screenshot of the admin area]

## Contributing
Contributors are welcome to submit pull requests and issues. Please ensure that your code is well-documented and follows the existing coding style.

## License
MIT License

## Contact
[Insert author/maintainer information if available]

## Thanks + Attribution
This README was generated using [GitRead](https://git-read.vercel.app)
