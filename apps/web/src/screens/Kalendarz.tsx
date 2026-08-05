import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type CalEntry } from '../api';

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

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
    api.calendar(from, to).then(setEntries).catch(() => setEntries([]));
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={subscribe} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, padding: '8px 13px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
          <CalendarDays size={15} /> Subskrybuj (iCal)
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" aria-label="Poprzedni miesiąc" style={navBtn} onClick={() => shift(-1)}><ChevronLeft size={17} /></button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
          <button type="button" aria-label="Następny miesiąc" style={navBtn} onClick={() => shift(1)}><ChevronRight size={17} /></button>
        </div>
      </div>
      {feedMsg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)' }}>{feedMsg}</div>
          {feedUrl && <code style={{ display: 'block', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-all' }}>{feedUrl}</code>}
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: 2, padding: 3, marginBottom: 14, background: 'var(--surface-3)', borderRadius: 'var(--radius-md)' }}>
        {([['all', 'Wszyscy'], ['today', 'Dziś'], ['week', 'Ten tydzień']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-sm, 8px)', border: 'none', cursor: 'pointer',
            background: filter === k ? 'var(--surface)' : 'transparent', color: filter === k ? 'var(--brand)' : 'var(--ink-2)',
            boxShadow: filter === k ? 'var(--shadow-sm)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {byPerson.length === 0 && <div style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>{filter === 'all' ? 'Brak nieobecności w tym miesiącu.' : 'Nikt nieobecny w wybranym okresie.'}</div>}
        {byPerson.map((row) => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', width: 180 }}>{row.name}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {row.ranges.map((r, i) => (
                <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 9px', borderRadius: 20, background: 'var(--absence)', color: 'var(--absence-ink)' }}>
                  {r.dateFrom === r.dateTo ? r.dateFrom : `${r.dateFrom} – ${r.dateTo}`}
                </span>
              ))}
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
