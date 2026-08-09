import { useEffect, useState } from 'react';
import { count, plural } from '@nieobecnosci/core/plural';
import { dateRange, todayIso } from '../format';
import { api, type Absence, type AbsenceType, type Employee } from '../api';
import { Button } from '../design-system/components/core/Button';
import { ConfirmDialog, Field, Section, Notice, field, th, td, useNotice } from '../admin/ui';
import { cardClipped } from '../design-system/surfaces';


// Zakres szedł dotąd w surowym ISO („2026-08-03 – 2026-08-05") — jedyny ekran korygujący
// cudze wpisy pokazywał daty inaczej niż wszystkie pozostałe.
const range = (a: Absence) => dateRange(a.dateFrom, a.dateTo, { long: true });

// FR-A5 — lider/uprawniony koryguje nieobecności swojego zespołu. Typy są zamaskowane na serwerze,
// gdy brak uprawnienia VIEW_L4 (L4 niewyróżniane) — tu prezentujemy je jednolicie. Każda zmiana jest audytowana.
export function Zespol() {
  const [team, setTeam] = useState<Employee[]>([]);
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [memberId, setMemberId] = useState('');
  const [rows, setRows] = useState<Absence[]>([]);
  const { notice, ok, fail, clear } = useNotice();
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ id: string; from: string; to: string } | null>(null);
  const [add, setAdd] = useState({ typeId: '', dayPart: 'FULL', from: todayIso(), to: todayIso() });
  const [confirmDel, setConfirmDel] = useState<Absence | null>(null);
  // FR-A10 — operacje masowe
  const [bulkSel, setBulkSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ typeId: '', dayPart: 'FULL', from: todayIso(), to: todayIso() });
  const bulkNotice = useNotice();

  // do dodania „w imieniu" wybieramy tylko typy zwykłe — L4 jest domeną uprawnienia VIEW_L4/konwersji (FR-B10).
  const addable = types.filter((t) => !t.specialCategory);
  const nameOf = (id: string) => { const e = team.find((t) => t.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  useEffect(() => {
    api.myTeam().then(setTeam).catch(() => setTeam([]));
    api.types().then((t) => {
      setTypes(t);
      const def = t.find((x) => !x.specialCategory)?.id ?? '';
      setAdd((a) => ({ ...a, typeId: def })); setBulk((b) => ({ ...b, typeId: def }));
    });
  }, []);

  // Pusta tabela ogłaszała „Ta osoba nie ma zapisanych nieobecności", zanim cokolwiek przyszło
  // z serwera — zdanie fałszywe dla każdego, kto jakieś ma, i to na ekranie, na którym lider
  // decyduje o cudzych wpisach.
  const [rowsLoading, setRowsLoading] = useState(false);
  const load = (id: string) => {
    if (!id) return Promise.resolve();
    setRowsLoading(true);
    return api.absences(id).then(setRows).catch((e) => { setRows([]); fail(e); }).finally(() => setRowsLoading(false));
  };
  useEffect(() => { setEdit(null); clear(); load(memberId); }, [memberId]);

  const partial = add.dayPart !== 'FULL';
  const addTo = partial ? add.from : add.to;
  const badRange = !partial && add.to < add.from;

  // Każdy zapis blokuje przyciski na czas trwania — dwuklik tworzyłby dwa wpisy w cudzym imieniu.
  const guard = async (fn: () => Promise<string>) => {
    if (busy) return;
    setBusy(true); clear();
    try { ok(await fn()); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const saveAdd = () => {
    if (!memberId || !add.typeId) return;
    void guard(async () => {
      await api.createAbsence({ employeeId: memberId, typeId: add.typeId, dateFrom: add.from, dateTo: addTo, dayPart: add.dayPart });
      await load(memberId);
      return `Dodano nieobecność w imieniu: ${nameOf(memberId)}. Zmiana jest odnotowana w audycie.`;
    });
  };
  const saveEdit = () => {
    if (!edit) return;
    void guard(async () => {
      await api.updateAbsence(edit.id, { dateFrom: edit.from, dateTo: edit.to });
      setEdit(null);
      await load(memberId);
      return 'Skorygowano termin.';
    });
  };
  const del = () => {
    const a = confirmDel;
    if (!a) return;
    void guard(async () => {
      await api.deleteAbsence(a.id);
      setConfirmDel(null);
      await load(memberId);
      return `Usunięto nieobecność ${range(a)}.`;
    });
  };

  // FR-A10 — masowe dodanie jednej nieobecności wielu zaznaczonym osobom (RBAC/walidacja per osoba na serwerze).
  const bulkPartial = bulk.dayPart !== 'FULL';
  const bulkTo = bulkPartial ? bulk.from : bulk.to;
  const toggleBulk = (id: string) => setBulkSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = team.length > 0 && bulkSel.size === team.length;
  const saveBulk = async () => {
    if (bulkSel.size === 0 || !bulk.typeId || busy) return;
    setBusy(true);
    bulkNotice.clear();
    try {
      const r = await api.bulkCreateAbsences({ employeeIds: [...bulkSel], typeId: bulk.typeId, dateFrom: bulk.from, dateTo: bulkTo, dayPart: bulk.dayPart });
      const errTxt = r.errors.length ? ` Pominięto: ${r.errors.map((e) => `${nameOf(e.employeeId)} (${e.message})`).join('; ')}` : '';
      const head = `Dodano dla ${r.created} ${plural(r.created, ['osoby', 'osób', 'osób'])}.`;
      // Częściowe niepowodzenie nie jest sukcesem — inaczej pominięte osoby giną w zielonym komunikacie.
      if (r.errors.length) bulkNotice.fail(new Error(`${head}${errTxt}`));
      else bulkNotice.ok(head);
      setBulkSel(new Set());
      if (memberId) await load(memberId);
    } catch (e) { bulkNotice.fail(e); } finally { setBusy(false); }
  };

  // Minimum 24 px wysokości celu wskaźnika (WCAG 2.5.8) — te przyciski usuwają cudze wpisy.
  const btn = { ...field, cursor: 'pointer', fontSize: 12, padding: '5px 10px', minHeight: 24, boxSizing: 'border-box' as const } as const;

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
        {team.length === 0 && <Notice text="Nie widzisz tu nikogo — Twój zespół jest pusty albo nie masz uprawnienia do korygowania cudzych wpisów. Struktura zespołu jest ustawiana w Konfiguracji przez administratora." />}
      </Section>

      {memberId && (
        <>
          <div style={{ ...cardClipped, marginBottom: 18 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <caption style={{ ...td, textAlign: 'left', color: 'var(--muted)', fontSize: 12.5, borderBottom: 'none' }}>Nieobecności: {nameOf(memberId)}</caption>
              <thead><tr><th scope="col" style={th}>Termin</th><th scope="col" style={th}>Typ</th><th scope="col" style={{ ...th, textAlign: 'right' }}>Akcje</th></tr></thead>
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
                          <button type="button" onClick={saveEdit} disabled={busy || edit.to < edit.from} style={{ ...btn, marginRight: 6, color: 'var(--brand)' }}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
                          <button type="button" onClick={() => setEdit(null)} style={btn}>Anuluj</button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={busy} aria-label={`Edytuj termin ${range(a)}`} onClick={() => setEdit({ id: a.id, from: a.dateFrom, to: a.dateTo })} style={{ ...btn, marginRight: 6 }}>Edytuj termin</button>
                          <button type="button" disabled={busy} aria-label={`Usuń nieobecność ${range(a)}`} onClick={() => setConfirmDel(a)} style={{ ...btn, color: 'var(--danger)' }}>Usuń</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {rowsLoading && <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={3}>Wczytywanie nieobecności…</td></tr>}
                {!rowsLoading && rows.length === 0 && <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={3}>Ta osoba nie ma zapisanych nieobecności. Dodaj pierwszą w sekcji poniżej.</td></tr>}
              </tbody>
            </table>
          </div>

          <Section title="Dodaj nieobecność w imieniu pracownika">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <Field label="Typ">
                <select style={field} value={add.typeId} onChange={(e) => setAdd((a) => ({ ...a, typeId: e.target.value }))}>
                  {addable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Wymiar dnia">
                <select style={field} value={add.dayPart} onChange={(e) => setAdd((a) => ({ ...a, dayPart: e.target.value }))}>
                  <option value="FULL">Cały dzień</option>
                  <option value="AM">Przedpołudnie (½)</option>
                  <option value="PM">Popołudnie (½)</option>
                </select>
              </Field>
              <Field label={partial ? 'Data' : 'Data od'} width={170}>
                <input type="date" style={field} value={add.from} onChange={(e) => setAdd((a) => ({ ...a, from: e.target.value }))} />
              </Field>
              <Field label="Data do" width={170}>
                <input type="date" style={{ ...field, opacity: partial ? 0.5 : 1 }} value={addTo} min={add.from} disabled={partial}
                  aria-invalid={badRange || undefined} onChange={(e) => setAdd((a) => ({ ...a, to: e.target.value }))} />
              </Field>
              <Button onClick={saveAdd} disabled={!add.typeId || badRange || busy}>{busy ? 'Dodawanie…' : 'Dodaj'}</Button>
            </div>
            {badRange && <Notice text={'Data „do" jest wcześniejsza niż „od".'} tone="error" />}
          </Section>
        </>
      )}
      <Notice {...notice} />

      <ConfirmDialog open={!!confirmDel} title="Usunąć nieobecność?" confirmLabel="Usuń wpis" danger busy={busy}
        onConfirm={del} onCancel={() => setConfirmDel(null)}>
        <p style={{ margin: 0 }}>
          Wpis <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{confirmDel ? range(confirmDel) : ''}</b> zostanie
          usunięty, a dni wrócą do puli pracownika. Usunięcie jest odnotowane w audycie.
        </p>
      </ConfirmDialog>

      {team.length > 0 && (
        <Section title="Operacje masowe — dodaj nieobecność wielu osobom">
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
            <legend style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: 0, marginBottom: 8 }}>
              Osoby ({bulkSel.size} z {team.length} zaznaczonych)
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                <input type="checkbox" checked={allSel} onChange={() => setBulkSel(allSel ? new Set() : new Set(team.map((e) => e.id)))} /> Zaznacz wszystkich
              </label>
              {team.map((e) => (
                <label key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>
                  <input type="checkbox" checked={bulkSel.has(e.id)} onChange={() => toggleBulk(e.id)} /> {e.firstName} {e.lastName}
                </label>
              ))}
            </div>
          </fieldset>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <Field label="Typ">
              <select style={field} value={bulk.typeId} onChange={(e) => setBulk((b) => ({ ...b, typeId: e.target.value }))}>
                {addable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Wymiar dnia">
              <select style={field} value={bulk.dayPart} onChange={(e) => setBulk((b) => ({ ...b, dayPart: e.target.value }))}>
                <option value="FULL">Cały dzień</option>
                <option value="AM">Przedpołudnie (½)</option>
                <option value="PM">Popołudnie (½)</option>
              </select>
            </Field>
            <Field label={bulkPartial ? 'Data' : 'Data od'} width={170}>
              <input type="date" style={field} value={bulk.from} onChange={(e) => setBulk((b) => ({ ...b, from: e.target.value }))} />
            </Field>
            <Field label="Data do" width={170}>
              <input type="date" style={{ ...field, opacity: bulkPartial ? 0.5 : 1 }} value={bulkTo} min={bulk.from} disabled={bulkPartial} onChange={(e) => setBulk((b) => ({ ...b, to: e.target.value }))} />
            </Field>
            <Button onClick={saveBulk} disabled={bulkSel.size === 0 || !bulk.typeId || busy}>
              {busy ? 'Dodawanie…' : `Dodaj ${count(bulkSel.size, ['zaznaczonej osobie', 'zaznaczonym osobom', 'zaznaczonym osobom'])}`}
            </Button>
          </div>
          <Notice {...bulkNotice.notice} />
        </Section>
      )}
    </div>
  );
}
