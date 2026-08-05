import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Avatar } from '../../components/core/Avatar.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';

const DAYS = [['P',15],['W',16],['Ś',17],['C',18],['P',19],['S',20,1],['N',21,1],['P',22],['W',23],['Ś',24],['C',25],['P',26],['S',27,1],['N',28,1]];
const WE = [5,6,12,13];
const PEOPLE = [
  { g: 'Squad Płatności' },
  { i: 'AK', n: 'Anna Kowalska', r: [] },
  { i: 'MW', n: 'Marta Wiśniewska', r: [[7, 9]] },
  { i: 'RK', n: 'Rafał Kamiński', sub: 'Tech Lead', key: 1, r: [[8, 9]] },
  { g: 'Squad Onboarding' },
  { i: 'TL', n: 'Tomasz Lewandowski', r: [[8, 12]] },
  { i: 'KZ', n: 'Katarzyna Zielińska', r: [] },
];
const cellStyle = (i, ranges) => {
  const rg = ranges && ranges.find(([s, e]) => i >= s && i <= e);
  let bg = 'transparent', rad = '0';
  if (rg) { const [s, e] = rg; const st = i === s, en = i === e; bg = 'var(--absence)'; rad = (st && en) ? '8px' : st ? '8px 0 0 8px' : en ? '0 8px 8px 0' : '0'; }
  else if (WE.includes(i)) bg = 'var(--surface-3)';
  return { height: 34, borderLeft: '1px solid var(--border)', background: bg, borderRadius: rad };
};
const COLS = '208px repeat(14,minmax(0,1fr))';

export function Kalendarz() {
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 130 }}>Czerwiec 2026</span>
        <SegmentedControl options={['Tydzień', 'Sprint 13', 'Miesiąc']} value="Sprint 13" />
        <div style={{ flex: 1 }} />
        <Badge tone="neutral">Kto dziś nieobecny</Badge>
      </div>
      <Card padding={0}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.04em', alignSelf: 'center' }}>ZESPÓŁ · 7 OS.</div>
          {DAYS.map(([d, n, we], i) => (
            <div key={i} style={{ textAlign: 'center', padding: '7px 0 9px', borderLeft: '1px solid var(--border)', background: we ? 'var(--surface-3)' : 'transparent', color: n === 22 ? 'var(--brand)' : 'inherit', fontWeight: n === 22 ? 700 : 400 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d}</div><div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{n}</div>
            </div>
          ))}
        </div>
        {PEOPLE.map((p, idx) => p.g ? (
          <div key={idx} style={{ padding: '8px 16px', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}>{p.g}</div>
        ) : (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: COLS, borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
              <Avatar initials={p.i} tone="blue" size={28} />
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}>{p.n}{p.key ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} /> : null}</div>{p.sub && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{p.sub}</div>}</div>
            </div>
            {DAYS.map((_, i) => <div key={i} style={cellStyle(i, p.r)} />)}
          </div>
        ))}
      </Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 22, height: 13, borderRadius: 4, background: 'var(--absence)', border: '1px solid var(--absence-border)' }} />Nieobecność</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />Rola kluczowa</span>
      </div>
    </div>
  );
}
