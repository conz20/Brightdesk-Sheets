# Brightdesk Sheets — approved design brief

This repository implements the approved Brightdesk Sheets visual identity. Do not create a separate theme or change shared shell decisions independently.

## Canonical source

The owner-controlled visual contract is [Brightdesk-suite/docs/BRIGHTDESK_VISUAL_STANDARD.md](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_VISUAL_STANDARD.md), with machine-readable tokens and all ten product identities in [BRIGHTDESK_DESIGN_CONTRACT.json](https://github.com/connormolloy12/Brightdesk-suite/blob/main/docs/BRIGHTDESK_DESIGN_CONTRACT.json). Brightdesk-AI keeps a private checked-in mirror and uses it in development proposals and independent reviews.

## Shared shell

- Workspace canvas: `#F3F6FA`; work surfaces: `#FFFFFF`; muted surfaces: `#F8F9FB`.
- Navigation: deep navy vertical gradient `#14233F` to `#0D1930`, with white primary labels and muted `#A8B6D0` secondary labels.
- Text: ink `#202B3C`, body `#354256`, muted `#68778C`.
- Borders: `#DFE4EC` and `#EBEFF4`; Inter/system sans-serif typography.
- Retain consistent spacing, control sizes, borders, radii, hover/pressed states and visible keyboard focus.

## Sheets identity

- Approved accent: `#27845C`.
- Strong accent: `#1E6847`.
- Soft accent: `#EDF7F1`.
- Original application icon: `src/assets/icons/sheets.svg`.
- Approved concept preview: `assets/previews/sheets-workspace.svg`.

Use the accent for active product states, focus indicators and primary actions; do not recolour the shared surfaces. Use the original SVG artwork everywhere the product icon appears. Never use emoji, Unicode pictographs, initials or generic placeholders as the application icon.

## Accessibility and evidence

All actionable controls must be keyboard accessible, semantically labelled and visibly focused. Maintain readable contrast, never communicate status by colour alone, respect reduced motion and avoid clipping essential controls at narrow widths.

Concept artwork is not a screenshot. Only describe or publish a genuine screenshot after capturing it from the current running desktop build and checking the visible workflow. Never present a mockup as proof of runtime behaviour.
