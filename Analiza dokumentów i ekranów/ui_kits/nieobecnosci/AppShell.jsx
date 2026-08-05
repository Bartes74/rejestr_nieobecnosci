import React from 'react';
import { NavItem } from '../../components/navigation/NavItem.jsx';
import { Avatar } from '../../components/core/Avatar.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';

const Ic = ({ d, w = 18, sw = 1.8 }) => (<svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>);
const GRID = <><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></>;
const CAL = <><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></>;
const PLUS = <path d="M12 5v14M5 12h14"/>;
const CLOCK = <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>;
const FLAG = <><path d="M5 3v18"/><path d="M5 4h13l-2.5 3.5L18 11H5"/></>;
const CHART = <><path d="M4 20h16"/><rect x="5" y="11" width="3.2" height="6"/><rect x="10.4" y="6" width="3.2" height="11"/><rect x="15.8" y="13.5" width="3.2" height="3.5"/></>;
const LAYERS = <><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></>;
const USERS = <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.6M16.8 19a5.5 5.5 0 0 0-2.6-4.7"/></>;
const SLIDERS = <><path d="M4 7h9M19 7h1M4 17h2M12 17h8"/><circle cx="16" cy="7" r="2.3"/><circle cx="8.5" cy="17" r="2.3"/></>;
const SHIELD = <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z"/><path d="m9 12 2 2 4-4"/></>;

const NAV = [
  { group: 'PRACOWNIK', items: [['pulpit', 'Pulpit', GRID], ['wpis', 'Nowa nieobecność', PLUS], ['kalendarz', 'Kalendarz zespołu', CAL], ['historia', 'Moja historia', CLOCK]] },
  { group: 'PLANOWANIE', items: [['capacity', 'Capacity sprintu', FLAG]] },
  { group: 'DYREKTOR', items: [['raporty', 'Raporty i analizy', CHART], ['heatmapa', 'Heatmapa pokrycia', LAYERS]] },
  { group: 'ADMINISTRACJA', items: [['pracownicy', 'Pracownicy i struktura', USERS], ['konfiguracja', 'Konfiguracja', SLIDERS], ['audyt', 'Audyt i RODO', SHIELD]] },
];

export function AppShell({ view, onNav, title, roleTag, theme, onToggleTheme, children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100%', background: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <aside style={{ width: 250, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 18px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--on-brand)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{CAL}</svg></div>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>Nieobecności</div><div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>v2.0 · MVP</div></div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {NAV.map((sec) => (
            <div key={sec.group}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.13em', color: 'var(--muted)', padding: '14px 11px 6px' }}>{sec.group}</div>
              {sec.items.map(([id, label, d]) => (
                <NavItem key={id} active={view === id} onClick={() => onNav(id)} label={label} icon={<Ic d={d} />} />
              ))}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials="AK" tone="brand" size={34} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>Anna Kowalska</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Squad Płatności</div></div>
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 64, flex: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, overflow: 'hidden' }}>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>{title}</h1>
            {roleTag && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--brand)', background: 'var(--brand-tint)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{roleTag}</span>}
          </div>
          <button onClick={onToggleTheme} title="Motyw" style={{ width: 38, height: 38, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, cursor: 'pointer', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {theme === 'dark'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4 6.3 6.3 0 0 0 20 13.5z"/></svg>}
          </button>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 30px 60px' }}>{children}</main>
      </div>
    </div>
  );
}
