# Spreadsheet reference study and Brightdesk Sheets roadmap

**Status:** research and proposed roadmap, not a claim that these features are implemented.

## Reference reviewed

- Project: [Storytold GridCraft](https://github.com/storytold/gridcraft)
- Reference version: public `main` branch inspected on 7 November 2026
- Project description: open-source spreadsheet implemented in Rust
- Published licence: MIT OR Apache-2.0
- Relevant reference material: [README](https://github.com/storytold/gridcraft/blob/main/README.md), [roadmap](https://github.com/storytold/gridcraft/blob/main/ROADMAP.md), [architecture](https://github.com/storytold/gridcraft/blob/main/Cargo.toml), and the public crate layout.

This review uses public feature descriptions and architecture as product research. Brightdesk Sheets remains an independent implementation with its own source, interface, product identity, icons and artwork. No GridCraft source code, ArtCraft branding, screenshots, sample workbooks or assets are copied by this document.

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

## Proposed capability sequence

| Priority | Brightdesk capability | Acceptance evidence before calling it complete |
|---|---|---|
| P0 | Stable workbook/sheet/cell model, save/reopen and edit history | Model tests, persistence tests and corruption recovery |
| P1 | Formula parser, references, core functions and clear formula errors | Parser/evaluator tests and deterministic reference cases |
| P1 | Row/column operations, fill, copy/paste, sort and filter | Boundary, selection, clipboard and undo/redo tests |
| P1 | Cell formatting, number/date formats and reusable styles | Display/edit separation and save/reopen tests |
| P2 | XLSX and CSV compatibility with explicit loss reporting | Real-world workbook corpus and round-trip comparison |
| P2 | Multiple sheets, named ranges, tables and data validation | Cross-sheet and malformed-reference regression tests |
| P3 | Formula dependency graph and incremental recalculation | Recalculation correctness and performance benchmarks |
| P3 | Charts, conditional formatting, sparklines and print/PDF | Visual fixtures, data binding and export tests |
| P4 | Pivot tables, what-if analysis and advanced data import | Feature-specific correctness suites and documented limitations |
| P4 | Scripting/automation interface with safe local permissions | Contract tests, sandboxed file access and audit logs |

Priorities are proposed, not a promise that every feature will be included in the first release. Each increment must be sized against the existing code and the user's intended workflow.

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
