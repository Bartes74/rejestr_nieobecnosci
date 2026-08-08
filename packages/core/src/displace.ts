// FR-B10 (rozszerzenie) — nieobecność nieobciążająca puli (L4) ma pierwszeństwo przed
// zaplanowanym wcześniej urlopem. Dni wspólne wycina się z wcześniejszego wpisu i przez to
// same wracają do puli: saldo nie jest nigdzie przechowywane, liczy się z wpisów
// (`usedLeaveDays`), więc skrócony urlop to od razu odzyskane dni.
//
// Wycinanie operuje na całych dniach — daty w bazie to `@db.Date` (północ UTC), więc
// dodawanie doby w milisekundach jest dokładne i nie łapie przesunięć czasu letniego.

const DAY = 86_400_000;
const shift = (d: Date, days: number): Date => new Date(d.getTime() + days * DAY);

export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Część zakresu `span` leżąca poza zakresem `cut`.
 *
 * Zwraca kolejno: 1 zakres (brak części wspólnej), 0 (`cut` pochłania `span` w całości),
 * 1 (przycięcie od początku albo od końca) albo 2 zakresy (`cut` wypada w środku i rozcina
 * `span` na dwa kawałki). Ten ostatni przypadek jest powodem, dla którego funkcja zwraca
 * tablicę, a nie jeden opcjonalny zakres: L4 w środku dwutygodniowego urlopu zostawia urlop
 * przed chorobą i po niej.
 */
export function subtractRange(span: DateRange, cut: DateRange): DateRange[] {
  if (cut.dateTo < span.dateFrom || cut.dateFrom > span.dateTo) return [span];
  const rest: DateRange[] = [];
  if (span.dateFrom < cut.dateFrom) rest.push({ dateFrom: span.dateFrom, dateTo: shift(cut.dateFrom, -1) });
  if (span.dateTo > cut.dateTo) rest.push({ dateFrom: shift(cut.dateTo, 1), dateTo: span.dateTo });
  return rest;
}
