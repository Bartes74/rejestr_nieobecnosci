import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Button } from '../../components/core/Button.jsx';
import { Avatar } from '../../components/core/Avatar.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Alert } from '../../components/feedback/Alert.jsx';
import { ProgressBar } from '../../components/data/ProgressBar.jsx';
import { AbsencePill } from '../../components/data/AbsencePill.jsx';

const Row = ({ initials, name, unit, range, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
    <Avatar initials={initials} tone="blue" size={32} />
    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{unit}</div></div>
    <AbsencePill>{range}</AbsencePill>
  </div>
);

export function Pulpit({ onNav }) {
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 23, fontWeight: 700, margin: '0 0 3px' }}>Dzień dobry, Anna 👋</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Poniedziałek, 22 czerwca 2026 · Sprint 13 (16–27.06)</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 18 }}>
        <Card padding={24} style={{ borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div><div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Twój urlop · pozostało do rozplanowania</div><Badge mono>Rok kalendarzowy 2026</Badge></div>
            <Button onClick={() => onNav && onNav('wpis')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}>Zaplanuj nieobecność</Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}><span style={{ fontSize: 58, fontWeight: 800, lineHeight: .9, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>15</span><span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600, marginBottom: 9 }}>/ 26 dni</span><Badge tone="brand" style={{ marginLeft: 'auto', marginBottom: 11 }}>aktualizacja na żywo</Badge></div>
          <ProgressBar segments={[{ pct: 42, color: 'var(--brand)' }, { pct: 15, color: 'var(--absence-border)' }]} style={{ margin: '14px 0 18px' }} />
          <div style={{ display: 'flex', gap: 22 }}>
            {[['26', 'Pula roczna'], ['11', 'Wykorzystano', 'var(--brand)'], ['4', 'w tym zaległe']].map(([v, l, c], i) => (
              <div key={i} style={{ flex: 1, borderLeft: i ? '1px solid var(--border)' : 'none', paddingLeft: i ? 22 : 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: c || 'var(--ink)' }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Przypomnienia" padding={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Alert variant="amber" icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 1.5 21h21z"/><path d="M12 9v5M12 17.5v.5"/></svg>} style={{ padding: '12px 13px', borderRadius: 'var(--radius-lg)' }}><b style={{ color: 'var(--ink)' }}>Masz 4 dni zaległego urlopu.</b> Wykorzystaj do 30.09.2026.</Alert>
            <Alert variant="info" icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg>} style={{ padding: '12px 13px', borderRadius: 'var(--radius-lg)' }}>Zbliża się koniec okresu — zaplanuj pozostałe <b style={{ color: 'var(--ink)' }}>15 dni</b>.</Alert>
          </div>
        </Card>
        <Card title="Kto dziś / w tym tygodniu nieobecny" right={<a onClick={() => onNav && onNav('kalendarz')} style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600 }}>Kalendarz ›</a>} padding={20}>
          <Row initials="MW" name="Marta Wiśniewska" unit="Squad Płatności" range="dziś–24.06" />
          <Row initials="TL" name="Tomasz Lewandowski" unit="Squad Onboarding" range="23–27.06" />
          <Row initials="JW" name="Jakub Wójcik" unit="Squad Mobilny" range="26.06" last />
        </Card>
        <Card title="Moje najbliższe nieobecności" padding={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['14', 'LIP', '14–18 lipca 2026', '5 dni roboczych · zaplanowane'], ['01', 'WRZ', '1 września 2026 · pół dnia (PM)', '0,5 dnia · zaplanowane']].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
                <div style={{ textAlign: 'center', width: 42 }}><div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{r[0]}</div><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r[1]}</div></div>
                <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 13 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{r[2]}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r[3]}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
