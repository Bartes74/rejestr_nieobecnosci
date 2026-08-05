import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import {
  BarChart3, Bell, Calendar, CalendarPlus, Clock, Layers, type LucideIcon,
  LayoutDashboard, LogOut, Moon, Search, ShieldCheck, SlidersHorizontal, Sun, UserCog, Users, Zap,
} from 'lucide-react';
import { useAuth } from './current-employee';
import { api, type Me } from './api';
import { Pulpit } from './screens/Pulpit';
import { Wpis } from './screens/Wpis';
import { Historia } from './screens/Historia';
import { Kalendarz } from './screens/Kalendarz';
import { Zespol } from './screens/Zespol';
import { Capacity } from './screens/Capacity';
import { Raporty } from './screens/Raporty';
import { Heatmapa } from './screens/Heatmapa';
import { Pracownicy } from './screens/Pracownicy';
import { Konfiguracja } from './screens/Konfiguracja';
import { Audyt } from './screens/Audyt';
import { Login } from './screens/Login';

const SCREENS: Record<string, () => JSX.Element> = {
  '/pulpit': Pulpit,
  '/wpis': Wpis,
  '/kalendarz': Kalendarz,
  '/historia': Historia,
  '/zespol': Zespol,
  '/capacity': Capacity,
  '/raporty': Raporty,
  '/heatmapa': Heatmapa,
  '/pracownicy': Pracownicy,
  '/konfiguracja': Konfiguracja,
  '/audyt': Audyt,
};

// FR-A5 — ekran „Zespół" widoczny dla osób mogących korygować cudze wpisy (lider/admin/MODIFY_ABSENCE).
const canManageTeam = (me: Me) => me.role === 'LEADER' || me.role === 'ADMIN' || me.permissions.includes('MODIFY_ABSENCE');
// FR-D2/C4 — capacity i heatmapa pokrycia tylko dla ról planujących (jak RBAC endpointu /capacity).
const canSeeCapacity = (me: Me) => ['PO', 'LEADER', 'DIRECTOR', 'ADMIN'].includes(me.role);

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Pracownik', LEADER: 'Lider', PO: 'Product Owner', DIRECTOR: 'Dyrektor', PMO: 'PMO', ADMIN: 'Administrator',
};

// Nawigacja pogrupowana wg odbiorcy (wg prototypu): tytuł w topbarze = label, `tag` = rola-odbiorca ekranu.
type NavItem = { to: string; label: string; tag: string; icon: LucideIcon; can?: (me: Me) => boolean };
type NavGroup = { group: string; items: NavItem[] };
const NAV: NavGroup[] = [
  { group: 'Pracownik', items: [
    { to: '/pulpit', label: 'Pulpit', tag: 'Pracownik', icon: LayoutDashboard },
    { to: '/wpis', label: 'Nowa nieobecność', tag: 'Pracownik', icon: CalendarPlus },
    { to: '/kalendarz', label: 'Kalendarz zespołu', tag: 'Pracownik · Lider', icon: Calendar },
    { to: '/historia', label: 'Moja historia', tag: 'Pracownik', icon: Clock },
  ] },
  { group: 'Planowanie', items: [
    { to: '/capacity', label: 'Capacity sprintu', tag: 'PO · Agile PM', icon: Zap },
    { to: '/zespol', label: 'Zespół', tag: 'Lider', icon: UserCog, can: canManageTeam },
  ] },
  { group: 'Dyrektor', items: [
    { to: '/raporty', label: 'Raporty i analizy', tag: 'Dyrektor', icon: BarChart3 },
    { to: '/heatmapa', label: 'Heatmapa pokrycia', tag: 'Dyrektor', icon: Layers, can: canSeeCapacity },
  ] },
  { group: 'Administracja', items: [
    { to: '/pracownicy', label: 'Pracownicy i struktura', tag: 'Administrator', icon: Users },
    { to: '/konfiguracja', label: 'Konfiguracja', tag: 'Administrator', icon: SlidersHorizontal },
    { to: '/audyt', label: 'Audyt i RODO', tag: 'Administrator · IOD', icon: ShieldCheck },
  ] },
];
const visibleGroups = (me: Me | undefined): NavGroup[] =>
  NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.can || (me ? n.can(me) : false)) })).filter((g) => g.items.length);
