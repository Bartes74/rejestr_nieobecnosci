import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, Upload } from 'lucide-react';
import { api, type Employee, type OrgUnit } from '../api';
import { useAuth } from '../current-employee';
import { ColumnMap, field } from '../admin/ui';

const empty = { firstName: '', lastName: '', email: '', login: '', employmentType: 'UOP', startDate: '2026-01-01', password: '' };
const ROLES = ['EMPLOYEE', 'LEADER', 'PO', 'DIRECTOR', 'ADMIN', 'PMO'];
// FR-G5 — domyślne nagłówki kolumn .xlsx (nadpisywalne przed importem).
const EMP_COLS = [
  { key: 'firstName', label: 'Imię' }, { key: 'lastName', label: 'Nazwisko' },
  { key: 'email', label: 'E-mail' }, { key: 'login', label: 'Login' },
  { key: 'employmentType', label: 'Forma' }, { key: 'startDate', label: 'Data startu' },
];
const empColDefaults = Object.fromEntries(EMP_COLS.map((c) => [c.key, c.label]));
const SCOPES: [string, string][] = [['MODIFY_ABSENCE', 'MOD'], ['VIEW_L4', 'L4']]; // FR-H4 uprawnienia rozszerzone

type TreeNode = OrgUnit & { children?: TreeNode[] };
const AVATARS = [
  { bg: 'var(--brand-tint)', fg: 'var(--brand)' },
  { bg: 'var(--blue-tint)', fg: 'var(--blue)' },
  { bg: 'var(--surface-3)', fg: 'var(--ink-2)' },
];
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
              display: 'flex', alignItems: 'center', gap: 7, padding: `6px 8px 6px ${8 + depth * 16}px`, borderRadius: 7,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: isTribe ? 600 : 400,
              color: isTribe ? 'var(--brand)' : 'var(--ink-2)', background: isTribe ? 'var(--brand-tint)' : 'transparent',
            }}>
              {n.children && n.children.length > 0 && <ChevronDown size={13} color={isTribe ? 'var(--brand)' : 'var(--muted)'} style={{ flex: 'none' }} />}
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
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [colMap, setColMap] = useState<Record<string, string>>(empColDefaults);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.employees().then(setRows).catch(() => {});
  useEffect(() => { load(); api.orgTree().then((t) => setTree(t as TreeNode[])).catch(() => setTree([])); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => `${e.firstName} ${e.lastName} ${e.login ?? ''}`.toLowerCase().includes(q));
  }, [rows, query]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const add = async () => {
    setMsg('');
    try { await api.createEmployee(form); setForm({ ...empty }); setMsg('Dodano pracownika.'); setShowAdd(false); load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const imp = async (file?: File) => {
    if (!file) return;
    try {
      const r = await api.importEmployees(file, colMap);
      const e0 = r.errors[0];
      setMsg(`Import: utworzono ${r.created}, zaktualizowano ${r.updated}, błędy: ${r.errors.length}${e0 ? ` (np. wiersz ${e0.row}: ${e0.message})` : ''}`);
      load();
    } catch (e) { setMsg((e as Error).message); }
  };
  const setPwd = async (id: string) => {
    const p = window.prompt('Nowe hasło dla pracownika:');
    if (!p) return;
    try { await api.setPassword(id, p); setMsg('Hasło ustawione.'); } catch (e) { setMsg((e as Error).message); }
  };
  const has = (e: Employee, scope: string) => (e.permissions ?? []).some((p) => p.scope === scope);
  const togglePerm = async (e: Employee, scope: string) => {
    try { await (has(e, scope) ? api.revokePermission(e.id, scope) : api.grantPermission(e.id, scope)); load(); }
    catch (err) { setMsg((err as Error).message); }
  };
  const anonymize = async (e: Employee) => {
    if (!window.confirm(`Anonimizować dane: ${e.firstName} ${e.lastName}? (RODO — nieodwracalne)`)) return;
    try { await api.anonymize(e.id); setMsg('Dane zanonimizowane.'); load(); } catch (err) { setMsg((err as Error).message); }
  };

  const toolBtn = { display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, padding: '9px 14px', borderRadius: 9 } as const;

  return (
    <div style={{ maxWidth: 1200, animation: 'fu .2s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '268px 1fr', gap: 18, alignItems: 'start' }}>
        {/* DRZEWO ORGANIZACJI */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', padding: 18 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', marginBottom: 14 }}>Struktura organizacyjna</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tree.length === 0 ? <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)' }}>Brak jednostek.</div> : <Tree nodes={tree} />}
          </div>
        </div>

        {/* PRACOWNICY */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--surface)' }}>
              <Search size={15} color="var(--muted)" style={{ flex: 'none' }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj pracownika…" aria-label="Szukaj pracownika" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 13, minWidth: 0 }} />
            </div>
            {isAdmin && <>
              <button type="button" onClick={() => { setShowImport((v) => !v); setShowAdd(false); }} style={{ ...toolBtn, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)' }}><Upload size={15} /> Import .xlsx</button>
              <button type="button" onClick={() => { setShowAdd((v) => !v); setShowImport(false); }} style={{ ...toolBtn, border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 700 }}><Plus size={15} /> Dodaj</button>
            </>}
          </div>

          {isAdmin && showAdd && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input style={field} placeholder="Imię" value={form.firstName} onChange={set('firstName')} />
                <input style={field} placeholder="Nazwisko" value={form.lastName} onChange={set('lastName')} />
                <input style={field} placeholder="E-mail" value={form.email} onChange={set('email')} />
                <input style={field} placeholder="Login" value={form.login} onChange={set('login')} />
                <select style={field} value={form.employmentType} onChange={set('employmentType')}><option value="UOP">UoP</option><option value="B2B">B2B</option><option value="OUT">OUT</option></select>
                <input style={field} type="date" value={form.startDate} onChange={set('startDate')} />
                <input style={field} type="password" placeholder="Hasło (opcjonalnie)" value={form.password} onChange={set('password')} />
                <button type="button" onClick={add} style={{ ...toolBtn, border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontWeight: 700 }}>Zapisz</button>
              </div>
            </div>
          )}
          {isAdmin && showImport && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6 }}>Mapowanie kolumn .xlsx (dopasuj do nagłówków w pliku):</div>
              <ColumnMap fields={EMP_COLS} value={colMap} onChange={setColMap} />
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { imp(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{ ...toolBtn, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink-2)' }}><Upload size={15} /> Wybierz plik i importuj</button>
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '11px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' }}>
              <div>PRACOWNIK</div><div>FORMA</div><div>ROLA</div><div>UPRAWNIENIA</div><div>AKCJE</div>
            </div>
            {filtered.map((e, i) => {
              const av = AVATARS[i % AVATARS.length]!;
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: av.bg, color: av.fg, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11, flex: 'none' }}>{initials(e)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.firstName} {e.lastName}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{e.login ?? '—'}</div>
                    </div>
                  </div>
                  <div>
                    {isAdmin
                      ? <select value={e.employmentType} onChange={(ev) => api.changeEmploymentType(e.id, ev.target.value).then(load).catch((err) => setMsg((err as Error).message))} style={smallField} aria-label={`Forma — ${e.firstName} ${e.lastName}`}><option value="UOP">UoP</option><option value="B2B">B2B</option><option value="OUT">OUT</option></select>
                      : <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{e.employmentType}</span>}
                  </div>
                  <div>
                    {isAdmin
                      ? <select value={e.role ?? 'EMPLOYEE'} onChange={(ev) => api.changeRole(e.id, ev.target.value).then(load).catch((err) => setMsg((err as Error).message))} style={smallField} aria-label={`Rola — ${e.firstName} ${e.lastName}`}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                      : <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{e.role}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isAdmin && SCOPES.map(([scope, label]) => (
                      <button key={scope} type="button" onClick={() => togglePerm(e, scope)} aria-pressed={has(e, scope)} aria-label={`${has(e, scope) ? 'Odbierz' : 'Nadaj'} uprawnienie ${scope} — ${e.firstName} ${e.lastName}`} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${has(e, scope) ? 'var(--brand)' : 'var(--border-2)'}`,
                        background: has(e, scope) ? 'var(--brand-tint)' : 'transparent', color: has(e, scope) ? 'var(--brand)' : 'var(--muted)',
                      }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ whiteSpace: 'nowrap' }}>
                    {isAdmin && <>
                      <button type="button" onClick={() => setPwd(e.id)} style={{ ...smallField, cursor: 'pointer', marginRight: 6 }}>Hasło</button>
                      <button type="button" onClick={() => anonymize(e)} style={{ ...smallField, cursor: 'pointer', color: 'var(--danger)' }}>Anonimizuj</button>
                    </>}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--muted)' }}>{rows.length === 0 ? 'Brak pracowników.' : 'Brak wyników dla filtra.'}</div>}
          </div>

          {msg && <div style={{ marginTop: 12, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
