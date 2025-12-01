UI/UX Specification Report: Rule 43 Financial Intelligence Workspace

Version: 1.1 (Updated) - 14:04 01/12/2025   

Target Audience: Frontend Developers, UI Designers, Product Managers

Framework: React / Tailwind CSS / Recharts / Lucide React

1. Executive Summary

The Rule 43 Workspace is a specialized legal-fintech application designed for High Court interim maintenance applications. Unlike standard accounting software, its primary function is forensic verification.

The UI/UX is built around a specific legal requirement: The Burden of Proof.

Every interaction is designed to bridge the gap between an Alleged Expense (what a party says they spend) and the Proven Expense (what the bank statements demonstrate).

Core UX Philosophy: "The Golden Thread."

The interface must maintain an unbroken visual line between the Source Document (Evidence), the Extracted Data (Transaction Grid), and the Legal Claim (Schedule of Expenses).

2. Layout Architecture: The "Forensic Workbench"

The application uses a Split-Pane "Master-Detail" Layout designed for high-density data processing without context switching.

2.1 The Split-Screen Strategy

Left Pane (Context & Evidence): This is the "Truth" anchor. It displays either the Source Inventory (PDFs, Claims) or the Source Viewer (Actual PDF rendering). It represents the input.

Right Pane (Processing & Action): This is the "Work" area. It displays the Transaction Grid where data is categorized, annotated, and manipulated. It represents the output.

Interaction: These panes are reactive. Changing a category in the Right Pane immediately updates the verification status in the Left Pane.

2.2 Global Navigation

Sidebar (Vertical, Collapsed): A slim (w-16), dark-themed (bg-slate-900) navigation rail containing only high-level mode switchers (Dashboard, Workbench, Evidence Locker). This maximizes horizontal screen real estate for the split-pane.

Header (Context Bar): Displays the Active Matter (e.g., "Smith vs Smith") and global actions (Download Report, Save Project). It anchors the user in the specific legal case.

3. Key UX Patterns & "Gold Standard" Features

3.1 The "Traffic Light" Verification System (Critical)

This is the central forensic feature. In the Schedule of Alleged Expenses (Left Pane), amounts are color-coded based on their relationship to the Proven bank data.

Logic:

<span style="color:#f43f5e">RED (Shortfall):</span> Proven Amount < Claimed Amount (Ratio < 0.95).

Meaning: The applicant has claimed an expense (e.g., Groceries R5,000) but bank data only proves a lower amount.

Visual: Text is text-rose-500. Progress bar is red/amber/green. (0% proven = red, 100% proven = green, 50% proven = amber)

<span style="color:#0f172a">BLACK (Verified):</span> Proven Amount ≈ Claimed Amount (0.95 < Ratio < 1.05).

Meaning: The claim is substantiated by evidence.

Visual: Text is text-slate-900. Icon is a Double Check (check-double).

<span style="color:#2563eb">BLUE (Under-claim):</span> Proven Amount > Claimed Amount (Ratio > 1.05).

Meaning: The applicant actually spends more than claimed (or data includes transactions that are not related to the claim).

Visual: Text is text-blue-600. Progress bar is Blue.

3.2 Dynamic Averaging Engine

Legal applications require comparison over time (typically 3-6 months).

Feature: The "Proven" column header explicitly states the scope: "Proven (Avg)".

Calculation: Total Categorized Transactions / MONTHS_IN_SCOPE.

UX Requirement: Developers must ensure that changing the global time filter (e.g., 6 Months) instantly recalculates these averages across the entire Schedule.

3.3 The "Three-Mode" Data Entry

In the Schedule header (Left Pane), three distinct input methods are exposed to accommodate different workflow speeds:

Manual: User types amounts from a paper affidavit.

Import: Parsing word documents (e.g., "Annexure KPR8.docx").

Auto-Calc: (Future Feature - greyed out) The "Magic Wand" feature. The system infers the claim based on the actual spending average found in the bank statements.

4. Component Specifications

4.1 The Dashboard (Landing View)

Purpose: Instant financial health check.

Components:

KPI Cards: Income, Expenses, Net Flow. Use gradients (card-income, card-expense) to visually separate credits from debits.

Trend Chart: A Recharts Bar Chart showing the 6-month trajectory. Essential for spotting "Divorce Planning" (sudden drops in income or spikes in expenses before filing).

