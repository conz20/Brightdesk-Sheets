# GridCraft feature and visual parity study

**Status:** evidence-based product requirements and implementation plan. This document does not claim that planned features are implemented or verified.

**Target product:** Brightdesk Sheets (the spreadsheet product in the existing ten-product Brightdesk suite).

## Reference material reviewed

The following six public Craft Wiki pages were reviewed on 14 November 2026:

- [GridCraft overview](https://craft.wiki/apps/gridcraft/overview/)
- [Getting started](https://craft.wiki/apps/gridcraft/getting-started/)
- [Install and update](https://craft.wiki/apps/gridcraft/install-update/)
- [Workflows](https://craft.wiki/apps/gridcraft/workflows/)
- [AI agents](https://craft.wiki/apps/gridcraft/ai-agents/)
- [Troubleshooting](https://craft.wiki/apps/gridcraft/troubleshooting/)

The pages describe a desktop spreadsheet with a ribbon, formula bar, Name Box, sheet tabs, tables, charts and pivot tables. The reference itself identifies its current release as alpha. Its described capabilities are a product direction, not proof that every capability is complete or that Brightdesk should claim identical compatibility.

This study supplements `docs/GRIDCRAFT_REFERENCE_AND_SHEETS_ROADMAP.md`. It does not copy GridCraft source code, ArtCraft branding, screenshots, sample workbooks or artwork.

## Current Brightdesk evidence

The current `main` implementation is an Electron desktop product. The renderer creates a single editable grid from a `cells` array; the selected cell is exposed through a Name Box-like reference and formula input. The current formula module supports basic arithmetic and six range functions: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` and `COUNTA`. The Sheets ribbon currently exposes Home, Insert, Formulas, Data and View tabs. Current data actions include adding rows/columns, sorting the selected column and zooming. The documented first-use file exchange is CSV/XLSX.

The README explicitly describes this as a basic spreadsheet foundation and says not to assume VBA/macros, pivot tables, advanced formula coverage, complex workbook features or exact Excel round-trip compatibility.

**Important:** the table below is a gap-analysis target. A feature is not considered present merely because a tab, label, roadmap entry or dependency exists. It must have a working user path, persistence/import/export behavior where relevant, and automated regression coverage.

## Feature comparison and required direction

| Capability area | GridCraft reference describes | Brightdesk current evidence | Brightdesk direction |
|---|---|---|---|
| Workbook workspace | Ribbon, formula bar, Name Box, sheet tabs, tables, charts and pivot tables | Basic ribbon, cell reference/formula input and one grid; no verified multi-sheet tab model | Build a focused spreadsheet workspace with a persistent workbook title bar, contextual ribbon, Name Box, formula bar, grid, sheet tabs and status/zoom controls |
| Workbook and sheets | Workbook model, multiple worksheets, artboards/sheets and navigation | Current document stores one `cells` grid | Introduce a versioned workbook model with multiple named sheets, active-sheet state, add/rename/duplicate/reorder/delete actions and safe last-sheet protection |
| Formula authoring | Formula entry, function library, Insert Function, AutoSum, named ranges and formula evaluation tools | Basic arithmetic and six aggregate functions | Expand parser/evaluator in tested increments; add function search, argument guidance, AutoSum, named ranges and useful formula errors |
| Formula calculation | References, dependency tracking, incremental recalculation, dynamic arrays and spilling | Recursive cell evaluation; no verified dependency graph or dynamic-array engine | Add explicit dependency tracking and deterministic recalculation; support cross-sheet references, error propagation and later dynamic arrays/spills |
| Function coverage | Hundreds of functions; examples include XLOOKUP, IFS, LET and LAMBDA; FILTER, SORT and UNIQUE dynamic arrays | Six range functions plus arithmetic | Prioritise common logical, lookup, text, date/time, math, statistical and dynamic-array functions; publish a tested compatibility list rather than claiming hundreds prematurely |
| Cell presentation | Number formats, cell styles, borders and locale-aware input | No verified spreadsheet cell formatting model | Add typed values separate from display strings; number/date/currency/percentage formats; font, fill, alignment, borders and reusable styles |
| Conditional formatting | Data bars, colour scales and icon sets | Not verified | Add rule-based conditional formatting with preview, priority, stop-if-true semantics and save/reopen tests |
| Tables | Format as Table, structured data, filter buttons and totals rows | Basic grid and sorting; no verified structured table model | Add named tables, header/total rows, banded styles, structured references, table resizing and per-column filter controls |
| Data preparation | Sort, filter, Flash Fill, Text to Columns, Remove Duplicates, validation, grouping and subtotals | Selected-column sorting and row/column insertion | Add range-aware multi-column sort, filter menus, duplicate removal, split text, fill patterns, validation lists/rules, grouping and subtotals |
| Charts | Column, bar, line, pie, area, scatter and other charts; sparklines | Not verified in the current baseline | Add chart objects linked to ranges, chart design controls, legends/axes/labels, refresh-on-edit and cell sparklines |
| Pivot analysis | Drag fields among rows, columns, values and filters | Not implemented in documented baseline | Add pivot-table model and field-list interaction after tables, range selection and calculation foundations are stable |
| Images and shapes | Pictures floating over a sheet or placed in cells; shapes and drawing/ink | Not verified | Add safe local image placement, move/resize/anchor behavior, accessible alternatives and persistence |
| Review and protection | Comments, notes, spelling, sheet and workbook protection | Shared spelling infrastructure exists; spreadsheet comments/notes and protection are not verified | Add cell comments/notes, local spelling, protected ranges/sheets/workbooks and clear password/export limitations |
| Page layout and output | Page Break Preview, print areas/titles, printing and PDF export | CSV/XLSX export baseline; no verified spreadsheet print-layout experience | Add print preview, page size/orientation/margins, print areas/titles, repeating headers, page breaks and PDF export |
| File exchange | XLSX plus CSV/TSV; import/export and explicit known limits | CSV/XLSX foundation | Improve XLSX fidelity with a test corpus; add TSV; preserve supported formulas/styles/tables/charts; report unsupported content and lossy conversions |
| Automation | Command interface, CLI, MCP and assistants operating workbook commands | No verified customer-facing spreadsheet command protocol | Add a local, permission-scoped command interface for workbook operations; expose only explicit, auditable commands to optional assistants |
| Getting started | Blank workbook, samples, keyboard entry, formula entry, tables, save and PDF sharing | Basic workbook entry and file actions | Provide first-run sample workbooks (budget, sales dashboard, gradebook), guided first edit and clear open/save/export affordances |
| Installation and updates | Per-platform installation, checksum verification, update and uninstall guidance | Brightdesk has its own installer/update policy | Preserve Brightdesk's approved Windows/macOS/Linux packaging and explicit customer approval for update download/install; never adopt a third-party launcher or updater |
| Troubleshooting | Startup, high-DPI, performance, drag/drop, fonts, format limits, large files, external references, macros, printing, update failures and logs | Product-specific support coverage needs expansion | Add actionable diagnostics and help pages for each supported platform; report unsupported formats/features clearly and never imply unsupported macros work |

## Visual direction: closely follow the reference's information architecture

The reference screenshots and descriptions establish a familiar, dense desktop spreadsheet composition. Brightdesk should follow that composition and interaction hierarchy closely while remaining visibly Brightdesk.

### Main workbook window

1. **Top application frame:** Brightdesk Sheets identity, workbook name, save state and primary file actions.
2. **Ribbon tabs:** Home, Insert, Draw, Page Layout, Formulas, Data, Review, View and Automate. Contextual Table Design and Chart Design tabs appear only when the matching object is selected.
3. **Ribbon command groups:** compact, labelled controls with clear separators, tooltips and keyboard access.
4. **Name Box:** current cell/range address and navigation to a typed cell reference or named range.
5. **Formula bar:** function/input area with an expandable editing surface; formula text remains distinct from calculated cell display.
6. **Worksheet grid:** column letters, row numbers, visible selection border, fill handle, gridlines, formula-result display and horizontal/vertical scrolling.
7. **Sheet strip:** named worksheet tabs, active-sheet indicator, add-sheet control and navigation when tabs overflow.
8. **Status bar:** ready/edit state, selection summary, zoom control and accessible zoom percentage.

### Reference-led visual examples

The overview page's Quarterly Sales Dashboard screenshot describes a styled table with filter buttons, totals row, data bars, arrow icons and sparklines beside a clustered column chart and pie chart. The getting-started page's Household Budget screenshot describes accounting number formats, overspend highlighting, a percentage-used colour scale and a budget-versus-actual bar chart.

These are the visual quality targets for Brightdesk's own original sample workbooks. Create original Brightdesk data, chart palettes, iconography, typography and composition. Do not embed the reference screenshots or trace their artwork.

### Brightdesk identity constraints

- Keep the approved Brightdesk Sheets green accent (`#27845C`) and the shared Brightdesk design contract.
- Keep the original Brightdesk logo and Sheets SVG icon.
- Use the shared Brightdesk typography, spacing, focus, border and reduced-motion standards.
- Use the reference's familiar spreadsheet hierarchy, not its ArtCraft logo, names, product artwork, exact branded styling or copied assets.
- Keep the interface desktop-first for Windows, macOS and Linux.
- Preserve keyboard navigation, readable contrast, accessible labels and reduced-motion behavior.
- Do not add a mobile/tablet product surface as part of this work.

## AI and automation boundary

GridCraft's AI page describes a command-driven interface where an assistant can read/write cells, enter formulas, format ranges, create tables/charts, sort/filter and save workbooks through a local CLI/MCP bridge.

Brightdesk can adopt the useful interaction pattern without adopting its runtime or provider choices:

- Workbook commands must be local and deterministic.
- Every command must have a narrow schema, explicit workbook/range target and predictable result.
- File access must be limited to user-selected workbooks and approved output locations.
- Destructive operations require confirmation or a reversible undo step.
- Commands must not expose arbitrary shell execution, unrestricted filesystem access, credentials or hidden network calls.
- Brightdesk-AI remains separate engineering tooling, not an eleventh customer product and not a required runtime service.
- No paid model, subscription, account, cloud workbook, telemetry, analytics, advertising or customer-document upload is introduced.
- Any future MCP adapter is optional and local-first; normal spreadsheet work must remain fully usable without AI.

## Installation, file and support policy

GridCraft's installation page describes per-platform packages, checksums, update notices and uninstall guidance. Brightdesk must implement the equivalent quality of customer guidance using Brightdesk's own packaging and release process. It must not add ArtCraft Launcher or make a third-party service a runtime dependency.

For file compatibility, every import/export path must have:
- format and feature support documentation;
- malformed-file and large-file tests;
- explicit reporting when unsupported workbook content is ignored or changed;
- round-trip fixtures for formulas, styles, dates, merged cells, names, validation, tables and charts as each feature is introduced.

Troubleshooting documentation should cover only real Brightdesk-supported behavior. In particular, never imply that VBA, external-workbook links, password-protected workbook fidelity or unsupported legacy formats work unless tests prove it.

## Recommended implementation order

| Stage | Deliverable | Exit evidence |
|---|---|---|
| 0 — Workspace foundation | GridCraft-informed ribbon and workbook layout; Name Box, formula bar, grid, sheet strip and status bar | Visual review at supported desktop sizes; keyboard/focus checks; screenshot captured from a running build |
| 1 — Workbook model | Versioned workbook with multiple worksheets, active sheet, rename/add/duplicate/reorder/delete and safe persistence migration | Model, persistence, import/export and legacy-data regression tests |
| 2 — Editing foundation | Range selection, copy/paste, fill handle, undo/redo, multi-column sort, filters and keyboard navigation | Deterministic interaction tests and save/reopen coverage |
| 3 — Formula engine | Parser, references, common function groups, named ranges, dependency graph and clear error states | Parser/evaluator/reference/cycle/locale tests and performance baseline |
| 4 — Formatting and tables | Number formats, styles, borders, conditional formatting, structured tables and validation | Rendering fixtures plus persistence and XLSX round-trip tests |
| 5 — Visual analysis | Charts, sparklines, pictures, shapes and pivot tables | Data-binding tests, screenshot fixtures, accessibility and export checks |
| 6 — Review and output | Comments/notes, protection, page layout, print preview and PDF | Permission, recovery, print/PDF and native-platform tests |
| 7 — Automation and help | Local command protocol, optional MCP adapter, samples and troubleshooting guide | Permission-boundary tests, command contract tests and end-to-end workbook examples |

Each stage should be delivered as a small reviewed change. Use the repository's existing Node.js 24.22.2 test command and preserve the current Electron and Rust integration. Write failing regression tests before behavior changes. Do not replace the current stack with GridCraft's Rust architecture.

## Completion rule

A capability is **implemented** only when the real UI or supported command path works. It is **verified** only when its tests and relevant platform checks pass. It is **compatible** only for the formats and behaviors covered by fixtures. A screenshot of a design mock-up is not a running-app screenshot. A dependency, tab label, documentation entry or roadmap row is not proof of functionality.

