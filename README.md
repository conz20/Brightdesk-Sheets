# Brightdesk Sheets

<p align="center"><img src="assets/brand/brightdesk-logo.svg" alt="Brightdesk Office Suite" width="420"></p>
<p align="center"><img src="assets/icons/sheets.svg" alt="Brightdesk Sheets application icon" width="112" height="112"></p>

<p align="center"><strong>Work with tables, calculations, formulas and data.</strong></p>

<p align="center"><a href="https://raw.githubusercontent.com/connormolloy12/Brightdesk-Sheets/main/assets/previews/sheets-workspace.svg"><img src="assets/previews/sheets-workspace.svg" alt="Brightdesk Sheets workspace design preview" width="100%"></a></p>

<p align="center"><sub>Select the preview to open the full-size artwork.</sub></p>

> **Concept artwork — not a screenshot.** The preview above is original Brightdesk design artwork, not a capture from the running desktop build. A genuine screenshot will be added only after the current product window has been launched and its primary workflow checked.

Brightdesk Sheets is a dedicated desktop application within the independent Brightdesk Office Suite. It uses the shared Brightdesk design language and opens directly into Sheets.

## Shared Brightdesk design standard

This product follows the [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md) for branding, icon usage, layout, responsive behaviour and accessibility.

## Current first-use workflows

- Edit values in a spreadsheet grid and use the formula bar.
- Calculate basic arithmetic and supported range functions, including SUM, AVERAGE, MIN, MAX, COUNT and COUNTA.
- Add rows and columns, sort a selected column, and work with supported CSV and XLSX import/export.
- Keep the current workbook data on the device as part of the Brightdesk project.

**Known boundaries:** This is a basic spreadsheet foundation. Do not assume VBA/macros, pivot tables, advanced formula coverage, complex workbook features or exact Excel round-trip compatibility.

## Rust Node-API engine

The desktop main process can load Brightdesk's Node-API 8 Rust engine for bounded text chunking, source analysis, embedding normalization, cosine similarity and deterministic vector ranking. Renderer access is restricted to validated `window.brightdesk` methods through the context-isolated preload. Ordinary development uses a compatible JavaScript fallback when the native module is unavailable; installer builds compile the native module before packaging.

The engine does not generate semantic embeddings, call language models or upload spreadsheet content. Online collaboration and remote model services are separate capabilities and are not enabled by this engine.
## Download

The latest desktop installers are published from this repository’s verified release workflow when a release is approved.

| Platform | Installer |
| --- | --- |
| Windows | Windows x64 installer (.exe) |
| macOS | Universal installer (.dmg), package (.pkg) and archive (.zip) |
| Linux | x64 AppImage and Debian package (.deb) |

The complete ten-product desktop suite remains available from [Brightdesk-suite](https://github.com/connormolloy12/Brightdesk-suite).

## Quality and security

Pull requests and pushes run the product and shared-engine test suite, verify the dependency lock and third-party licences, check release preflight and block high-severity dependency vulnerabilities. The same checks repeat daily. Dependabot checks npm packages and GitHub Actions weekly.

Installer builds are started manually. Publishing a GitHub Release is a separate manual choice and is disabled by default.

## Run from source

Use Node.js **24.22.2**.

    npm ci
    npm start

To build an installer on its native operating system:

    npm run dist:product:mac
    npm run verify:product:mac

Use win on Windows or linux on Linux instead of mac.

## Project structure

- src/ — Brightdesk desktop renderer and product modules.
- `assets/icons/sheets.svg` — original Brightdesk Sheets application icon.
- `assets/previews/sheets-workspace.svg` — workspace concept preview.
- scripts/ — build and release verification tools.
- tests/ — automated product and shared-engine tests.

## Related project

[Brightdesk Office Suite](https://github.com/connormolloy12/Brightdesk-suite) brings all ten approved Brightdesk products together in one desktop installer.

## Identity and licence

Brightdesk is independent and is not affiliated with Microsoft. It uses original product names, code, interface design and artwork. See LICENSE, TERMS_AND_CONDITIONS.txt and THIRD_PARTY_NOTICES.md.
