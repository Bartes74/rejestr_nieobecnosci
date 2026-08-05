import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { api, type OrgUnit, type ReportTreeNode, type UsageReport } from '../api';

type OverdueRow = { employeeId: string; name: string; employmentType: string; carriedOver: number; remaining: number; zalega: boolean };

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)' } as const;
const th = { textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, padding: '11px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' } as const;
const td = { fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', padding: '12px 16px', borderBottom: '1px solid var(--border)' } as const;
const num = { ...td, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' } as const;

function StatCard({ label, value, unit, sub, color }: { label: string; value: string | number; unit?: string; sub: string; color?: string }) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 34, fontWeight: 800, lineHeight: .9, fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--ink)' }}>{value}</span>
        {unit && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function TreeRows({ node, depth = 0 }: { node: ReportTreeNode; depth?: number }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderTop: depth === 0 ? 'none' : '1px solid var(--border)', gap: 10 }}>
        <span style={{ paddingLeft: depth * 18, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginRight: 8 }}>{node.type}</span>{node.name}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{node.headcount} os.</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', width: 80, textAlign: 'right' }}>{node.used} dni</span>
      </div>
      {node.children.map((c) => <TreeRows key={c.id} node={c} depth={depth + 1} />)}
    </>
  );
}

export function Raporty() {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [tree, setTree] = useState<ReportTreeNode | null>(null);
  const [overdue, setOverdue] = useState<{ rows: OverdueRow[] } | null>(null);
  const [pool, setPool] = useState<number | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.orgUnits().then((u) => { setUnits(u); setUnitId((p) => p || u[0]?.id || ''); }).catch(() => {});
    api.poolDefault().then((d) => setPool(d.value)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!unitId) return;
    setErr('');
    api.reportUsage(unitId).then(setUsage).catch((e: Error) => { setUsage(null); setErr(/403|uprawnie/.test(e.message) ? 'Brak uprawnień do raportów.' : e.message); });
    api.reportTree(unitId).then(setTree).catch(() => setTree(null));
    api.reportOverdue(unitId).then(setOverdue).catch(() => setOverdue(null));
  }, [unitId]);

  const stats = useMemo(() => {
    if (!usage) return null;
    const entitle = usage.rows.reduce((a, r) => a + r.pool + r.carriedOver, 0);
    const used = usage.rows.reduce((a, r) => a + r.used, 0);
    return { pct: entitle > 0 ? Math.round((used / entitle) * 100) : 0, used, people: usage.rows.length };
  }, [usage]);
  const overdueRows = useMemo(() => (overdue?.rows ?? []).filter((r) => r.zalega).sort((a, b) => b.carriedOver - a.carriedOver), [overdue]);

  // wykres: wykorzystanie wg bezpośrednich jednostek podrzędnych (% puli, jeśli znana, inaczej względnie)
  const bars = useMemo(() => {
    const kids = tree?.children ?? [];
    const maxUsed = Math.max(1, ...kids.map((k) => k.used));
    return kids.map((k, i) => {
      const pct = pool && k.headcount > 0 ? Math.min(100, Math.round((k.used / (k.headcount * pool)) * 100)) : Math.round((k.used / maxUsed) * 100);
      return { name: k.name, used: k.used, pct, color: i % 2 === 0 ? 'var(--brand)' : 'var(--blue)' };
    });
  }, [tree, pool]);

  const exportXlsx = async () => {
    const blob = await api.exportUsage(unitId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'raport-urlopy.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 1180, animation: 'fu .2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Jednostka" style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5 }}>
          {units.length === 0 && <option value="">Brak jednostek</option>}
          {units.map((u) => <option key={u.id} value={u.id}>{u.type} · {u.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={exportXlsx} disabled={!usage} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--brand)', cursor: usage ? 'pointer' : 'default', background: 'var(--brand-tint)', color: 'var(--brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, padding: '9px 15px', borderRadius: 9, opacity: usage ? 1 : 0.5 }}>
          <Upload size={15} /> Eksport .xlsx
        </button>
      </div>

      {err && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>{err}</div>}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
          <StatCard label="Śr. wykorzystanie urlopu" value={stats.pct} unit="%" sub={`w jednostce · ${stats.people} ${stats.people === 1 ? 'osoba' : 'osób'}`} />
          <StatCard label="Wykorzystany urlop" value={stats.used} unit="dni" sub="wszystkie typy obniżające pulę" />
          <StatCard label="Zalega z urlopem" value={overdueRows.length} unit="osób" sub="powyżej progu zaległości" color={overdueRows.length > 0 ? 'var(--amber)' : 'var(--ink)'} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16, marginBottom: 18 }}>
        {/* WYKRES per jednostka */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', marginBottom: 18 }}>Wykorzystanie urlopu wg jednostki</div>
          {bars.length === 0 ? <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Brak jednostek podrzędnych.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {bars.map((b) => (
                <div key={b.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span>{b.name}</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{b.used} dni{pool ? ` · ${b.pct}%` : ''}</span>
                  </div>
                  <div style={{ height: 9, borderRadius: 6, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${b.pct}%`, height: '100%', background: b.color }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KTO ZALEGA */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>Kto zalega z urlopem</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Osoby z zaległym / niewybranym urlopem</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr 1fr', padding: '8px 20px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em' }}>
            <div>OSOBA</div><div>ZALEGA</div><div style={{ textAlign: 'right' }}>POZOSTAŁO</div>
          </div>
          {overdueRows.length === 0 && <div style={{ padding: '16px 20px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Nikt nie zalega w tej jednostce.</div>}
          {overdueRows.map((r, i) => (
            <div key={r.employeeId} style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr 1fr', padding: '12px 20px', borderBottom: i < overdueRows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: 13 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.carriedOver >= 7 ? 'var(--danger)' : 'var(--amber)' }}>{r.carriedOver} dni</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', textAlign: 'right' }}>{r.remaining}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABELA SZCZEGÓŁOWA (FR-F1) */}
      {usage && (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Pracownik</th><th style={th}>Forma</th><th style={{ ...th, textAlign: 'right' }}>Pula+zaległe</th><th style={{ ...th, textAlign: 'right' }}>Wykorzystano</th><th style={{ ...th, textAlign: 'right' }}>Pozostało</th></tr></thead>
            <tbody>
              {usage.rows.map((r) => (
                <tr key={r.employeeId}>
                  <td style={td}>{r.name}</td><td style={td}>{r.employmentType}</td>
                  <td style={num}>{r.pool + r.carriedOver}</td><td style={num}>{r.used}</td>
                  <td style={{ ...num, color: 'var(--brand)', fontWeight: 600 }}>{r.remaining}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }}>RAZEM</td><td style={td} />
                <td style={{ ...num, fontWeight: 700 }}>{usage.totals.pool}</td><td style={{ ...num, fontWeight: 700 }}>{usage.totals.used}</td><td style={{ ...num, fontWeight: 700 }}>{usage.totals.remaining}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* DRĄŻENIE HIERARCHII (FR-F3) */}
      {tree && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 4px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Drążenie hierarchii</div>
          <div style={{ paddingBottom: 8 }}><TreeRows node={tree} /></div>
        </div>
      )}
    </div>
  );
}
