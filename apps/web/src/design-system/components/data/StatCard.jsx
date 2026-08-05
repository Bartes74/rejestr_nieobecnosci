import React from 'react';

export function StatCard({ label, value, unit, sub, accent, style }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-sm)', padding: 20, ...style }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 0.9, letterSpacing: '-.01em',
          fontVariantNumeric: 'tabular-nums', color: accent || 'var(--ink)' }}>{value}</span>
        {unit && <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{sub}</div>}
    </div>
  );
}
