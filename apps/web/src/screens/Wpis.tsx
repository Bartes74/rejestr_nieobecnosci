import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, TriangleAlert } from 'lucide-react';
import { count, plural } from '@nieobecnosci/core/plural';
import { dateRange, todayIso } from '../format';
import { api, type Absence, type AbsenceType, type Preview } from '../api';
import { useAuth } from '../current-employee';
import { Notice, useNotice } from '../admin/ui';
import { card } from '../design-system/surfaces';


const nf = (n: number) => String(n).replace('.', ','); // ułamki po polsku (0,5)
const labelStyle = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } as const;
const inputBox = { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '11px 14px' } as const;
// `outline: none` zostaje: pierścień fokusu rysuje ramka `.ds-field`, nie kontrolka w jej środku.
const inputEl = { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 14, minWidth: 0 } as const;

// Ten sam kształt co przyciski zakresu w kalendarzu zespołu — jedna nawigacja miesiącami
// w całej aplikacji. 32 px mieści się w minimum celu wskaźnika (24 px) z audytu dostępności.
const navBtn = { width: 32, height: 32, flex: 'none', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;

const PARTS: [string, string][] = [['FULL', 'Cały dzień'], ['AM', 'Przed poł. (AM)'], ['PM', 'Po poł. (PM)'], ['HOURS', 'Godziny']];
const WD = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];
// Mianownik, bo to nagłówek miesiąca, a nie data — „SIERPNIA 2026" czyta się jak urwane zdanie.
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

/** Pole daty: ikona marki po lewej otwiera natywny wybór, natywny wskaźnik jest ukryty (patrz styles.css). */
function DateField({ label, value, min, disabled, invalid, onChange }: {
  label: string; value: string; min?: string; disabled?: boolean; invalid?: boolean; onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label>
      <span style={labelStyle}>{label}</span>
      <span className="ds-field" style={{ ...inputBox, opacity: disabled ? 0.5 : 1 }}>
        <button type="button" tabIndex={-1} aria-hidden="true" disabled={disabled} onClick={() => ref.current?.showPicker?.()}
          style={{ display: 'flex', border: 'none', background: 'transparent', padding: 0, flex: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--brand)' }}>
          <CalendarDays size={16} />
        </button>
        <input ref={ref} className="ds-datefield" type="date" value={value} min={min} disabled={disabled}
          aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} style={inputEl} />
      </span>
    </label>
  );
}

