import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { dateRange } from './format';
import { api, type CalEntry, type Employee } from './api';
import { AbsencePill } from './design-system/components/data/AbsencePill';

const HORIZON_DAYS = 60;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const range = (e: CalEntry) => dateRange(e.dateFrom, e.dateTo);

/**
 * Wyszukiwarka osób w topbarze. Odpowiada na pytanie, które faktycznie zadaje ktoś wpisujący
 * nazwisko: „kiedy ta osoba jest nieobecna?".
 *
 * Oba źródła są już autoryzowane i zawężone po stronie serwera: `/employees` zwraca
 * nieuprawnionym wyłącznie ich Tribe w minimalnym zestawie pól (FR-H1, minimalizacja danych),
 * a `/calendar` oddaje nieobecności bez typu i bez znacznika L4 (D1/D2). Wyszukiwarka nie
 * poszerza więc niczyjej widoczności — pokazuje to samo, co kalendarz zespołu, tylko szybciej.
 *
 * Horyzont jest świadomie skończony (60 dni) i napisany w podpowiedzi, żeby brak wyniku
 * nie sugerował, że ktoś nie ma urlopu — tylko że nie ma go w tym oknie.
 */
export function TopSearch() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<CalEntry[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const from = new Date();
    const to = new Date(from.getTime() + HORIZON_DAYS * 86_400_000);
    api.employees().then(setPeople).catch(() => setPeople([]));
    api.calendar(iso(from), iso(to)).then(setEntries).catch(() => setEntries([]));
  }, []);

  const byPerson = useMemo(() => {
    const m = new Map<string, CalEntry[]>();
    for (const e of entries) m.set(e.employeeId, [...(m.get(e.employeeId) ?? []), e]);
    return m;
  }, [entries]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return people
      .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [people, q]);

  useEffect(() => setActive(0), [q]);

  // Zamknięcie kliknięciem poza kontrolką; z klawiatury robi to Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Wybór osoby prowadzi do pełnego kalendarza zespołu — lista wyników odpowiada „kiedy",
  // kalendarz pokazuje to w kontekście reszty zespołu.
  const choose = () => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    navigate('/kalendarz');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) choose(); }
  };

  const showList = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: '0 1 260px', minWidth: 44 }}>
      {/* Etykieta zamiast diva — klikalna jest cała ramka, nie sama linijka tekstu w środku. */}
      <label className="ds-field" style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '8px 12px', background: 'var(--surface)' }}>
        <Search size={16} color="var(--muted)" style={{ flex: 'none' }} aria-hidden="true" />
        <input
          ref={inputRef} role="combobox" aria-expanded={showList} aria-controls="topsearch-list"
          aria-autocomplete="list" aria-activedescendant={showList && matches[active] ? `topsearch-${matches[active].id}` : undefined}
          aria-label={`Szukaj osoby w zespole — pokaże nieobecności z najbliższych ${HORIZON_DAYS} dni`}
          value={q} placeholder="Szukaj osoby…" autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 13 }}
        />
      </label>

      {showList && (
        <div id="topsearch-list" role="listbox" aria-label="Wyniki wyszukiwania"
          style={{ position: 'absolute', top: 44, right: 0, left: 0, minWidth: 300, maxHeight: 'min(60vh, 380px)', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', zIndex: 20 }}>
          {matches.length === 0 && (
            <div style={{ padding: '14px 14px', fontFamily: 'var(--font-sans)', fontSize: 12.8, color: 'var(--muted)', lineHeight: 1.45 }}>
              Nikt o tej nazwie nie jest widoczny w Twoim zespole.
            </div>
          )}
          {matches.map((p, i) => {
            const away = byPerson.get(p.id) ?? [];
            return (
              <button key={p.id} id={`topsearch-${p.id}`} type="button" role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)} onClick={choose}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '10px 14px', background: i === active ? 'var(--surface-2)' : 'transparent',
                  borderTop: i ? '1px solid var(--border)' : 'none',
                }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                  {p.firstName} {p.lastName}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: away.length ? 6 : 3 }}>
                  {away.length === 0
                    ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)' }}>Brak nieobecności w najbliższych {HORIZON_DAYS} dniach</span>
                    : away.slice(0, 4).map((e, k) => <AbsencePill key={k}>{range(e)}</AbsencePill>)}
                  {away.length > 4 && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center' }}>+{away.length - 4}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
