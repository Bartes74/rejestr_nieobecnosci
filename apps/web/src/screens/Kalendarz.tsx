import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { count } from '@nieobecnosci/core/plural';
import { addDays, currentYearMonth, dateRange, dayMonth, mergeIsoRanges, todayIso, weekBounds } from '../format';
import { api, type OrgUnit, type Sprint, type TeamGrid, type TeamPerson } from '../api';
import { useAuth } from '../current-employee';
import { Notice, field, useNotice } from '../admin/ui';
import { card } from '../design-system/surfaces';
import { SegmentedControl } from '../design-system/components/forms/SegmentedControl';

/**
 * FR-C1/C3 — kalendarz zespołu jako oś czasu.
 *
 * Wcześniej był to spis osób z pigułkami zakresów: żeby sprawdzić, czy dwie osoby są nieobecne
 * jednocześnie, trzeba było porównać daty w głowie. Oś czasu odpowiada na to wzrokiem — dni są
 * kolumnami, ludzie wierszami, a nieobecność ciągłym paskiem. Nakładające się paski widać
 * natychmiast i o to w tym ekranie chodzi w oknie planowania sprintu.
 *
 * Druga różnica jest merytoryczna: siatka pokazuje **cały zespół**, także osoby bez wpisów.
 * Pusty wiersz niesie informację „ta osoba jest dostępna", której lista nieobecności nie miała
 * jak wyrazić.
 *
 * Prezentacja pozostaje jednolita (D1/D2): każdy pasek wygląda tak samo, bez typu i bez
 * wyróżnienia L4 — serwer i tak nie wysyła typu tym kanałem.
 */

const RANGES = [
  { value: 'week', label: 'Tydzień' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'month', label: 'Miesiąc' },
] as const;
type RangeKind = (typeof RANGES)[number]['value'];

const WD = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NDZ'];
const isWeekend = (iso: string) => {
  const dow = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return dow === 0 || dow === 6;
};
const monthLabelOf = (y: number, m: number) =>
  new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));

