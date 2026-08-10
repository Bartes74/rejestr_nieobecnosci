// A4 / NFR-7 (WCAG 2.1 AA) — statyczne sprawdzenie dostępności JSX. Tylko reguły jsx-a11y
// (bez ogólnego lintu), by skupić się na barierach a11y bez szumu.
// Zakres obejmuje też .jsx design systemu — jego komponenty trafiają do produktu tak samo jak ekrany.
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // Kalendarz i heatmapa to siatki przewijane w poziomie, w których nie ma ani jednej
      // kontrolki. axe (WCAG 2.1.1, `scrollable-region-focusable`) wymaga w takim wypadku
      // `tabIndex={0}` na obszarze przewijanym — inaczej użytkownik klawiatury nie dosięgnie
      // prawej części siatki. Domyślna lista tej reguły zna tylko `tabpanel`, więc dopisujemy
      // `region`; poza tymi dwiema rolami reguła działa bez zmian.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
    },
  },
];
