import { describe, it, expect } from 'vitest';
import { toICS } from './ical.js';

describe('toICS (FR-F4)', () => {
  it('emituje all-day VEVENT z DTEND = ostatni+1 (ekskluzywny) i zakończeniami CRLF', () => {
    const ics = toICS([{ uid: 'a@x', summary: 'Urlop', dateFrom: new Date(Date.UTC(2026, 6, 14)), dateTo: new Date(Date.UTC(2026, 6, 18)) }]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260714');
    expect(ics).toContain('DTEND;VALUE=DATE:20260719'); // 18 + 1 dzień
    expect(ics).toContain('SUMMARY:Urlop');
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('jeden dzień: DTEND = dzień następny', () => {
    const ics = toICS([{ uid: 'b', summary: 'Nieobecność', dateFrom: new Date(Date.UTC(2026, 0, 2)), dateTo: new Date(Date.UTC(2026, 0, 2)) }]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260102');
    expect(ics).toContain('DTEND;VALUE=DATE:20260103');
  });

  it('escapuje znaki specjalne w SUMMARY (RFC 5545)', () => {
    const ics = toICS([{ uid: 'c', summary: 'Nieobecność; test, x', dateFrom: new Date(Date.UTC(2026, 0, 1)), dateTo: new Date(Date.UTC(2026, 0, 1)) }]);
    expect(ics).toContain('SUMMARY:Nieobecność\\; test\\, x');
  });
});
