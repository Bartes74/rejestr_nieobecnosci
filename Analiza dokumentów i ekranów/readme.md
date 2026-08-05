# Nieobecności — Design System

A design system for **Nieobecności** — an internal web application for registering and monitoring employee absences across a large, agile-structured department (~300 users, 6 teams). It replaces fragile, lock-prone Excel files with a single source of truth: real-time multi-user entry, automatic roll-up through the org hierarchy, and a clear leave-balance counter.

This system was derived from the working hi-fi prototype (`Aplikacja Nieobecnosci.dc.html`) and the organisation's visual-identity colour palette (Pantone-based corporate swatches).

## Sources
- Functional requirements: "Wymagania funkcjonalne — aplikacja do monitorowania nieobecności" v2.0
- Product backlog: "Backlog — aplikacja nieobecności" (11 epics, 67 stories)
- Visual identity: corporate Pantone palette (basic + appended colours)
- Reference prototype: `Aplikacja Nieobecnosci.dc.html` (in the parent project)

---

## CONTENT FUNDAMENTALS

**Language:** Polish. Professional, calm, plain. The product is an internal tool for a regulated (banking-style) organisation, so copy is precise and trustworthy, never playful.

**Address:** Second person singular, warm but professional — "Twój urlop", "Zaplanuj nieobecność", "Masz 4 dni zaległego urlopu". System-level statements are impersonal — "Wpis obowiązuje od zapisania".

**Casing:** Sentence case for headings and buttons ("Nowa nieobecność", "Zapisz nieobecność"). UPPERCASE only for small mono table/section labels ("PRACOWNIK", "ZALEGA", "NIEOBECNI · 23–24.06"), tracked at ~.04em.

**Tone examples**
- Empty/help: "Nieobecności prezentowane jednolicie."
- Reminder (amber): "Masz 4 dni zaległego urlopu. Wykorzystaj do 30.09.2026, aby nie przepadły."
- Alert (danger): "Alert: kolizja kluczowych ról — … nieobecni jednocześnie w dniach 23–24.06. Rozważ przesunięcie kluczowych zadań sprintu."
- Privacy notice: "Informacja „to jest L4" dostępna wyłącznie dla ról uprawnionych."

**Numbers & dates:** Polish formats — `22 czerwca 2026`, `14–18.07.2026`, `30.09.2026`. Counters and IDs are set in IBM Plex Mono with tabular figures. Ranges use an en-dash (–), not a hyphen.

**Emoji:** Essentially none. A single waving hand in the dashboard greeting ("Dzień dobry, Anna 👋") is the only sanctioned use; avoid elsewhere.

**Quotation marks:** Polish low-high quotes „…".

---

## VISUAL FOUNDATIONS

**Mood:** Calm, dense, trustworthy enterprise software. Generous whitespace inside cards; quiet neutrals; one confident brand green; colour reserved for meaning.

**Colour**
- Primary is corporate **teal-green** (`--brand` #007A53 light / #2FB888 dark). Used for primary actions, active nav, brand mark, key figures.
- Neutrals are cool-warm greys with a faint green tint (`--canvas`, `--surface`, `--surface-2/3`). Never pure #000/#FFF for text.
- Accent **blue** (`--blue`) is for data-viz and avatars only — it does **not** encode meaning.
- Semantic: **amber** = attention/reminder, **danger** = error/over-limit/risk.
- **Absence is always uniform** (`--absence` soft teal). It is NEVER colour-coded by type, and L4 (sick leave) is never visually distinguished — a hard requirement (D1/D2/C3).
- The **coverage heatmap** is the one place with a sequential scale: green (calm) → yellow → orange → red (at risk). Colour there encodes *risk intensity*, not absence type.

**Typography:** Archivo for everything UI; IBM Plex Mono for data (counters, IDs, dates, table micro-labels). Big balance numbers use weight 800 with `-0.02em` tracking and `tabular-nums`.

**Backgrounds:** Flat. `--canvas` behind cards; white surfaces. No photography, no full-bleed imagery, no textures. The only gradient is the login brand panel (a 150° teal gradient with a faint dot grid) and the soft brand-tint header on the RODO/L4 notice.

**Cards:** `--surface` fill, 1px `--border`, `--radius-xl` (16px), `--shadow-sm`. Inner panels use `--radius-lg`. Tables live inside cards with `overflow:hidden`.

**Borders & radii:** Hairline 1px borders everywhere; controls 10px, cards 14–16px, pills 20px. Avatars/icon tiles are 7–9px rounded squares (not circles) with tinted backgrounds + initials.

**Shadows:** Restrained. `--shadow-sm` for resting cards; `--shadow` for the few elevated elements (mobile FAB, toast). Dark theme deepens shadows.

**Elevation & status accents:** Alerts/callouts use tint background + 1px solid same-hue border + a filled icon tile. The danger alert additionally uses a filled icon square; the heatmap "at risk" cell uses an inset red ring.

**Animation:** Minimal and functional. Subtle fade/translate on screen mount; instant theme/nav switches. No bounces, no decorative motion. Live counters imply real-time updates (≤1s).

**Hover/press:** Buttons darken to `--brand-dark` on hover; ghost/secondary controls get `--surface-2` fill. Nav items get `--brand-tint` + brand text when active. Keep transitions short (120–160ms).

**Layout:** Fixed 250px left sidebar + sticky 64px top bar; scrollable content with 28–30px padding. Max content width ~1180px. Tables and timelines are CSS grid. Spacing via fl//grid `gap`, not margins.

---

## ICONOGRAPHY

- **Style:** Lucide-style line icons — 1.8–2.0px stroke, `currentColor`, rounded caps/joins, 24×24 viewBox, rendered 14–22px. They inherit text colour from context.
- In production, use **Lucide** (`lucide-react` or the SVG CDN) — it matches the prototype's hand-tuned set 1:1 (calendar, plus, grid, users, sliders, shield, clock, bell, search, sun/moon, flag, triangle-alert, chevrons, layers, download, log-out).
- The **logo mark** is a calendar glyph in a rounded brand-green tile; wordmark "Nieobecności" in Archivo 700. See `assets/`.
- **Avatars:** initials in a 7px rounded tile, tinted (`--brand-tint`/`--blue-tint`/`--surface-3`) — never photos.
- **No emoji** as icons (one greeting exception). No unicode-glyph icons except the small status dot (●) and en-dash separators.

---

## INDEX / MANIFEST

- `styles.css` — global entry (import this). Pulls in all tokens + fonts.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`.
- `guidelines/` — foundation specimen cards (colours, type, spacing, brand) shown in the Design System tab.
- `components/` — reusable React primitives:
  - `core/` — Button, Badge, Avatar, Card
  - `forms/` — Input, Select, SegmentedControl, Switch
  - `feedback/` — Alert
  - `navigation/` — NavItem, Tabs, Breadcrumb
  - `data/` — StatCard, ProgressBar, AbsencePill, Table
  - `overlay/` — Dialog, Toast, Tooltip
- `ui_kits/nieobecnosci/` — high-fidelity recreations of key app screens (Pulpit, Nowa nieobecność, Kalendarz, Capacity, Raporty, Heatmapa, Pracownicy).
- `assets/` — logo mark, wordmark.
- `SKILL.md` — portable skill manifest.
