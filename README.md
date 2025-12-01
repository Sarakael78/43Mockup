# 43Mockup
# 43Mockup

A minimal Vite + React scaffold for the Rule 43 workspace mockup.

## Quick start

1. Install dependencies:

```bash
cd /home/david/projects/43Mockup
npm install
```

2. Start the dev server:

```bash
npm run dev
```

Or run the helper script which finds a free port and opens your browser:

```bash
./run.sh
```

Open the URL shown by Vite (typically `http://localhost:5173`) in your browser.

## What this project contains

- `src/` — React source (entry at `src/main.jsx`, main UI in `src/App.jsx`).
- `index.html` — Vite entry that mounts `#root`.
- `financial_data.json` — Mock data loaded at runtime by the app.
- `frontend.html` — Original single-file preview (kept for reference).
- `run.sh` — Dev helper: installs deps if needed, picks a free port, starts dev server and opens browser.
- `build.sh` — Production build helper; `./build.sh --serve` serves `dist/` on a free port.
- `tailwind.config.cjs`, `postcss.config.cjs`, `src/index.css` — Tailwind setup.

## Build for production

Create a production build:

```bash
npm run build
```

Or use the helper that builds and serves `dist/`:

```bash
./build.sh --serve
```

After a successful build the `dist/` folder will contain the static site ready for deployment.

## Tailwind CSS

Tailwind is configured and imported from `src/index.css`. The Vite dev server processes Tailwind automatically.

## CI: GitHub Actions

This repository includes a GitHub Actions workflow (`.github/workflows/build.yml`) that builds `dist/` on push and uploads the build as an artifact.

## Troubleshooting

- Unstyled utility classes: ensure dependencies are installed and restart the dev server:

```bash
npm install
npm run dev
```

- `financial_data.json` fetch fails: confirm the file exists at the project root and the dev server is running.

- Port conflicts: `run.sh` and `build.sh --serve` pick ephemeral free ports. To use a fixed port run `npm run dev -- --port 5173`.

## Deployment

Deploy the contents of `dist/` to any static host (Netlify, S3, GitHub Pages, nginx, etc.).

## Development notes

- The UI uses Tailwind utility classes. If you want the exact visual styles, enable Tailwind (already configured).
- `frontend.html` is a reference preview; the Vite app is the recommended development target.

## Running the helpers

- Dev helper: `./run.sh` — installs, starts dev server, opens browser.
- Build helper: `./build.sh` — runs `npm run build` and optionally serves `dist/` with `--serve`.

If you'd like CI to also publish the artifact or deploy to a hosting provider, I can add that in a follow-up.

----
Generated: 2025-12-01
