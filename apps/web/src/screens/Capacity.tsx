import { useEffect, useMemo, useState } from 'react';
import { TriangleAlert, Zap } from 'lucide-react';
import { api, type Capacity as Cap, type OrgUnit, type Sprint } from '../api';

const dm = (s: string) => `${Number(s.slice(8, 10))}.${s.slice(5, 7)}`;
const select = { padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14 } as const;
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)' } as const;

// próg dostępności → kolor (jak w prototypie: zielony OK, bursztyn uwaga, czerwony ryzyko)
const availColor = (pct: number) => (pct >= 80 ? 'var(--brand)' : pct >= 60 ? 'var(--amber)' : 'var(--danger)');

export function Capacity() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [squads, setSquads] = useState<OrgUnit[]>([]);
  const [sprintId, setSprintId] = useState('');
  const [caps, setCaps] = useState<Cap[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sprints().then((s) => { setSprints(s); setSprintId((p) => p || s[0]?.id || ''); }).catch(() => {});
    api.orgUnits().then((u) => setSquads(u.filter((x) => x.type === 'SQUAD'))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sprintId || squads.length === 0) { setCaps([]); setLoading(false); return; }
    setErr(''); setLoading(true);
    Promise.all(squads.map((sq) => api.capacity(sprintId, sq.id).catch((e: Error) => { if (/403|uprawnie/.test(e.message)) setErr('Brak uprawnień do widoku capacity.'); return null; })))
      .then((res) => { setCaps(res.filter((c): c is Cap => !!c)); setLoading(false); });
  }, [sprintId, squads]);

  const sprint = useMemo(() => sprints.find((s) => s.id === sprintId) ?? null, [sprints, sprintId]);
  const workdays = useMemo(() => { const c = caps.find((x) => x.memberCount > 0); return c ? Math.round(c.totalPersonDays / c.memberCount) : 0; }, [caps]);
  const totals = useMemo(() => caps.reduce((a, c) => ({ total: a.total + c.totalPersonDays, avail: a.avail + c.available }), { total: 0, avail: 0 }), [caps]);
  const collisions = useMemo(() => caps.flatMap((c) => c.keyRoleCollisions.map((k) => ({ squad: c.unit.name, ...k }))), [caps]);
  const maxTotal = Math.max(1, ...caps.map((c) => c.totalPersonDays));

  return (
    <div style={{ maxWidth: 1180, animation: 'fu .2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 10, padding: '4px 6px 4px 14px' }}>
          <Zap size={16} color="var(--brand)" />
          <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} aria-label="Sprint" style={{ ...select, border: 'none', padding: '6px 8px' }}>
            {/* bez wskazywania Konfiguracji — PO nie ma do niej dostępu */}
            {sprints.length === 0 && <option value="">Brak zdefiniowanych sprintów</option>}
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {sprint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' }}>{dm(sprint.dateFrom.slice(0, 10))}–{dm(sprint.dateTo.slice(0, 10))}.{sprint.dateTo.slice(0, 4)} · {workdays} dni rob.</span>}
      </div>

      {err && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 14, marginBottom: 16 }}>{err}</div>}
      {loading && !err && <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>Wczytywanie capacity…</div>}

      {/* ALERT KOLIZJI KLUCZOWYCH RÓL (FR-D3) */}
      {collisions.length > 0 && (
        <div style={{ background: 'var(--danger-tint)', border: '1px solid var(--danger)', borderRadius: 14, padding: '16px 18px', marginBottom: 18, display: 'flex', gap: 13, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: 'var(--danger)', display: 'grid', placeItems: 'center' }}><TriangleAlert size={19} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, marginBottom: 3, color: 'var(--ink)' }}>Alert: kolizja kluczowych ról</div>
            {collisions.map((c, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                <b>{c.employees[0]}</b> i <b>{c.employees[1]}</b> ({c.squad}) — nieobecni jednocześnie {c.dateFrom === c.dateTo ? dm(c.dateFrom) : `${dm(c.dateFrom)}–${dm(c.dateTo)}`}.
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
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)' }}>{c.memberCount} {c.memberCount === 1 ? 'osoba' : 'osób'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 34, fontWeight: 800, lineHeight: .9, fontVariantNumeric: 'tabular-nums', color: col }}>{pct}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: col, fontWeight: 700, marginBottom: 5 }}>%</span>
                  <span style={{ marginLeft: 'auto', marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{c.available} / {c.totalPersonDays} os-dni</span>
                </div>
                <div style={{ height: 9, borderRadius: 6, background: 'var(--surface-3)', overflow: 'hidden', margin: '10px 0 6px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: col }} />
                </div>
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
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Capacity w sprincie</span>
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
