# Spreadsheet reference study and Brightdesk Sheets roadmap

**Status:** research and proposed roadmap, not a claim that these features are implemented.

## Reference reviewed

- Project: [Storytold GridCraft](https://github.com/storytold/gridcraft)
- Reference snapshot: public `main` at commit `c0ee120ac2d9b59630f5abf1151dd9b471fe2926`, committed 12 November 2026; GitHub reported the repository pushed on 13 November and updated on 14 November 2026.
- Upstream Cargo workspace version: `0.19.1`; Rust edition `2024`; declared minimum Rust version `1.95`.
- Upstream workspace licence expression: MIT OR Apache-2.0, with both licence files present.
- Relevant reference material: [README](https://github.com/storytold/gridcraft/blob/main/README.md), [roadmap](https://github.com/storytold/gridcraft/blob/main/ROADMAP.md), [architecture](https://github.com/storytold/gridcraft/blob/main/Cargo.toml), and the public crate layout.

This review uses public feature descriptions and architecture as product research. Brightdesk Sheets remains an independent implementation with its own source, interface, product identity, icons and artwork. No GridCraft source code, ArtCraft branding, screenshots, sample workbooks or assets are copied by this document.

## Current upstream snapshot and documentation freshness

The current upstream README describes a much broader spreadsheet surface than the earlier 7 November review:

- A familiar ribbon, formula bar, Name Box, sheet tabs, fill handle, Format Cells, conditional formatting and dark mode.
- AutoFilter, sorting, structured tables, table references, totals rows, data validation, Flash Fill, outlining and subtotals.
- A formula engine advertised with more than 500 functions, dynamic arrays/spilling, LET/LAMBDA and related higher-order functions.
- Charts and sparklines, PivotTables, cell pictures, comments, page-break preview, printing and PDF.
- XLSX as its native workbook format, plus CSV/TSV; documented partial import paths for legacy XLS, XLSB and ODS.
- CLI, MCP and a JSON control channel for automation.

**Do not treat those README descriptions as proof that every capability is complete or compatible with Excel.** The same current README still labels GridCraft alpha and says compatibility and implementation depth remain rough. Its own published summary estimates about 50% readiness for real work and approximately 160–240 hours to beta; these are upstream estimates, not Brightdesk targets.

The documentation is not all equally fresh: the upstream roadmap identifies itself as last updated 5 November 2026, and docs/gaps.md identifies itself as last updated 2 November 2026. The repository main branch moved after those dates. Use the current README and exact current source for product-scope research, but treat the older roadmap/gap estimates as dated context rather than a live list of current defects. Re-check the source before using any individual capability as an implementation specification.

GridCraft's Rust 2024 workspace, Rust 1.95 MSRV and 0.19.1 version are metadata of the reference project only. Brightdesk remains on its own approved Node.js 24.22.2 / Electron 45.2.1 / electron-builder 26.18.0 toolchain and current mixed-language architecture. Do not copy GridCraft's Rust architecture, code, dependency choices or brand assets into Brightdesk.

## What the reference demonstrates

GridCraft separates spreadsheet behaviour into distinct layers and documents these capability areas:

- Workbook and worksheet model, cells, values, styles and tables.
- Formula language: parsing, reference adjustment, evaluation and dependency tracking.
- Calculation: dependency graph, incremental recalculation, dynamic arrays and spilling.
- Worksheet functions, number formats and locale-aware input.
- Editing: selection, clipboard, fill, undo/history, sorting and filtering.
- Data features: tables, validation, outlining, subtotals and pivot tables.
- Visualisation: charts, sparklines, pictures and chart data tables.
- File exchange: XLSX, CSV and TSV, with documented partial import paths for other formats.
- Page layout, printing and PDF.
- Automation: command interface, CLI, MCP and a control channel.

GridCraft itself labels its current release alpha. Its roadmap calls out incomplete real-world XLSX fidelity, very large workbooks, legacy formats, charts, localisation and other gaps. Its reported command/function counts are catalogue measurements, not proof that every listed feature works. Brightdesk must make the same distinction between feature plans, implemented code and verified behaviour.

## Brightdesk Sheets: current verified baseline

The product README currently describes:

- Editing cell values in a spreadsheet grid and using a formula bar.
- Basic arithmetic and supported range functions, including SUM, AVERAGE, MIN, MAX, COUNT and COUNTA.
- Adding rows and columns, sorting a selected column, and supported CSV/XLSX import and export.
- Keeping workbook data on the device as part of the Brightdesk project.

The current product is an Electron desktop project using Node.js 24.22.2. Its existing test command is explicitly listed in `package.json`; use that exact command rather than assuming a generic test runner. Rust integration work must be preserved where present. Do not replace the current implementation with GridCraft's pure-Rust architecture.

## Current draft implementation: selection, formatting, clipboard and fill

The same review branch also introduces:

- Rectangular selection by Shift-click, with a visible selected range and cell count.
- Cell and range formatting for bold, italic, underline, safe text/fill colours and basic number formats.
- Copy/cut of selected cell blocks and paste of quoted tab/newline clipboard blocks. Clipboard parsing and paste size are bounded to protect workbook memory.
- Fill Down and Fill Right, copying from the first selected row/column and translating supported relative A1 cell and range references.
- Guarded Add Row and Add Column actions that refuse to expand beyond the 250,000-cell worksheet limit or Excel's row/column dimensions.
- Bounded undo/redo history for cell changes, formatting, row/column additions, sorting and worksheet operations.

Clipboard paste preserves formula text but does not translate its relative references or copy cell styles. Fill Down/Right does translate the supported relative reference subset. Neither behaviour implies full Excel formula compatibility. The draft still needs exact-head Node.js 24.22.2 tests and native desktop verification.

## Current draft implementation: filtering and safe sorting

The active multi-worksheet review branch is extending the P1 editing scope with:

- A Data-tab AutoFilter toggle and per-column dropdown menus on the first/header row.
- Searchable, multi-select distinct values, with an explicit blank option and AND-combined filters across columns.
- Filter criteria saved independently with each worksheet in the local Brightdesk project format.
- Keyboard navigation that skips rows hidden by active filters, including when an edited cell causes its own row to become hidden.
- Stable sorting of data rows while leaving the header in place, carrying cell styles with their records, and remapping same-worksheet formula references to the destination rows of the records they originally referenced.
- XLSX AutoFilter range import/export. ExcelJS writes and reads the filter range; Brightdesk's per-value selection criteria remain in the local project format and reset when importing an XLSX workbook. The imported cell data is not removed by this reset.

The implementation includes unit and integration-focused regression tests, but these features must remain marked **draft / unverified** until the exact current commit passes the approved Node.js 24.22.2 CI run, the real XLSX round-trip tests pass, and the running desktop experience is checked. Do not describe the feature as fully Excel-compatible or as full GridCraft parity.

## Proposed capability sequence

| Priority | Brightdesk capability | Acceptance evidence before calling it complete |
|---|---|---|
| P0 | Stable workbook/sheet/cell model, save/reopen and edit history | Model tests, persistence tests and corruption recovery |
| P1 | Formula parser, references, core functions and clear formula errors | Parser/evaluator tests and deterministic reference cases |
| P1 | Row/column operations, fill, copy/paste, sort and filter | Boundary, selection, clipboard and undo/redo tests |
| P1 | Cell formatting, number/date formats and reusable styles | Display/edit separation and save/reopen tests |
| P2 | XLSX and CSV compatibility with explicit loss reporting | Real-world workbook corpus and round-trip comparison |
| P2 | Named ranges, structured tables, totals rows and data validation | Table-name/reference tests, validation-rule boundary tests, local save/reopen and XLSX round trips |
| P2 | XLSX and CSV compatibility with explicit loss reporting | Real-world workbook corpus, format-feature matrix and round-trip comparison |
| P3 | Formula dependency graph and incremental recalculation | Recalculation correctness, dependency-invalidation tests and performance benchmarks |
| P3 | Charts, conditional formatting, sparklines and print/PDF | Visual fixtures, data binding, accessible editing and export tests |
| P4 | Pivot tables, what-if analysis and advanced data import | Feature-specific correctness suites and documented limitations |
| P4 | Scripting/automation interface with safe local permissions | Contract tests, sandboxed file access and audit logs |

Multiple worksheets and the first sort/filter foundation are already being developed in draft PR #35; they are not accepted until exact-head tests and desktop verification pass. The next product-value increment after that is structured tables and data validation, not attempting to reproduce every high-end GridCraft/Excel feature at once. Priorities are proposed, not a promise that every feature will be included in the first release. Each increment must be sized against the existing code and the user's intended workflow.

## Brightdesk implementation principles

1. Keep the Brightdesk Sheets product repository as the source of truth.
2. Preserve JavaScript/Node/Electron and every existing language, including Rust. Do not replace the current stack to imitate the reference's pure-Rust architecture.
3. Keep workbook model, formula parsing/calculation, file adapters, commands/history and UI rendering separated behind tested interfaces where the current architecture permits.
4. Treat XLSX compatibility as a measurable exchange target. Test formulas, styles, charts, names, validation, dates, merged cells and unsupported content; never promise perfect Excel round-tripping without corpus evidence.
5. Keep workbooks local by default. Do not add a paid cloud dependency or make Brightdesk-AI a runtime requirement.
6. Use original Brightdesk interface composition, terminology, icons, sample data and visual assets. A familiar grid, formula bar and sheet tabs are conventional spreadsheet patterns; do not copy another product's branding, screenshots, artwork or exact screen composition.
7. Add or update tests before changing behaviour. Run focused tests and then the repository's complete test command using Node.js 24.22.2.

## Licensing and attribution

GridCraft publishes under MIT OR Apache-2.0. This research document does not copy its implementation. If a later change deliberately reuses a specific code component, first identify the exact source files and commit, choose and comply with the applicable licence, retain copyright and licence notices, add the required third-party attribution to Brightdesk's notices, and review dependency and distribution obligations. Do not copy ArtCraft trademarks or brand assets; the upstream project explicitly separates those from its code licence.

## Research links

- [GridCraft repository](https://github.com/storytold/gridcraft)
- [GridCraft README](https://github.com/storytold/gridcraft/blob/main/README.md)
- [GridCraft roadmap](https://github.com/storytold/gridcraft/blob/main/ROADMAP.md)
- [GridCraft attribution policy](https://github.com/storytold/gridcraft/blob/main/ATTRIBUTION.md)
- [GridCraft licence files](https://github.com/storytold/gridcraft/tree/main)
