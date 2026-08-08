import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3100';

export default defineConfig({
  plugins: [react()],
  // packages/core kompiluje się do CommonJS (konsumuje go też NestJS). Bez tego rollup nie widzi
  // nazwanych eksportów z linkowanego pakietu workspace i build wywala się na `import { plural }`.
  build: { commonjsOptions: { include: [/packages\/core/, /node_modules/] } },
  // Każdy podmoduł rdzenia konsumowany przez frontend musi tu być wymieniony: pakiet kompiluje
  // się do CommonJS, więc bez wstępnego przetworzenia Vite nie widzi nazwanych eksportów
  // i przeglądarka dostaje „does not provide an export named …" zamiast aplikacji.
  optimizeDeps: { include: ['@nieobecnosci/core/plural', '@nieobecnosci/core/today'] },
  server: {
    port: 5188,
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
});
