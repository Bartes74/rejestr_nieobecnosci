---
name: nieobecnosci-design
description: Use this skill to generate well-branded interfaces and assets for Nieobecności (an internal employee absence-monitoring app), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key facts to load first:
- `styles.css` is the single entry point — link it and use the CSS custom properties (`--brand`, `--surface`, `--ink`, `--absence`, `--font-sans`, `--font-mono`, spacing/radius tokens). Light is default; add `data-theme="dark"` for dark mode.
- Primary colour is corporate teal-green. Absence is ALWAYS shown uniformly — never colour-coded by type, and sick-leave (L4) is never visually distinguished (privacy requirement). The only sequential colour scale is the coverage heatmap (green→red = calm→at-risk).
- Type: Archivo (UI) + IBM Plex Mono (data/IDs/dates). Icons: Lucide line style.
- Components live in `components/` (Button, Badge, Avatar, Card, SegmentedControl, Switch, Alert, NavItem, StatCard, ProgressBar, AbsencePill). Full screens in `ui_kits/nieobecnosci/`.
