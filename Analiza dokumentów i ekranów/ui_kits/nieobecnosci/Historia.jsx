import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Tabs } from '../../components/navigation/Tabs.jsx';
import { Table } from '../../components/data/Table.jsx';

const ROWS = [
  ['14–18.07.2026', '5', 'Urlop wypoczynkowy', 'Samodzielny', ['Zaplanowane', 'blue'], 'Wycofaj'],
  ['01.09.2026 · PM', '0,5', 'Urlop wypoczynkowy', 'Samodzielny', ['Zaplanowane', 'blue'], 'Wycofaj'],
  ['02–06.06.2026', '5', 'Urlop wypoczynkowy', 'Samodzielny', ['Zrealizowane', 'neutral'], ''],
  ['14–16.04.2026', '3', 'L4', 'Dodał: Lider', ['Zrealizowane', 'neutral'], ''],
  ['02.01.2026', '1', 'Urlop na żądanie', 'Samodzielny', ['Zrealizowane', 'neutral'], ''],
];

export function Historia() {
  const [tab, setTab] = React.useState('Wszystkie');
  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Tabs tabs={['Wszystkie', 'Nadchodzące', 'Zrealizowane']} value={tab} onChange={setTab} style={{ border: 'none', gap: 14 }} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>2026 · rok kalendarzowy</span>
      </div>
      <Table
        columns={[
          { key: 'zakres', label: 'ZAKRES', width: '1.6fr', bold: true },
          { key: 'dni', label: 'DNI', width: '.6fr', mono: true },
          { key: 'typ', label: 'TYP', width: '1.5fr' },
          { key: 'zr', label: 'ŹRÓDŁO', width: '1.3fr' },
          { key: 'status', label: 'STATUS', width: '1fr' },
          { key: 'akcja', label: '', width: '.9fr' },
        ]}
        rows={ROWS.map(([zakres, dni, typ, zr, [st, tone], akcja]) => ({
          zakres, dni,
          typ: typ === 'L4'
            ? <span>L4 <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 5, marginLeft: 4 }}>widoczne tylko dla Ciebie</span></span>
            : <span style={{ color: 'var(--ink-2)' }}>{typ}</span>,
          zr: <span style={{ color: 'var(--muted)' }}>{zr}</span>,
          status: <Badge tone={tone}>{st}</Badge>,
          akcja: akcja ? <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{akcja}</span> : '',
        }))}
      />
    </div>
  );
}
