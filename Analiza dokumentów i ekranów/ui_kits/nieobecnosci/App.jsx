import React from 'react';
import { AppShell } from './AppShell.jsx';
import { Pulpit } from './Pulpit.jsx';
import { Wpis } from './Wpis.jsx';
import { Kalendarz } from './Kalendarz.jsx';
import { Historia } from './Historia.jsx';
import { Capacity } from './Capacity.jsx';
import { Raporty } from './Raporty.jsx';
import { Heatmapa } from './Heatmapa.jsx';
import { Pracownicy } from './Pracownicy.jsx';
import { Konfiguracja } from './Konfiguracja.jsx';
import { Audyt } from './Audyt.jsx';

const TITLES = {
  pulpit: ['Pulpit', 'Pracownik'], wpis: ['Nowa nieobecność', 'Pracownik'], kalendarz: ['Kalendarz zespołu', 'Pracownik / Lider'], historia: ['Moja historia', 'Pracownik'],
  capacity: ['Capacity sprintu', 'PO / Agile PM'], raporty: ['Raporty i analizy', 'Dyrektor'], heatmapa: ['Heatmapa pokrycia', 'Dyrektor'],
  pracownicy: ['Pracownicy i struktura', 'Administrator'], konfiguracja: ['Konfiguracja', 'Administrator'], audyt: ['Audyt i RODO', 'Administrator / IOD'],
};
const SCREENS = { pulpit: Pulpit, wpis: Wpis, kalendarz: Kalendarz, historia: Historia, capacity: Capacity, raporty: Raporty, heatmapa: Heatmapa, pracownicy: Pracownicy, konfiguracja: Konfiguracja, audyt: Audyt };

export function App() {
  const [view, setView] = React.useState('pulpit');
  const [theme, setTheme] = React.useState('light');
  const [title, role] = TITLES[view] || [view, ''];
  const Screen = SCREENS[view] || Pulpit;
  return (
    <div data-theme={theme} style={{ height: '100vh' }}>
      <AppShell view={view} onNav={setView} title={title} roleTag={role} theme={theme} onToggleTheme={() => setTheme((t) => t === 'light' ? 'dark' : 'light')}>
        <Screen onNav={setView} />
      </AppShell>
    </div>
  );
}
