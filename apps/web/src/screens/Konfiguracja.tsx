import { useEffect, useRef, useState } from 'react';
import { plural } from '@nieobecnosci/core/plural';
import { minPoolFor } from '@nieobecnosci/core/balance';
import { dateRange, fullDate, todayIso } from '../format';
import { api, type AbsenceType, type Adoption, type Calendar, type Employee, type EmploymentType, type OrgUnit, type ProcessingActivity, type Sprint, type AdminSetting } from '../api';
import { useAuth } from '../current-employee';
import { Button } from '../design-system/components/core/Button';
import { AdminOnly, Section, Notice, ColumnMap, ConfirmDialog, Field, field, useNotice } from '../admin/ui';

const list ={ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', padding: '4px 0' };
// FR-D4 — domyślne nagłówki kolumn .xlsx dla sprintów (nadpisywalne przed importem).
const SPRINT_COLS = [{ key: 'name', label: 'Sprint' }, { key: 'from', label: 'Od' }, { key: 'to', label: 'Do' }, { key: 'squad', label: 'Squad' }];
const sprintColDefaults = Object.fromEntries(SPRINT_COLS.map((c) => [c.key, c.label]));

function Typy() {
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [f, setF] = useState({ name: '', affectsPool: true, affectsCapacity: true, specialCategory: false });
  const { notice, busy, run } = useNotice();
  const load = () => api.types().then(setTypes);
  useEffect(() => { load(); }, []);
  const add = () => run(async () => {
    const name = f.name;
    await api.createType(f);
    setF({ name: '', affectsPool: true, affectsCapacity: true, specialCategory: false });
    await load();
    return `Dodano typ „${name}" na końcu listy.`;
  });

  /**
   * Przestawienie o jedno miejsce. Optymistycznie, bo administrator zwykle klika kilka razy
   * z rzędu i czekanie na odpowiedź po każdym kroku zamieniłoby układanie listy w szarpaninę;
   * błąd cofa stan do tego, co naprawdę stoi w bazie.
   */
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (busy || j < 0 || j >= types.length) return;
    const next = [...types];
    [next[i], next[j]] = [next[j] as AbsenceType, next[i] as AbsenceType];
    const moved = types[i];
    setTypes(next);
    void run(async () => {
      try {
        setTypes(await api.reorderTypes(next.map((t) => t.id)));
      } catch (e) {
        await load(); // cofnięcie optymistycznego przestawienia do stanu z bazy
        throw e;
      }
      return `„${moved?.name}" — pozycja ${j + 1} z ${types.length}.`;
    });
  };

  const cb = (k: 'affectsPool' | 'affectsCapacity' | 'specialCategory') => (
    <label className="ds-form-check" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 5, alignItems: 'center' }}>
      <input type="checkbox" checked={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.checked }))} />
      {k === 'affectsPool' ? 'obniża pulę' : k === 'affectsCapacity' ? 'obniża capacity' : 'kategoria szczególna (L4)'}
    </label>
  );
  const moveBtn = { ...field, padding: '3px 8px', cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1.2 } as const;

  return (
    <Section title="Typy nieobecności">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 12px', maxWidth: 620 }}>
        Kolejność na tej liście jest kolejnością na liście wyboru przy dodawaniu nieobecności.
        Pierwszy typ spoza kategorii szczególnej jest wyborem domyślnym — warto, żeby to był
        ten, który zespół wybiera najczęściej.
      </p>
      {types.length === 0
        ? <div style={{ ...list, color: 'var(--muted)' }}>Brak typów. Dodaj pierwszy — bez niego nikt nie zapisze nieobecności.</div>
        : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {types.map((t, i) => (
              <li key={t.id} style={{ ...list, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', width: 18, flex: 'none' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {t.name} {t.specialCategory && <em style={{ color: 'var(--amber)' }}>· szczególna</em>} {!t.affectsPool && <span style={{ color: 'var(--muted)' }}>· bez puli</span>}
                </span>
                {/* Nazwa typu w etykiecie, bo bez niej czytnik ekranu ogłasza tuzin identycznych
                    „przenieś wyżej" i nie da się powiedzieć, który przycisk co przesuwa. */}
                <button type="button" className="ds-quiet" style={moveBtn} disabled={busy || i === 0}
                  aria-label={`Przenieś „${t.name}" wyżej`} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="ds-quiet" style={moveBtn} disabled={busy || i === types.length - 1}
                  aria-label={`Przenieś „${t.name}" niżej`} onClick={() => move(i, 1)}>↓</button>
              </li>
            ))}
          </ol>
        )}
      <div className="ds-form-row" style={{ marginTop: 12 }}>
        <Field label="Nazwa typu"><input style={field} value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></Field>
        {cb('affectsPool')}{cb('affectsCapacity')}{cb('specialCategory')}
        <Button onClick={add} disabled={!f.name.trim() || busy}>{busy ? 'Dodawanie…' : 'Dodaj'}</Button>
      </div>
      <Notice {...notice} />
    </Section>
  );
}

