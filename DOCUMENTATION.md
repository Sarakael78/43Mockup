# 43Mockup — Documentation

This document describes how to run, build and modify the 43Mockup project (React + Vite).

**Overview**
- **Purpose**: Local mockup of a Rule 43 financial reconciliation workspace.
- **Primary files**: `src/` (React app), `financial_data.json` (data used at runtime), `frontend.html` (original static preview), `run.sh` (dev convenience), `build.sh` (production build + optional serve).

**Prerequisites**
- Node.js (16+) and `npm` on PATH.
- `python3` (used by helper scripts to pick free ports and serve static files).
- (Optional) `xdg-open` on Linux to open browser automatically.

**Quick Start — Development (recommended)**
1. Install dependencies:

```bash
cd /home/david/projects/43Mockup
npm install
```

2. Start the Vite dev server (default port shown by Vite):

```bash
npm run dev
```

Or run the helper that picks an available port and opens your browser:

```bash
./run.sh
```

- The app will fetch `financial_data.json` from the project root at `http://localhost:<port>/financial_data.json`.

**Building for production**
- Create a production build:

```bash
npm run build
# or using the helper
./build.sh
```

- To build and serve `dist/` locally (picks a free port and opens browser):

```bash
./build.sh --serve
```

**Tailwind CSS**
- Tailwind is configured (see `tailwind.config.cjs` and `postcss.config.cjs`). The project imports `src/index.css` from `src/main.jsx`.
- When running the Vite dev server, Tailwind is built automatically.

**Project layout**
- `index.html` — Vite entry that mounts `#root` and loads `/src/main.jsx`.
- `src/main.jsx` — React entrypoint (imports `index.css` and renders `App`).
- `src/App.jsx` — Main app and components (Dashboard, Workbench, etc.).
- `financial_data.json` — Data source used at runtime by `App`.
- `frontend.html` — Original single-file preview (kept for reference). Prefer the Vite app.
- `run.sh` — Dev helper: installs (if needed), finds a free port, starts dev server, opens browser.
- `build.sh` — Production build helper; optionally serves `dist/`.

**Editing data**
- Edit `financial_data.json` to change the mock data. The dev server will pick up changes to the JSON when the page is reloaded.

**Troubleshooting**
- Unstyled utility classes: ensure dependencies are installed and restart dev server:

```bash
npm install
npm run dev
```

- `financial_data.json` fetch fails: confirm the file is present in the project root and the dev server is serving from the project root.

- Port conflicts: `run.sh` and `build.sh --serve` pick ephemeral free ports. If you want a fixed port, run `npm run dev -- --port 5173`.

- If the browser does not open automatically, copy the URL printed by the script and open it manually.

**Adding new dependencies**
- Use `npm install <pkg> --save` for production dependencies or `--save-dev` for dev-time tools. Restart the dev server after installing.

**CI / Deployment**
- `dist/` contains the production-ready static files. Deploy contents of `dist/` to your static host (S3, Netlify, GitHub Pages, nginx, etc.).

**Developer notes**
- The visual UI uses Tailwind utility classes in the markup; no Tailwind-specific components are required beyond the base config.
- `frontend.html` is the original embedded-preview file. The Vite app (`index.html` + `src/`) is the canonical source for development.

**Contact / Next steps**
- If you want, I can:
  - Add a small test-suite or linting setup,
  - Configure Tailwind plugins (forms/typography),
  - Convert `frontend.html` content into a single-page demo served from `dist/` automatically.

---
Generated: 2025-12-01
