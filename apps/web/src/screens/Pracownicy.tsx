import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Upload } from 'lucide-react';
import { api, type Employee, type OrgUnit } from '../api';
import { useAuth } from '../current-employee';
import { ColumnMap, ConfirmDialog, Field, Notice, PasswordDialog, field, useNotice } from '../admin/ui';
import { card, cardClipped } from '../design-system/surfaces';
import { Avatar } from '../design-system/components/core/Avatar';

const empty = { firstName: '', lastName: '', email: '', login: '', employmentType: 'UOP', startDate: '2026-01-01', password: '' };
const ROLES = ['EMPLOYEE', 'LEADER', 'PO', 'DIRECTOR', 'ADMIN', 'PMO'];
// FR-G5 — domyślne nagłówki kolumn .xlsx (nadpisywalne przed importem).
const EMP_COLS = [
  { key: 'firstName', label: 'Imię' }, { key: 'lastName', label: 'Nazwisko' },
  { key: 'email', label: 'E-mail' }, { key: 'login', label: 'Login' },
  { key: 'employmentType', label: 'Forma' }, { key: 'startDate', label: 'Data startu' },
];
const empColDefaults = Object.fromEntries(EMP_COLS.map((c) => [c.key, c.label]));
// Pola formularza dodawania — etykieta jest dostępną nazwą pola, nie tylko podpowiedzią w środku.
// Placeholder znika po pierwszym znaku; czytnik ekranu nie czyta go jako nazwy.
const ADD_FIELDS: { key: keyof typeof empty; label: string; type?: string; autoComplete?: string }[] = [
  { key: 'firstName', label: 'Imię', autoComplete: 'given-name' },
  { key: 'lastName', label: 'Nazwisko', autoComplete: 'family-name' },
  { key: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
  { key: 'login', label: 'Login', autoComplete: 'username' },
];
const SCOPES: [string, string][] = [['MODIFY_ABSENCE', 'MOD'], ['VIEW_L4', 'L4']]; // FR-H4 uprawnienia rozszerzone

type TreeNode = OrgUnit & { children?: TreeNode[] };
// Tony awatarów cyklicznie — ta sama trójka, którą zna komponent Avatar.
const AVATARS = ['brand', 'blue', 'neutral'] as const;
const initials = (e: Employee) => `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase();
const COLS = '2fr 0.9fr 1.1fr 1fr 1.2fr';
const smallField = { ...field, fontSize: 12, padding: '4px 8px' } as const;

function Tree({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((n) => {
        const isTribe = n.type === 'TRIBE';
        return (
          <div key={n.id}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: `6px 8px 6px ${8 + depth * 16}px`, borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: isTribe ? 600 : 400,
              color: isTribe ? 'var(--brand)' : 'var(--ink-2)', background: isTribe ? 'var(--brand-tint)' : 'transparent',
            }}>
              {/* Był tu chevron na węzłach z dziećmi — obiecywał zwijanie, którego drzewo nie ma.
                  Hierarchię niesie wcięcie i etykieta typu; strzałka tylko kusiła do kliknięcia. */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.04em', color: isTribe ? 'var(--brand)' : 'var(--muted)' }}>{n.type}</span>
              {n.name}
            </div>
            {n.children && n.children.length > 0 && <Tree nodes={n.children} depth={depth + 1} />}
          </div>
        );
      })}
    </>
  );
}

export function Pracownicy() {
  const { current } = useAuth();
  const isAdmin = current?.role === 'ADMIN';
  const [rows, setRows] = useState<Employee[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ ...empty });
  const { notice, busy, run } = useNotice();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [colMap, setColMap] = useState<Record<string, string>>(empColDefaults);
  // Operacje wymagające potwierdzenia trzymają wybraną osobę — dialog musi wiedzieć, kogo dotyczy.
  const [pwdFor, setPwdFor] = useState<Employee | null>(null);
  const [anonFor, setAnonFor] = useState<Employee | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bez tego pusta tabela mówiła „Brak pracowników. Dodaj pierwszą osobę…" administratorowi,
  // który ma ich trzystu — zanim lista zdążyła przyjść.
  const [loaded, setLoaded] = useState(false);
  const load = () => api.employees().then(setRows).catch(() => {}).finally(() => setLoaded(true));
  useEffect(() => { load(); api.orgTree().then((t) => setTree(t as TreeNode[])).catch(() => setTree([])); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => `${e.firstName} ${e.lastName} ${e.login ?? ''}`.toLowerCase().includes(q));
  }, [rows, query]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const nameOf = (e: Employee) => `${e.firstName} ${e.lastName}`.trim();
  // E-mail jest wymagany: to jedyny kanał powiadomień, a docelowo konta zasila AD, więc każdy
  // ma adres. Wcześniej UI mówił „opcjonalny", a serwer i baza wymagały — zleceniodawca dostał
  // surowe „email must be an email" pod tabelą. Wzorzec sprawdza tylko kształt; resztę zna serwer.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const emailBad = form.email.trim() !== '' && !emailOk;
  const required = form.firstName.trim() && form.lastName.trim() && form.login.trim() && emailOk;

  const add = () => run(async () => {
    await api.createEmployee(form);
    setForm({ ...empty });
    setShowAdd(false);
    await load();
    return 'Dodano pracownika.';
  });
  const imp = (file?: File) => {
    if (!file) return;
    void run(async () => {
      const r = await api.importEmployees(file, colMap);
      const e0 = r.errors[0];
      await load();
      return `Import: utworzono ${r.created}, zaktualizowano ${r.updated}, błędy: ${r.errors.length}${e0 ? ` (np. wiersz ${e0.row}: ${e0.message})` : ''}`;
    });
  };
  const setPwd = (password: string) => {
    const target = pwdFor;
    if (!target) return;
    void run(async () => {
      await api.setPassword(target.id, password);
      setPwdFor(null);
      return `Hasło ustawione dla: ${nameOf(target)}.`;
    });
  };
  const changeField = (p: Promise<unknown>, okMsg: string) => run(async () => { await p; await load(); return okMsg; });
  const has = (e: Employee, scope: string) => (e.permissions ?? []).some((p) => p.scope === scope);
  const togglePerm = (e: Employee, scope: string) => run(async () => {
    const granting = !has(e, scope);
    await (granting ? api.grantPermission(e.id, scope) : api.revokePermission(e.id, scope));
    await load();
    return `${granting ? 'Nadano' : 'Odebrano'} uprawnienie ${scope}: ${nameOf(e)}.`;
  });
  const anonymize = () => {
    const target = anonFor;
    if (!target) return;
    void run(async () => {
      await api.anonymize(target.id);
      setAnonFor(null);
      await load();
      return `Dane zanonimizowane: ${nameOf(target)}.`;
    });
  };

  const toolBtn = { display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, padding: '9px 14px', borderRadius: 'var(--radius-md)' } as const;

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '268px 1fr', gap: 18, alignItems: 'start' }}>
        {/* DRZEWO ORGANIZACJI */}
        <div style={{ ...card, padding: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', margin: '0 0 14px' }}>Struktura organizacyjna</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tree.length === 0 ? <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)' }}>Brak jednostek.</div> : <Tree nodes={tree} />}
          </div>
        </div>

        {/* PRACOWNICY */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {/* `border-2`, nie `border`: to jedyna granica pola na białym tle, więc obowiązuje
                próg 3:1 (WCAG 1.4.11) — włoskowate `--border` dawało tu 1,2:1.
                `.ds-field` niesie pierścień fokusu, którego to pole jako jedyne w aplikacji nie miało:
                `outline: none` w atrybucie `style` bije regułę `:focus-visible` z arkusza. */}
            {/* `label`, nie `div`: samo pole tekstowe ma 16 px wysokości, więc celem wskaźnika
                była wąska linijka w środku ramki. Etykieta oddaje fokus kontrolce natywnie,
                przez co klikalna jest cała ramka (35 px) — bez ani jednej linii JavaScriptu. */}
            <label className="ds-field" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '9px 12px', background: 'var(--surface)' }}>
              <Search size={15} color="var(--muted)" style={{ flex: 'none' }} aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj pracownika…" aria-label="Szukaj pracownika" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 13, minWidth: 0 }} />
            </label>
            {isAdmin && <>
              <button type="button" onClick={() => { setShowImport((v) => !v); setShowAdd(false); }} style={{ ...toolBtn, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)' }}><Upload size={15} /> Import .xlsx</button>
              <button type="button" onClick={() => { setShowAdd((v) => !v); setShowImport(false); }} style={{ ...toolBtn, border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 700 }}><Plus size={15} /> Dodaj</button>
            </>}
          </div>

          {isAdmin && showAdd && (
            <form onSubmit={(ev) => { ev.preventDefault(); add(); }} style={{ ...card, padding: 16, marginBottom: 14 }}>
              <div className="ds-form-row" style={{ gap: 10 }}>
                {ADD_FIELDS.map((f) => (
                  <Field key={f.key} label={`${f.label} *`}>
                    <input style={field} type={f.type ?? 'text'} autoComplete={f.autoComplete} required
                      aria-invalid={f.key === 'email' && emailBad ? true : undefined} aria-describedby={f.key === 'email' && emailBad ? 'emp-email-err' : undefined}
                      value={form[f.key]} onChange={set(f.key)} />
                    {/* Błąd przy polu, nie tylko w komunikacie na dole — jak w PasswordDialog. */}
                    {f.key === 'email' && emailBad && <span id="emp-email-err" role="alert" style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--danger)' }}>Podaj poprawny adres e-mail, np. jan.kowalski@firma.pl.</span>}
                  </Field>
                ))}
                <Field label="Forma">
                  <select style={field} value={form.employmentType} onChange={set('employmentType')}><option value="UOP">UoP</option><option value="B2B">B2B</option><option value="OUT">OUT</option></select>
                </Field>
                <Field label="Data startu *">
                  <input style={field} type="date" required value={form.startDate} onChange={set('startDate')} />
                </Field>
                <Field label="Hasło (opcjonalnie)">
                  <input style={field} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
                </Field>
                <button type="submit" disabled={busy || !required} style={{ ...toolBtn, border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 700, opacity: busy || !required ? 0.55 : 1, cursor: busy || !required ? 'not-allowed' : 'pointer' }}>
                  {busy ? 'Zapisywanie…' : 'Zapisz'}
                </button>
              </div>
            </form>
          )}
          {isAdmin && showImport && (
            <div style={{ ...card, padding: 16, marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6 }}>Mapowanie kolumn .xlsx (dopasuj do nagłówków w pliku):</div>
              <ColumnMap fields={EMP_COLS} value={colMap} onChange={setColMap} />
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { imp(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ''; }} />
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} style={{ ...toolBtn, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)', opacity: busy ? 0.55 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
                <Upload size={15} /> {busy ? 'Import w toku…' : 'Wybierz plik i importuj'}
              </button>
            </div>
          )}

          {/* Komunikat stoi NAD tabelą, tuż pod formularzem dodawania i importu: pod tabelą
              z trzystoma osobami znikał poza ekranem i nie było wiadomo, dlaczego zapis nie przeszedł. */}
          <Notice {...notice} />

          {/* Układ zostaje na CSS grid (kolumny muszą się zgadzać w pionie), ale role ARIA wiążą
              komórkę z nagłówkiem — bez nich czytnik ekranu czyta ciąg wartości bez kontekstu. */}
          <div role="table" aria-label="Pracownicy" aria-rowcount={filtered.length + 1}
            style={cardClipped}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '11px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              <div role="columnheader">Pracownik</div><div role="columnheader">Forma</div><div role="columnheader">Rola</div><div role="columnheader">Uprawnienia</div><div role="columnheader">Akcje</div>
            </div>
            {filtered.map((e, i) => {
              const av = AVATARS[i % AVATARS.length]!;
              return (
                <div key={e.id} role="row" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <div role="rowheader" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={initials(e)} tone={av} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.firstName} {e.lastName}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{e.login ?? '—'}</div>
                    </div>
                  </div>
                  <div role="cell">
                    {isAdmin
                      ? <select value={e.employmentType} disabled={busy} onChange={(ev) => changeField(api.changeEmploymentType(e.id, ev.target.value), `Forma zatrudnienia zmieniona: ${nameOf(e)}.`)} style={smallField} aria-label={`Forma — ${nameOf(e)}`}><option value="UOP">UoP</option><option value="B2B">B2B</option><option value="OUT">OUT</option></select>
                      : <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{e.employmentType}</span>}
                  </div>
                  <div role="cell">
                    {isAdmin
                      ? <select value={e.role ?? 'EMPLOYEE'} disabled={busy} onChange={(ev) => changeField(api.changeRole(e.id, ev.target.value), `Rola zmieniona: ${nameOf(e)}.`)} style={smallField} aria-label={`Rola — ${nameOf(e)}`}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                      : <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{e.role}</span>}
                  </div>
                  <div role="cell" style={{ display: 'flex', gap: 4 }}>
                    {isAdmin && SCOPES.map(([scope, label]) => (
                      // Cel wskaźnika miał 31 × 22 px — poniżej minimum 24 × 24 (WCAG 2.5.8),
                      // a to przełącznik nadający uprawnienie do danych o zdrowiu.
                      <button key={scope} type="button" disabled={busy} onClick={() => togglePerm(e, scope)} aria-pressed={has(e, scope)} aria-label={`${has(e, scope) ? 'Odbierz' : 'Nadaj'} uprawnienie ${scope} — ${nameOf(e)}`} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 9px', minHeight: 24, borderRadius: 'var(--radius-md)', cursor: busy ? 'not-allowed' : 'pointer',
                        border: `1px solid ${has(e, scope) ? 'var(--brand)' : 'var(--border-2)'}`,
                        background: has(e, scope) ? 'var(--brand-tint)' : 'transparent', color: has(e, scope) ? 'var(--brand)' : 'var(--muted)',
                      }}>{label}</button>
                    ))}
                  </div>
                  <div role="cell" style={{ whiteSpace: 'nowrap' }}>
                    {isAdmin && <>
                      <button type="button" disabled={busy} onClick={() => setPwdFor(e)} aria-label={`Ustaw hasło — ${nameOf(e)}`} style={{ ...smallField, cursor: 'pointer', marginRight: 6 }}>Hasło</button>
                      <button type="button" disabled={busy} onClick={() => setAnonFor(e)} aria-label={`Anonimizuj dane — ${nameOf(e)}`} style={{ ...smallField, cursor: 'pointer', color: 'var(--danger)' }}>Anonimizuj</button>
                    </>}
                  </div>
                </div>
              );
            })}
            {!loaded && <div role="row"><div role="cell" style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)' }}>Wczytywanie listy pracowników…</div></div>}
            {loaded && filtered.length === 0 && (
              <div role="row"><div role="cell" style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)' }}>
                {rows.length === 0 ? 'Brak pracowników. Dodaj pierwszą osobę albo zaimportuj listę z pliku .xlsx.' : `Brak wyników dla „${query.trim()}". Zmień frazę lub wyczyść pole wyszukiwania.`}
              </div></div>
            )}
          </div>
        </div>
      </div>

      <PasswordDialog open={!!pwdFor} employeeName={pwdFor ? nameOf(pwdFor) : ''} busy={busy}
        onSubmit={setPwd} onCancel={() => setPwdFor(null)} />

      <ConfirmDialog open={!!anonFor} title="Anonimizacja danych (RODO)" confirmLabel="Anonimizuj nieodwracalnie"
        confirmPhrase="ANONIMIZUJ" danger busy={busy} onConfirm={anonymize} onCancel={() => setAnonFor(null)}>
        <p style={{ margin: 0 }}>
          Dane osobowe <b style={{ color: 'var(--ink)' }}>{anonFor ? nameOf(anonFor) : ''}</b> (imię, nazwisko, e-mail, login)
          zostaną trwale zastąpione wartościami anonimowymi. Nieobecności i wpisy audytu pozostaną, ale nie da się już
          powiązać ich z osobą.
        </p>
        <p style={{ margin: '10px 0 0', color: 'var(--danger)' }}><b>Operacji nie da się cofnąć.</b></p>
      </ConfirmDialog>
    </div>
  );
}
