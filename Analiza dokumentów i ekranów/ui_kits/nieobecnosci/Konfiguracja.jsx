import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Button } from '../../components/core/Button.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Tabs } from '../../components/navigation/Tabs.jsx';
import { Table } from '../../components/data/Table.jsx';

const TYPY = [
  ['Urlop wypoczynkowy', 'Tak', 'Tak', null],
  ['Urlop na żądanie', 'Tak', 'Tak', null],
  ['L4 (zwolnienie chorobowe)', 'Nie', 'Tak', 'Dane o zdrowiu'],
  ['Opieka (art. 188 KP)', 'Nie', 'Tak', null],
  ['Urlop okolicznościowy', 'Nie', 'Tak', null],
];
const Yes = ({ v }) => <span style={{ color: v === 'Tak' ? 'var(--brand)' : 'var(--muted)', fontWeight: 600 }}>{v}</span>;

export function Konfiguracja() {
  const [tab, setTab] = React.useState('Typy nieobecności');
  return (
    <div style={{ maxWidth: 1200 }}>
      <Tabs tabs={['Typy nieobecności', 'Pula urlopu', 'Święta i dni wolne', 'Sprinty (QBR)']} value={tab} onChange={setTab} style={{ marginBottom: 18 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        <Card title="Typy nieobecności" right={<Button size="sm">+ Dodaj typ</Button>} padding={20}>
          <Table style={{ border: 'none', borderRadius: 0 }}
            columns={[{ key: 'n', label: 'NAZWA TYPU', width: '1.6fr', bold: true }, { key: 'p', label: 'OBNIŻA PULĘ', width: '.9fr' }, { key: 'c', label: 'CAPACITY', width: '.9fr' }, { key: 'k', label: 'KAT. SZCZEGÓLNA', width: '1.2fr' }]}
            rows={TYPY.map(([n, p, c, k]) => ({ n, p: <Yes v={p} />, c: <Yes v={c} />, k: k ? <Badge tone="danger" dot>{k}</Badge> : <span style={{ color: 'var(--muted)' }}>—</span> }))} />
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Pula urlopu" padding={18}>
            {[['Pula globalna', '26 dni'], ['Wymiar okresowy (Q2)', '19 dni'], ['Korekty indywidualne', '7 osób']].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', fontSize: 13 }}><span style={{ color: 'var(--ink-2)' }}>{l}</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{v}</span></div>
            ))}
          </Card>
          <Card title="Święta i dni wolne" right={<span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>2026</span>} padding={18}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-2)' }}>Boże Ciało</span><span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>04.06</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-2)' }}>Wniebowzięcie NMP</span><span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>15.08</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--brand-tint)', margin: '0 -8px', padding: '5px 8px', borderRadius: 6 }}><span style={{ color: 'var(--brand)', fontWeight: 600 }}>Odbiór za 15.08 (sob)</span><span style={{ color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}>14.08</span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
