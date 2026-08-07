import { useEffect, useMemo, useState } from 'react';
import { dateRange } from '../format';
import { api, type OrgUnit, type Sprint } from '../api';
import { card } from '../design-system/surfaces';

// FR-C4 — heatmapa pokrycia: natężenie nieobecności (% osobodni) per squad × sprint.
// Kolor prowadzi od zielonego (spokojnie) po czerwony (≥50% — ryzyko niedoboru obsady).
// Cała siatka schodzi jednym żądaniem `GET /capacity/matrix`; wcześniej było jedno na każdą parę.

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

export function Heatmapa() {
  const [squads, setSquads] = useState<OrgUnit[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Cell[]>>({});
  const [loading, setLoading] = useState(true);
  // Nieudane pobranie siatki wyglądało dotąd jak siatka bez danych — same kreski, bez powodu.
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api.orgUnits(), api.sprints()]).then(([units, sp]) => {
      setSquads(units.filter((u) => u.type === 'SQUAD'));
      // okno: ostatnie/najbliższe sprinty wg daty
      setSprints([...sp].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)).slice(-MAX_SPRINTS));
    }).catch(() => { setSquads([]); setSprints([]); });
  }, []);

  // Jedno żądanie na całą siatkę zamiast jednego na każdą parę squad × sprint. Przy sześciu
  // squadach i dwunastu sprintach to 72 wywołania mniej — i to w oknie planowania sprintu,
  // czyli wtedy, gdy do serwera dobija się naraz cały departament (NFR-1).
  useEffect(() => {
    if (squads.length === 0 || sprints.length === 0) { setLoading(false); return undefined; }
    setLoading(true);
    setErr('');
    let alive = true;
    api.capacityMatrix(sprints.map((s) => s.id), squads.map((s) => s.id))
      .then(({ cells }) => {
        if (!alive) return; // ekran zdążył zniknąć — nie dotykamy stanu odmontowanego drzewa
        const byKey = new Map(cells.map((c) => [`${c.unitId}:${c.sprintId}`, c]));
        const m: Record<string, Cell[]> = {};
        for (const sq of squads) {
          m[sq.id] = sprints.map((sp) => {
            const c = byKey.get(`${sq.id}:${sp.id}`);
            const total = c?.totalPersonDays ?? 0;
            return total > 0 && c
              ? { pct: Math.round((c.absentPersonDays! / total) * 100), title: `${sq.name} · ${sp.name}: ${c.absentPersonDays}/${total} osobodni` }
              : { pct: null, title: `${sq.name} · ${sp.name}: brak danych` };
          });
        }
        setMatrix(m);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setErr(/403|uprawnie/.test(e.message) ? 'Brak uprawnień do widoku pokrycia.' : e.message);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [squads, sprints]);

  const cols = useMemo(() => `150px repeat(${sprints.length}, minmax(46px,1fr))`, [sprints.length]);
  const empty = !loading && (squads.length === 0 || sprints.length === 0);

  return (
    <div style={{ maxWidth: 1080 }}>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 13.5, margin: '0 0 20px', maxWidth: 680 }}>
        Natężenie nieobecności w czasie — pozwala wcześnie wykryć tygodnie zagrożone niedoborem obsady.
        Kolor prowadzi od zielonego (spokojnie) po czerwony (wymaga uwagi).
      </p>

      <div style={{ ...card, padding: 22, overflowX: 'auto' }}>
        <div role="alert" aria-live="assertive">
          {err && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', padding: '8px 0' }}>{err}</div>}
        </div>
        <div role="status" aria-live="polite">
          {loading && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--muted)', padding: '8px 0' }}>Wczytywanie pokrycia…</div>}
          {empty && !err && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--muted)', padding: '8px 0' }}>Brak squadów lub sprintów — dodaj je w Konfiguracji, aby zobaczyć pokrycie.</div>}
        </div>

        {!loading && !empty && !err && (
          <>
            {/* Siatka jest tabelą i tak się przedstawia: bez ról czytnik ekranu dostawał ciąg
                czterdziestu kilku procentów bez informacji, którego squadu i którego sprintu
                dotyczą. Wiersz nie używa już `display: contents` — kolumny zgadzają się w pionie,
                bo każdy wiersz niesie ten sam `gridTemplateColumns` przy tej samej szerokości,
                a element wyjęty z drzewa dostępności przestaje być jedyną strukturą, jaką mamy. */}
            <div role="table" aria-label="Pokrycie: udział nieobecności w osobodniach, squady w wierszach, sprinty w kolumnach"
              style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 640 }}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center' }}>
                <div role="columnheader"><span className="ds-sr">Squad</span></div>
                {sprints.map((s, i) => (
                  <div key={s.id} role="columnheader" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                    <span aria-hidden="true">{sprintTag(s, i)}</span>
                    {/* Skrót „S13" wystarcza wzrokowi, ale nie uchu — pełna nazwa i zakres idą do czytnika. */}
                    <span className="ds-sr">{s.name}, {dateRange(s.dateFrom, s.dateTo)}</span>
                  </div>
                ))}
              </div>
              {squads.map((sq) => (
                <div key={sq.id} role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center' }}>
                  <div role="rowheader" title={sq.name} style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sq.name}</div>
                  {(matrix[sq.id] ?? sprints.map(() => ({ pct: null, title: '' }))).map((c, i) => {
                    if (c.pct === null) {
                      return (
                        <div key={i} role="cell" title={c.title} style={{ height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)' }}>
                          <span aria-hidden="true">–</span><span className="ds-sr">brak danych</span>
                        </div>
                      );
                    }
                    const step = heatStep(c.pct);
                    const high = step === 5;
                    return (
                      <div key={i} role="cell" title={c.title} style={{
                        height: 40, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center',
                        background: `var(--heat-${step})`,
                        boxShadow: high ? '0 0 0 2px var(--surface), inset 0 0 0 2px var(--heat-5-ring)' : 'none',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: `var(--heat-${step}-ink)` }}>{c.pct}%</span>
                        {/* Pierścień wysokiego ryzyka jest sygnałem czysto wizualnym — nazwijmy go słowem. */}
                        {high && <span className="ds-sr">wysokie ryzyko</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>
                <span>Spokojnie</span>
                <div aria-hidden="true" style={{ width: 170, height: 11, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(90deg,var(--heat-1),var(--heat-2),var(--heat-3),var(--heat-4),var(--heat-5))' }} />
                <span>Wymaga uwagi</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ width: 18, height: 18, borderRadius: 'var(--radius-sm)', background: 'var(--heat-5)', boxShadow: '0 0 0 2px var(--surface), inset 0 0 0 2px var(--heat-5-ring)' }} />
                Tydzień wysokiego ryzyka (≥50% nieobecnych)
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
