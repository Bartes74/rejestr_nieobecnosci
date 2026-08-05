import { useEffect, useState } from 'react';
import { api, type Absence, type AbsenceType, type Employee } from '../api';
import { Button } from '../design-system/components/core/Button';
import { Section, Notice, field, th, td } from '../admin/ui';

const today = () => new Date().toISOString().slice(0, 10);
const range = (a: Absence) => (a.dateFrom.slice(0, 10) === a.dateTo.slice(0, 10) ? a.dateFrom.slice(0, 10) : `${a.dateFrom.slice(0, 10)} – ${a.dateTo.slice(0, 10)}`);

// FR-A5 — lider/uprawniony koryguje nieobecności swojego zespołu. Typy są zamaskowane na serwerze,
// gdy brak uprawnienia VIEW_L4 (L4 niewyróżniane) — tu prezentujemy je jednolicie. Każda zmiana jest audytowana.
export function Zespol() {
  const [team, setTeam] = useState<Employee[]>([]);
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [memberId, setMemberId] = useState('');
  const [rows, setRows] = useState<Absence[]>([]);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<{ id: string; from: string; to: string } | null>(null);
  const [add, setAdd] = useState({ typeId: '', dayPart: 'FULL', from: today(), to: today() });
  // FR-A10 — operacje masowe
  const [bulkSel, setBulkSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ typeId: '', dayPart: 'FULL', from: today(), to: today() });
  const [bulkMsg, setBulkMsg] = useState('');

  // do dodania „w imieniu" wybieramy tylko typy zwykłe — L4 jest domeną uprawnienia VIEW_L4/konwersji (FR-B10).
  const addable = types.filter((t) => !t.specialCategory);

  useEffect(() => {
    api.myTeam().then(setTeam).catch(() => setTeam([]));
    api.types().then((t) => {
      setTypes(t);
      const def = t.find((x) => !x.specialCategory)?.id ?? '';
      setAdd((a) => ({ ...a, typeId: def })); setBulk((b) => ({ ...b, typeId: def }));
    });
  }, []);

  const load = (id: string) => { if (id) api.absences(id).then(setRows).catch((e) => { setRows([]); setMsg((e as Error).message); }); };
  useEffect(() => { setEdit(null); setMsg(''); load(memberId); }, [memberId]);

  const partial = add.dayPart !== 'FULL';
  const addTo = partial ? add.from : add.to;

  const saveAdd = async () => {
    if (!memberId || !add.typeId) return;
    setMsg('');
    try {
      await api.createAbsence({ employeeId: memberId, typeId: add.typeId, dateFrom: add.from, dateTo: addTo, dayPart: add.dayPart });
      setMsg('Dodano nieobecność (zapisano w imieniu pracownika).');
      load(memberId);
    } catch (e) { setMsg((e as Error).message); }
  };
  const saveEdit = async () => {
    if (!edit) return;
    setMsg('');
    try { await api.updateAbsence(edit.id, { dateFrom: edit.from, dateTo: edit.to }); setEdit(null); setMsg('Skorygowano termin.'); load(memberId); }
    catch (e) { setMsg((e as Error).message); }
  };
  const del = async (a: Absence) => {
    if (!window.confirm(`Usunąć nieobecność ${range(a)}?`)) return;
    setMsg('');
    try { await api.deleteAbsence(a.id); setMsg('Usunięto nieobecność.'); load(memberId); }
    catch (e) { setMsg((e as Error).message); }
  };

  // FR-A10 — masowe dodanie jednej nieobecności wielu zaznaczonym osobom (RBAC/walidacja per osoba na serwerze).
  const bulkPartial = bulk.dayPart !== 'FULL';
  const bulkTo = bulkPartial ? bulk.from : bulk.to;
  const toggleBulk = (id: string) => setBulkSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = team.length > 0 && bulkSel.size === team.length;
  const nameOf = (id: string) => { const e = team.find((t) => t.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const saveBulk = async () => {
    if (bulkSel.size === 0 || !bulk.typeId) return;
    setBulkMsg('');
    try {
      const r = await api.bulkCreateAbsences({ employeeIds: [...bulkSel], typeId: bulk.typeId, dateFrom: bulk.from, dateTo: bulkTo, dayPart: bulk.dayPart });
      const errTxt = r.errors.length ? ` Pominięto: ${r.errors.map((e) => `${nameOf(e.employeeId)} (${e.message})`).join('; ')}` : '';
      setBulkMsg(`Dodano dla ${r.created} ${r.created === 1 ? 'osoby' : 'osób'}.${errTxt}`);
      setBulkSel(new Set());
      if (memberId) load(memberId);
    } catch (e) { setBulkMsg((e as Error).message); }
  };

  const btn = { ...field, cursor: 'pointer', fontSize: 12, padding: '4px 10px' } as const;

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
        Korekta nieobecności członków zespołu. Zmiany zapisywane są w imieniu pracownika i odnotowane w audycie.
      </p>

      <Section title="Wybierz pracownika">
        <select aria-label="Pracownik zespołu" style={{ ...field, minWidth: 260 }} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">— wybierz —</option>
          {team.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        {team.length === 0 && <Notice text="Brak osób w Twoim zespole (lub brak uprawnień do zarządzania nieobecnościami)." />}
      </Section>

      {memberId && (
        <>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 18 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Termin</th><th style={th}>Typ</th><th style={{ ...th, textAlign: 'right' }}>Akcje</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td style={td}>
                      {edit?.id === a.id ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <input type="date" aria-label="Od" style={{ ...field, fontSize: 12, padding: '4px 8px' }} value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} />
                          <input type="date" aria-label="Do" style={{ ...field, fontSize: 12, padding: '4px 8px' }} value={edit.to} min={edit.from} onChange={(e) => setEdit({ ...edit, to: e.target.value })} />
                        </span>
                      ) : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{range(a)}</span>}
                    </td>
                    <td style={td}>{a.type?.name ?? 'Nieobecność'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {edit?.id === a.id ? (
                        <>
                          <button type="button" onClick={saveEdit} style={{ ...btn, marginRight: 6, color: 'var(--brand)' }}>Zapisz</button>
                          <button type="button" onClick={() => setEdit(null)} style={btn}>Anuluj</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => setEdit({ id: a.id, from: a.dateFrom.slice(0, 10), to: a.dateTo.slice(0, 10) })} style={{ ...btn, marginRight: 6 }}>Edytuj termin</button>
                          <button type="button" onClick={() => del(a)} style={{ ...btn, color: 'var(--danger)' }}>Usuń</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={3}>Brak nieobecności.</td></tr>}
              </tbody>
            </table>
          </div>

          <Section title="Dodaj nieobecność w imieniu pracownika">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select aria-label="Typ" style={field} value={add.typeId} onChange={(e) => setAdd((a) => ({ ...a, typeId: e.target.value }))}>
                {addable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select aria-label="Wymiar" style={field} value={add.dayPart} onChange={(e) => setAdd((a) => ({ ...a, dayPart: e.target.value }))}>
                <option value="FULL">Cały dzień</option>
                <option value="AM">Przedpołudnie (½)</option>
                <option value="PM">Popołudnie (½)</option>
              </select>
              <input type="date" aria-label={partial ? 'Data' : 'Od'} style={field} value={add.from} onChange={(e) => setAdd((a) => ({ ...a, from: e.target.value }))} />
              <input type="date" aria-label="Do" style={{ ...field, opacity: partial ? 0.5 : 1 }} value={addTo} min={add.from} disabled={partial} onChange={(e) => setAdd((a) => ({ ...a, to: e.target.value }))} />
              <Button onClick={saveAdd} disabled={!add.typeId}>Dodaj</Button>
            </div>
          </Section>
        </>
      )}
      <Notice text={msg} />

      {team.length > 0 && (
        <Section title="Operacje masowe — dodaj nieobecność wielu osobom">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              <input type="checkbox" checked={allSel} onChange={() => setBulkSel(allSel ? new Set() : new Set(team.map((e) => e.id)))} /> Zaznacz wszystkich
            </label>
            {team.map((e) => (
              <label key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>
                <input type="checkbox" checked={bulkSel.has(e.id)} onChange={() => toggleBulk(e.id)} /> {e.firstName} {e.lastName}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <select aria-label="Typ (masowo)" style={field} value={bulk.typeId} onChange={(e) => setBulk((b) => ({ ...b, typeId: e.target.value }))}>
              {addable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select aria-label="Wymiar (masowo)" style={field} value={bulk.dayPart} onChange={(e) => setBulk((b) => ({ ...b, dayPart: e.target.value }))}>
              <option value="FULL">Cały dzień</option>
              <option value="AM">Przedpołudnie (½)</option>
              <option value="PM">Popołudnie (½)</option>
            </select>
            <input type="date" aria-label={bulkPartial ? 'Data (masowo)' : 'Od (masowo)'} style={field} value={bulk.from} onChange={(e) => setBulk((b) => ({ ...b, from: e.target.value }))} />
            <input type="date" aria-label="Do (masowo)" style={{ ...field, opacity: bulkPartial ? 0.5 : 1 }} value={bulkTo} min={bulk.from} disabled={bulkPartial} onChange={(e) => setBulk((b) => ({ ...b, to: e.target.value }))} />
            <Button onClick={saveBulk} disabled={bulkSel.size === 0 || !bulk.typeId}>Dodaj zaznaczonym ({bulkSel.size})</Button>
          </div>
          <Notice text={bulkMsg} />
        </Section>
      )}
    </div>
  );
}
