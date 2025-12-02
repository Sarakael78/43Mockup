## 21. Full Code Review — 2025-12-02

### Key Findings
- Default categories (`src/config/categories.json`) didn’t match parser output (`Groceries/Household`, `Accommodation/Rent`, etc.), so dropdowns couldn’t show imported labels.
- Claims ingest paths (`src/utils/claimsImport.js`, `src/utils/fileProcessors.js`) discarded duplicate category rows, wiping multi-line affidavit data.
- Loading a project without an explicit `categories` array removed every option from the Workbench category picker.
- File upload UI accepted `.xlsx/.xls`, but processors rejected them, creating a dead-end workflow.
- PDF worker URL was hard-coded to `/pdf.worker.min.mjs`, breaking deployments mounted under a non-root base path.
- File readers rejected Safari/legacy browsers that lack `Blob.stream()`.
- Entity filters exposed only Personal/Business/Trust, hiding Spouse/Credit datasets already produced by triage/account logic.

### Fix Summary
1. Normalized canonical categories (slashes vs. ampersands) and expanded the alias mapper (`src/utils/categoryMapper.js`) so imported data and UI options share the same vocabulary.
2. Allowed multiple claims per category by deduplicating only on IDs, preserving every affidavit row.
3. Added a resilient fallback to `defaultCategories` when loading saved projects missing category metadata.
4. Tightened the upload modal to only accept PDF/DOCX/DOC/CSV, with upfront user messaging plus triage for the Credit entity option.
5. Resolved the PDF worker URL via `import.meta.env.BASE_URL` so SPA deployments work under any prefix.
6. Relaxed Blob detection to rely on `slice`/`size`, restoring compatibility with browsers lacking `Blob.stream()`.
7. Surfaced `SPOUSE` and `CREDIT` in entity filters (Workbench/Evidence Locker) and the triage dropdown, keeping filters in sync with parser outputs.

### Verification
- `npm run build`
- Manual smoke of file upload modal (extension filtering) and Workbench/Evidence Locker entity toggles.