// Formy zatrudnienia w kolejności, w jakiej administrator o nich myśli; UoP jest przypadkiem
// domyślnym, B2B i OUT rozliczają się w roku budżetowym i miewają inną pulę.
const FORMY: { key: EmploymentType; label: string }[] = [
  { key: 'UOP', label: 'UoP' }, { key: 'B2B', label: 'B2B' }, { key: 'OUT', label: 'OUT' },
];

function Pula() {
  const [val, setVal] = useState('');
  const [byType, setByType] = useState<Record<EmploymentType, string>>({ UOP: '', B2B: '', OUT: '' });
  const [emps, setEmps] = useState<Employee[]>([]);
  // „Zaległe" startuje puste, nie zerem: pusta wartość znaczy „licz automatycznie z poprzednich
  // okresów" (FR-B7), a zapisane zero zamrażałoby saldo tej osoby na zerze.
  const [a, setA] = useState({ employeeId: '', periodYear: '2026', baseDays: '26', overrideDays: '', carriedOver: '' });
  const { notice, clear, busy, run } = useNotice();
  useEffect(() => {
    api.poolDefault().then((d) => {
      setVal(String(d.value ?? ''));
      setByType({ UOP: String(d.byType.UOP ?? ''), B2B: String(d.byType.B2B ?? ''), OUT: String(d.byType.OUT ?? '') });
    });
    api.employees().then(setEmps);
  }, []);
  const days = (raw: string, what: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${what} musi być liczbą nieujemną (np. 26).`);
    return n;
  };
  const saveDefault = () => run(async () => {
    // Najpierw sprawdzamy komplet wartości, dopiero potem zapisujemy którąkolwiek. Walidacja
    // wpleciona między zapisy zostawiała pulę wspólną już zmienioną, a na ekranie czerwony
    // komunikat o błędzie — z takiej sprzeczności nie da się odczytać, co właściwie zapisano.
    // ponytail: wyczyszczenie pola nie kasuje ustawienia formy — żeby ją zrównać ze wspólną,
    // wpisz tę samą liczbę. Kasowanie dorobić, jeśli okaże się potrzebne.
    const n = days(val, 'Pula wspólna');
    const own = FORMY.filter((f) => byType[f.key] !== '').map((f) => ({ ...f, days: days(byType[f.key], `Pula dla ${f.label}`) }));
    // Minimum formy na wartości efektywnej: forma bez własnej puli dziedziczy wspólną. Serwer
    // sprawdza to samo — tu tylko po to, żeby nic nie zapisać, zanim wyjdzie sprzeczność.
    for (const f of FORMY) {
      const eff = own.find((o) => o.key === f.key)?.days ?? n;
      if (eff < minPoolFor(f.key)) throw new Error(`Pula dla ${f.label} nie może być mniejsza niż ${minPoolFor(f.key)} dni (wyniosłaby ${eff}).`);
    }

    await api.setDefaultPool(n);
    for (const f of own) await api.setDefaultPool(f.days, f.key);
    return own.length === 0
      ? `Pula wspólna zapisana: ${n} dni.`
      : `Zapisano: wspólna ${n} dni, własna dla ${own.map((f) => `${f.label} — ${f.days}`).join(', ')}.`;
  });
  const saveAllow = () => run(async () => {
    await api.setAllowance({ employeeId: a.employeeId, periodYear: Number(a.periodYear), baseDays: Number(a.baseDays), overrideDays: a.overrideDays ? Number(a.overrideDays) : undefined, carriedOver: a.carriedOver === '' ? undefined : days(a.carriedOver, 'Zaległe') });
    return a.carriedOver === ''
      ? 'Korekta indywidualna zapisana. Zaległe liczone automatycznie z poprzednich okresów.'
      : `Korekta indywidualna zapisana, zaległe ustawione ręcznie na ${a.carriedOver}.`;
  });
  // Komunikat opisuje wartości, które zostały zapisane. Po zmianie któregokolwiek pola dotyczy
  // już czegoś innego niż to, co widać na ekranie — jak zielone „Zapisano" przy formularzu
  // opisującym inny stan. Kasuje go każda edycja w tej sekcji.
  const num = (k: 'periodYear' | 'baseDays' | 'overrideDays' | 'carriedOver') => (e: { target: { value: string } }) => { clear(); setA((s) => ({ ...s, [k]: e.target.value })); };
  const allowMin = minPoolFor((emps.find((e) => e.id === a.employeeId)?.employmentType ?? 'UOP') as EmploymentType);
  const allowHint = allowMin ? `min. ${allowMin} dni` : undefined;
  return (
    <Section title="Pula nieobecności">
      <div className="ds-form-row">
        <Field label="Pula wspólna — dni" hint="Obowiązuje formę zatrudnienia, dla której nie ustawiono własnej puli." width={230}>
          <input style={field} type="number" min={0} inputMode="numeric" value={val} onChange={(e) => { clear(); setVal(e.target.value); }} />
        </Field>
        {FORMY.map((f) => (
          <Field key={f.key} label={`Pula dla ${f.label}`} width={110} hint={minPoolFor(f.key) ? `min. ${minPoolFor(f.key)} dni` : undefined}>
            <input style={field} type="number" min={minPoolFor(f.key)} inputMode="numeric" placeholder={val || '—'}
              value={byType[f.key]} onChange={(e) => { clear(); setByType((s) => ({ ...s, [f.key]: e.target.value })); }} />
          </Field>
        ))}
        <Button onClick={saveDefault} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</Button>
      </div>
      <div className="ds-form-row" style={{ marginTop: 18 }}>
        <Field label="Korekta indywidualna — pracownik">
          <select style={field} value={a.employeeId} onChange={(e) => { clear(); setA((s) => ({ ...s, employeeId: e.target.value })); }}>
            <option value="">— wybierz —</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
        <Field label="Rok" width={90}><input style={field} type="number" inputMode="numeric" value={a.periodYear} onChange={num('periodYear')} /></Field>
        <Field label="Pula bazowa" width={100} hint={allowHint}><input style={field} type="number" min={allowMin} inputMode="numeric" value={a.baseDays} onChange={num('baseDays')} /></Field>
        <Field label="Nadpisanie (opcj.)" width={120} hint={allowHint}><input style={field} type="number" min={allowMin} inputMode="numeric" value={a.overrideDays} onChange={num('overrideDays')} /></Field>
        {/* Placeholder niesie całą regułę („automatycznie"), więc pole nie potrzebuje podpowiedzi
            pod spodem — ta rozjeżdżała wyrównanie wiersza, bo sąsiednie pola równają się do dołu. */}
        <Field label="Zaległe" width={130}>
          <input style={field} type="number" min={0} inputMode="numeric" placeholder="automatycznie" value={a.carriedOver} onChange={num('carriedOver')} />
        </Field>
        <Button onClick={saveAllow} disabled={!a.employeeId || busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</Button>
      </div>
      <Notice {...notice} />
    </Section>
  );
}

function Struktura() {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [u, setU] = useState({ name: '', type: 'TRIBE', parentId: '' });
  const [m, setM] = useState({ employeeId: '', orgUnitId: '' });
  const { notice, busy, run } = useNotice();
  const load = () => api.orgUnits().then(setUnits);
  useEffect(() => { load(); api.employees().then(setEmps); }, []);
  const addUnit = () => run(async () => {
    await api.createUnit({ name: u.name, type: u.type, parentId: u.parentId || undefined });
    const name = u.name;
    setU({ name: '', type: 'TRIBE', parentId: '' });
    await load();
    return `Dodano jednostkę „${name}".`;
  });
  const addMember = () => run(async () => {
    await api.addMembership(m);
    const who = emps.find((e) => e.id === m.employeeId);
    const where = units.find((x) => x.id === m.orgUnitId);
    return `Przypisano ${who ? `${who.firstName} ${who.lastName}` : 'pracownika'} do jednostki ${where?.name ?? ''}.`;
  });
  return (
    <Section title="Struktura organizacyjna">
      {units.length === 0
        ? <div style={{ ...list, color: 'var(--muted)' }}>Brak jednostek. Zacznij od pionu lub departamentu, potem dodaj jednostki podrzędne.</div>
        : units.map((x) => <div key={x.id} style={list}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{x.type}</span>{x.name}</div>)}
      <div className="ds-form-row" style={{ marginTop: 12 }}>
        <Field label="Nazwa jednostki"><input style={field} value={u.name} onChange={(e) => setU((s) => ({ ...s, name: e.target.value }))} /></Field>
        <Field label="Typ">
          <select style={field} value={u.type} onChange={(e) => setU((s) => ({ ...s, type: e.target.value }))}>
            {['PION', 'DEPARTAMENT', 'TRIBE', 'CHAPTER', 'SQUAD'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Jednostka nadrzędna">
          <select style={field} value={u.parentId} onChange={(e) => setU((s) => ({ ...s, parentId: e.target.value }))}>
            <option value="">— bez nadrzędnej —</option>
            {units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Button onClick={addUnit} disabled={!u.name.trim() || busy}>{busy ? 'Dodawanie…' : 'Dodaj jednostkę'}</Button>
      </div>
      <div className="ds-form-row" style={{ marginTop: 14 }}>
        <Field label="Przypisz pracownika">
          <select style={field} value={m.employeeId} onChange={(e) => setM((s) => ({ ...s, employeeId: e.target.value }))}>
            <option value="">— wybierz —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
        <Field label="Do jednostki" hint="Jedna osoba może należeć do kilku jednostek.">
          <select style={field} value={m.orgUnitId} onChange={(e) => setM((s) => ({ ...s, orgUnitId: e.target.value }))}>
            <option value="">— wybierz —</option>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Button onClick={addMember} disabled={!m.employeeId || !m.orgUnitId || busy}>{busy ? 'Przypisywanie…' : 'Przypisz'}</Button>
      </div>
      <Notice {...notice} />
    </Section>
  );
}

function Swieta() {
  const [cals, setCals] = useState<Calendar[]>([]);
  const [calId, setCalId] = useState('');
  const [hols, setHols] = useState<{ id: string; date: string; name: string }[]>([]);
  const [newCal, setNewCal] = useState('');
  const [h, setH] = useState({ date: '', name: '' });
  // Rok w strefie organizacji, nie z zegara przeglądarki — jak wszędzie indziej w aplikacji.
  const [year, setYear] = useState(todayIso().slice(0, 4));
  const { notice, clear, busy, run } = useNotice();
  const loadCals = () => api.calendars().then((c) => { setCals(c); setCalId((p) => p || c[0]?.id || ''); });
  useEffect(() => { loadCals(); }, []);
  useEffect(() => { if (calId) api.holidays(calId).then(setHols); }, [calId]);
  const addCal = () => run(async () => {
    const name = newCal;
    await api.createCalendar({ name, isDefault: cals.length === 0 });
    setNewCal('');
    await loadCals();
    return `Dodano kalendarz „${name}".`;
  });
  const addHol = () => run(async () => {
    const { date, name } = h;
    await api.createHoliday({ calendarId: calId, date, name });
    setH({ date: '', name: '' });
    setHols(await api.holidays(calId));
    return `Dodano dzień wolny: ${date} — ${name}.`;
  });
  const importPl = () => run(async () => {
    const r = await api.importPolishHolidays(calId, Number(year));
    setHols(await api.holidays(calId));
    return r.added === 0
      ? `Święta ${r.year} są już w tym kalendarzu — nic nie dodano.`
      : `Dodano ${r.added} ${plural(r.added, ['dzień wolny', 'dni wolne', 'dni wolnych'])} na rok ${r.year}.`;
  });
  return (
    <Section title="Święta i dni wolne">
      <div className="ds-form-row">
        <Field label="Kalendarz" hint="Dni z tego kalendarza nie są naliczane przy wpisach.">
          <select style={field} value={calId} onChange={(e) => { clear(); setCalId(e.target.value); }} disabled={cals.length === 0}>
            {cals.length === 0 && <option value="">— brak kalendarzy —</option>}
            {cals.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (domyślny)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Nowy kalendarz"><input style={field} value={newCal} onChange={(e) => setNewCal(e.target.value)} /></Field>
        <Button variant="secondary" onClick={addCal} disabled={!newCal.trim() || busy}>Dodaj kalendarz</Button>
      </div>
      <div style={{ marginTop: 12, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>
        {!calId ? 'Najpierw dodaj kalendarz.'
          : hols.length === 0 ? 'Ten kalendarz nie ma jeszcze dni wolnych — weekendy i tak są pomijane.'
            : hols.map((x) => <span key={x.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginRight: 10, color: 'var(--ink-2)' }}>{fullDate(x.date)} {x.name}</span>)}
      </div>
      <div className="ds-form-row" style={{ marginTop: 12 }}>
        <Field label="Data" width={170}><input style={field} type="date" value={h.date} onChange={(e) => setH((s) => ({ ...s, date: e.target.value }))} /></Field>
        <Field label="Nazwa dnia wolnego"><input style={field} value={h.name} onChange={(e) => setH((s) => ({ ...s, name: e.target.value }))} /></Field>
        <Button onClick={addHol} disabled={!h.date || !h.name.trim() || !calId || busy}>Dodaj dzień wolny</Button>
      </div>
      <div className="ds-form-row" style={{ marginTop: 12 }}>
        {/* Szerokość pola niesie podpowiedź, nie kontrolkę: przy 100 px tekst zawijał się na pięć
            wąskich linii. Sama kontrolka zostaje wąska, bo wpisuje się do niej cztery cyfry. */}
        <Field label="Rok" width={260} hint="Święta ustawowe wylicza aplikacja — bez połączenia z internetem. Powtórny import nie duplikuje dni.">
          <input style={{ ...field, width: 90, boxSizing: 'border-box' }} type="number" inputMode="numeric" value={year} onChange={(e) => { clear(); setYear(e.target.value); }} />
        </Field>
        <Button variant="secondary" onClick={importPl} disabled={!calId || !year || busy}>
          {busy ? 'Import w toku…' : 'Wczytaj święta w Polsce'}
        </Button>
      </div>
      <Notice {...notice} />
    </Section>
  );
}

function Sprinty() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [squads, setSquads] = useState<OrgUnit[]>([]);
  const [f, setF] = useState({ name: '', dateFrom: '', dateTo: '', squadId: '' });
  const { notice, busy, run } = useNotice();
  const [colMap, setColMap] = useState<Record<string, string>>(sprintColDefaults);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => api.sprints().then(setSprints);
  useEffect(() => { load(); api.orgUnits().then((u) => setSquads(u.filter((x) => x.type === 'SQUAD'))); }, []);
  // Odwrócony zakres dat przechodziłby do bazy i psuł capacity — łapiemy go przed zapisem.
  const badRange = !!f.dateFrom && !!f.dateTo && f.dateTo < f.dateFrom;
  const add = () => run(async () => {
    const name = f.name;
    await api.createSprint({ ...f, squadId: f.squadId || undefined });
    setF({ name: '', dateFrom: '', dateTo: '', squadId: '' });
    await load();
    return `Dodano sprint „${name}".`;
  });
  const imp = (file?: File) => {
    if (!file) return;
    void run(async () => {
      const r = await api.importSprints(file, colMap);
      await load();
      return `Import: utworzono ${r.created}, błędy: ${r.errors.length}`;
    });
  };
  return (
    <Section title="Sprinty">
      {sprints.length === 0
        ? <div style={{ ...list, color: 'var(--muted)' }}>Brak sprintów. Bez nich capacity i heatmapa nie mają na czym się oprzeć.</div>
        : sprints.map((s) => <div key={s.id} style={list}>{s.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{dateRange(s.dateFrom, s.dateTo, { long: true })}</span></div>)}
      <div className="ds-form-row" style={{ marginTop: 12 }}>
        <Field label="Nazwa"><input style={field} value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></Field>
        <Field label="Od" width={170}><input style={field} type="date" value={f.dateFrom} onChange={(e) => setF((s) => ({ ...s, dateFrom: e.target.value }))} /></Field>
        <Field label="Do" width={170}>
          <input style={field} type="date" min={f.dateFrom || undefined} value={f.dateTo} aria-invalid={badRange || undefined}
            onChange={(e) => setF((s) => ({ ...s, dateTo: e.target.value }))} />
        </Field>
        <Field label="Squad">
          <select style={field} value={f.squadId} onChange={(e) => setF((s) => ({ ...s, squadId: e.target.value }))}>
            <option value="">— wszystkie —</option>{squads.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Button onClick={add} disabled={!f.name.trim() || !f.dateFrom || !f.dateTo || badRange || busy}>{busy ? 'Dodawanie…' : 'Dodaj'}</Button>
      </div>
      {badRange && <Notice text={'Data „do" jest wcześniejsza niż „od". Popraw zakres, żeby zapisać sprint.'} tone="error" />}
      <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { imp(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ''; }} />
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6 }}>Mapowanie kolumn .xlsx (dopasuj do nagłówków w pliku):</div>
        <ColumnMap fields={SPRINT_COLS} value={colMap} onChange={setColMap} />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Import w toku…' : 'Importuj z .xlsx'}</Button>
      </div>
      <Notice {...notice} />
    </Section>
  );
}

function Przypomnienia() {
  const { notice, info, busy, run } = useNotice();
  const send = () => run(async () => {
    info('Wysyłanie…');
    const r = await api.sendReminders();
    return `Wysłano przypomnienia: ${r.sent} ${plural(r.sent, ['wiadomość', 'wiadomości', 'wiadomości'])}.`;
  });
  return (
    <Section title="Przypomnienia o zaległym urlopie">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 10 }}>
        Wyślij e-mail do osób z zaległym urlopem. Docelowo uruchamiane harmonogramem (cron).
      </p>
      <Button onClick={send} disabled={busy}>{busy ? 'Wysyłanie…' : 'Wyślij przypomnienia'}</Button>
      <Notice {...notice} />
    </Section>
  );
}

// FR-E3/F5/J2 — reguły administratora (wcześniej wartości zaszyte w kodzie).
function Reguly() {
  const [items, setItems] = useState<AdminSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { notice, ok, fail, clear } = useNotice();
  const [savingKey, setSavingKey] = useState('');
  const load = () => api.settings().then((s) => {
    setItems(s);
    setDraft(Object.fromEntries(s.map((x) => [x.key, String(x.value)])));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (key: string, label: string) => {
    if (savingKey) return;
    const n = Number(draft[key]);
    clear();
    if (!Number.isFinite(n) || n < 0) { fail(new Error(`„${label}" musi być liczbą nieujemną.`)); return; }
    setSavingKey(key);
    try { const r = await api.setSetting(key, n); ok(`Zapisano „${label}": ${r.value}.`); await load(); }
    catch (e) { fail(e); } finally { setSavingKey(''); }
  };

  return (
    <Section title="Reguły administratora">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 12 }}>
        Progi sterujące przypomnieniami, raportem zalegania i retencją. Zmiana obowiązuje od razu.
      </p>
      {items.length === 0 && <div style={{ ...list, color: 'var(--muted)' }}>Wczytywanie reguł…</div>}
      {items.map((s) => (
        <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink)' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{s.key} · {s.ref}</div>
          </div>
          <input
            type="number" min={0} inputMode="numeric" style={field} value={draft[s.key] ?? ''} aria-label={s.label}
            onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
          />
          <Button variant="secondary" onClick={() => save(s.key, s.label)} disabled={savingKey === s.key}>
            {savingKey === s.key ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </div>
      ))}
      <Notice {...notice} />
    </Section>
  );
}

function Retencja() {
  const { notice, busy, run } = useNotice();
  const [confirming, setConfirming] = useState(false);
  const start = () => run(async () => {
    const r = await api.runRetention();
    setConfirming(false);
    return r.anonymized === 0
      ? `Brak osób do anonimizacji (okres przechowywania: ${r.months} mies.).`
      : `Zanonimizowano ${r.anonymized} ${plural(r.anonymized, ['osobę', 'osoby', 'osób'])} (okres ${r.months} mies.).`;
  });
  return (
    <Section title="Retencja danych (RODO)">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 10 }}>
        Anonimizuje dane byłych pracowników po okresie przechowywania (domyślnie 24 mies.). Docelowo uruchamiane harmonogramem (cron).
      </p>
      <Button variant="secondary" onClick={() => setConfirming(true)}>Uruchom retencję</Button>
      <Notice {...notice} />
      <ConfirmDialog open={confirming} title="Uruchomić retencję danych?" confirmLabel="Uruchom retencję"
        confirmPhrase="RETENCJA" danger busy={busy} onConfirm={start} onCancel={() => setConfirming(false)}>
        <p style={{ margin: 0 }}>
          Dane osobowe wszystkich byłych pracowników, u których minął okres przechowywania, zostaną trwale
          zastąpione wartościami anonimowymi. Operacja obejmuje wiele osób naraz.
        </p>
        <p style={{ margin: '10px 0 0', color: 'var(--danger)' }}><b>Operacji nie da się cofnąć.</b></p>
      </ConfirmDialog>
    </Section>
  );
}

