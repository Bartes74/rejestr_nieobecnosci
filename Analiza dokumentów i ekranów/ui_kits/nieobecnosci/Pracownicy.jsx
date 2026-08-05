import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Button } from '../../components/core/Button.jsx';
import { Input } from '../../components/forms/Input.jsx';
import { Avatar } from '../../components/core/Avatar.jsx';
import { Table } from '../../components/data/Table.jsx';

const ROWS = [
  ['AK', 'Anna Kowalska', 'brand', 'Płatności · Chapter Inż.', '26', '4'],
  ['PN', 'Piotr Nowak', 'blue', 'Mobilny', '19', '0'],
  ['MW', 'Marta Wiśniewska', 'brand', 'Płatności', '26', '2'],
  ['TL', 'Tomasz Lewandowski', 'neutral', 'Onboarding', '19', '8'],
  ['RK', 'Rafał Kamiński', 'brand', 'Płatności · kluczowa', '30', '1'],
  ['JW', 'Jakub Wójcik', 'blue', 'Mobilny', '20', '4'],
];
const TREE = [['Dep. Bankowości Detal.', 0, 'caret'], ['Tribe „Klient Indywidualny"', 1, 'active'], ['Squad Płatności', 2, '3'], ['Squad Onboarding', 2, '2'], ['Squad Mobilny', 2, '2'], ['Tribe „Klient Biznesowy"', 1, 'caret2'], ['Chapter „Inżynieria"', 1, 'caret2']];

export function Pracownicy() {
  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '268px 1fr', gap: 18 }}>
        <Card title="Struktura organizacyjna" padding={18} style={{ height: 'fit-content' }}>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TREE.map(([label, depth, kind], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', paddingLeft: 8 + depth * 16, borderRadius: 7, fontWeight: kind === 'active' || depth === 0 ? 600 : 400, color: kind === 'active' ? 'var(--brand)' : 'var(--ink-2)', background: kind === 'active' ? 'var(--brand-tint)' : 'transparent' }}>
                {(kind === 'caret' || kind === 'active' || kind === 'caret2') && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={kind === 'caret2' ? 'm9 6 6 6-6 6' : 'm6 9 6 6 6-6'} /></svg>}
                <span style={{ flex: 1 }}>{label}</span>
                {!isNaN(Number(kind)) && <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{kind}</span>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>Jedna osoba może należeć do wielu jednostek — dane agregują się we wszystkich.</div>
        </Card>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Input icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/></svg>} placeholder="Szukaj pracownika…" style={{ flex: 1 }} />
            <Button variant="secondary" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>}>Import .xlsx</Button>
            <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--on-brand)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}>Dodaj</Button>
          </div>
          <Table columns={[{ key: 'p', label: 'PRACOWNIK', width: '1.9fr', bold: true }, { key: 'j', label: 'JEDNOSTKI', width: '1.5fr' }, { key: 'pula', label: 'PULA', width: '.7fr', mono: true }, { key: 'z', label: 'ZALEGŁE', width: '.8fr', mono: true }, { key: 's', label: 'STATUS', width: '.9fr' }]}
            rows={ROWS.map(([ini, name, tone, unit, pula, zal]) => ({
              p: <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar initials={ini} tone={tone} size={28} /><span style={{ fontWeight: 600 }}>{name}</span></span>,
              j: <span style={{ color: 'var(--muted)', fontSize: 12 }}>{unit}</span>, pula, z: zal,
              s: <span style={{ fontSize: 12, color: 'var(--ink-2)' }}><span style={{ color: 'var(--brand)' }}>●</span> Aktywny</span>,
            }))} />
        </div>
      </div>
    </div>
  );
}
