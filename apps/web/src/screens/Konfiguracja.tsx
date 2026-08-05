import { useEffect, useRef, useState } from 'react';
import { api, type AbsenceType, type Adoption, type Calendar, type Employee, type OrgUnit, type ProcessingActivity, type Sprint, type AdminSetting } from '../api';
import { useAuth } from '../current-employee';
import { Button } from '../design-system/components/core/Button';
import { AdminOnly, Section, Notice, ColumnMap, field } from '../admin/ui';

const row = { display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' };
const list = { fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', padding: '4px 0' };
// FR-D4 — domyślne nagłówki kolumn .xlsx dla sprintów (nadpisywalne przed importem).
const SPRINT_COLS = [{ key: 'name', label: 'Sprint' }, { key: 'from', label: 'Od' }, { key: 'to', label: 'Do' }, { key: 'squad', label: 'Squad' }];
const sprintColDefaults = Object.fromEntries(SPRINT_COLS.map((c) => [c.key, c.label]));

function Typy() {
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [f, setF] = useState({ name: '', affectsPool: true, affectsCapacity: true, specialCategory: false });
  const [msg, setMsg] = useState('');
  const load = () => api.types().then(setTypes);
  useEffect(() => { load(); }, []);
  const add = async () => { setMsg(''); try { await api.createType(f); setF({ name: '', affectsPool: true, affectsCapacity: true, specialCategory: false }); load(); } catch (e) { setMsg((e as Error).message); } };
  const cb = (k: 'affectsPool' | 'affectsCapacity' | 'specialCategory') => (
    <label style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="checkbox" checked={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.checked }))} />
      {k === 'affectsPool' ? 'pula' : k === 'affectsCapacity' ? 'capacity' : 'L4/szczególna'}
    </label>
  );
  return (
    <Section title="Typy nieobecności">
      {types.map((t) => <div key={t.id} style={list}>{t.name} {t.specialCategory && <em style={{ color: 'var(--amber)' }}>· szczególna</em>} {!t.affectsPool && <span style={{ color: 'var(--muted)' }}>· bez puli</span>}</div>)}
      <div style={{ ...row, marginTop: 12 }}>
        <input style={field} placeholder="Nazwa typu" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        {cb('affectsPool')}{cb('affectsCapacity')}{cb('specialCategory')}
        <Button onClick={add} disabled={!f.name}>Dodaj</Button>
      </div>
      <Notice text={msg} />
    </Section>
  );
}