// mini-kalendarz miesiąca daty „od" z zaznaczonym zakresem (Pon-first)
//
// `existing` to nieobecności użytkownika, które JUŻ są zapisane. Bez nich kalendarz pokazywał
// wyłącznie zaznaczenie, więc kolizja („masz już nieobecność w tym terminie") była twierdzeniem
// bez pokrycia w tym, co widać: użytkownik nie miał jak sprawdzić, czy wpis faktycznie istnieje,
// czy to usterka. Zapisane dni noszą obwódkę (`inset`, nie `border` — border zmieniłby wysokość
// komórki i siatka skakałaby przy każdej zmianie dat), zaznaczenie zostaje wypełnieniem.
// Dzień, który jest jednocześnie zapisany i zaznaczony, ma obwódkę NA wypełnieniu — czyli sama
// kolizja jest widoczna, a nie tylko opisana zdaniem obok.
function MiniCal({ from, to, existing }: { from: string; to: string; existing: { dateFrom: string; dateTo: string }[] }) {
  // Siatka otwiera się na miesiącu daty „od", ale daje się przewinąć: urlop bywa planowany
  // na przełomie, a wpis z sąsiedniego miesiąca był poza zasięgiem wzroku. Przesunięcie wraca
  // do zera przy każdej zmianie daty „od" — inaczej po wybraniu nowego terminu siatka zostałaby
  // na miesiącu, który z tym terminem nie ma już nic wspólnego.
  const [shift, setShift] = useState(0);
  useEffect(() => setShift(0), [from]);

  const base = new Date(from + 'T00:00:00Z');
  // Normalizacja przez `Date.UTC`: przesunięcie o −1 z stycznia daje grudzień roku poprzedniego,
  // więc rok i miesiąc czytamy z gotowej daty, a nie z arytmetyki na `m`.
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + shift, 1));
  const y = first.getUTCFullYear(), m = first.getUTCMonth();
  const offset = (first.getUTCDay() + 6) % 7; // Pon = 0
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let dnum = 1; new Date(Date.UTC(y, m, dnum)).getUTCMonth() === m; dnum++) cells.push(new Date(Date.UTC(y, m, dnum)));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // `GET /absences` oddaje pełne znaczniki czasu („2026-08-10T00:00:00.000Z"), a nie samą datę
  // jak `/calendar` — stąd `slice`. Bez niego doklejenie „T00:00:00Z" dawało `NaN` i pętla dni
  // nie wykonywała się ani razu, a filtr miesiąca wychodził dobrze wyłącznie przypadkiem,
  // na leksykalnym porównaniu napisów.
  const ranges = existing.map((a) => ({ from: a.dateFrom.slice(0, 10), to: a.dateTo.slice(0, 10) }));
  const monthFrom = iso(first), monthTo = iso(new Date(Date.UTC(y, m + 1, 0)));
  // Sortowanie po dacie startu: `GET /absences` oddaje wpisy w kolejności utworzenia, więc zdanie
  // pod siatką czytało się „24.08…, 10.08…" — wstecz względem tego, co widać w kalendarzu.
  const wThisMonth = ranges.filter((a) => a.from <= monthTo && a.to >= monthFrom).sort((a, b) => a.from.localeCompare(b.from));
  const taken = new Set<string>();
  for (const a of wThisMonth) {
    for (let t = Date.parse(a.from + 'T00:00:00Z'); t <= Date.parse(a.to + 'T00:00:00Z'); t += 86_400_000) {
      taken.add(new Date(t).toISOString().slice(0, 10));
    }
  }

  return (
    <div style={{ ...card, padding: 16, borderRadius: 'var(--radius-lg)' }}>
      {/* Nazwa miesiąca w regionie live: przy sterowaniu klawiaturą strzałki zmieniają siatkę,
          a bez tego zmiana byłaby wyłącznie wizualna i czytnik ekranu nic by nie ogłosił. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <button type="button" className="ds-quiet" aria-label="Poprzedni miesiąc" onClick={() => setShift((s) => s - 1)} style={navBtn}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <div aria-live="polite" style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{MONTHS[m]} {y}</div>
        <button type="button" className="ds-quiet" aria-label="Następny miesiąc" onClick={() => setShift((s) => s + 1)} style={navBtn}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 11.5 }}>
        {WD.map((w, i) => <div key={i} style={{ textAlign: 'center', color: 'var(--muted)', paddingBottom: 3 }}>{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = iso(d); const inRange = s >= from && s <= to;
          const isStart = s === from, isEnd = s === to;
          const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
          const booked = taken.has(s);
          let bg = 'transparent', col = weekend ? 'var(--muted)' : 'var(--ink)', radius = '0', weight = 400;
          if (inRange) {
            // Zakres to planowana nieobecność — nosi tokeny nieobecności, nie tinty marki.
            // Krańce zakresu są uchwytami zaznaczenia, więc te zostają w kolorze marki.
            col = 'var(--absence-ink)'; weight = 600;
            bg = isStart || isEnd ? 'var(--brand)' : 'var(--absence)';
            if (isStart || isEnd) col = 'var(--on-brand)';
            radius = isStart && isEnd ? '7px' : isStart ? '7px 0 0 7px' : isEnd ? '0 7px 7px 0' : '0';
          } else if (weekend) { bg = 'var(--surface-3)'; radius = '7px'; }
          if (booked) { if (!inRange) { col = 'var(--absence-ink)'; weight = 600; } radius = radius === '0' ? '7px' : radius; }
          return <div key={i} style={{
            textAlign: 'center', padding: '6px 0', background: bg, color: col, borderRadius: radius, fontWeight: weight, fontVariantNumeric: 'tabular-nums',
            boxShadow: booked ? 'inset 0 0 0 1.5px var(--absence-border)' : undefined,
          }}>{d.getUTCDate()}</div>;
        })}
      </div>

      {/* Znaczenie obwódki musi stać słowem, nie tylko kolorem (WCAG 1.4.1). Zdanie niesie też
          konkretne daty, więc czytnik ekranu dostaje tę samą informację co siatka. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 12, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 5, background: 'var(--absence)' }} />Zaznaczony zakres
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 5, boxShadow: 'inset 0 0 0 1.5px var(--absence-border)' }} />Już zapisane
        </span>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
        {wThisMonth.length === 0
          ? `Nie masz zapisanych nieobecności w tym miesiącu (${MONTHS[m]} ${y}).`
          : `Masz już zapisane: ${wThisMonth.map((a) => dateRange(a.from, a.to, { long: true })).join(', ')}.`}
      </div>
    </div>
  );
}

export function Wpis() {
  const { current } = useAuth();
  const navigate = useNavigate();
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [typeId, setTypeId] = useState('');
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [dayPart, setDayPart] = useState('FULL');
  const [hourFrom, setHourFrom] = useState('09:00');
  const [hourTo, setHourTo] = useState('13:00');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mine, setMine] = useState<Absence[]>([]);
  const { notice, ok, fail, clear } = useNotice();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);

  const partial = dayPart !== 'FULL';
  const effTo = partial ? from : to;
  const badRange = !partial && !!to && to < from;
  const badHours = dayPart === 'HOURS' && hourTo <= hourFrom;
  const hf = dayPart === 'HOURS' ? hourFrom : undefined;
  const ht = dayPart === 'HOURS' ? hourTo : undefined;

  // Domyślny typ pomija kategorię szczególną (L4). Lista wraca z serwera posortowana po nazwie,
  // więc pierwsze bywało zwolnienie lekarskie — ekran planowania urlopu otwierał się z wpisem
  // o stanie zdrowia gotowym do zapisania jednym kliknięciem.
  useEffect(() => {
    api.types()
      .then((t) => { setTypes(t); setTypeId((p) => p || (t.find((x) => !x.specialCategory) ?? t[0])?.id || ''); })
      .catch(() => setTypes([]));
  }, []);
  // `saved` w zależnościach: po zapisie podgląd musi policzyć się od nowa. Bez tego karta
  // „Balans po zapisie" pokazywała nieaktualne „26 → 25" obok komunikatu, że zapis już nastąpił.
  useEffect(() => {
    if (current && from && effTo) api.preview(current.id, from, effTo, dayPart, hf, ht, typeId).then(setPreview).catch(() => setPreview(null));
  }, [current?.id, from, effTo, dayPart, hf, ht, typeId, saved]);
  // Własne wpisy do mini-kalendarza. Istniejący `GET /absences?employeeId=` wystarcza — to lista
  // jednej osoby, więc filtrowanie do widocznego miesiąca robi się po stronie ekranu.
  // `saved` w zależnościach z tego samego powodu co wyżej: świeżo zapisany wpis ma się pokazać.
  useEffect(() => {
    if (current) api.absences(current.id).then(setMine).catch(() => setMine([]));
  }, [current?.id, saved]);

  const skipped = useMemo(() => {
    if (!preview || partial) return 0;
    let t = Date.parse(from + 'T00:00:00Z'); const end = Date.parse(effTo + 'T00:00:00Z'); let total = 0;
    while (t <= end) { total++; t += 86_400_000; }
    return Math.max(0, total - preview.workingDays);
  }, [preview, from, effTo, partial]);

  // Wzorzec radiogroup: strzałki przenoszą wybór między segmentami, a z całej grupy wychodzi się
  // jednym Tabem (tabIndex −1 na nieaktywnych). Bez tego `role="radio"` obiecywało czytnikowi
  // ekranu zachowanie, którego kontrolka nie miała.
  const movePart = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = PARTS.findIndex(([k]) => k === dayPart);
    const next = PARTS[(i + step + PARTS.length) % PARTS.length]?.[0];
    if (!next) return;
    setDayPart(next);
    (e.currentTarget.parentElement?.querySelector(`[data-part="${next}"]`) as HTMLElement | null)?.focus();
  };

  const blocked = !typeId || !!preview?.collision || badRange || badHours;
  const save = async () => {
    if (!current || blocked || saving) return;
    setSaving(true); clear();
    try {
      await api.createAbsence({ employeeId: current.id, typeId, dateFrom: from, dateTo: effTo, dayPart, hourFrom: hf, hourTo: ht });
      const days = preview ? ` — ${nf(preview.workingDays)} ${plural(preview.workingDays, ['dzień roboczy', 'dni robocze', 'dni roboczych'])}` : '';
      ok(`Zapisano nieobecność${days}. Wpis obowiązuje od razu i jest już widoczny w kalendarzu zespołu.`);
      setSaved((n) => n + 1);
      // Daty wracają na dziś, bo po zapisie formularz opisywał termin, który sam przed chwilą
      // zajął: obok „Zapisano nieobecność" stawało „Zapis zablokowany: masz już nieobecność
      // w tym terminie". Ekran przeczył sam sobie i nie dało się z niego odczytać, czy wpis
      // powstał. Zakres zostaje widoczny w mini-kalendarzu jako zapisany — informacja nie ginie.
      setFrom(todayIso()); setTo(todayIso()); setDayPart('FULL');
    } catch (e) { fail(e); } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .95fr', gap: 18, alignItems: 'start' }}>
        {/* FORMULARZ */}
        <div style={{ ...card, padding: 24 }}>
          {/* Nazwę ekranu niesie już nagłówek w topbarze — karta nazywa własną zawartość.
              Wcześniej stało tu „Zgłoś nieobecność": czasownik obiecywał akceptację, której
              w tym produkcie nie ma (decyzja D3), a potem duplikował H1 co do słowa. */}
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: 'var(--ink)' }}>Szczegóły nieobecności</h2>

          <label style={{ display: 'block', marginBottom: 20 }}>
            <span style={labelStyle}>Typ nieobecności</span>
            <span className="ds-field" style={inputBox}>
              <select value={typeId} disabled={types.length === 0} onChange={(e) => setTypeId(e.target.value)} style={{ ...inputEl, fontWeight: 500, cursor: types.length === 0 ? 'progress' : 'pointer' }}>
                {types.length === 0 && <option value="">Wczytywanie typów…</option>}
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <DateField label={partial ? 'Data' : 'Data od'} value={from} onChange={setFrom} />
            <DateField label="Data do" value={effTo} min={from} disabled={partial} invalid={badRange} onChange={setTo} />
          </div>

          {/* Grupa wyboru zachowuje się jak radio, więc i nazywa się jak radio — inaczej czytnik
              ekranu czyta cztery niezależne przyciski bez informacji, który jest wybrany. */}
          {/* Grupa zachowuje się jak radio, więc odpowiada też za klawiaturę: strzałki przenoszą
              wybór, a poza grupę wychodzi się jednym Tabem (roving tabindex, wzorzec WAI-ARIA).
              Bez tego `role="radio"` obiecywało czytnikowi ekranu zachowanie, którego nie było. */}
          <div role="radiogroup" aria-label="Wymiar dnia">
            <div style={labelStyle}>Wymiar dnia</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: dayPart === 'HOURS' ? 14 : 24 }}>
              {PARTS.map(([k, lbl]) => {
                const active = dayPart === k;
                return <button key={k} type="button" role="radio" data-part={k} aria-checked={active} tabIndex={active ? 0 : -1}
                  className={active ? undefined : 'ds-quiet'} onClick={() => setDayPart(k)} onKeyDown={movePart} style={{
                    flex: 1, textAlign: 'center', borderRadius: 'var(--radius-md)', padding: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600,
                    border: active ? '1.5px solid var(--brand)' : '1px solid var(--border-2)', background: active ? 'var(--brand-tint)' : 'var(--surface)', color: active ? 'var(--brand)' : 'var(--ink-2)',
                  }}>{lbl}</button>;
              })}
            </div>
          </div>
          {dayPart === 'HOURS' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <label><span style={labelStyle}>Od godz.</span><span className="ds-field" style={inputBox}><input type="time" value={hourFrom} onChange={(e) => setHourFrom(e.target.value)} style={inputEl} /></span></label>
              <label><span style={labelStyle}>Do godz.</span><span className="ds-field" style={inputBox}><input type="time" value={hourTo} aria-invalid={badHours || undefined} onChange={(e) => setHourTo(e.target.value)} style={inputEl} /></span></label>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ds-primary" onClick={save} disabled={saving || blocked} aria-describedby={blocked ? 'wpis-blokada' : undefined}
              style={{ border: 'none', cursor: saving || blocked ? 'not-allowed' : 'pointer', background: 'var(--brand)', color: 'var(--on-brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, padding: '12px 22px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', opacity: saving || blocked ? 0.6 : 1 }}>
              {saving ? 'Zapisywanie…' : 'Zapisz nieobecność'}
            </button>
            <button type="button" className="ds-quiet" onClick={() => navigate('/pulpit')} style={{ border: '1px solid var(--border-2)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, padding: '12px 22px', borderRadius: 'var(--radius-md)' }}>Anuluj</button>
          </div>
          {/* Wyłączony przycisk nie da się sfokusować, więc powód blokady musi stać obok niego
              we własnym regionie live — inaczej użytkownik klawiatury nie dowie się, co poprawić. */}
          <div id="wpis-blokada" role="status" aria-live="polite" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--amber)', marginTop: blocked ? 10 : 0 }}>
            {badRange ? 'Zapis zablokowany: data „do" jest wcześniejsza niż „od".'
              : badHours ? 'Zapis zablokowany: godzina zakończenia musi być późniejsza niż rozpoczęcia.'
                : preview?.collision ? 'Zapis zablokowany: masz już nieobecność w tym terminie. Zmień daty.'
                  : !typeId ? 'Zapis zablokowany: wybierz typ nieobecności.' : ''}
          </div>
          <Notice {...notice} />
        </div>

        {/* PODGLĄD NA ŻYWO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)' }} />
              <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', margin: 0 }}>Podgląd na żywo</h2>
            </div>
            <Row label="Dni robocze w zakresie" value={preview ? nf(preview.workingDays) : '—'} />
            <Row label="Pominięto (weekend / święta)" value={partial ? '—' : String(skipped)} muted />
            <Row label="Balans po zapisie" value={preview ? `${nf(preview.remaining)} → ${nf(preview.remainingAfter)}` : '—'} accent last />
            {/* `&&` na liczbie renderuje samo „0", gdy minimum wynosi zero — stąd jawne porównanie. */}
            {!!preview && (preview.minimumToLeave ?? 0) > 0 && preview.remainingAfter >= 0 && preview.remainingAfter < (preview.minimumToLeave ?? 0) && (
              <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--amber)', lineHeight: 1.5 }}>Zejdziesz poniżej minimum do pozostawienia ({count(preview.minimumToLeave ?? 0, ['dzień', 'dni', 'dni'])}).</div>
            )}
          </div>

          {preview?.collision && (
            <div style={{ background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <TriangleAlert size={18} color="var(--amber)" style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>Kolizja z istniejącym wpisem</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>Masz już nieobecność w terminie {preview.collisionFrom && preview.collisionTo ? dateRange(preview.collisionFrom, preview.collisionTo, { long: true }) : '—'}. Zmień daty, aby zapisać.</div>
              </div>
            </div>
          )}

          {/* Wpis bez puli (L4) ma pierwszeństwo przed zaplanowanym urlopem — serwer nie zgłasza
              wtedy kolizji, tylko wycina dni wspólne. Karta mówi to wprost przed zapisem, bo
              inaczej wcześniejszy wpis zmieniłby się bez ostrzeżenia. Kolor neutralny, nie
              ostrzegawczy: nic tu nie jest błędem, a nic w tym ekranie nie koduje typu (D1/D2). */}
          {!!preview?.returnedDays && (
            <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <RotateCcw size={18} color="var(--ink-2)" style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>Dni wrócą do puli</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                  {/* `nf` zamiast `count`, bo pół dnia ma się wyświetlić jako „0,5", nie „0.5". */}
                  Ten wpis ma pierwszeństwo przed zaplanowaną wcześniej nieobecnością. {nf(preview.returnedDays)} {plural(preview.returnedDays, ['dzień', 'dni', 'dni'])} z tamtego terminu {plural(preview.returnedDays, ['wróci', 'wrócą', 'wróci'])} do puli, a pokrywający się fragment zostanie z niego wycięty.
                </div>
              </div>
            </div>
          )}

          <MiniCal from={from} to={effTo} existing={mine} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted, accent, last }: { label: string; value: string; muted?: boolean; accent?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: accent ? 700 : 600, fontSize: 14, color: accent ? 'var(--brand)' : muted ? 'var(--muted)' : 'var(--ink)' }}>{value}</span>
    </div>
  );
}
