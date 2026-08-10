import { useEffect, useMemo, useState } from 'react';
import { TriangleAlert, Zap } from 'lucide-react';
import { count } from '@nieobecnosci/core/plural';
import { dateRange } from '../format';
import { api, type CapacityCell, type OrgUnit, type Sprint } from '../api';
import { card } from '../design-system/surfaces';
import { ProgressBar } from '../design-system/components/data/ProgressBar';

const select = { padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14 } as const;

// próg dostępności → kolor (jak w prototypie: zielony OK, bursztyn uwaga, czerwony ryzyko)
const availColor = (pct: number) => (pct >= 80 ? 'var(--brand)' : pct >= 60 ? 'var(--amber)' : 'var(--danger)');

export function Capacity() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [squads, setSquads] = useState<OrgUnit[]>([]);
  const [sprintId, setSprintId] = useState('');
  const [cells, setCells] = useState<CapacityCell[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sprints().then((s) => { setSprints(s); setSprintId((p) => p || s[0]?.id || ''); }).catch(() => {});
    api.orgUnits().then((u) => setSquads(u.filter((x) => x.type === 'SQUAD'))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sprintId || squads.length === 0) { setCells([]); setLoading(false); return; }
    setErr(''); setLoading(true);
    let alive = true;
    // Jedno żądanie na cały sprint zamiast jednego na squad — ten sam endpoint, z którego korzysta
    // heatmapa. Komórka bez pomiaru (null) nie jest zerem, więc odpada z widoku zamiast zaniżać sumy.
    api.capacityMatrix([sprintId], squads.map((sq) => sq.id))
      .then(({ cells: res }) => { if (!alive) return; setCells(res.filter((c) => c.totalPersonDays !== null)); setLoading(false); })
      .catch((e: Error) => {
        if (!alive) return;
        setErr(/403|uprawnie/.test(e.message) ? 'Brak uprawnień do widoku capacity.' : e.message);
        setCells([]); setLoading(false);
      });
    return () => { alive = false; };
  }, [sprintId, squads]);

  // Nazwa jednostki nie jedzie w komórce — mamy ją już z `/org/units`, tak samo jak heatmapa.
  const caps = useMemo(() => {
    const nameOf = new Map(squads.map((s) => [s.id, s.name]));
    return cells.map((c) => ({
      unit: { id: c.unitId, name: nameOf.get(c.unitId) ?? c.unitId },
      memberCount: c.memberCount ?? 0,
      totalPersonDays: c.totalPersonDays ?? 0,
      absentPersonDays: c.absentPersonDays ?? 0,
      available: c.available ?? 0,
      // `?? []` na wypadek starszego API pod tym samym frontendem (zdarza się przy dev, gdy
      // proces API nie został zrestartowany): brak alertu jest do przeżycia, biały ekran nie.
      keyRoleCollisions: c.keyRoleCollisions ?? [],
    }));
  }, [cells, squads]);

  const sprint = useMemo(() => sprints.find((s) => s.id === sprintId) ?? null, [sprints, sprintId]);
  const workdays = useMemo(() => { const c = caps.find((x) => x.memberCount > 0); return c ? Math.round(c.totalPersonDays / c.memberCount) : 0; }, [caps]);
  const totals = useMemo(() => caps.reduce((a, c) => ({ total: a.total + c.totalPersonDays, avail: a.avail + c.available }), { total: 0, avail: 0 }), [caps]);
  const collisions = useMemo(() => caps.flatMap((c) => c.keyRoleCollisions.map((k) => ({ squad: c.unit.name, ...k }))), [caps]);
  const maxTotal = Math.max(1, ...caps.map((c) => c.totalPersonDays));

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '4px 6px 4px 14px' }}>
          <Zap size={16} color="var(--brand)" />
          <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} aria-label="Sprint" style={{ ...select, border: 'none', padding: '6px 8px' }}>
            {/* bez wskazywania Konfiguracji — PO nie ma do niej dostępu */}
            {sprints.length === 0 && <option value="">Brak zdefiniowanych sprintów</option>}
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {sprint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' }}>{dateRange(sprint.dateFrom, sprint.dateTo, { long: true })} · {count(workdays, ['dzień roboczy', 'dni robocze', 'dni roboczych'])}</span>}
      </div>

      <div role="alert" aria-live="assertive">
        {err && <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-md)', background: 'var(--danger-tint)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 13.5 }}>{err}</div>}
      </div>
      <div role="status" aria-live="polite">
        {loading && !err && <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Wczytywanie capacity…</div>}
        {!loading && !err && caps.length === 0 && <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Brak danych capacity — sprawdź, czy zdefiniowano sprinty i squady.</div>}
      </div>

      {/* ALERT KOLIZJI KLUCZOWYCH RÓL (FR-D3) */}
      {collisions.length > 0 && (
        <div style={{ background: 'var(--danger-tint)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 18, display: 'flex', gap: 13, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 'var(--radius-md)', background: 'var(--danger)', display: 'grid', placeItems: 'center' }}><TriangleAlert size={19} color="var(--on-danger)" aria-hidden="true" /></div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, margin: '0 0 3px', color: 'var(--ink)' }}>Alert: kolizja kluczowych ról</h2>
            {collisions.map((c, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                <b>{c.employees[0]}</b> i <b>{c.employees[1]}</b> ({c.squad}) — nieobecni jednocześnie {dateRange(c.dateFrom, c.dateTo)}.
              </div>
            ))}
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Rozważ przesunięcie kluczowych zadań sprintu.</div>
          </div>
        </div>
      )}

      {/* KARTY CAPACITY PER SQUAD */}
      {caps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
          {caps.map((c) => {
            const pct = c.totalPersonDays > 0 ? Math.round((c.available / c.totalPersonDays) * 100) : 0;
            const col = availColor(pct);
            return (
              <div key={c.unit.id} style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{c.unit.name}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)' }}>{count(c.memberCount, ['osoba', 'osoby', 'osób'])}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 34, fontWeight: 800, lineHeight: .9, fontVariantNumeric: 'tabular-nums', color: col }}>{pct}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: col, fontWeight: 700, marginBottom: 5 }}>%</span>
                  <span style={{ marginLeft: 'auto', marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{c.available} / {c.totalPersonDays} os-dni</span>
                </div>
                <ProgressBar value={pct} color={col} height={9} style={{ margin: '10px 0 6px' }} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>−{c.absentPersonDays} os-dni nieobecności</div>
              </div>
            );
          })}
        </div>
      )}

      {/* PODSUMOWANIE — dostępność per squad */}
      {caps.length > 0 && (
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0 }}>Capacity w sprincie</h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Razem: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{totals.avail} / {totals.total}</b> os-dni</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, paddingBottom: 26, position: 'relative' }}>
            {caps.map((c) => {
              const h = Math.round((c.available / maxTotal) * 100);
              const pct = c.totalPersonDays > 0 ? Math.round((c.available / c.totalPersonDays) * 100) : 0;
              return (
                <div key={c.unit.id} title={`${c.unit.name}: ${c.available}/${c.totalPersonDays} os-dni`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, position: 'relative' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>{c.available}</span>
                  <div style={{ width: '100%', maxWidth: 56, height: `${Math.max(4, h)}%`, background: availColor(pct), borderRadius: '5px 5px 0 0' }} />
                  <span style={{ fontSize: 10.5, color: 'var(--muted)', position: 'absolute', bottom: 0, fontFamily: 'var(--font-sans)', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.unit.name.replace('Squad ', '')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
