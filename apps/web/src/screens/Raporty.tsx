import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { count, plural } from '@nieobecnosci/core/plural';
import { api, type OrgUnit, type ReportTreeNode, type UsageReport } from '../api';
import { card, cardClipped } from '../design-system/surfaces';
import { ProgressBar } from '../design-system/components/data/ProgressBar';
import { StatCard } from '../design-system/components/data/StatCard';
import { num, td, th } from '../admin/ui';

type OverdueRow = { employeeId: string; name: string; employmentType: string; carriedOver: number; remaining: number; zalega: boolean };


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
  // Dotąd ekran po prostu nic nie pokazywał do czasu odpowiedzi — ani kart, ani informacji,
  // że coś się dzieje. Przy raporcie dla całego pionu to kilka sekund pustej strony.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.orgUnits().then((u) => { setUnits(u); setUnitId((p) => p || u[0]?.id || ''); }).catch(() => {});
    // Skala wykresu: pula wspólna, a gdy jej nie ustawiono — pula UoP jako forma dominująca.
    // Jednostka bywa mieszana, więc to i tak przybliżenie; bez żadnej z nich słupki idą względne.
    api.poolDefault().then((d) => setPool(d.value ?? d.byType.UOP)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!unitId) return;
    setErr('');
    setLoading(true);
    void Promise.all([
      api.reportUsage(unitId).then(setUsage).catch((e: Error) => { setUsage(null); setErr(/403|uprawnie/.test(e.message) ? 'Brak uprawnień do raportów.' : e.message); }),
      api.reportTree(unitId).then(setTree).catch(() => setTree(null)),
      api.reportOverdue(unitId).then(setOverdue).catch(() => setOverdue(null)),
    ]).finally(() => setLoading(false));
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
    try {
      const blob = await api.exportUsage(unitId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'raport-urlopy.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr((e as Error).message); // bez tego błąd eksportu ginął jako nieobsłużone odrzucenie
    }
  };

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Jednostka" style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5 }}>
          {units.length === 0 && <option value="">Brak jednostek</option>}
          {units.map((u) => <option key={u.id} value={u.id}>{u.type} · {u.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={exportXlsx} disabled={!usage} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--brand)', cursor: usage ? 'pointer' : 'default', background: 'var(--brand-tint)', color: 'var(--brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, padding: '9px 15px', borderRadius: 'var(--radius-md)', opacity: usage ? 1 : 0.5 }}>
          <Upload size={15} /> Eksport .xlsx
        </button>
      </div>

      <div role="alert" aria-live="assertive">
        {err && <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 'var(--radius-md)', background: 'var(--danger-tint)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 13.5, lineHeight: 1.45 }}>{err}</div>}
      </div>
      <div role="status" aria-live="polite">
        {loading && !err && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--muted)', padding: '4px 0 14px' }}>Wczytywanie raportu…</div>}
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
          <StatCard label="Śr. wykorzystanie urlopu" value={stats.pct} unit="%" sub={`w jednostce · ${count(stats.people, ['osoba', 'osoby', 'osób'])}`} />
          <StatCard label="Wykorzystany urlop" value={stats.used} unit="dni" sub="wszystkie typy obniżające pulę" />
          <StatCard label="Zalega z urlopem" value={overdueRows.length} unit={plural(overdueRows.length, ['osoba', 'osoby', 'osób'])} sub="powyżej progu zaległości" accent={overdueRows.length > 0 ? 'var(--amber)' : 'var(--ink)'} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16, marginBottom: 18 }}>
        {/* WYKRES per jednostka */}
        <div style={{ ...card, padding: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 18px' }}>Wykorzystanie urlopu wg jednostki</h2>
          {bars.length === 0 ? <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Brak jednostek podrzędnych.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {bars.map((b) => (
                <div key={b.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span>{b.name}</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{b.used} dni{pool ? ` · ${b.pct}%` : ''}</span>
                  </div>
                  <ProgressBar value={b.pct} color={b.color} height={9} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KTO ZALEGA */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 12px' }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', margin: 0 }}>Kto zalega z urlopem</h2>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Osoby z zaległym / niewybranym urlopem</div>
          </div>
          {/* Ostatnia siatka w aplikacji, która udawała tabelę bez ról — czytnik ekranu czytał
              ciąg nazwisk i liczb bez informacji, która liczba jest zaległością, a która resztą.
              Wersaliki robi teraz CSS, nie treść: „OSOBA" bywa literowane głoska po głosce. */}
          <div role="table" aria-label="Osoby zalegające z urlopem">
            <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr 1fr', padding: '8px 20px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              <div role="columnheader">Osoba</div><div role="columnheader">Zalega</div><div role="columnheader" style={{ textAlign: 'right' }}>Pozostało</div>
            </div>
            {overdueRows.length === 0 && <div role="row"><div role="cell" style={{ padding: '16px 20px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Nikt nie zalega w tej jednostce.</div></div>}
            {overdueRows.map((r, i) => (
              <div key={r.employeeId} role="row" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr 1fr', padding: '12px 20px', borderBottom: i < overdueRows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: 13 }}>
                <div role="rowheader" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                <div role="cell" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: r.carriedOver >= 7 ? 'var(--danger)' : 'var(--amber)' }}>{count(r.carriedOver, ['dzień', 'dni', 'dni'])}</div>
                <div role="cell" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)', textAlign: 'right' }}>{r.remaining}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABELA SZCZEGÓŁOWA (FR-F1) */}
      {usage && (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th scope="col" style={th}>Pracownik</th><th scope="col" style={th}>Forma</th><th scope="col" style={{ ...th, textAlign: 'right' }}>Pula+zaległe</th><th scope="col" style={{ ...th, textAlign: 'right' }}>Wykorzystano</th><th scope="col" style={{ ...th, textAlign: 'right' }}>Pozostało</th></tr></thead>
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
          <h2 style={{ padding: '16px 16px 4px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: 0 }}>Drążenie hierarchii</h2>
          <div style={{ paddingBottom: 8 }}><TreeRows node={tree} /></div>
        </div>
      )}
    </div>
  );
}
