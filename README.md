# Brightdesk Sheets

<p align="center"><img src="assets/brand/brightdesk-logo.svg" alt="Brightdesk Office Suite" width="420"></p>
<p align="center"><img src="assets/icons/sheets.svg" alt="Brightdesk Sheets application icon" width="112" height="112"></p>

<p align="center"><strong>Work with tables, calculations, formulas and data.</strong></p>

<p align="center"><img src="assets/previews/sheets-workspace.svg" alt="Brightdesk Sheets workspace design preview" width="100%"></p>

> **Visual example:** This is an original Brightdesk design preview showing the intended desktop workspace. It is an illustrative concept, not a screenshot of a completed release build.

Brightdesk Sheets is a dedicated desktop application within the independent Brightdesk Office Suite. It uses the shared Brightdesk design language and opens directly into Sheets.

## Shared Brightdesk design standard

This product follows the [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md) for branding, icon usage, layout, responsive behaviour and accessibility.

## What this product does

Work with tables, calculations, formulas and data.

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
- assets/brightdesk-product.svg — original product artwork.
- scripts/ — build and release verification tools.
- tests/ — automated product and shared-engine tests.

## Related project

[Brightdesk Office Suite](https://github.com/connormolloy12/Brightdesk-suite) brings all ten approved Brightdesk products together in one desktop installer.

## Identity and licence

Brightdesk is independent and is not affiliated with Microsoft. It uses original product names, code, interface design and artwork. See LICENSE, TERMS_AND_CONDITIONS.txt and THIRD_PARTY_NOTICES.md.

## Professional workspace examples and acceptance

Sheets must feel like a capable spreadsheet workspace. The primary example should show a useful, realistic table with readable column headers, varied values, a selected cell, a formula result and a clear relationship between the formula bar and the grid.

### Example workflow

1. Create a workbook for a simple monthly budget or inventory.
2. Add meaningful column names and realistic sample rows.
3. Enter a total or average formula and show the calculated result.
4. Sort or filter the records and make the active selection obvious.
5. Export a CSV and verify that text values are handled safely.

The grid must remain the main focus. Use consistent row/column headers, restrained gridlines, clear selection and edit states, legible formula entry, and visible feedback for sorting, filtering and export. Do not use decorative charts or controls that are not connected to working data.

Follow the shared [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md). Keep the artwork original to Brightdesk.

### Acceptance checks

- Cell selection, editing, formula evaluation and sorting/filtering produce observable results.
- Formula-like exported text is safely handled by the CSV export path.
- Keyboard navigation and focus are clear across the grid and toolbar.
- Screenshots use realistic data and identify concept artwork versus a verified running build.
