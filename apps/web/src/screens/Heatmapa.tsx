import { useEffect, useMemo, useState } from 'react';
import { api, type OrgUnit, type Sprint } from '../api';

// FR-C4 — heatmapa pokrycia: natężenie nieobecności (% osobodni) per squad × sprint.
// Kolor prowadzi od zielonego (spokojnie) po czerwony (≥50% — ryzyko niedoboru obsady).
// ponytail: pobiera capacity dla każdej pary squad×sprint (N×M zapytań); gdy squadów/sprintów przybędzie,
//           dołożymy zbiorczy endpoint /capacity/matrix. Dla typowej skali (kilka squadów, ~12 sprintów) wystarcza.

type Cell = { pct: number | null; title: string };
const MAX_SPRINTS = 12;

// 5-stopniowa skala (tokeny --heat-* mają te same wartości co prototyp).
function heatStep(v: number): number {
  if (v < 12) return 1;
  if (v < 25) return 2;
  if (v < 38) return 3;
  if (v < 50) return 4;
  return 5;
}
const sprintTag = (s: Sprint, i: number) => {
  const m = s.name.match(/(\d+)/);
  return m ? `S${m[1]}` : `S${i + 1}`;
};
const dm = (s: string) => `${Number(s.slice(8, 10))}.${s.slice(5, 7)}`;

export function Heatmapa() {
  const [squads, setSquads] = useState<OrgUnit[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Cell[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.orgUnits(), api.sprints()]).then(([units, sp]) => {
      setSquads(units.filter((u) => u.type === 'SQUAD'));
      // okno: ostatnie/najbliższe sprinty wg daty
      setSprints([...sp].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)).slice(-MAX_SPRINTS));
    }).catch(() => { setSquads([]); setSprints([]); });
  }, []);

  useEffect(() => {
    if (squads.length === 0 || sprints.length === 0) { setLoading(false); return; }
    setLoading(true);
    const tasks = squads.flatMap((sq) => sprints.map((sp) =>
      api.capacity(sp.id, sq.id)
        .then((c) => ({ sq: sq.id, pct: c.totalPersonDays > 0 ? Math.round((c.absentPersonDays / c.totalPersonDays) * 100) : null,
          title: `${sq.name} · ${sp.name}: ${c.absentPersonDays}/${c.totalPersonDays} osobodni` }))
        .catch(() => ({ sq: sq.id, pct: null as number | null, title: `${sq.name} · ${sp.name}: brak danych` })),
    ));
    Promise.all(tasks).then((res) => {
      const m: Record<string, Cell[]> = {};
      let k = 0;
      for (const sq of squads) {
        m[sq.id] = sprints.map(() => { const r = res[k++]; return { pct: r?.pct ?? null, title: r?.title ?? '' }; });
      }
      setMatrix(m);
      setLoading(false);
    });
  }, [squads, sprints]);

  const cols = useMemo(() => `150px repeat(${sprints.length}, minmax(46px,1fr))`, [sprints.length]);
  const empty = !loading && (squads.length === 0 || sprints.length === 0);

  return (
    <div style={{ maxWidth: 1080, animation: 'fu .2s ease' }}>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 13.5, margin: '0 0 20px', maxWidth: 680 }}>
        Natężenie nieobecności w czasie — pozwala wcześnie wykryć tygodnie zagrożone niedoborem obsady.
        Kolor prowadzi od zielonego (spokojnie) po czerwony (wymaga uwagi).
      </p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', padding: 22, overflowX: 'auto' }}>
        {loading && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--muted)', padding: '8px 0' }}>Wczytywanie pokrycia…</div>}
        {empty && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--muted)', padding: '8px 0' }}>Brak squadów lub sprintów — dodaj je w Konfiguracji, aby zobaczyć pokrycie.</div>}

        {!loading && !empty && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center', minWidth: 640 }}>
              <div />
              {sprints.map((s, i) => (
                <div key={s.id} title={`${s.name} (${dm(s.dateFrom.slice(0, 10))}–${dm(s.dateTo.slice(0, 10))})`} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{sprintTag(s, i)}</div>
              ))}
              {squads.map((sq) => (
                <div key={sq.id} style={{ display: 'contents' }}>
                  <div title={sq.name} style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sq.name}</div>
                  {(matrix[sq.id] ?? sprints.map(() => ({ pct: null, title: '' }))).map((c, i) => {
                    if (c.pct === null) return <div key={i} title={c.title} style={{ height: 40, borderRadius: 8, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)' }}>–</div>;
                    const step = heatStep(c.pct);
                    const high = step === 5;
                    return (
                      <div key={i} title={c.title} style={{
                        height: 40, borderRadius: 8, display: 'grid', placeItems: 'center',
                        background: `var(--heat-${step})`,
                        boxShadow: high ? '0 0 0 2px var(--surface), inset 0 0 0 2px var(--heat-5-ring)' : 'none',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: `var(--heat-${step}-ink)` }}>{c.pct}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>
                <span>Spokojnie</span>
                <div style={{ width: 170, height: 11, borderRadius: 6, background: 'linear-gradient(90deg,var(--heat-1),var(--heat-2),var(--heat-3),var(--heat-4),var(--heat-5))' }} />
                <span>Wymaga uwagi</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--heat-5)', boxShadow: '0 0 0 2px var(--surface), inset 0 0 0 2px var(--heat-5-ring)' }} />
                Tydzień wysokiego ryzyka (≥50% nieobecnych)
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
