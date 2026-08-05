import React from 'react';
import { Card } from '../../components/core/Card.jsx';
import { Button } from '../../components/core/Button.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Input } from '../../components/forms/Input.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';
import { Alert } from '../../components/feedback/Alert.jsx';

const CAL = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>;
const JUL = [['29',1],['30',1],['1'],['2'],['3'],['4',1],['5',1],['6'],['7'],['8'],['9'],['10'],['11',1],['12',1],['13'],['14','s'],['15','m'],['16','m'],['17','m'],['18','e'],['19',1],['20',1],['21'],['22'],['23'],['24'],['25',1],['26',1]];

export function Wpis({ onNav }) {
  const [wymiar, setWymiar] = React.useState('Cały dzień');
  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .95fr', gap: 18 }}>
        <Card padding={24}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>Zgłoś nieobecność</h2>
          <Select label="Typ nieobecności" value="Urlop wypoczynkowy" options={['Urlop wypoczynkowy', 'Urlop na żądanie', 'L4', 'Opieka (art. 188)']} style={{ marginBottom: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <Input label="Data od" icon={CAL} value="14.07.2026" />
            <Input label="Data do" icon={CAL} value="18.07.2026" />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 }}>Wymiar dnia</div>
          <SegmentedControl options={['Cały dzień', 'AM', 'PM', 'Godziny']} value={wymiar} onChange={setWymiar} style={{ marginBottom: 24, display: 'flex', width: '100%' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button>Zapisz nieobecność</Button>
            <Button variant="secondary" onClick={() => onNav && onNav('pulpit')}>Anuluj</Button>
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)' }} /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Podgląd na żywo</span></div>
            {[['Dni robocze w zakresie', '5'], ['Pominięto (weekend / święta)', '2'], ['Balans po zapisie', '15 → 10 dni']].map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}><span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{l}</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: i === 2 ? 700 : 600, fontSize: 14, color: i === 2 ? 'var(--brand)' : 'var(--ink)' }}>{v}</span></div>
            ))}
          </Card>
          <Alert variant="amber" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 1.5 21h21z"/><path d="M12 9v5M12 17.5v.5"/></svg>} title="Kolizja w zespole">W tym terminie nieobecny jest <b>Rafał Kamiński</b> (rola kluczowa). Zapis jest możliwy — to informacja, nie blokada.</Alert>
          <Card padding={16}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 11, letterSpacing: '.04em' }}>LIPIEC 2026</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontSize: 11.5 }}>
              {['P', 'W', 'Ś', 'C', 'P', 'S', 'N'].map((d, i) => <div key={i} style={{ textAlign: 'center', color: 'var(--muted)', paddingBottom: 3 }}>{d}</div>)}
              {JUL.map(([n, st], i) => {
                let s = { textAlign: 'center', padding: '6px 0', borderRadius: 0 };
                if (st === 1) Object.assign(s, { color: 'var(--muted)' });
                if (st === 's' || st === 'e') Object.assign(s, { background: 'var(--brand)', color: '#fff', fontWeight: 600, borderRadius: st === 's' ? '7px 0 0 7px' : '0 7px 7px 0' });
                if (st === 'm') Object.assign(s, { background: 'var(--brand-tint-2)', color: 'var(--brand)', fontWeight: 600 });
                return <div key={i} style={s}>{n}</div>;
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