Financial Alerts: A scrollable list of algorithmic warnings pertaining to the proven expenses vs the claimed expenses or other forensic warnings (e.g., inter-account transfers missing, unexplained large payments, missing transactions, many small payments to one person, many cash withdrawals, unexplained income, etc.).

4.2 The Transaction Grid (Right Pane)

Density: High. Font size text-xs or text-[10px].

Columns: Date, Description (with Cleaned Name), Amount, Evidence Status.

Interactive Categorization:

The "Category" field is a Dropdown, not a text input.

Feedback Loop: Selecting a category here must trigger a re-render of the Left Pane Schedule to update the "Traffic Light" status immediately.

Notes: A "Sticky Note" icon button for line-item annotations.

4.3 Document Inventory (Left Pane - "ALL" State)

State Switching:

When the Global Filter is "ALL", this pane shows the Inventory & Schedule.

When a specific Entity (e.g., "PERSONAL") is selected, this pane replaces the Inventory with the PDF Viewer for that specific entity.

Visual Hierarchy:

Top Half: Source Documents list (PDFs).

Bottom Half: The Schedule of Alleged Expenses (The target for reconciliation).

4.4 Data Ingestion & Persistence

Purpose: Streamlined onboarding of evidence and state preservation.

4.4.1 File Upload UX (Bank Statements & Schedules)

Location: Accessed via the "Evidence Locker" view or a global "Add Evidence" floating action button (FAB) in the Sidebar.

Interaction Pattern: Modal Dialog with "Drop Zone".

Visual Feedback:

Drop Zone: Dashed border area (border-dashed, border-slate-300) changing to border-blue-500 on drag-over. Iconography: UploadCloud (Lucide).

Progress: Individual progress bars for batch uploads.

Post-Drop Logic (The "Triage" Step):

Immediately upon dropping a file, the user must be prompted to classify it via a small inline form row:

File Name: (Auto-detected)

Type: [Dropdown: Bank Statement / Financial Affidavit / Other]

Entity Assignment: [Dropdown: PERSONAL / BUSINESS / TRUST / SPOUSE]

Parser Selection: [Dropdown: Standard Bank / FNB / Investec / Generic CSV]

Rationale: We cannot parse data without knowing the context (Entity) and the structure (Parser).

4.4.2 Project Persistence (Save/Load)

Architecture: Client-side JSON serialization. The entire application state (Transactions, Claims, Categorizations, Alerts) is packaged into a single JSON object.

UI Elements:

Save: "Export Analysis" button in Top Bar (Icon: Save or Download). Downloads a timestamped .r43 (JSON) file (e.g., Rademan_v_Rademan_2025-12-01.r43).

Load: "Open Case" button on the Dashboard Landing page (Icon: FolderOpen). Triggers system file picker accepting .r43 or .json files.

Data Safety:

Implement localStorage auto-save on every transaction edit to prevent data loss during browser refreshes.

Visual Indicator: Small "Saved" checkmark in the Top Bar (fades out after 3 seconds).

5. Visual Design System

5.1 Colour Palette

Backgrounds: slate-50 / slate-100 (Reduces eye strain for long reading sessions).

Primary Action: blue-600 (Buttons, Active States).

Forensic Indicators:

Proven/Income: emerald-600 (#059669)

Unproven/Expense: rose-500 (#f43f5e)

Over-claim/Info: blue-600 (#2563eb)

Warnings: amber-500 (#f59e0b)

5.2 Typography

Font Family: Inter (UI elements) + JetBrains Mono (Financial Data).

Tabular Figures: All financial amounts must use Monospace fonts (font-mono) to ensure decimal alignment for rapid scanning.

6. Developer Implementation Checklist

State Management:

Lift state up. The transactions array and claims array must exist in a parent context so they can interact.

Constraint: Changing a transaction's category in WorkbenchView must trigger a recalculation of getProvenAvg in DocumentInventory.

Responsiveness:

The layout is strictly Desktop-First. Rule 43 analysis involves complex spreadsheets and PDFs; it does not scale down to mobile.

Ensure overflow-auto and custom-scroll classes are applied to the inner panes, not the window body, to preserve the toolbar headers.

PDF Handling:

Use react-pdf or a native <iframe>.

Entity Mapping: Ensure the PDF Viewer creates a filtered view of transactions relevant only to the currently viewed PDF to allow for "Tick and Bash" verification.

File I/O:

Utilize FileReader API for client-side file reading.

Implement strict type checking on import (validate JSON schema) to prevent app crashes from corrupted save files.