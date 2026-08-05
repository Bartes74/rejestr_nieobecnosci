import type { Balance } from './api';

// FR-B2 — licznik: pula (+ zaległe) / wykorzystano / pozostało.
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 30, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--brand)' : 'var(--ink)', marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

export function BalanceCounter({ bal }: { bal: Balance }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14, maxWidth: 560 }}>
        <Stat label="Pula + zaległe" value={bal.pool + bal.carriedOver} />
        <Stat label="Wykorzystano" value={bal.used} />
        <Stat label="Pozostało" value={bal.remaining} accent />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
        Okres {bal.period.type === 'CALENDAR' ? 'kalendarzowy' : 'budżetowy'} {bal.period.from} – {bal.period.to}
        {bal.minimumToLeave ? <> · min. do pozostawienia {bal.minimumToLeave}</> : null}
      </div>
    </div>
  );
}
