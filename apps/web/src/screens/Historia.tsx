import { useEffect, useMemo, useState } from 'react';
import { api, type Absence, type AbsenceType } from '../api';
import { useAuth } from '../current-employee';
import { ConfirmDialog, Notice, useNotice } from '../admin/ui';
import { cardClipped } from '../design-system/surfaces';

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
  const [confirmDel, setConfirmDel] = useState<Absence | null>(null);
  const [busy, setBusy] = useState(false);
  const { notice, fail, clear } = useNotice();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'done'>('all');

  const load = () => { if (current) api.absences(current.id).then(setRows).catch(fail); };
  useEffect(load, [current?.id]);
  useEffect(() => { api.types().then(setTypes).catch(() => {}); }, []);

  const guard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); clear();
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const remove = () => {
    const a = confirmDel;
    if (!a) return;
    void guard(async () => { await api.deleteAbsence(a.id); setConfirmDel(null); setUndo(a); load(); });
  };
  const doUndo = () => {
    if (!undo || !current) return;
    const a = undo;
    void guard(async () => {
      await api.createAbsence({ employeeId: current.id, typeId: a.type.id, dateFrom: d(a.dateFrom), dateTo: d(a.dateTo), dayPart: a.dayPart, hourFrom: a.hourFrom ?? undefined, hourTo: a.hourTo ?? undefined });
      setUndo(null); load();
    });
  };
  const saveEdit = () => {
    if (!edit) return;
    void guard(async () => {
      await api.updateAbsence(edit.id, { typeId: edit.typeId, dateFrom: edit.dateFrom, dateTo: edit.dateTo });
      setEdit(null); load();
    });
  };

  const filtered = useMemo(() => {
    const t = today();
    const sorted = [...rows].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
    if (filter === 'upcoming') return sorted.filter((a) => d(a.dateTo) >= t);
    if (filter === 'done') return sorted.filter((a) => d(a.dateTo) < t);
    return sorted;
  }, [rows, filter]);

  // Stan „wybrany" jest zakodowany kolorem, więc czytnik ekranu potrzebuje aria-pressed —
  // bez tego wszystkie trzy filtry brzmią identycznie.
  const tab = (k: typeof filter, label: string) => (
    <button type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} style={{
      padding: '8px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
      background: filter === k ? 'var(--brand-tint)' : 'transparent', color: filter === k ? 'var(--brand)' : 'var(--muted)',
    }}>{label}</button>
  );
  const hcell = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' } as const;

  return (
    <div style={{ maxWidth: 1080, animation: 'fu .2s ease' }}>
      <div role="status" aria-live="polite">
        {undo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', flex: 1 }}>Usunięto wpis {dm(d(undo.dateFrom))} – {dm(d(undo.dateTo))}. Dni wróciły do puli.</span>
            <button type="button" onClick={doUndo} disabled={busy} style={{ ...field, cursor: 'pointer', color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}>{busy ? 'Przywracanie…' : 'Cofnij'}</button>
            <button type="button" onClick={() => setUndo(null)} aria-label="Zamknij komunikat" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 8, margin: -8, borderRadius: 7 }}>×</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        <div role="group" aria-label="Filtr wpisów" style={{ display: 'flex', gap: 6 }}>
          {tab('all', 'Wszystkie')}{tab('upcoming', 'Nadchodzące')}{tab('done', 'Zrealizowane')}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{new Date().getFullYear()} · rok rozliczeniowy</span>
      </div>
      <Notice {...notice} />

      <div role="table" aria-label="Moje nieobecności" style={{ ...cardClipped, marginTop: 12 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div role="columnheader" style={hcell}>ZAKRES</div><div role="columnheader" style={hcell}>DNI</div><div role="columnheader" style={hcell}>TYP</div><div role="columnheader" style={hcell}>ŹRÓDŁO</div><div role="columnheader" style={hcell}>STATUS</div><div role="columnheader" style={hcell}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Akcje</span></div>
        </div>
        {filtered.length === 0 && (
          <div role="row"><div role="cell" style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>
            {rows.length === 0 ? 'Nie masz jeszcze żadnych wpisów. Zaplanuj pierwszą nieobecność w „Nowa nieobecność".'
              : filter === 'upcoming' ? 'Brak nadchodzących nieobecności.' : 'Brak zrealizowanych nieobecności w tym okresie.'}
          </div></div>
        )}
        {filtered.map((a, i) => {
          const isUpcoming = d(a.dateTo) >= today();
          const part = a.dayPart === 'AM' ? ' · AM' : a.dayPart === 'PM' ? ' · PM' : a.dayPart === 'HOURS' ? ' · godz.' : '';
          if (edit && edit.id === a.id) {
            return (
              <div key={a.id} role="row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <select style={field} aria-label="Typ nieobecności" value={edit.typeId} onChange={(e) => setEdit({ ...edit, typeId: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <input type="date" style={field} aria-label="Data od" value={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateFrom: e.target.value })} />
                <input type="date" style={field} aria-label="Data do" value={edit.dateTo} min={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateTo: e.target.value })} />
                <button type="button" onClick={saveEdit} disabled={busy || edit.dateTo < edit.dateFrom} style={{ ...field, cursor: 'pointer', color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
                <button type="button" onClick={() => setEdit(null)} style={{ ...field, cursor: 'pointer' }}>Anuluj</button>
              </div>
            );
          }
          return (
            <div key={a.id} role="row" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '15px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              <div role="rowheader" style={{ fontWeight: 600, color: 'var(--ink)' }}>{rangeLabel(a)}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>{part}</span></div>
              <div role="cell" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{workdays(a.workingDays)}</div>
              <div role="cell" style={{ color: 'var(--ink-2)' }}>
                {a.type.name}
                {a.type.specialCategory && <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 5, marginLeft: 6 }}>widoczne tylko dla Ciebie</span>}
              </div>
              <div role="cell" style={{ color: 'var(--muted)', fontSize: 12.5 }}>{a.source === 'DELEGATE' ? 'W imieniu' : 'Samodzielny'}</div>
              <div role="cell">
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 7, color: isUpcoming ? 'var(--blue)' : 'var(--muted)', background: isUpcoming ? 'var(--blue-tint)' : 'var(--surface-3)' }}>{isUpcoming ? 'Zaplanowane' : 'Zrealizowane'}</span>
              </div>
              <div role="cell" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {isUpcoming && <>
                  <button type="button" disabled={busy} aria-label={`Edytuj nieobecność ${rangeLabel(a)}`} onClick={() => setEdit({ id: a.id, typeId: a.type.id, dateFrom: d(a.dateFrom), dateTo: d(a.dateTo) })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Edytuj</button>
                  <button type="button" disabled={busy} aria-label={`Wycofaj nieobecność ${rangeLabel(a)}`} onClick={() => setConfirmDel(a)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--danger)' }}>Wycofaj</button>
                </>}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog open={!!confirmDel} title="Wycofać nieobecność?" confirmLabel="Wycofaj wpis" danger busy={busy}
        onConfirm={remove} onCancel={() => setConfirmDel(null)}>
        <p style={{ margin: 0 }}>
          Wpis <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{confirmDel ? rangeLabel(confirmDel) : ''}</b>
          {confirmDel ? ` (${workdays(confirmDel.workingDays)} dni roboczych)` : ''} zniknie z kalendarza zespołu, a dni wrócą do Twojej puli.
        </p>
        <p style={{ margin: '10px 0 0' }}>Po usunięciu przez chwilę będzie można cofnąć tę operację.</p>
      </ConfirmDialog>
    </div>
  );
}
