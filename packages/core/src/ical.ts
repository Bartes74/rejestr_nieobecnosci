// FR-F4 — generowanie kanału iCalendar (.ics) z nieobecności. Czysty tekst, bez zależności.
// Wpisy całodniowe: DTSTART;VALUE=DATE oraz DTEND;VALUE=DATE = dzień PO ostatnim (DTEND jest ekskluzywny).

export interface ICalEvent {
  uid: string;
  summary: string;
  dateFrom: Date;
  dateTo: Date; // ostatni dzień włącznie
}

const pad = (n: number): string => String(n).padStart(2, '0');
const ymd = (d: Date): string => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const nextDay = (d: Date): Date => new Date(d.getTime() + 86_400_000);
// RFC 5545: w wartościach TEXT escapujemy \ ; , oraz nowe linie.
const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function toICS(events: readonly ICalEvent[], calName = 'Nieobecności'): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nieobecnosci//PL', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(calName)}`];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `SUMMARY:${esc(e.summary)}`,
      `DTSTART;VALUE=DATE:${ymd(e.dateFrom)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.dateTo))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
