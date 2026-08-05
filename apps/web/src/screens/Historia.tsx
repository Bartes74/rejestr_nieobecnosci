import { useEffect, useMemo, useState } from 'react';
import { api, type Absence, type AbsenceType } from '../api';
import { useAuth } from '../current-employee';

const d = (iso: string) => iso.slice(0, 10);
const dm = (s: string) => `${Number(s.slice(8, 10))}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const today = () => new Date().toISOString().slice(0, 10);
const field = { padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 12.5 } as const;
const COLS = '1.6fr .6fr 1.6fr 1.1fr 1fr .9fr';

// Dni robocze liczy serwer (z kalendarzem świąt osoby) — ta sama liczba, którą widzi balans.
const workdays = (n: number) => String(n).replace('.', ','); // ułamki po polsku (0,5)
const rangeLabel = (a: Absence) => {
  const f = d(a.dateFrom), t = d(a.dateTo);
  if (f === t) return dm(f);
  return `${Number(f.slice(8, 10))}–${dm(t)}`;
};

export function Historia() {
  const { current } = useAuth();
  const [rows, setRows] = useState<Absence[]>([]);
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [undo, setUndo] = useState<Absence | null>(null);
  const [edit, setEdit] = useState<{ id: string; typeId: string; dateFrom: string; dateTo: string } | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'done'>('all');

  const load = () => { if (current) api.absences(current.id).then(setRows).catch(() => setRows([])); };
  useEffect(load, [current?.id]);
  useEffect(() => { api.types().then(setTypes).catch(() => {}); }, []);

  const remove = async (a: Absence) => {
    if (!window.confirm('Usunąć ten wpis nieobecności?')) return;
    await api.deleteAbsence(a.id); setUndo(a); load();
  };
  const doUndo = async () => {
    if (!undo || !current) return;
    await api.createAbsence({ employeeId: current.id, typeId: undo.type.id, dateFrom: d(undo.dateFrom), dateTo: d(undo.dateTo), dayPart: undo.dayPart, hourFrom: undo.hourFrom ?? undefined, hourTo: undo.hourTo ?? undefined });
    setUndo(null); load();
  };
  const saveEdit = async () => {
    if (!edit) return;
    setErr('');
    try { await api.updateAbsence(edit.id, { typeId: edit.typeId, dateFrom: edit.dateFrom, dateTo: edit.dateTo }); setEdit(null); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const filtered = useMemo(() => {
    const t = today();
    const sorted = [...rows].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
    if (filter === 'upcoming') return sorted.filter((a) => d(a.dateTo) >= t);
    if (filter === 'done') return sorted.filter((a) => d(a.dateTo) < t);
    return sorted;
  }, [rows, filter]);

  const tab = (k: typeof filter, label: string) => (
    <button type="button" onClick={() => setFilter(k)} style={{
      padding: '8px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
      background: filter === k ? 'var(--brand-tint)' : 'transparent', color: filter === k ? 'var(--brand)' : 'var(--muted)',
    }}>{label}</button>
  );
  const hcell = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' } as const;

  return (
    <div style={{ maxWidth: 1080, animation: 'fu .2s ease' }}>
      {undo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', flex: 1 }}>Usunięto wpis {dm(d(undo.dateFrom))} – {dm(d(undo.dateTo))}.</span>
          <button type="button" onClick={doUndo} style={{ ...field, cursor: 'pointer', color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}>Cofnij</button>
          <button type="button" onClick={() => setUndo(null)} aria-label="Zamknij" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        {tab('all', 'Wszystkie')}{tab('upcoming', 'Nadchodzące')}{tab('done', 'Zrealizowane')}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{new Date().getFullYear()} · rok rozliczeniowy</span>
      </div>
      {err && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 13, marginBottom: 10 }}>{err}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={hcell}>ZAKRES</div><div style={hcell}>DNI</div><div style={hcell}>TYP</div><div style={hcell}>ŹRÓDŁO</div><div style={hcell}>STATUS</div><div style={hcell} />
        </div>
        {filtered.length === 0 && <div style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Brak wpisów.</div>}
        {filtered.map((a, i) => {
          const isUpcoming = d(a.dateTo) >= today();
          const part = a.dayPart === 'AM' ? ' · AM' : a.dayPart === 'PM' ? ' · PM' : a.dayPart === 'HOURS' ? ' · godz.' : '';
          if (edit && edit.id === a.id) {
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <select style={field} value={edit.typeId} onChange={(e) => setEdit({ ...edit, typeId: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <input type="date" style={field} value={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateFrom: e.target.value })} />
                <input type="date" style={field} value={edit.dateTo} min={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateTo: e.target.value })} />
                <button type="button" onClick={saveEdit} style={{ ...field, cursor: 'pointer', color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}>Zapisz</button>
                <button type="button" onClick={() => setEdit(null)} style={{ ...field, cursor: 'pointer' }}>Anuluj</button>
              </div>
            );
          }
          return (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '15px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{rangeLabel(a)}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>{part}</span></div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{workdays(a.workingDays)}</div>
              <div style={{ color: 'var(--ink-2)' }}>
                {a.type.name}
                {a.type.specialCategory && <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 5, marginLeft: 6 }}>widoczne tylko dla Ciebie</span>}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>{a.source === 'DELEGATE' ? 'W imieniu' : 'Samodzielny'}</div>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 7, color: isUpcoming ? 'var(--blue)' : 'var(--muted)', background: isUpcoming ? 'var(--blue-tint)' : 'var(--surface-3)' }}>{isUpcoming ? 'Zaplanowane' : 'Zrealizowane'}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {isUpcoming && <>
                  <button type="button" onClick={() => setEdit({ id: a.id, typeId: a.type.id, dateFrom: d(a.dateFrom), dateTo: d(a.dateTo) })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Edytuj</button>
                  <button type="button" onClick={() => remove(a)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--danger)' }}>Wycofaj</button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
