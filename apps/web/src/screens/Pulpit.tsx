import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Info, Plus, TriangleAlert } from 'lucide-react';
import { api, type Absence, type Balance, type CalEntry, type Sprint } from '../api';
import { useAuth } from '../current-employee';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());

// Bieżący tydzień (pon–niedz) wg dzisiejszej daty.
function weekBounds(): [string, string] {
  const n = new Date();
  const t = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  const dow = (t.getUTCDay() + 6) % 7;
  const mon = new Date(t); mon.setUTCDate(t.getUTCDate() - dow);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  return [iso(mon), iso(sun)];
}

const initialsOf = (name: string) => name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
const monthShort = (s: string) => new Intl.DateTimeFormat('pl-PL', { month: 'short', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z')).replace('.', '').toUpperCase();
const dayNum = (s: string) => s.slice(8, 10);
const dmShort = (s: string) => `${Number(s.slice(8, 10))}.${s.slice(5, 7)}`;

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)' } as const;
const cardTitle = { fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' } as const;

export function Pulpit() {
  const { current } = useAuth();
  const navigate = useNavigate();
  const [bal, setBal] = useState<Balance | null>(null);
  const [week, setWeek] = useState<CalEntry[]>([]);
  const [mine, setMine] = useState<Absence[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [wf, wt] = useMemo(weekBounds, []);

  useEffect(() => {
    if (!current) return;
    api.balance(current.id).then(setBal).catch(() => setBal(null));
    api.calendar(wf, wt).then(setWeek).catch(() => setWeek([]));
    api.absences(current.id).then(setMine).catch(() => setMine([]));
    api.sprints().then(setSprints).catch(() => setSprints([]));
  }, [current?.id]);

  const dateLabel = useMemo(() => {
    const s = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    return s.charAt(0).toUpperCase() + s.slice(1); // tylko dzień tygodnia z wielkiej (miesiąc małą, jak w prototypie)
  }, []);
  const sprint = useMemo(() => {
    const t = today();
    return sprints.find((s) => s.dateFrom.slice(0, 10) <= t && s.dateTo.slice(0, 10) >= t) ?? null;
  }, [sprints]);

  // FR-C3 — kto nieobecny w tym tygodniu (jednolicie, bez typu); pomijamy siebie.
  const absent = useMemo(() => {
    const byPerson = new Map<string, { name: string; from: string; to: string }>();
    for (const e of week) {
      if (current && e.employeeId === current.id) continue;
      const cur = byPerson.get(e.employeeId);
      const from = e.dateFrom.slice(0, 10), to = e.dateTo.slice(0, 10);
      if (!cur) byPerson.set(e.employeeId, { name: e.employee, from, to });
      else { if (from < cur.from) cur.from = from; if (to > cur.to) cur.to = to; }
    }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [week, current?.id]);

  // FR-I2 — moje najbliższe (przyszłe) nieobecności.
  const upcoming = useMemo(() => {
    const t = today();
    return mine.filter((a) => a.dateTo.slice(0, 10) >= t).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)).slice(0, 4);
  }, [mine]);

  const pool = bal ? bal.pool : 0;
  const carried = bal ? bal.carriedOver : 0;
  const used = bal ? bal.used : 0;
  const remaining = bal ? bal.remaining : 0;
  const total = pool + carried;
  const usedW = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const carriedW = total > 0 ? Math.min(100 - usedW, (carried / total) * 100) : 0;

  const chipDate = (a: { from: string; to: string }) => {
    const t = today();
    const fromTxt = a.from <= t && a.to >= t ? 'dziś' : dmShort(a.from);
    return a.from === a.to ? dmShort(a.from) : `${fromTxt}–${dmShort(a.to)}`;
  };

  return (
    <div style={{ maxWidth: 1180, animation: 'fu .2s ease' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 23, fontWeight: 700, margin: '0 0 3px', letterSpacing: '-.01em', color: 'var(--ink)' }}>
          Dzień dobry{current ? `, ${current.firstName}` : ''} 👋
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          {dateLabel}{sprint ? <> · {sprint.name} ({dmShort(sprint.dateFrom.slice(0, 10))}–{dmShort(sprint.dateTo.slice(0, 10))})</> : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 18 }}>
        {/* BALANS */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Twój urlop · pozostało do rozplanowania</div>
              {bal && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', background: 'var(--surface-3)', padding: '3px 8px', borderRadius: 6 }}>Rok {bal.period.type === 'CALENDAR' ? 'kalendarzowy' : 'budżetowy'} {bal.period.year}</span>}
            </div>
            <button type="button" onClick={() => navigate('/wpis')} style={{ border: 'none', cursor: 'pointer', background: 'var(--brand)', color: 'var(--on-brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, padding: '10px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 7, boxShadow: 'var(--shadow-sm)' }}>
              <Plus size={16} /> Zaplanuj nieobecność
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 58, fontWeight: 800, lineHeight: .9, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{remaining}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 600, marginBottom: 9 }}>/ {total} dni</span>
            <span style={{ marginBottom: 11, marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--brand)', background: 'var(--brand-tint)', fontWeight: 600, padding: '4px 9px', borderRadius: 20 }}>aktualizacja na żywo</span>
          </div>
          <div style={{ display: 'flex', height: 11, borderRadius: 7, overflow: 'hidden', background: 'var(--surface-3)', margin: '14px 0 18px' }}>
            <div style={{ width: `${usedW}%`, background: 'var(--brand)' }} />
            <div style={{ width: `${carriedW}%`, background: 'var(--absence-border)' }} />
          </div>
          <div style={{ display: 'flex', gap: 22 }}>
            {[['Pula roczna', pool, false], ['Wykorzystano', used, true], ['w tym zaległe', carried, false]].map(([label, value, accent], i) => (
              <div key={label as string} style={{ flex: 1, borderLeft: i ? '1px solid var(--border)' : 'none', paddingLeft: i ? 22 : 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: accent ? 'var(--brand)' : 'var(--ink)' }}>{value as number}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>{label as string}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PRZYPOMNIENIA */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ ...cardTitle, marginBottom: 14 }}>Przypomnienia</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {bal && bal.carriedOver > 0 ? (
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 11, padding: '12px 13px' }}>
                <TriangleAlert size={17} color="var(--amber)" style={{ flex: 'none', marginTop: 1 }} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.8, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                  <b style={{ color: 'var(--ink)' }}>Masz {bal.carriedOver} dni zaległego urlopu.</b> Zaplanuj jego wykorzystanie, aby nie zalegał.
                </div>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 13px' }}>
              <Info size={17} color="var(--blue)" style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.8, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                {remaining > 0 ? <>Zbliża się koniec okresu rozliczeniowego — zaplanuj pozostałe <b style={{ color: 'var(--ink)' }}>{remaining} dni</b>.</> : 'Masz w pełni rozplanowany urlop w tym okresie.'}
              </div>
            </div>
          </div>
        </div>

        {/* KTO NIEOBECNY */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={cardTitle}>Kto dziś / w tym tygodniu nieobecny</div>
            <button type="button" onClick={() => navigate('/kalendarz')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              Kalendarz <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {absent.length === 0 && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)', padding: '12px 0' }}>Nikt nieobecny w tym tygodniu.</div>}
            {absent.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < absent.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-tint)', color: 'var(--blue)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12 }}>{initialsOf(p.name)}</div>
                <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{p.name}</div></div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--absence-ink)', background: 'var(--absence)', border: '1px solid var(--absence-border)', padding: '3px 9px', borderRadius: 7 }}>{chipDate(p)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MOJE NAJBLIŻSZE */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ ...cardTitle, marginBottom: 14 }}>Moje najbliższe nieobecności</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.length === 0 && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)' }}>Brak zaplanowanych nieobecności.</div>}
            {upcoming.map((a) => {
              const from = a.dateFrom.slice(0, 10), to = a.dateTo.slice(0, 10);
              const part = a.dayPart === 'AM' ? ' · pół dnia (AM)' : a.dayPart === 'PM' ? ' · pół dnia (PM)' : a.dayPart === 'HOURS' ? ' · godziny' : '';
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px' }}>
                  <div style={{ textAlign: 'center', width: 42 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>{dayNum(from)}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{monthShort(from)}</div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 13 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{from === to ? dmShort(from) : `${dmShort(from)} – ${dmShort(to)}`}{part}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)' }}>{a.type?.name ?? 'Nieobecność'} · zaplanowane</div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
