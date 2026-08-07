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
    rules: jsxA11y.configs.recommended.rules,
  },
];
