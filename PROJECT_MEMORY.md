# Brightdesk project memory

The standing project requirement is latest-stable-first: check official upstream release sources, current security advisories and support status before each runtime, toolchain or dependency update, then select the newest stable version that passes Brightdesk compatibility checks. The current tested local Node.js pin remains 24.22.2 LTS until its candidate update passes; Node.js 24.22.3 is the security-patch candidate and Node.js 26.13.1 requires a separate major-runtime compatibility trial. Keep exact tested pins and evidence in the shared Brightdesk Suite Version Compatibility Standard.

The approved and fixed product scope is exactly ten Brightdesk products:
- Brightdesk Pages
- Brightdesk Sheets
- Brightdesk Decks
- Brightdesk Notes
- Brightdesk Database
- Brightdesk Forms
- Brightdesk Lists
- Brightdesk Planner
- Brightdesk To Do
- Brightdesk Workspace

All ten approved customer products have their own GitHub repositories and are integrated into Brightdesk Office Suite. The live owner portfolio contains 28 active, unarchived repositories as of 28 November 2026; repository count is not the customer-product count. Brightdesk-AI is private engineering tooling, Brightdesk-Archives is owner-controlled support infrastructure, and the remaining supporting repositories are not additional customer products.

Each product repository is independently maintained and connected to the Suite. Keep source, tests, dependencies, documentation and installer evidence current in the repository being changed. Integration or repository presence does not prove that tests, accessibility, persistence, installers or release acceptance are complete.

## Brightdesk naming rule

Use the product's actual name on its own (for example, **Brightdesk Pages**) and describe distribution as **desktop installers**.

Do not use the words "standalone" or "app" in customer-facing wording, product descriptions, repository names or descriptions, README files, documentation, UI labels, download buttons, installer names, release names, workflow names, artwork or progress updates. Replace either word with the product name or clear desktop-installer wording wherever possible.

Apply this rule consistently to all ten approved products and to every future product repository. When updating source code or internal files, also rename avoidable filenames, function names, variables, comments, tests and workflow identifiers that use the disallowed terminology. Preserve framework-required API names or compatibility keys only when changing them would break runtime behavior or existing data, and never expose such identifiers as product wording.

The user has explicitly authorised using available plugins and tools as needed for Brightdesk project work. This does not authorise adding products outside the approved ten or publishing releases without explicit release approval.

## Product scope restrictions

Outlook, OneDrive and Teams are excluded. Do not add them.

Brightdesk is an independent desktop product with original branding and implementation. Keep installers native to their target operating systems. Do not publish a release without explicit owner approval.
