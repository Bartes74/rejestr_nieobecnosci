import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Info, Plus, TriangleAlert } from 'lucide-react';
import { count } from '@nieobecnosci/core/plural';
import { dateRange, dayMonth, dayOfMonth, todayIso, weekBounds } from '../format';
import { api, type Absence, type Balance, type CalEntry, type Sprint } from '../api';
import { useAuth } from '../current-employee';
import { useIsNarrow } from '../viewport';
import { card, panel } from '../design-system/surfaces';
import { AbsencePill } from '../design-system/components/data/AbsencePill';
import { Avatar } from '../design-system/components/core/Avatar';
import { ProgressBar } from '../design-system/components/data/ProgressBar';

const initialsOf = (name: string) => name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
const monthShort = (s: string) => new Intl.DateTimeFormat('pl-PL', { month: 'short', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z')).replace('.', '').toUpperCase();
const hm = (d: Date) => new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(d);

const cardTitle = { fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' } as const;

/** Blok zastępczy na czas wczytywania. Płaski, bez połysku — w tym systemie nic nie miga. */
const Skeleton = ({ w, h = 13, mt = 0 }: { w: number | string; h?: number; mt?: number }) => (
  <div aria-hidden="true" style={{ width: w, height: h, marginTop: mt, background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)' }} />
);

export function Pulpit() {
  const { current } = useAuth();
  const navigate = useNavigate();
  const narrow = useIsNarrow(); // NFR-6, wariant pośredni: pulpit i wpis działają na telefonie
  const [bal, setBal] = useState<Balance | null>(null);
  const [week, setWeek] = useState<CalEntry[]>([]);
  const [mine, setMine] = useState<Absence[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  // Trzy stany, nie dwa. Bez tego pusta odpowiedź, nieudane żądanie i „jeszcze nie wiadomo"
  // wyglądały identycznie: licznik pokazywał 0 z 0 dni, a listy ogłaszały „nikt nieobecny"
  // zanim cokolwiek przyszło z serwera.
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [wf, wt] = useMemo(weekBounds, []);

  const [attempt, setAttempt] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!current) return undefined;
    let live = true;
    const employeeId = current.id;

    // `quiet` odróżnia pierwsze wejście od odświeżenia w tle: przy odświeżeniu treść zostaje
    // na ekranie, bo zamiana danych na bloki zastępcze co powrót do karty byłaby migotaniem,
    // nie informacją. Nieudane odświeżenie też nie kasuje tego, co użytkownik już widzi —
    // stara liczba jest bliżej prawdy niż ekran błędu.
    const fetchAll = (quiet: boolean) => {
      if (!quiet) setState('loading');
      return Promise.all([
        api.balance(employeeId),
        api.calendar(wf, wt),
        api.absences(employeeId),
        api.sprints().catch(() => [] as Sprint[]), // sprint to ozdobnik nagłówka, nie treść pulpitu
      ]).then(([b, w, m, s]) => {
        if (!live) return;
        setBal(b); setWeek(w); setMine(m); setSprints(s); setState('ready'); setRefreshedAt(new Date());
      }).catch(() => { if (live && !quiet) setState('error'); });
    };

    void fetchAll(false);

    // Pigułka „aktualizacja na żywo" obiecywała odświeżanie, którego nie było — dane schodziły
    // z serwera raz, przy wejściu na ekran. Pulpit bywa zostawiony otwarty na cały dzień,
    // a nieobecność dopisana przez kogoś innego zmienia i licznik, i listę zespołu.
    //
    // Kotwicą jest powrót uwagi do karty, nie zegar: pytamy wtedy, kiedy ktoś patrzy.
    // Odpytywanie w pętli dla 300 osób w oknie planowania sprintu kosztowałoby serwer
    // dokładnie w godzinie, w której jest najbardziej obciążony (NFR-1).
    // ponytail: jeśli okaże się, że dane muszą się zmieniać na oczach użytkownika bez
    //           przełączania kart, właściwym krokiem jest kanał SSE, nie krótszy interwał.
    let last = Date.now();
    const MIN_GAP_MS = 30_000; // alt-tab tam i z powrotem to nie jest zdarzenie warte żądania
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      void fetchAll(true);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [current?.id, attempt]);

  const dateLabel = useMemo(() => {
    const s = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    return s.charAt(0).toUpperCase() + s.slice(1); // tylko dzień tygodnia z wielkiej (miesiąc małą, jak w prototypie)
  }, []);
  const sprint = useMemo(() => {
    const t = todayIso();
    return sprints.find((s) => s.dateFrom <= t && s.dateTo >= t) ?? null;
  }, [sprints]);

  // FR-C3 — kto nieobecny w tym tygodniu (jednolicie, bez typu); pomijamy siebie.
  const absent = useMemo(() => {
    const byPerson = new Map<string, { name: string; from: string; to: string }>();
    for (const e of week) {
      if (current && e.employeeId === current.id) continue;
      const cur = byPerson.get(e.employeeId);
      const from = e.dateFrom, to = e.dateTo;
      if (!cur) byPerson.set(e.employeeId, { name: e.employee, from, to });
      else { if (from < cur.from) cur.from = from; if (to > cur.to) cur.to = to; }
    }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [week, current?.id]);

  // FR-I2 — moje najbliższe (przyszłe) nieobecności.
  const upcoming = useMemo(() => {
    const t = todayIso();
    return mine.filter((a) => a.dateTo >= t).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)).slice(0, 4);
  }, [mine]);

  const pool = bal ? bal.pool : 0;
  const carried = bal ? bal.carriedOver : 0;
  const used = bal ? bal.used : 0;
  const remaining = bal ? bal.remaining : 0;
  const total = pool + carried;
  const usedW = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const carriedW = total > 0 ? Math.min(100 - usedW, (carried / total) * 100) : 0;

  const chipDate = (a: { from: string; to: string }) => {
    const t = todayIso();
    // Trwająca nieobecność zaczyna się od słowa „dziś" — data początku jest wtedy mniej użyteczna
    // niż informacja, że ktoś jest nieobecny teraz.
    const fromTxt = a.from <= t && a.to >= t ? 'dziś' : dayMonth(a.from);
    return a.from === a.to ? dayMonth(a.from) : `${fromTxt}–${dayMonth(a.to)}`;
  };

  if (state === 'error') {
    return (
      <div style={{ maxWidth: 1180 }}>
        <div style={{ ...card, padding: 24, maxWidth: 560 }} role="alert">
          <h2 style={{ ...cardTitle, fontSize: 16, margin: '0 0 8px' }}>Nie udało się wczytać pulpitu</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)', margin: '0 0 16px' }}>
            Serwer nie odpowiedział na żądanie danych. Twoje wpisy są bezpieczne — to problem z odczytem, nie z zapisem.
          </p>
          <button type="button" className="ds-primary" onClick={() => setAttempt((n) => n + 1)}
            style={{ border: 'none', cursor: 'pointer', background: 'var(--brand)', color: 'var(--on-brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, padding: '10px 16px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }
  const loading = state === 'loading';

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 23, fontWeight: 700, margin: '0 0 3px', letterSpacing: '-.01em', color: 'var(--ink)' }}>
          Dzień dobry{current ? `, ${current.firstName}` : ''} 👋
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          {dateLabel}{sprint ? <> · {sprint.name} ({dateRange(sprint.dateFrom, sprint.dateTo)})</> : ''}
        </p>
      </div>

      {/* `start` zamiast domyślnego rozciągania: karta z jednym zdaniem nie ma udawać wysokości
          sąsiadki i zostawiać pod treścią stu pikseli pustki.
          Na telefonie karty idą jedna pod drugą — balans zostaje pierwszy, bo to on jest tu
          głównym produktem dla pracownika. */}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1.35fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* BALANS */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Twój urlop · pozostało do rozplanowania</div>
              {bal
                ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', background: 'var(--surface-3)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>Rok {bal.period.type === 'CALENDAR' ? 'kalendarzowy' : 'budżetowy'} {bal.period.year}</span>
                : <Skeleton w={150} h={19} />}
            </div>
            <button type="button" className="ds-primary" onClick={() => navigate('/wpis')} style={{ border: 'none', cursor: 'pointer', background: 'var(--brand)', color: 'var(--on-brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, padding: '10px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 7, boxShadow: 'var(--shadow-sm)' }}>
              <Plus size={16} aria-hidden="true" /> Zaplanuj nieobecność
            </button>
          </div>
          {/* Licznik jest jedyną liczbą, do której sprowadza się ten ekran — dopóki nie znamy
              jej wartości, nie wolno pokazać zera. „0 z 0 dni" to nie stan pusty, to nieprawda. */}
          <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6, minHeight: 54 }}>
            {loading ? <Skeleton w={190} h={44} /> : <>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 58, fontWeight: 800, lineHeight: .9, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{remaining}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 600, marginBottom: 9 }}>/ {total} dni</span>
              {/* Etykieta jest teraz sprawdzalna: dokładny moment ostatniego odczytu stoi
                  w podpowiedzi, żeby „na żywo" dało się zweryfikować, a nie tylko przeczytać. */}
              <span title={refreshedAt ? `Ostatnia aktualizacja: ${hm(refreshedAt)}` : undefined}
                style={{ marginBottom: 11, marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--brand)', background: 'var(--brand-tint)', fontWeight: 600, padding: '4px 9px', borderRadius: 'var(--radius-sm)' }}>aktualizacja na żywo</span>
            </>}
          </div>
          <ProgressBar height={11} style={{ margin: '14px 0 18px' }} segments={[
            { pct: usedW, color: 'var(--brand)' },
            { pct: carriedW, color: 'var(--absence-border)' },
          ]} />
          <div style={{ display: 'flex', gap: 22 }}>
            {[['Pula roczna', pool, false], ['Wykorzystano', used, true], ['w tym zaległe', carried, false]].map(([label, value, accent], i) => (
              <div key={label as string} style={{ flex: 1, borderLeft: i ? '1px solid var(--border)' : 'none', paddingLeft: i ? 22 : 0 }}>
                {loading
                  ? <Skeleton w={38} h={24} />
                  : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--brand)' : 'var(--ink)' }}>{value as number}</div>}
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)', marginTop: loading ? 6 : 0 }}>{label as string}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PRZYPOMNIENIA */}
        <div style={{ ...card, padding: 20 }}>
          <h2 style={{ ...cardTitle, margin: '0 0 14px' }}>Przypomnienia</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {loading && <Skeleton w="100%" h={62} />}
            {bal && bal.carriedOver > 0 ? (
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-lg)', padding: '12px 13px' }}>
                <TriangleAlert size={17} color="var(--amber)" style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.8, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                  <b style={{ color: 'var(--ink)' }}>Masz {count(bal.carriedOver, ['dzień', 'dni', 'dni'])} zaległego urlopu.</b> Te dni nie przepadają, ale im dłużej czekają, tym trudniej je rozplanować.
                </div>
              </div>
            ) : null}
            {/* Treść mówiła wcześniej o zbliżającym się końcu okresu rozliczeniowego niezależnie
                od daty i od tego, że w tym produkcie urlop nie przepada (PRODUCT.md). */}
            {!loading && (
              <div style={{ ...panel, display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 13px' }}>
                <Info size={17} color="var(--blue)" style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.8, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                  {remaining > 0
                    ? <>Do rozplanowania w tym okresie: <b style={{ color: 'var(--ink)' }}>{count(remaining, ['dzień', 'dni', 'dni'])}</b>. Wpis obowiązuje od zapisania — nie wymaga akceptacji.</>
                    : 'Masz w pełni rozplanowany urlop w tym okresie.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KTO NIEOBECNY */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h2 style={{ ...cardTitle, margin: 0 }}>Kto dziś / w tym tygodniu nieobecny</h2>
            <button type="button" className="ds-quiet" onClick={() => navigate('/kalendarz')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, padding: '5px 7px', minHeight: 24, boxSizing: 'border-box', margin: '-5px -7px', borderRadius: 'var(--radius-sm)' }}>
              Kalendarz <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
          {/* Tribe ma kilkadziesiąt osób. Bez własnego przewijania ta karta w tygodniu wyjazdowym
              rosła na kilkanaście ekranów i spychała resztę pulpitu poza widok. */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8, maxHeight: 268, overflowY: 'auto' }}>
            {loading && [0, 1, 2].map((k) => <Skeleton key={k} w="100%" h={32} mt={k ? 20 : 8} />)}
            {!loading && absent.length === 0 && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)', padding: '12px 0' }}>Nikt nieobecny w tym tygodniu.</div>}
            {!loading && absent.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < absent.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Avatar initials={initialsOf(p.name)} tone="blue" size={32} />
                <div style={{ flex: 1, minWidth: 0 }}><div title={p.name} style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div></div>
                <AbsencePill>{chipDate(p)}</AbsencePill>
              </div>
            ))}
          </div>
        </div>

        {/* MOJE NAJBLIŻSZE */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ ...cardTitle, margin: 0 }}>Moje najbliższe nieobecności</h2>
            <button type="button" className="ds-quiet" onClick={() => navigate('/historia')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, padding: '5px 7px', minHeight: 24, boxSizing: 'border-box', margin: '-5px -7px', borderRadius: 'var(--radius-sm)' }}>
              Moja historia <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading && [0, 1].map((k) => <Skeleton key={k} w="100%" h={56} />)}
            {!loading && upcoming.length === 0 && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)' }}>Brak zaplanowanych nieobecności.</div>}
            {!loading && upcoming.map((a) => {
              const from = a.dateFrom, to = a.dateTo;
              const part = a.dayPart === 'AM' ? ' · pół dnia (AM)' : a.dayPart === 'PM' ? ' · pół dnia (PM)' : a.dayPart === 'HOURS' ? ' · godziny' : '';
              return (
                <div key={a.id} style={{ ...panel, display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px' }}>
                  <div style={{ textAlign: 'center', width: 42 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>{dayOfMonth(from)}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{monthShort(from)}</div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 13, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{dateRange(from, to)}{part}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)' }}>
                      {a.type?.name ?? 'Nieobecność'} · zaplanowane
                      {/* Ten sam znacznik, co w historii — typ z kategorii szczególnej widzi
                          wyłącznie właściciel wpisu i ma o tym wiedzieć na każdym ekranie. */}
                      {a.type?.specialCategory && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-3)' }}>widoczne tylko dla Ciebie</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
