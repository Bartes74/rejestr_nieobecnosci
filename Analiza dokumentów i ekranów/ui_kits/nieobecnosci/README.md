# UI kit — Aplikacja Nieobecności

High-fidelity recreation of the absence-monitoring app's core surfaces, composed from this design system's component primitives.

## Screens
- **AppShell** — 250px sidebar (grouped nav: Pracownik / Planowanie / Dyrektor / Administracja) + sticky top bar with theme toggle.
- **Pulpit** — employee dashboard: live leave balance, reminders, "who's out", upcoming absences.
- **Wpis (Nowa nieobecność)** — entry form (type, date range, day-fraction) with live working-day/balance preview, collision alert, and a mini month picker.
- **Kalendarz** — team timeline for the sprint window; uniform absence bars (never typed), key-role dot, weekend shading.
- **Capacity** — sprint capacity per squad, key-role collision alert, daily availability chart.
- **Raporty** — period switch, hierarchy breadcrumb, KPI stat cards, per-squad utilisation, "kto zalega" table, Excel export.
- **Heatmapa** — coverage risk heatmap (green→red sequential scale).
- **Pracownicy** — org tree + employees table (Avatar, multi-unit, pula/zaległe/status), import/add.
- **Historia** — own-entries table with tabs (Wszystkie/Nadchodzące/Zrealizowane) and withdraw action; L4 visible only to self.
- **Konfiguracja** — tabs (Typy/Pula/Święta/Sprinty); absence-type table (L4 flagged "Dane o zdrowiu") + pula & holidays cards.
- **Audyt** — L4-protection RODO notice, immutable audit log, retention switches, right-to-be-forgotten.

All 10 nav targets are now fully realised screens.

`App.jsx` wires navigation + light/dark theme. `index.html` mounts `App` from the compiled bundle and is the interactive entry point.

Rendered via the generated `_ds_bundle.js`; in a consuming project, import screens/components by relative path or from the bundle namespace.
