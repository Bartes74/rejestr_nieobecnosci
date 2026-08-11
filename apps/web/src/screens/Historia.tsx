import { useEffect, useMemo, useState } from 'react';
import { plural } from '@nieobecnosci/core/plural';
import { dateRange, todayIso } from '../format';
import { api, type Absence, type AbsenceType } from '../api';
import { useAuth } from '../current-employee';
import { ConfirmDialog, DAY_PARTS, Notice, field, useNotice } from '../admin/ui';
import { cardClipped } from '../design-system/surfaces';
import { SegmentedControl } from '../design-system/components/forms/SegmentedControl';


const COLS = '1.6fr .6fr 1.6fr 1.1fr 1fr .9fr';


// Dni robocze liczy serwer (z kalendarzem świąt osoby) — ta sama liczba, którą widzi balans.
const workdays = (n: number) => String(n).replace('.', ','); // ułamki po polsku (0,5)
const rangeLabel = (a: Absence) => dateRange(a.dateFrom, a.dateTo, { long: true });

export function Historia() {
  const { current } = useAuth();
  const [rows, setRows] = useState<Absence[]>([]);
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [undo, setUndo] = useState<Absence | null>(null);
  // Wymiar dnia i godziny w edycji, bo bez nich błędnie wpisanego zakresu godzinowego nie dało
  // się poprawić — trzeba było usunąć wpis i utworzyć go od nowa.
  const [edit, setEdit] = useState<{ id: string; typeId: string; dateFrom: string; dateTo: string; dayPart: string; hourFrom: string; hourTo: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Absence | null>(null);
  const { notice, fail, busy, run } = useNotice();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'done'>('all');
  // Bez tego stanu pusta tabela w trakcie wczytywania ogłaszała „Nie masz jeszcze żadnych wpisów"
  // — zdanie fałszywe dla każdego, kto jakieś ma.
  const [loaded, setLoaded] = useState(false);

  const load = () => { if (current) api.absences(current.id).then(setRows).catch(fail).finally(() => setLoaded(true)); };
  useEffect(load, [current?.id]);
  useEffect(() => { api.types().then(setTypes).catch(() => {}); }, []);

  const remove = () => {
    const a = confirmDel;
    if (!a) return;
    void run(async () => { await api.deleteAbsence(a.id); setConfirmDel(null); setUndo(a); load(); });
  };
  const doUndo = () => {
    if (!undo || !current) return;
    const a = undo;
    void run(async () => {
      await api.createAbsence({ employeeId: current.id, typeId: a.type.id, dateFrom: a.dateFrom, dateTo: a.dateTo, dayPart: a.dayPart, hourFrom: a.hourFrom ?? undefined, hourTo: a.hourTo ?? undefined });
      setUndo(null); load();
    });
  };
  // Niepełny dzień dotyczy pojedynczej daty (FR-A3), a zakres godzin musi być rosnący —
  // te same reguły co w formularzu nowego wpisu. Serwer sprawdza je niezależnie.
  const editPartial = !!edit && edit.dayPart !== 'FULL';
  const editTo = editPartial ? edit!.dateFrom : edit?.dateTo ?? '';
  const editBadHours = !!edit && edit.dayPart === 'HOURS' && edit.hourTo <= edit.hourFrom;
  const editBadRange = !!edit && !editPartial && editTo < edit.dateFrom;

  const saveEdit = () => {
    if (!edit || editBadHours || editBadRange) return;
    void run(async () => {
      await api.updateAbsence(edit.id, {
        typeId: edit.typeId, dateFrom: edit.dateFrom, dateTo: editTo, dayPart: edit.dayPart,
        ...(edit.dayPart === 'HOURS' ? { hourFrom: edit.hourFrom, hourTo: edit.hourTo } : {}),
      });
      setEdit(null); load();
    });
  };

  const filtered = useMemo(() => {
    const t = todayIso();
    const sorted = [...rows].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
    if (filter === 'upcoming') return sorted.filter((a) => a.dateTo >= t);
    if (filter === 'done') return sorted.filter((a) => a.dateTo < t);
    return sorted;
  }, [rows, filter]);

  // Nagłówek kolumny wg DESIGN.md (mono 10,5 WERSALIKI). Wersaliki robi CSS, nie treść —
  // czytnik ekranu ma usłyszeć „zakres", a nie literowane „Z-A-K-R-E-S".
  const hcell = { fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' } as const;

  return (
    <div style={{ maxWidth: 1080 }}>
      <div role="status" aria-live="polite">
        {undo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', flex: 1 }}>Usunięto wpis {rangeLabel(undo)}. Dni wróciły do puli.</span>
            <button type="button" className="ds-quiet" onClick={doUndo} disabled={busy} style={{ ...field, cursor: 'pointer', color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}>{busy ? 'Przywracanie…' : 'Cofnij'}</button>
            <button type="button" className="ds-quiet" onClick={() => setUndo(null)} aria-label="Zamknij komunikat" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 8, margin: -8, borderRadius: 'var(--radius-sm)' }}>×</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        <SegmentedControl label="Filtr wpisów" value={filter} onChange={(v) => setFilter(v as typeof filter)}
          options={[{ value: 'all', label: 'Wszystkie' }, { value: 'upcoming', label: 'Nadchodzące' }, { value: 'done', label: 'Zrealizowane' }]} />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{new Date().getFullYear()} · rok rozliczeniowy</span>
      </div>
      <Notice {...notice} />

      <div role="table" aria-label="Moje nieobecności" style={{ ...cardClipped, marginTop: 12 }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div role="columnheader" style={hcell}>Zakres</div><div role="columnheader" style={hcell}>Dni</div><div role="columnheader" style={hcell}>Typ</div><div role="columnheader" style={hcell}>Źródło</div><div role="columnheader" style={hcell}>Status</div><div role="columnheader" style={hcell}><span className="ds-sr">Akcje</span></div>
        </div>
        {!loaded && <div role="row"><div role="cell" style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Wczytywanie wpisów…</div></div>}
        {loaded && filtered.length === 0 && (
          <div role="row"><div role="cell" style={{ padding: 20, color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>
            {rows.length === 0 ? 'Nie masz jeszcze żadnych wpisów. Zaplanuj pierwszą nieobecność w „Nowa nieobecność".'
              : filter === 'upcoming' ? 'Brak nadchodzących nieobecności.' : 'Brak zrealizowanych nieobecności w tym okresie.'}
          </div></div>
        )}
        {filtered.map((a, i) => {
          const isUpcoming = a.dateTo >= todayIso();
          const part = a.dayPart === 'AM' ? ' · AM' : a.dayPart === 'PM' ? ' · PM' : a.dayPart === 'HOURS' ? ' · godz.' : '';
          if (edit && edit.id === a.id) {
            return (
              <div key={a.id} role="row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <select style={field} aria-label="Typ nieobecności" value={edit.typeId} onChange={(e) => setEdit({ ...edit, typeId: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <input type="date" style={field} aria-label="Data od" value={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateFrom: e.target.value })} />
                {/* Przy niepełnym dniu data „do" znika zamiast być wyszarzona: pole, które i tak
                    nic nie zmienia, tylko każe się zastanawiać, dlaczego nie działa. */}
                {!editPartial && <input type="date" style={field} aria-label="Data do" value={edit.dateTo} min={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateTo: e.target.value })} />}
                <select style={field} aria-label="Wymiar dnia" value={edit.dayPart} onChange={(e) => setEdit({ ...edit, dayPart: e.target.value })}>
                  {DAY_PARTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {edit.dayPart === 'HOURS' && <>
                  <input type="time" style={field} aria-label="Od godziny" value={edit.hourFrom} onChange={(e) => setEdit({ ...edit, hourFrom: e.target.value })} />
                  <input type="time" style={field} aria-label="Do godziny" aria-invalid={editBadHours || undefined} value={edit.hourTo} onChange={(e) => setEdit({ ...edit, hourTo: e.target.value })} />
                </>}
                {editBadHours && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--danger)' }}>Godzina „do" musi być późniejsza niż „od".</span>}
                <button type="button" className="ds-quiet" onClick={saveEdit} disabled={busy || editBadRange || editBadHours} style={{ ...field, cursor: 'pointer', color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
                <button type="button" className="ds-quiet" onClick={() => setEdit(null)} style={{ ...field, cursor: 'pointer' }}>Anuluj</button>
              </div>
            );
          }
          return (
            <div key={a.id} role="row" className="ds-row" style={{ display: 'grid', gridTemplateColumns: COLS, padding: '15px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              <div role="rowheader" style={{ fontWeight: 600, color: 'var(--ink)' }}>{rangeLabel(a)}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>{part}</span></div>
              <div role="cell" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>{workdays(a.workingDays)}</div>
              <div role="cell" style={{ color: 'var(--ink-2)' }}>
                {a.type.name}
                {a.type.specialCategory && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', marginLeft: 6 }}>widoczne tylko dla Ciebie</span>}
              </div>
              <div role="cell" style={{ color: 'var(--muted)', fontSize: 12.5 }}>{a.source === 'DELEGATE' ? 'W imieniu' : 'Samodzielny'}</div>
              <div role="cell">
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--radius-sm)', color: isUpcoming ? 'var(--blue)' : 'var(--muted)', background: isUpcoming ? 'var(--blue-tint)' : 'var(--surface-3)' }}>{isUpcoming ? 'Zaplanowane' : 'Zrealizowane'}</span>
              </div>
              <div role="cell" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {isUpcoming && <>
                  <button type="button" className="ds-quiet" disabled={busy} aria-label={`Edytuj nieobecność ${rangeLabel(a)}`} onClick={() => setEdit({ id: a.id, typeId: a.type.id, dateFrom: a.dateFrom, dateTo: a.dateTo, dayPart: a.dayPart, hourFrom: a.hourFrom ?? '09:00', hourTo: a.hourTo ?? '13:00' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', padding: '5px 7px', minHeight: 24, boxSizing: 'border-box', margin: '-5px -3px', borderRadius: 'var(--radius-sm)' }}>Edytuj</button>
                  <button type="button" className="ds-danger" disabled={busy} aria-label={`Wycofaj nieobecność ${rangeLabel(a)}`} onClick={() => setConfirmDel(a)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', padding: '5px 7px', minHeight: 24, boxSizing: 'border-box', margin: '-5px -7px', borderRadius: 'var(--radius-sm)' }}>Wycofaj</button>
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
          {confirmDel ? ` (${workdays(confirmDel.workingDays)} ${plural(confirmDel.workingDays, ['dzień roboczy', 'dni robocze', 'dni roboczych'])})` : ''} zniknie z kalendarza zespołu, a dni wrócą do Twojej puli.
        </p>
        {/* Cofnięcie nie wygasa samo — komunikat czeka, aż zamkniesz go albo opuścisz ekran.
            Wcześniejsze „przez chwilę" obiecywało licznik, którego nie ma. */}
        <p style={{ margin: '10px 0 0' }}>Zaraz po usunięciu pojawi się nad tabelą przycisk „Cofnij" — będzie tam, dopóki nie zamkniesz komunikatu.</p>
      </ConfirmDialog>
    </div>
  );
}
