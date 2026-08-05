import React from 'react';

const WEEKS = ['22', '23', '24', '25', '26', '27', '28', '29', '30'];
const DATA = {
  'Squad Płatności': [10, 15, 20, 45, 35, 20, 15, 30, 55],
  'Squad Onboarding': [20, 25, 30, 50, 60, 25, 20, 15, 10],
  'Squad Mobilny': [5, 10, 15, 20, 10, 40, 15, 10, 20],
  'Squad Rozliczenia': [15, 10, 25, 30, 20, 15, 55, 40, 25],
  'Squad Integracje': [30, 20, 15, 10, 45, 50, 20, 25, 15],
};
const band = (v) => v < 12 ? ['var(--heat-1)', 'var(--heat-1-ink)'] : v < 25 ? ['var(--heat-2)', 'var(--heat-2-ink)'] : v < 38 ? ['var(--heat-3)', 'var(--heat-3-ink)'] : v < 50 ? ['var(--heat-4)', 'var(--heat-4-ink)'] : ['var(--heat-5)', 'var(--heat-5-ink)'];

export function Heatmapa() {
  return (
    <div style={{ maxWidth: 1080 }}>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '0 0 20px', maxWidth: 680 }}>Natężenie nieobecności w czasie — pozwala wcześnie wykryć tygodnie zagrożone niedoborem obsady. Kolor prowadzi od zielonego (spokojnie) po czerwony (wymaga uwagi).</p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', padding: 22, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(9,minmax(46px,1fr))', gap: 6, alignItems: 'center', minWidth: 640 }}>
          <div />
          {WEEKS.map((w) => <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>T{w}</div>)}
          {Object.entries(DATA).map(([squad, vals]) => (
            <React.Fragment key={squad}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{squad}</div>
              {vals.map((v, i) => {
                const [bg, fg] = band(v); const high = v >= 50;
                return <div key={i} style={{ height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: fg, boxShadow: high ? '0 0 0 2px var(--surface), inset 0 0 0 2px var(--heat-5-ring)' : 'none' }}>{v}%</div>;
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--muted)' }}><span>Spokojnie</span><div style={{ width: 170, height: 11, borderRadius: 6, background: 'linear-gradient(90deg,var(--heat-1),var(--heat-2),var(--heat-3),var(--heat-4),var(--heat-5))' }} /><span>Wymaga uwagi</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted)' }}><span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--heat-5)', boxShadow: '0 0 0 2px var(--surface), inset 0 0 0 2px var(--heat-5-ring)' }} />Tydzień wysokiego ryzyka (≥50%)</div>
        </div>
      </div>
    </div>
  );
}