const allItems = NAV.flatMap((g) => g.items);

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ animation: 'fu .2s ease' }}>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 14 }}>
        {title} — ekran zostanie zbudowany w kolejnym kroku planu.
      </p>
    </div>
  );
}

const navA = (active: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', margin: '1px 0', borderRadius: 9,
  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, letterSpacing: '.005em', textDecoration: 'none',
  transition: 'background .14s, color .14s',
  color: active ? 'var(--brand)' : 'var(--ink-2)', background: active ? 'var(--brand-tint)' : 'transparent',
} as const);

function Sidebar() {
  const { current, logout } = useAuth();
  const initials = current ? `${current.firstName[0] ?? ''}${current.lastName[0] ?? ''}` : '';
  return (
    <aside style={{ width: 250, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 18px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', display: 'grid', placeItems: 'center' }}>
          <Calendar size={19} />
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nieobecności</span>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {visibleGroups(current).map(({ group, items }) => (
          <div key={group}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--muted)', padding: '16px 11px 6px' }}>{group}</div>
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} style={({ isActive }) => navA(isActive)}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand-tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current ? `${current.firstName} ${current.lastName}` : ''}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted)' }}>{current ? (ROLE_LABEL[current.role] ?? current.role) : ''}</div>
        </div>
        <button type="button" aria-label="Wyloguj" title="Wyloguj" onClick={logout} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 6, borderRadius: 7, border: 'none', background: 'transparent' }}><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

function Topbar({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const location = useLocation();
  const meta = allItems.find((n) => n.to === location.pathname);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notif, setNotif] = useState<{ items: { kind: string; text: string; severity: string }[]; count: number }>({ items: [], count: 0 });
  useEffect(() => { api.notificationsFeed().then(setNotif).catch(() => {}); }, [location.pathname]);
  const iconBtn = { width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;
  return (
    <header style={{ height: 64, flex: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', position: 'sticky', top: 0, zIndex: 5 }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: '-.01em', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{meta?.label ?? 'Nieobecności'}</h1>
          {meta?.tag && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--brand)', background: 'var(--brand-tint)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', flex: 'none' }}>{meta.tag}</span>}
        </div>
      </div>
      {/* ponytail: wyszukiwarka wizualna wg prototypu; filtrowanie dołożymy, gdy będzie potrzebne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontSize: 13, flex: '0 1 220px', minWidth: 44, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <Search size={16} style={{ flex: 'none' }} /> Szukaj osoby…
      </div>
      <button type="button" aria-label={dark ? 'Tryb jasny' : 'Tryb ciemny'} title="Przełącz motyw" onClick={onToggleTheme} style={iconBtn}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div style={{ position: 'relative' }}>
        <button type="button" aria-label="Powiadomienia" onClick={() => setNotifOpen((v) => !v)} style={{ ...iconBtn, position: 'relative' }}>
          <Bell size={18} />
          {notif.count > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--danger)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', border: '2px solid var(--surface)' }}>{notif.count}</span>
          )}
        </button>
        {notifOpen && (
          <>
            <button type="button" aria-label="Zamknij powiadomienia" onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19, border: 'none', background: 'transparent', cursor: 'default' }} />
            <div style={{ position: 'absolute', top: 46, right: 0, width: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 20, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Powiadomienia</div>
              {notif.items.length === 0 && <div style={{ padding: 16, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Brak nowych powiadomień.</div>}
              {notif.items.map((it, i) => {
                const col = it.severity === 'danger' ? 'var(--danger)' : it.severity === 'warning' ? 'var(--amber)' : 'var(--blue)';
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, marginTop: 5, flex: 'none' }} />
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.8, color: 'var(--ink-2)', lineHeight: 1.45 }}>{it.text}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export function App() {
  const { current, ready } = useAuth();
  const location = useLocation();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  if (!ready) return null;
  if (!current) return <Login />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar dark={dark} onToggleTheme={() => setDark((v) => !v)} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 30px 60px' }}>
          <ErrorBoundary key={location.pathname}>
            <Routes>
              <Route path="/" element={<Navigate to="/pulpit" replace />} />
              {visibleGroups(current).flatMap((g) => g.items).map(({ to, label }) => {
                const Screen = SCREENS[to];
                return <Route key={to} path={to} element={Screen ? <Screen /> : <Placeholder title={label} />} />;
              })}
              <Route path="*" element={<Placeholder title="Nie znaleziono" />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
