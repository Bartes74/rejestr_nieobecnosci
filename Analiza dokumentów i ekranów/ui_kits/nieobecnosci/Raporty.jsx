import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Button } from '../../components/core/Button.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';
import { Breadcrumb } from '../../components/navigation/Breadcrumb.jsx';
import { StatCard } from '../../components/data/StatCard.jsx';
import { ProgressBar } from '../../components/data/ProgressBar.jsx';
import { Table } from '../../components/data/Table.jsx';

const SQUADS = [['Squad Płatności', 61, 'var(--brand)'], ['Squad Onboarding', 47, 'var(--blue)'], ['Squad Mobilny', 58, 'var(--brand)'], ['Squad Rozliczenia', 64, 'var(--brand)'], ['Squad Integracje', 41, 'var(--blue)']];

export function Raporty() {
  const [period, setPeriod] = React.useState('Rok kalendarzowy');
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <SegmentedControl options={['Rok kalendarzowy', 'Rok budżetowy']} value={period} onChange={setPeriod} />
        <div style={{ flex: 1 }} />
        <Button variant="tint" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>}>Eksport .xlsx</Button>
      </div>
      <Breadcrumb style={{ marginBottom: 16 }} items={[{ label: 'Departament Bankowości Detalicznej' }, { label: 'Tribe „Klient Indywidualny"', active: true }, { label: 'Squad' }, { label: 'Osoba' }]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
        <StatCard label="Śr. wykorzystanie urlopu" value="54" unit="%" sub="w departamencie · 142 osoby" />
        <StatCard label="Dni nieobecności (rok)" value="1 248" sub="wszystkie typy łącznie" />
        <StatCard label="Zalega z urlopem" value="14" unit="osób" accent="var(--amber)" sub="powyżej progu zaległości" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16 }}>
        <Card title="Wykorzystanie urlopu wg squadu" padding={22}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, fontSize: 12.5 }}>
            {SQUADS.map(([n, p, c]) => (
              <div key={n}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span>{n}</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{p}%</span></div><ProgressBar value={p} color={c} height={9} /></div>
            ))}
          </div>
        </Card>
        <Card title="Kto zalega z urlopem" subtitle="Osoby z zaległym / niewybranym urlopem" padding={20}>
          <Table style={{ border: 'none', borderRadius: 0 }} columns={[{ key: 'o', label: 'OSOBA', width: '1.7fr', bold: true }, { key: 'z', label: 'ZALEGA', width: '.8fr', mono: true }, { key: 'd', label: 'DEADLINE', width: '1fr' }]}
            rows={[{ o: 'Tomasz Lewandowski', z: '8 dni', d: '30.06.2026' }, { o: 'Katarzyna Zielińska', z: '6 dni', d: '30.09.2026' }, { o: 'Magdalena Dąbrowska', z: '5 dni', d: '30.09.2026' }, { o: 'Jakub Wójcik', z: '4 dni', d: '30.11.2026' }]} />
        </Card>
      </div>
    </div>
  );
}
