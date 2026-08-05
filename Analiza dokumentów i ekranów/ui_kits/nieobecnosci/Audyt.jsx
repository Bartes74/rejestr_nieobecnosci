import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Button } from '../../components/core/Button.jsx';
import { Switch } from '../../components/forms/Switch.jsx';
import { Table } from '../../components/data/Table.jsx';

const LOG = [
  ['22.06 09:42', 'Anna Kowalska', ['Dodanie wpisu', 'var(--brand)'], 'Nieobecność'],
  ['22.06 08:55', 'Lider (M. Nowak)', ['Konwersja → L4', 'var(--amber)'], 'Nieobecność'],
  ['21.06 16:20', 'Administrator', ['Zmiana puli', 'var(--ink-2)'], 'Pracownik'],
  ['21.06 14:03', 'K. Zielińska', ['Odmowa: odczyt L4', 'var(--danger)'], 'Znacznik L4'],
  ['21.06 11:10', 'Administrator', ['Nadanie uprawnień', 'var(--ink-2)'], 'Rola'],
];

export function Audyt() {
  const [anon, setAnon] = React.useState(true);
  const [safe, setSafe] = React.useState(true);
  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'linear-gradient(120deg,var(--brand-tint),var(--brand-tint-2))', border: '1px solid var(--absence-border)', borderRadius: 'var(--radius-xl)', padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 'var(--radius-md)', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--on-brand)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7.5 3v5.5c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z"/><path d="m9 12 2 2 4-4"/></svg></div>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>Ochrona znacznika L4 (dane o zdrowiu · art. 9 RODO)</div><div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>Informacja „to jest L4" dostępna wyłącznie dla ról uprawnionych (administrator, osoba z uprawnieniem rozszerzonym). Pozostali widzą tylko „nieobecność". Każda próba odczytu przez nieuprawnioną rolę jest blokowana i logowana.</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18 }}>
        <Card title="Dziennik audytu" padding={20}>
          <Table style={{ border: 'none', borderRadius: 0 }}
            columns={[{ key: 't', label: 'CZAS', width: '1.3fr', mono: true }, { key: 'u', label: 'UŻYTKOWNIK', width: '1.4fr' }, { key: 'a', label: 'AKCJA', width: '1.3fr' }, { key: 'e', label: 'ENCJA', width: '1fr' }]}
            rows={LOG.map(([t, u, [a, c], e]) => ({ t: <span style={{ color: 'var(--muted)' }}>{t}</span>, u, a: <span style={{ color: c, fontWeight: 600 }}>{a}</span>, e: <span style={{ color: 'var(--muted)' }}>{e}</span> }))} />
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Retencja i RODO" padding={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>Okres przechowywania</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>36 mies.</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>Anonimizacja b. pracowników</span><Switch checked={anon} onChange={setAnon} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>Bezpieczne eksporty (bez L4)</span><Switch checked={safe} onChange={setSafe} /></div>
          </Card>
          <Card title="Prawo do bycia zapomnianym" padding={18}>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>Po upływie retencji dane są anonimizowane lub usuwane zgodnie z polityką.</div>
            <Button variant="secondary" size="sm" style={{ width: '100%' }}>Rejestr czynności przetwarzania</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