/** Lista kolejnych dni `YYYY-MM-DD` od `from` do `to` włącznie. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Panel „Liderzy" dotyczy jednostek, wokół których planuje dyrektor. ponytail: bez PION (nikt nie
// planuje wokół szefa pionu) i bez CHAPTER/SQUAD (za drobno); dopisać, gdy ktoś o to poprosi.
const LEAD_TYPES = new Set(['DEPARTAMENT', 'TRIBE']);
const pill = { fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--brand)', background: 'var(--brand-tint)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', flex: 'none' } as const;

export function Kalendarz() {
  const { current } = useAuth();
  const canLead = current?.role === 'ADMIN' || current?.role === 'DIRECTOR';
  const [range, setRange] = useState<RangeKind>('week');
  // Filtry dyrektora (feedback002): jedna jednostka i „tylko liderzy". Dostępne dla każdego —
  // lider widzi w selekcie wyłącznie swoje poddrzewo, bo /org/units zgadza się z assertUnitInScope.
  const [unitId, setUnitId] = useState('');
  const [leadersOnly, setLeadersOnly] = useState(false);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [members, setMembers] = useState<Record<string, { id: string; firstName: string; lastName: string }[]>>({});
  const [reload, setReload] = useState(0);
  const { notice, busy, run } = useNotice();
  const [ym, setYm] = useState(currentYearMonth);
  const [weekAnchor, setWeekAnchor] = useState(todayIso);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [grid, setGrid] = useState<TeamGrid | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedMsg, setFeedMsg] = useState('');

  // Sprinty służą wyłącznie jako zakres osi. Gdy ich nie ma, przełącznik traci jedną opcję,
  // ale ekran działa dalej — kalendarz zespołu nie może zależeć od tego, czy ktoś wgrał harmonogram.
  useEffect(() => {
    api.sprints()
      .then((s) => {
        const sorted = [...s].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
        setSprints(sorted);
        const t = todayIso();
        const cur = sorted.findIndex((x) => x.dateFrom <= t && x.dateTo >= t);
        setSprintIdx(cur >= 0 ? cur : Math.max(0, sorted.length - 1));
      })
      .catch(() => setSprints([]));
  }, []);

  const sprint = sprints[sprintIdx] ?? null;
  const options = useMemo(() => RANGES.filter((r) => r.value !== 'sprint' || sprints.length > 0), [sprints.length]);

  // Okno osi. Każdy tryb ma własną nawigację, ale wszystkie sprowadzają się do pary dat.
  const [from, to, label] = useMemo((): [string, string, string] => {
    if (range === 'week') {
      const [mon, sun] = weekBounds(weekAnchor);
      return [mon, sun, `${dayMonth(mon)}–${dayMonth(sun)}`];
    }
    if (range === 'sprint' && sprint) {
      const f = sprint.dateFrom, t = sprint.dateTo;
      return [f, t, sprint.name];
    }
    const first = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`;
    return [first, addDays(`${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`, new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate() - 1), monthLabelOf(ym.y, ym.m)];
  }, [range, weekAnchor, sprint, ym]);

  useEffect(() => {
    let live = true;
    setState('loading');
    api.calendarTeam(from, to, { unitId: unitId || undefined, leadersOnly })
      .then((g) => { if (live) { setGrid(g); setState('ready'); } })
      .catch(() => { if (live) { setGrid(null); setState('error'); } });
    return () => { live = false; };
  }, [from, to, unitId, leadersOnly, reload]);

  useEffect(() => {
    let live = true;
    api.orgUnits().then((u) => { if (live) setUnits(u); }).catch(() => {});
    return () => { live = false; };
  }, [reload]);

  // Kandydaci na lidera per jednostka — tylko gdy panel jest widoczny; jedno żądanie na jednostkę.
  const leadUnits = useMemo(() => units.filter((u) => LEAD_TYPES.has(u.type)), [units]);
  useEffect(() => {
    if (!canLead || leadUnits.length === 0) return undefined;
    let live = true;
    Promise.all(leadUnits.map((u) => api.unitMembers(u.id).then((m) => [u.id, m] as const).catch(() => [u.id, []] as const)))
      .then((pairs) => { if (live) setMembers(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [canLead, leadUnits]);

  const setLeader = (u: OrgUnit, leaderId: string) => run(async () => {
    await api.setUnitLeader(u.id, leaderId || null);
    setReload((n) => n + 1);
    const who = members[u.id]?.find((m) => m.id === leaderId);
    return who ? `Lider jednostki „${u.name}": ${who.firstName} ${who.lastName}.` : `Jednostka „${u.name}" bez lidera.`;
  });

  const shift = (dir: -1 | 1) => {
    if (range === 'week') return setWeekAnchor((a) => addDays(a, dir * 7));
    if (range === 'sprint') return setSprintIdx((i) => Math.min(sprints.length - 1, Math.max(0, i + dir)));
    setYm(({ y, m }) => { const nm = m + dir; return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 }; });
  };
  const canShift = (dir: -1 | 1) => (range !== 'sprint' ? true : dir < 0 ? sprintIdx > 0 : sprintIdx < sprints.length - 1);

  const days = useMemo(() => daysBetween(from, to), [from, to]);
  const today = todayIso();

  // Wiersze pogrupowane po squadzie. Osoby bez przypisania trafiają na koniec pod własnym
  // nagłówkiem — znikanie ich z siatki ukryłoby czyjąś nieobecność przed planistą.
  const groups = useMemo(() => {
    if (!grid) return [];
    const byId = new Map<string, { from: string; to: string }[]>();
    for (const a of grid.absences) {
      const list = byId.get(a.employeeId) ?? [];
      list.push({ from: a.dateFrom, to: a.dateTo });
      byId.set(a.employeeId, list);
    }
    const bySquad = new Map<string, TeamPerson[]>();
    for (const p of grid.people) {
      const key = p.squad ?? '￿Bez squadu';
      (bySquad.get(key) ?? bySquad.set(key, []).get(key)!).push(p);
    }
    return [...bySquad.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pl'))
      .map(([key, people]) => ({
        label: key.startsWith('￿') ? 'Bez przypisania do squadu' : key,
        // Zakresy scalone: siatka nie rozróżnia rodzaju nieobecności, a nakładające się wpisy
        // dałyby tu dwa paski na tych samych dniach — i przerwę w środku ciągłej nieobecności,
        // bo krawędź pigułki wypadałaby na końcu pierwszego z nich.
        people: people.map((p) => ({ ...p, ranges: mergeIsoRanges(byId.get(p.id) ?? []) })),
      }));
  }, [grid]);

  const absentCount = useMemo(() => new Set(grid?.absences.map((a) => a.employeeId) ?? []).size, [grid]);

  // Per dzień: ilu nieobecnych i ilu z nich to liderzy. Dwóch liderów naraz to kolizja, o którą
  // pyta dyrektor (feedback002) — pokazana w nagłówku dnia, słowem i kolorem, nie samym kolorem.
  const dayStats = useMemo(() => {
    const out = new Map<string, { total: number; leaders: number }>();
    const people = groups.flatMap((g) => g.people);
    for (const d of days) {
      let total = 0, leaders = 0;
      for (const p of people) {
        if (!p.ranges.some((x) => d >= x.from && d <= x.to)) continue;
        total++;
        if (p.leaderOf.length > 0) leaders++;
      }
      out.set(d, { total, leaders });
    }
    return out;
  }, [groups, days]);

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

  // Kolumna nazwiska jest stała, dni dzielą resztę po równo. Przy miesiącu kolumn jest 31,
  // więc siatka dostaje minimalną szerokość i przewija się w poziomie wewnątrz karty.
  const cols = `208px repeat(${days.length}, minmax(0, 1fr))`;
  const minGridWidth = 208 + days.length * 30;
  const navBtn = { width: 32, height: 32, flex: 'none', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="ds-quiet" aria-label="Poprzedni zakres" disabled={!canShift(-1)}
            style={{ ...navBtn, opacity: canShift(-1) ? 1 : 0.4, cursor: canShift(-1) ? 'pointer' : 'not-allowed' }} onClick={() => shift(-1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span aria-live="polite" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{label}</span>
          <button type="button" className="ds-quiet" aria-label="Następny zakres" disabled={!canShift(1)}
            style={{ ...navBtn, opacity: canShift(1) ? 1 : 0.4, cursor: canShift(1) ? 'pointer' : 'not-allowed' }} onClick={() => shift(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <SegmentedControl label="Zakres osi czasu" value={range} onChange={(v) => setRange(v as RangeKind)} options={[...options]} />
        <select aria-label="Jednostka" value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ ...field, maxWidth: 260 }}>
          <option value="">Wszystkie widoczne jednostki</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.type} · {u.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" aria-label="Tylko liderzy jednostek" checked={leadersOnly} onChange={(e) => setLeadersOnly(e.target.checked)} /> tylko liderzy
        </label>
        <div style={{ flex: 1 }} />
        <button type="button" className="ds-quiet" onClick={subscribe}
          style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, padding: '8px 13px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
          <CalendarDays size={15} aria-hidden="true" /> Subskrybuj (iCal)
        </button>
      </div>

      {/* Lidera wskazuje się tam, gdzie się na niego patrzy: dyrektor nie ma Konfiguracji, a to on
          planuje wokół nieobecności liderów (feedback002). Kandydaci = członkowie poddrzewa. */}
      {canLead && leadUnits.length > 0 && (
        <div style={{ ...card, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Liderzy jednostek</h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>Osoby, których nieobecności śledzi dyrektor. Lider musi należeć do jednostki albo jej poddrzewa.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {leadUnits.map((u) => (
              <label key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{u.type} · {u.name}</span>
                <select style={field} value={u.leaderId ?? ''} disabled={busy} onChange={(e) => setLeader(u, e.target.value)}>
                  <option value="">— bez lidera —</option>
                  {(members[u.id] ?? []).map((m) => <option key={m.id} value={m.id}>{m.lastName} {m.firstName}</option>)}
                </select>
              </label>
            ))}
          </div>
          <Notice {...notice} />
        </div>
      )}

      <div role="status" aria-live="polite">
        {feedMsg && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)' }}>{feedMsg}</div>
            {feedUrl && <code style={{ display: 'block', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-all' }}>{feedUrl}</code>}
          </div>
        )}
      </div>

      {/* WCAG 2.1.1 — siatka przewija się w poziomie, a nie ma w niej nic, co da się kliknąć,
          więc bez `tabIndex` użytkownik klawiatury nie dosięgnie prawej części miesiąca.
          Obszar przewijany musi umieć przyjąć fokus i mieć nazwę, po której da się go rozpoznać. */}
      <div role="region" aria-label="Siatka kalendarza — przewijana w poziomie" tabIndex={0}
        style={{ ...card, overflowX: 'auto' }} aria-busy={state === 'loading'}>
        {state === 'loading' && <div role="status" style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Wczytywanie kalendarza…</div>}
        {state === 'error' && (
          <div role="alert" style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--ink-2)' }}>
            Nie udało się wczytać kalendarza na ten zakres. Przejdź na inny i wróć albo odśwież stronę.
          </div>
        )}
        {state === 'ready' && grid && grid.people.length === 0 && (
          <div style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>
            {leadersOnly ? 'Brak liderów w tym zakresie — liderów jednostek wskazuje dyrektor albo administrator w panelu nad siatką.'
              : unitId ? 'W tej jednostce nie ma nikogo.'
                : 'Nie widzisz tu nikogo — nie należysz jeszcze do żadnego Tribe. Struktura zespołu jest ustawiana w Konfiguracji przez administratora.'}
          </div>
        )}

        {state === 'ready' && grid && grid.people.length > 0 && (
          <div role="table" aria-label="Kalendarz zespołu — osoby w wierszach, dni w kolumnach" style={{ minWidth: minGridWidth }}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <div role="columnheader" style={{ padding: '11px 16px', alignSelf: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Zespół · {count(grid.people.length, ['osoba', 'osoby', 'osób'])}
              </div>
              {days.map((d) => {
                const we = isWeekend(d), now = d === today;
                const st = dayStats.get(d) ?? { total: 0, leaders: 0 };
                const clash = st.leaders >= 2;
                return (
                  <div key={d} role="columnheader" title={clash ? `Kolizja liderów: ${st.leaders} nieobecnych jednocześnie` : undefined} style={{
                    textAlign: 'center', padding: '7px 0 6px', borderLeft: '1px solid var(--border)',
                    background: clash ? 'var(--amber-tint)' : we ? 'var(--surface-3)' : 'transparent',
                  }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: now ? 'var(--brand)' : 'var(--muted)' }}>{WD[(new Date(`${d}T00:00:00.000Z`).getUTCDay() + 6) % 7]}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: now ? 700 : 600, fontVariantNumeric: 'tabular-nums', color: now ? 'var(--brand)' : 'var(--ink)' }}>{Number(d.slice(8, 10))}</div>
                    {/* Licznik nieobecnych tego dnia — planista czyta kolumnę, nie liczy pasków. */}
                    <div aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, minHeight: 12, color: clash ? 'var(--amber)' : 'var(--muted)', fontWeight: clash ? 700 : 400 }}>{st.total > 0 ? st.total : ''}</div>
                    <span className="ds-sr">{dayMonth(d)}{now ? ' — dziś' : ''}{st.total > 0 ? `, ${count(st.total, ['nieobecny', 'nieobecnych', 'nieobecnych'])}` : ''}{clash ? `, kolizja liderów: ${st.leaders}` : ''}</span>
                  </div>
                );
              })}
            </div>

            {groups.map((g) => (
              <div key={g.label}>
                <div role="row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                  <div role="rowheader" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{g.label}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted)' }}>{count(g.people.length, ['osoba', 'osoby', 'osób'])}</span>
                  </div>
                </div>
                {g.people.map((p) => (
                  <div key={p.id} role="row" style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div role="rowheader" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', minWidth: 0 }}>
                      <span aria-hidden="true" style={{ width: 28, height: 28, flex: 'none', borderRadius: 7, background: 'var(--blue-tint)', color: 'var(--blue)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 10.5 }}>{p.initials}</span>
                      <span style={{ minWidth: 0 }}>
                        <span title={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                          {/* Kropka to sygnał czysto wizualny — nazwa idzie do czytnika osobno. */}
                          {p.keyRole && <><span aria-hidden="true" style={{ width: 6, height: 6, flex: 'none', borderRadius: '50%', background: 'var(--amber)' }} /><span className="ds-sr">rola kluczowa</span></>}
                          {p.leaderOf.length > 0 && <><span aria-hidden="true" title={`Lider: ${p.leaderOf.join(', ')}`} style={pill}>lider</span><span className="ds-sr">lider: {p.leaderOf.join(', ')}</span></>}
                        </span>
                        <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 10.5, color: 'var(--muted)' }}>
                          {p.ranges.length === 0 ? 'dostępna cały zakres' : p.ranges.map((r) => dateRange(r.from, r.to)).join(', ')}
                        </span>
                      </span>
                    </div>
                    {days.map((d) => {
                      const r = p.ranges.find((x) => d >= x.from && d <= x.to);
                      const start = !!r && (d === r.from || d === days[0]);
                      const end = !!r && (d === r.to || d === days[days.length - 1]);
                      return (
                        <div key={d} role="cell" style={{
                          height: 34,
                          borderLeft: '1px solid var(--border)',
                          background: r ? 'var(--absence)' : isWeekend(d) ? 'var(--surface-3)' : 'transparent',
                          // Zaokrąglone tylko krańce zakresu — środek zostaje kwadratowy,
                          // żeby kolejne dni sklejały się w jeden ciągły pasek.
                          borderRadius: r ? `${start ? '8px' : '0'} ${end ? '8px' : '0'} ${end ? '8px' : '0'} ${start ? '8px' : '0'}` : '0',
                        }}>
                          {r && <span className="ds-sr">{p.name}, {dayMonth(d)}: nieobecność</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ width: 22, height: 13, borderRadius: 4, background: 'var(--absence)', border: '1px solid var(--absence-border)' }} />Nieobecność
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />Rola kluczowa
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ width: 22, height: 13, borderRadius: 4, background: 'var(--surface-3)', border: '1px solid var(--border)' }} />Weekend
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={pill}>lider</span>Lider jednostki
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ width: 22, height: 13, borderRadius: 4, background: 'var(--amber-tint)', border: '1px solid var(--amber)' }} />Kolizja liderów (≥ 2 nieobecnych tego dnia)
        </span>
        {state === 'ready' && <span style={{ marginLeft: 'auto' }}>Nieobecnych w tym zakresie: {absentCount}. Prezentacja jednolita — bez rozróżnienia typu.</span>}
      </div>
    </div>
  );
}
