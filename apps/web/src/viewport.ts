import { useEffect, useState } from 'react';

/**
 * NFR-6, wariant pośredni (10.08.2026) — aplikacja pozostaje narzędziem desktopowym, ale pulpit
 * i formularz wpisu mają być użyteczne na telefonie. To jedyny scenariusz mobilny, który realnie
 * się zdarza: „zachorowałem, wpisuję z domu". Ekrany planistyczne i raportowe zostają przy biurku.
 *
 * Progu nie da się tu wyrazić media query: układ ekranów jest pisany w atrybucie `style`, a te nie
 * mają pseudoklas ani zapytań o media. Czytamy go więc z `matchMedia`, zamiast dublować cały układ
 * w CSS i utrzymywać dwie prawdy o tym samym ekranie.
 */
const WASKI = '(max-width: 768px)';

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(WASKI).matches);
  useEffect(() => {
    const mq = window.matchMedia(WASKI);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
