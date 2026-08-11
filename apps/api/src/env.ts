/**
 * Jedno miejsce, w którym rozstrzyga się, czy uruchomienie jest jawnie lokalne.
 *
 * To samo pytanie zadawały dwa miejsca — awaryjny sekret JWT (main.ts) i wyłączanie limitów
 * żądań (app.module.ts) — każde własnym porównaniem `NODE_ENV`, i oba pytały odwrotnie:
 * „czy to NIE jest produkcja". Przy takim sformułowaniu bezpieczna jest jedna wartość,
 * a niebezpieczne wszystkie pozostałe, łącznie z tymi, których nikt nie wpisuje świadomie:
 * nieustawione NODE_ENV, „staging", „prod", „production " ze spacją. Każde takie środowisko
 * dostawało stały sekret z repozytorium i bezterminowo wyłączone limity logowania.
 *
 * Pytamy więc wprost o lokalność: nieznane środowisko nie jest lokalne, więc obowiązują je
 * reguły produkcyjne. Ulgi wymagają deklaracji, a nie jej braku.
 */
export const isLocalEnv = (): boolean =>
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
