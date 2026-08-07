import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { count } from '@nieobecnosci/core/plural';
import { dateRange } from '../format';
import { api, type CalEntry } from '../api';
import { cardClipped } from '../design-system/surfaces';
import { AbsencePill } from '../design-system/components/data/AbsencePill';
import { SegmentedControl } from '../design-system/components/forms/SegmentedControl';

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
// Dzień i miesiąc wystarczą: rok stoi w nagłówku nad tabelą.
const rangeLabel = (e: CalEntry) => dateRange(e.dateFrom, e.dateTo);

// FR-C2 — okno „dziś" / „ten tydzień" (pon–niedz) wg bieżącej daty.
function windowBounds(kind: 'today' | 'week'): [string, string] {
  const n = new Date();
  const t = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  const d = (x: Date) => x.toISOString().slice(0, 10);
  if (kind === 'today') return [d(t), d(t)];
  const dow = (t.getUTCDay() + 6) % 7;
  const mon = new Date(t); mon.setUTCDate(t.getUTCDate() - dow);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  return [d(mon), d(sun)];
}

// FR-C1/C3 — kalendarz zespołu (Tribe). Prezentacja JEDNOLITA: jednakowe „pigułki",
// bez typu i bez wyróżnienia L4 (dane przychodzą z serwera już bez typu).
export function Kalendarz() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const [entries, setEntries] = useState<CalEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedMsg, setFeedMsg] = useState('');
  // Pusty miesiąc i nieudane żądanie wyglądały tak samo — oba kończyły się zdaniem
  // „Brak nieobecności w tym miesiącu.", które w drugim przypadku było nieprawdą.
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  // FR-F4 — link subskrypcji kalendarza zespołu (iCal/webcal). Kanał jednolity (bez typu, L4-safe).
  const subscribe = async () => {
    setFeedMsg('');
    try {
      const { token } = await api.feedToken();
      const url = `${location.origin}/api/feed/team.ics?token=${token}`;
      setFeedUrl(url);
      try { await navigator.clipboard.writeText(url); setFeedMsg('Skopiowano link do schowka — dodaj go w aplikacji kalendarza (Outlook/Google: „Subskrybuj z URL").'); }
      catch { setFeedMsg('Link gotowy — skopiuj poniżej i dodaj w aplikacji kalendarza („Subskrybuj z URL").'); }
    } catch (e) { setFeedMsg((e as Error).message); }
  };

  const from = iso(ym.y, ym.m, 1);
  const to = iso(ym.y, ym.m + 1, 0);

  useEffect(() => {
    let live = true;
    setState('loading');
    api.calendar(from, to)
      .then((e) => { if (live) { setEntries(e); setState('ready'); } })
      .catch(() => { if (live) { setEntries([]); setState('error'); } });
    return () => { live = false; };
  }, [from, to]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    const [wf, wt] = windowBounds(filter);
    return entries.filter((e) => e.dateFrom <= wt && e.dateTo >= wf);
  }, [entries, filter]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; ranges: CalEntry[] }>();
    for (const e of filtered) {
      const row = map.get(e.employeeId) ?? { name: e.employee, ranges: [] };
      row.ranges.push(e);
      map.set(e.employeeId, row);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [filtered]);

  const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ym.y, ym.m, 1)));
  const shift = (d: number) => setYm(({ y, m }) => {
    const nm = m + d;
    return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
  });
  const navBtn = { width: 34, height: 34, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="ds-quiet" onClick={subscribe} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, padding: '8px 13px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
          <CalendarDays size={15} aria-hidden="true" /> Subskrybuj (iCal)
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="ds-quiet" aria-label="Poprzedni miesiąc" style={navBtn} onClick={() => shift(-1)}><ChevronLeft size={17} aria-hidden="true" /></button>
          <span aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
          <button type="button" className="ds-quiet" aria-label="Następny miesiąc" style={navBtn} onClick={() => shift(1)}><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </div>
      <div role="status" aria-live="polite">
        {feedMsg && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)' }}>{feedMsg}</div>
            {feedUrl && <code style={{ display: 'block', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-all' }}>{feedUrl}</code>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <SegmentedControl label="Zakres kalendarza" value={filter} onChange={(v) => setFilter(v as typeof filter)}
          options={[{ value: 'all', label: 'Wszyscy' }, { value: 'today', label: 'Dziś' }, { value: 'week', label: 'Ten tydzień' }]} />
        {state === 'ready' && byPerson.length > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{count(byPerson.length, ['osoba', 'osoby', 'osób'])}</span>
        )}
      </div>

      <div style={cardClipped} aria-busy={state === 'loading'}>
        {state === 'loading' && <div style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }} role="status">Wczytywanie kalendarza…</div>}
        {state === 'error' && (
          <div style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--ink-2)' }} role="alert">
            Nie udało się wczytać kalendarza na ten miesiąc. Przejdź na inny miesiąc i wróć albo odśwież stronę.
          </div>
        )}
        {state === 'ready' && byPerson.length === 0 && <div style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>{filter === 'all' ? 'Brak nieobecności w tym miesiącu.' : 'Nikt nieobecny w wybranym okresie.'}</div>}
        {state === 'ready' && byPerson.map((row) => (
          <div key={row.name} className="ds-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
            {/* Nazwisko musi mieć stałą kolumnę (pigułki mają się zaczynać w jednej linii), ale
                nie może uciąć długiego nazwiska bez ostrzeżenia — stąd elipsa i pełna treść w title. */}
            <span title={row.name} style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', flex: '0 0 180px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {row.ranges.map((r, i) => <AbsencePill key={i}>{rangeLabel(r)}</AbsencePill>)}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
        Nieobecności prezentowane jednolicie — bez rozróżnienia typu.
      </p>
    </div>
  );
}
