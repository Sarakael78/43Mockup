# 43Mockup
# 43Mockup

A Vite + React implementation of the Rule 43 financial intelligence workspace. Includes error handling, input sanitization, and data validation improvements. Currently uses mock data for demonstration purposes.

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
./scripts/run.sh
```

Open the URL shown by Vite (typically `http://localhost:5173`) in your browser.

## What this project contains

- `src/` — React source (entry at `src/main.jsx`, main UI in `src/App.jsx`).
- `index.html` — Vite entry that mounts `#root`.
- `financial_data.json` — Mock data loaded at runtime by the app.
- `scripts/run.sh` — Dev helper: installs deps if needed, picks a free port, starts dev server and opens browser.
- `scripts/build.sh` — Production build helper; `./scripts/build.sh --serve` serves `dist/` on a free port.
- `tailwind.config.cjs`, `postcss.config.cjs`, `src/index.css` — Tailwind setup.

## Workspace modes & UX highlights

- **Dashboard** — KPI cards, six-month Recharts trend, and forensic alerts for lightning-fast case triage. Includes "Open Case" button to load saved projects.
- **Workbench** — Split-pane forensic workbench with the transaction grid (category dropdowns, evidence badges, sticky notes) on the right and the Evidence Locker/PDF viewer on the left. Global entity + time filters drive the dynamic averaging engine (1M/3M/6M scopes) that powers the traffic-light schedule.
- **Evidence Locker** — Focus view for source documents; switch entities to open the PDF viewer with real PDF rendering, or stay in `ALL` to work the Claimed vs. Proven schedule with Manual / Import / Auto-Calc entry modes.
- **Traffic-light schedule** — Claimed vs. Proven table implements the Rule 43 "Golden Thread": shortfalls glow rose, inflations blue, verified rows render black with a double-check icon, and progress bars visualize ratios.
- **Evidence status badges** — Every transaction row exposes its evidence state (`proven`, `flagged`, etc.) so updates immediately ripple back into the Golden Thread schedule.
- **File Upload** — Modal dialog with drag-and-drop support for uploading bank statements and financial affidavits. Includes triage step for file classification (Type, Entity, Parser).
- **Project Persistence** — Save projects as `.r43` files and load them back. Auto-save to localStorage with visual feedback. Editable case name in the top bar.
- **Sticky Notes** — Add annotations to individual transactions with a modal editor. Notes are persisted with the project.
- **Import Mode** — Parse annexures (DOCX/PDF) directly into the schedule. Automatically extracts claimed expenses from financial affidavits.

## Build for production

Create a production build:

```bash
npm run build
```

Or use the helper that builds and serves `dist/`:

```bash
./scripts/build.sh --serve
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

- Port conflicts: `scripts/run.sh` and `scripts/build.sh --serve` pick ephemeral free ports. To use a fixed port run `npm run dev -- --port 5173`.

## Deployment

Deploy the contents of `dist/` to any static host (Netlify, S3, GitHub Pages, nginx, etc.).

## Development notes

- The UI uses Tailwind utility classes. If you want the exact visual styles, enable Tailwind (already configured).
- Error handling: All user-facing errors use non-blocking toast notifications via ToastContext system instead of `alert()` dialogs.
- Error boundaries: React Error Boundaries are implemented to gracefully handle component errors.
- Security: Input sanitization is implemented for case names, file names, and transaction notes to prevent XSS attacks.
- Data validation: Enhanced JSON schema validation for project files with detailed error messages.
- File processing: CSV, PDF, and DOCX files can be parsed and processed for bank statements and financial affidavits.
- CSV import: Supports importing transaction categories from CSV files. CSV parsers automatically detect category columns (case-insensitive: "category", "cat", "categories", etc.). Categories are sanitized to prevent CSV injection attacks.
- Security: CSV files are limited to 100,000 rows to prevent DoS attacks. File size limits (10MB) are enforced with user feedback.
- PDF viewer: Real PDF rendering using react-pdf with page navigation and zoom controls.
- Document import: DOCX and PDF documents can be parsed to extract claimed expenses automatically.

## Running the helpers

- Dev helper: `./scripts/run.sh` — installs, starts dev server, opens browser.
- Build helper: `./scripts/build.sh` — runs `npm run build` and optionally serves `dist/` with `--serve`.

If you'd like CI to also publish the artifact or deploy to a hosting provider, I can add that in a follow-up.

----
Generated: 2025-12-01