function RejestrRODO() {
  const [items, setItems] = useState<ProcessingActivity[]>([]);
  useEffect(() => { api.processingRegister().then(setItems).catch(() => {}); }, []);
  return (
    <Section title="Rejestr czynności przetwarzania (RODO)">
      {items.map((a) => (
        <div key={a.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
            {a.name} {a.specialCategory && <span style={{ color: 'var(--amber)', fontSize: 12, fontWeight: 400 }}>· kategoria szczególna</span>}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.6 }}>
            <div><strong>Cel:</strong> {a.purpose}</div>
            <div><strong>Podstawa prawna:</strong> {a.legalBasis}</div>
            <div><strong>Dane:</strong> {a.dataCategories}</div>
            <div><strong>Odbiorcy:</strong> {a.recipients}</div>
            <div><strong>Retencja:</strong> {a.retention}</div>
          </div>
        </div>
      ))}
    </Section>
  );
}

function Analityka() {
  const [m, setM] = useState<Adoption | null>(null);
  useEffect(() => { api.adoption().then(setM).catch(() => {}); }, []);
  const stat = (label: string, value: string | number, color = 'var(--ink)') => (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24, fontVariantNumeric: 'tabular-nums', color, marginTop: 4 }}>{value}</div>
    </div>
  );
  return (
    <Section title="Analityka adopcji (KPI > 80%)">
      {!m ? <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Wczytywanie…</span> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {stat('Adopcja', `${m.adoptionRate}%`, m.adoptionRate >= m.kpiTarget ? 'var(--brand)' : 'var(--amber)')}
          {stat('Aktywni / wszyscy', `${m.activeUsers}/${m.totalEmployees}`)}
          {stat('Wpisy', m.absencesCreated)}
          {stat('Logowania', m.logins)}
          {stat('Zdarzenia bezp.', m.securityEvents, m.securityEvents > 0 ? 'var(--danger)' : 'var(--ink)')}
        </div>
      )}
    </Section>
  );
}

export function Konfiguracja() {
  const { current } = useAuth();
  // PMO wchodzi tu wyłącznie po analitykę adopcji — jedyny panel, do którego dopuszcza go API
  // (/analytics/adoption = ADMIN + PMO). Reszta konfiguracji jest administracyjna.
  if (current?.role === 'PMO') return <div><Analityka /></div>;
  return (
    <div>
      <AdminOnly ok={current?.role === 'ADMIN'}>
        <Typy />
        <Pula />
        <Struktura />
        <Swieta />
        <Sprinty />
        <Analityka />
        <Reguly />
        <Przypomnienia />
        <Retencja />
        <RejestrRODO />
      </AdminOnly>
    </div>
  );
}