function Pula() {
  const [val, setVal] = useState('');
  const [emps, setEmps] = useState<Employee[]>([]);
  const [a, setA] = useState({ employeeId: '', periodYear: '2026', baseDays: '26', overrideDays: '', carriedOver: '0' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api.poolDefault().then((d) => setVal(String(d.value ?? ''))); api.employees().then(setEmps); }, []);
  const saveDefault = async () => { setMsg(''); try { await api.setDefaultPool(Number(val)); setMsg('Pula domyślna zapisana.'); } catch (e) { setMsg((e as Error).message); } };
  const saveAllow = async () => {
    setMsg('');
    try {
      await api.setAllowance({ employeeId: a.employeeId, periodYear: Number(a.periodYear), baseDays: Number(a.baseDays), overrideDays: a.overrideDays ? Number(a.overrideDays) : undefined, carriedOver: Number(a.carriedOver) });
      setMsg('Korekta zapisana.');
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <Section title="Pula urlopu">
      <div style={row}>
        <span style={list}>Pula domyślna (dni):</span>
        <input style={{ ...field, width: 80 }} value={val} onChange={(e) => setVal(e.target.value)} />
        <Button onClick={saveDefault}>Zapisz</Button>
      </div>
      <div style={{ ...row, marginTop: 14 }}>
        <span style={list}>Korekta indywidualna:</span>
        <select style={field} value={a.employeeId} onChange={(e) => setA((s) => ({ ...s, employeeId: e.target.value }))}>
          <option value="">— pracownik —</option>
          {emps.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <input style={{ ...field, width: 70 }} value={a.periodYear} onChange={(e) => setA((s) => ({ ...s, periodYear: e.target.value }))} title="rok" />
        <input style={{ ...field, width: 70 }} value={a.baseDays} onChange={(e) => setA((s) => ({ ...s, baseDays: e.target.value }))} title="pula" />
        <input style={{ ...field, width: 90 }} placeholder="override" value={a.overrideDays} onChange={(e) => setA((s) => ({ ...s, overrideDays: e.target.value }))} />
        <input style={{ ...field, width: 80 }} value={a.carriedOver} onChange={(e) => setA((s) => ({ ...s, carriedOver: e.target.value }))} title="zaległe" />
        <Button onClick={saveAllow} disabled={!a.employeeId}>Zapisz</Button>
      </div>
      <Notice text={msg} />
    </Section>
  );
}

function Struktura() {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [u, setU] = useState({ name: '', type: 'TRIBE', parentId: '' });
  const [m, setM] = useState({ employeeId: '', orgUnitId: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.orgUnits().then(setUnits);
  useEffect(() => { load(); api.employees().then(setEmps); }, []);
  const addUnit = async () => { setMsg(''); try { await api.createUnit({ name: u.name, type: u.type, parentId: u.parentId || undefined }); setU({ name: '', type: 'TRIBE', parentId: '' }); load(); } catch (e) { setMsg((e as Error).message); } };
  const addMember = async () => { setMsg(''); try { await api.addMembership(m); setMsg('Przypisano.'); } catch (e) { setMsg((e as Error).message); } };
  return (
    <Section title="Struktura organizacyjna">
      {units.map((x) => <div key={x.id} style={list}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>{x.type}</span>{x.name}</div>)}
      <div style={{ ...row, marginTop: 12 }}>
        <input style={field} placeholder="Nazwa jednostki" value={u.name} onChange={(e) => setU((s) => ({ ...s, name: e.target.value }))} />
        <select style={field} value={u.type} onChange={(e) => setU((s) => ({ ...s, type: e.target.value }))}>
          {['PION', 'DEPARTAMENT', 'TRIBE', 'CHAPTER', 'SQUAD'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={field} value={u.parentId} onChange={(e) => setU((s) => ({ ...s, parentId: e.target.value }))}>
          <option value="">— bez nadrzędnej —</option>
          {units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <Button onClick={addUnit} disabled={!u.name}>Dodaj jednostkę</Button>
      </div>
      <div style={{ ...row, marginTop: 10 }}>
        <select style={field} value={m.employeeId} onChange={(e) => setM((s) => ({ ...s, employeeId: e.target.value }))}>
          <option value="">— pracownik —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <select style={field} value={m.orgUnitId} onChange={(e) => setM((s) => ({ ...s, orgUnitId: e.target.value }))}>
          <option value="">— jednostka —</option>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <Button onClick={addMember} disabled={!m.employeeId || !m.orgUnitId}>Przypisz</Button>
      </div>
      <Notice text={msg} />
    </Section>
  );
}

function Swieta() {
  const [cals, setCals] = useState<Calendar[]>([]);
  const [calId, setCalId] = useState('');
  const [hols, setHols] = useState<{ id: string; date: string; name: string }[]>([]);
  const [newCal, setNewCal] = useState('');
  const [h, setH] = useState({ date: '', name: '' });
  const [msg, setMsg] = useState('');
  const loadCals = () => api.calendars().then((c) => { setCals(c); setCalId((p) => p || c[0]?.id || ''); });
  useEffect(() => { loadCals(); }, []);
  useEffect(() => { if (calId) api.holidays(calId).then(setHols); }, [calId]);
  const addCal = async () => { try { await api.createCalendar({ name: newCal, isDefault: cals.length === 0 }); setNewCal(''); loadCals(); } catch (e) { setMsg((e as Error).message); } };
  const addHol = async () => { try { await api.createHoliday({ calendarId: calId, date: h.date, name: h.name }); setH({ date: '', name: '' }); api.holidays(calId).then(setHols); } catch (e) { setMsg((e as Error).message); } };
  return (
    <Section title="Święta i dni wolne">
      <div style={row}>
        <select style={field} value={calId} onChange={(e) => setCalId(e.target.value)}>
          {cals.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (domyślny)' : ''}</option>)}
        </select>
        <input style={field} placeholder="Nowy kalendarz" value={newCal} onChange={(e) => setNewCal(e.target.value)} />
        <Button variant="secondary" onClick={addCal} disabled={!newCal}>Dodaj kalendarz</Button>
      </div>
      <div style={{ marginTop: 10 }}>{hols.map((x) => <span key={x.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginRight: 10, color: 'var(--ink-2)' }}>{x.date.slice(0, 10)} {x.name}</span>)}</div>
      <div style={{ ...row, marginTop: 10 }}>
        <input style={field} type="date" value={h.date} onChange={(e) => setH((s) => ({ ...s, date: e.target.value }))} />
        <input style={field} placeholder="Nazwa święta" value={h.name} onChange={(e) => setH((s) => ({ ...s, name: e.target.value }))} />
        <Button onClick={addHol} disabled={!h.date || !h.name || !calId}>Dodaj dzień wolny</Button>
      </div>
      <Notice text={msg} />
    </Section>
  );
}

function Sprinty() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [squads, setSquads] = useState<OrgUnit[]>([]);
  const [f, setF] = useState({ name: '', dateFrom: '', dateTo: '', squadId: '' });
  const [msg, setMsg] = useState('');
  const [colMap, setColMap] = useState<Record<string, string>>(sprintColDefaults);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => api.sprints().then(setSprints);
  useEffect(() => { load(); api.orgUnits().then((u) => setSquads(u.filter((x) => x.type === 'SQUAD'))); }, []);
  const add = async () => { try { await api.createSprint({ ...f, squadId: f.squadId || undefined }); setF({ name: '', dateFrom: '', dateTo: '', squadId: '' }); load(); } catch (e) { setMsg((e as Error).message); } };
  const imp = async (file?: File) => { if (!file) return; try { const r = await api.importSprints(file, colMap); setMsg(`Import: utworzono ${r.created}, błędy: ${r.errors.length}`); load(); } catch (e) { setMsg((e as Error).message); } };
  return (
    <Section title="Sprinty">
      {sprints.map((s) => <div key={s.id} style={list}>{s.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{s.dateFrom.slice(0, 10)} – {s.dateTo.slice(0, 10)}</span></div>)}
      <div style={{ ...row, marginTop: 12 }}>
        <input style={field} placeholder="Nazwa" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        <input style={field} type="date" value={f.dateFrom} onChange={(e) => setF((s) => ({ ...s, dateFrom: e.target.value }))} />
        <input style={field} type="date" value={f.dateTo} onChange={(e) => setF((s) => ({ ...s, dateTo: e.target.value }))} />
        <select style={field} value={f.squadId} onChange={(e) => setF((s) => ({ ...s, squadId: e.target.value }))}>
          <option value="">— squad —</option>{squads.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <Button onClick={add} disabled={!f.name || !f.dateFrom || !f.dateTo}>Dodaj</Button>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { imp(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ''; }} />
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6 }}>Mapowanie kolumn .xlsx (dopasuj do nagłówków w pliku):</div>
        <ColumnMap fields={SPRINT_COLS} value={colMap} onChange={setColMap} />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importuj z .xlsx</Button>
      </div>
      <Notice text={msg} />
    </Section>
  );
}

function Przypomnienia() {
  const [msg, setMsg] = useState('');
  const send = async () => {
    setMsg('Wysyłanie…');
    try { const r = await api.sendReminders(); setMsg(`Wysłano przypomnienia: ${r.sent}.`); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <Section title="Przypomnienia o zaległym urlopie">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 10 }}>
        Wyślij e-mail do osób z zaległym urlopem. Docelowo uruchamiane harmonogramem (cron).
      </p>
      <Button onClick={send}>Wyślij przypomnienia</Button>
      <Notice text={msg} />
    </Section>
  );
}

// FR-E3/F5/J2 — reguły administratora (wcześniej wartości zaszyte w kodzie).
function Reguly() {
  const [items, setItems] = useState<AdminSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const load = () => api.settings().then((s) => {
    setItems(s);
    setDraft(Object.fromEntries(s.map((x) => [x.key, String(x.value)])));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    setMsg('Zapisywanie…');
    try { const r = await api.setSetting(key, Number(draft[key])); setMsg(`Zapisano: ${key} = ${r.value}.`); load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <Section title="Reguły administratora">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 12 }}>
        Progi sterujące przypomnieniami, raportem zalegania i retencją. Zmiana obowiązuje od razu.
      </p>
      {items.map((s) => (
        <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink)' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{s.key} · {s.ref}</div>
          </div>
          <input
            type="number" min={0} style={field} value={draft[s.key] ?? ''} aria-label={s.label}
            onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
          />
          <Button variant="secondary" onClick={() => save(s.key)}>Zapisz</Button>
        </div>
      ))}
      <Notice text={msg} />
    </Section>
  );
}

function Retencja() {
  const [msg, setMsg] = useState('');
  const run = async () => {
    if (!window.confirm('Uruchomić retencję? Byli pracownicy po okresie przechowywania zostaną zanonimizowani.')) return;
    setMsg('Przetwarzanie…');
    try { const r = await api.runRetention(); setMsg(`Zanonimizowano: ${r.anonymized} (okres ${r.months} mies.).`); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <Section title="Retencja danych (RODO)">
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 10 }}>
        Anonimizuje dane byłych pracowników po okresie przechowywania (domyślnie 24 mies.). Docelowo uruchamiane harmonogramem (cron).
      </p>
      <Button variant="secondary" onClick={run}>Uruchom retencję</Button>
      <Notice text={msg} />
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
