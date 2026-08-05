import React from 'react';

export function ProgressBar({ value, color = 'var(--brand)', segments, height = 11, style }) {
  const segs = segments || [{ pct: value, color }];
  return (
    <div style={{ display: 'flex', height, borderRadius: 7, overflow: 'hidden', background: 'var(--surface-3)', ...style }}>
      {segs.map((s, i) => (
        <div key={i} style={{ width: s.pct + '%', background: s.color || color }} />
      ))}
    </div>
  );
}
