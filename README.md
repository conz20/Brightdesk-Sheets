# Brightdesk Sheets

<p align="center"><img src="assets/brand/brightdesk-logo.svg" alt="Brightdesk Office Suite" width="420"></p>
<p align="center"><img src="assets/icons/sheets.svg" alt="Brightdesk Sheets application icon" width="112" height="112"></p>

<p align="center"><strong>Work with tables, calculations, formulas and data.</strong></p>

<p align="center"><a href="https://raw.githubusercontent.com/connormolloy12/Brightdesk-Sheets/main/assets/previews/sheets-workspace.svg"><img src="assets/previews/sheets-workspace.svg" alt="Brightdesk Sheets interface design" width="100%"></a></p>

<p align="center"><sub>Select the interface image to open the full-size design.</sub></p>

> **Interface design artwork — not a screenshot.** This image shows the intended Brightdesk interface. It is not a capture from the running desktop build. A genuine product screenshot will be added after the current desktop build has been launched and its primary workflow verified.

Brightdesk Sheets is a dedicated desktop application within the independent Brightdesk Office Suite. It uses the shared Brightdesk design language and opens directly into Sheets.

## Shared Brightdesk design standard
This product follows the local [approved design brief](docs/BRIGHTDESK_DESIGN.md) and the canonical [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md). Its approved accent is `#27845C`; the shared shell, original SVG identity, accessibility rules and screenshot evidence requirements remain consistent across the suite.

## Cross-platform consistency

The Windows, macOS and Linux editions use the same approved Brightdesk interface and supported product scope. Shared layout, typography, spacing, component states and navigation follow the [Brightdesk visual and interaction standard](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md). This product's original icon and approved accent remain the same on every operating system. Only operating-system integrations such as window controls, native file dialogs, keyboard conventions and package formats may adapt to platform conventions.

| Operating system | Configured package targets |
| --- | --- |
| Windows | x64 NSIS installer (.exe) |
| macOS | Universal disk image (.dmg), package installer (.pkg) and archive (.zip) |
| Linux | x64 AppImage (.AppImage) and Debian package (.deb) |

These are configured build targets, not confirmation that a package has passed its native build, installation, upgrade and removal checks. Each operating system must pass its own release verification before its download is described as available.

**Terms and first launch:** A valid acceptance of the current Brightdesk Terms and Conditions is required before the product opens. When no current acceptance record exists, a blocking agreement window is shown. Accept continues; declining or closing the window exits the product. This first-use gate is present in the product source for Windows, macOS and Linux. Follow any additional agreement shown by the native installer.

**Updates and removal:** The approved product version and feature scope must remain aligned across all operating systems. Update packages must come from the same tested release. Native installation and removal controls can differ by operating system, but the expected outcome is consistent: remove the product without silently deleting local project data. Do not claim update, upgrade or uninstall verification for an operating system until its native workflow has passed.

## Current first-use workflows

- Edit values in a spreadsheet grid and use the formula bar.
- Calculate basic arithmetic and supported range functions, including SUM, AVERAGE, MIN, MAX, COUNT and COUNTA.
- Add rows and columns, sort a selected column, and work with supported CSV and XLSX import/export.
- Keep the current workbook data on the device as part of the Brightdesk project.

**Known boundaries:** This is a basic spreadsheet foundation. Do not assume VBA/macros, pivot tables, advanced formula coverage, complex workbook features or exact Excel round-trip compatibility.
## Cross-platform desktop packages

The approved cross-platform target is one Brightdesk interface and product scope on Windows, macOS and Linux. Each product must retain its approved icon and accent across those systems. Only operating-system integrations such as window chrome, native dialogs, keyboard conventions, permissions and packaging may vary.

| Platform | Configured package target |
| --- | --- |
| Windows | x64 NSIS installer (.exe) |
| macOS | Universal disk image (.dmg), package installer (.pkg) and archive (.zip) |
| Linux | x64 AppImage (.AppImage) and Debian package (.deb) |

These are configured build targets, not confirmation that installers are published or have passed native verification. Build and verify each package on its target operating system before describing it as available. Release checks must cover installation, first launch, upgrade, launch after upgrade and removal. Removing Brightdesk must not silently delete local project data.

The customer-facing release version and release approval are managed centrally by Brightdesk Office Suite. Publishing remains a separate manual action.
## Quality and security

Pull requests and pushes run the product and shared-engine test suite, verify the dependency lock and third-party licences, check release preflight and block high-severity dependency vulnerabilities. The same checks repeat daily. Dependabot checks npm packages and GitHub Actions weekly.

Installer builds are started manually. Publishing a GitHub Release is a separate manual choice and is disabled by default.

## Run from source

Use Node.js **24.22.2**.

```sh
npm ci
npm start
```

Build and verify each installer on its matching native operating system:

| Platform | Build command | Verification command |
| --- | --- | --- |
| Windows | `npm run dist:product:win` | `npm run verify:product:win` |
| macOS | `npm run dist:product:mac` | `npm run verify:product:mac` |
| Linux | `npm run dist:product:linux` | `npm run verify:product:linux` |

## Project structure

- src/ — Brightdesk desktop renderer and product modules.
- `assets/icons/sheets.svg` — original Brightdesk Sheets application icon.
- `assets/previews/sheets-workspace.svg` — workspace interface design.
- scripts/ — build and release verification tools.
- tests/ — automated product and shared-engine tests.

## Related project

[Brightdesk Office Suite](https://github.com/connormolloy12/Brightdesk-suite) brings all ten approved Brightdesk products together in one desktop installer.

## Identity and licence

Brightdesk is independent and is not affiliated with Microsoft. It uses original product names, code, interface design and artwork. See LICENSE, TERMS_AND_CONDITIONS.txt and THIRD_PARTY_NOTICES.md.

## CI and installer build cadence

Pull requests and pushes to `main` run the product validation job. Markdown-only changes are excluded from this test workflow because they do not change executable product code; the README freshness check remains responsible for documentation changes.

A scheduled maintenance validation runs every **Monday at 04:17 UTC**. The scheduled run performs the Ubuntu-based test, release-preflight and dependency-audit job only; it does not create desktop installers.

The Windows, macOS and Linux installer matrix remains available through a manual workflow dispatch with `build_installers: true`. Publishing remains a separate opt-in action with `publish_release: true`. This keeps routine checks lighter without removing any operating-system build target or reducing cross-platform release coverage.

## Documentation freshness

The root README is maintained alongside the product, not as an end-of-project task. Every pull request that changes application code, tests, UI, design assets, screenshots, icons, configuration, dependencies, packaging, or build/release workflows must also update this README in the same pull request. Keep feature status, screenshots and visual references, application icons, setup/build instructions, platform compatibility, and repository links aligned with the latest verified implementation. Describe planned or untested functionality as planned, never as completed. The **README freshness** GitHub Actions check requires a root `README.md` update whenever a pull request or direct push to `main` changes a non-Markdown file; a passing check confirms inclusion, while reviewers remain responsible for checking factual accuracy and current visuals.
