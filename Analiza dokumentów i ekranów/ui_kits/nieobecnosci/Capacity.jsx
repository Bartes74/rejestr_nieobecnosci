import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Alert } from '../../components/feedback/Alert.jsx';
import { ProgressBar } from '../../components/data/ProgressBar.jsx';

const SQUADS = [
  { name: 'Squad Płatności', people: 3, pct: 83, ratio: '25 / 30 os-dni', minus: '−5 os-dni nieobecności', accent: 'var(--brand)' },
  { name: 'Squad Onboarding', people: 2, pct: 75, ratio: '15 / 20 os-dni', minus: '−5 os-dni nieobecności', accent: 'var(--amber)' },
  { name: 'Squad Mobilny', people: 2, pct: 95, ratio: '19 / 20 os-dni', minus: '−1 os-dzień nieobecności', accent: 'var(--brand)' },
];
const BARS = [['Pn 16', 78], ['Wt 17', 78], ['Śr 18', 71], ['Cz 19', 71], ['Pn 22', 57], ['Wt 23', 43, 1], ['Śr 24', 43, 1], ['Cz 25', 64], ['Pt 26', 57]];

export function Capacity() {
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '10px 15px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18"/><path d="M5 4h13l-2.5 3.5L18 11H5"/></svg>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Sprint 13</span><span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>16–27.06.2026 · 10 dni rob.</span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Tribe „Klient Indywidualny"</span>
      </div>
      <Alert variant="danger" solidIcon title="Alert: kolizja kluczowych ról" style={{ marginBottom: 18 }}
        icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 1.5 21h21z"/><path d="M12 9v5M12 17.5v.5"/></svg>}>
        <b>Rafał Kamiński</b> (Tech Lead) i <b>Marta Wiśniewska</b> (Płatności Owner) są nieobecni jednocześnie w dniach <b>23–24.06</b>. Rozważ przesunięcie kluczowych zadań sprintu.
      </Alert>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
        {SQUADS.map((s) => (
          <Card key={s.name} padding={20}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span><span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.people} osoby</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}><span style={{ fontSize: 34, fontWeight: 800, lineHeight: .9, fontVariantNumeric: 'tabular-nums', color: s.accent }}>{s.pct}</span><span style={{ fontSize: 15, color: s.accent, fontWeight: 700, marginBottom: 5 }}>%</span><span style={{ marginLeft: 'auto', marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{s.ratio}</span></div>
            <ProgressBar value={s.pct} color={s.accent} height={9} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.minus}</div>
          </Card>
        ))}
      </div>
      <Card padding={22}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}><span style={{ fontWeight: 700, fontSize: 15 }}>Capacity Tribe w sprincie</span><span style={{ fontSize: 13, color: 'var(--muted)' }}>Razem: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>59 / 70</b> os-dni</span></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 130, paddingBottom: 24, position: 'relative' }}>
          {BARS.map(([lbl, h, risk], i) => (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', maxWidth: 46, height: h + '%', background: risk ? 'var(--danger)' : 'var(--brand)', borderRadius: '5px 5px 0 0' }} />
              <span style={{ fontSize: 10.5, color: risk ? 'var(--danger)' : 'var(--muted)', fontWeight: risk ? 600 : 400, position: 'absolute', bottom: 0 }}>{lbl}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
