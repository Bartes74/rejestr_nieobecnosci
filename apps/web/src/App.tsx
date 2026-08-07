import { Suspense, lazy, useEffect, useRef, useState, type LazyExoticComponent } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { plural } from '@nieobecnosci/core/plural';
import { TopSearch } from './TopSearch';
import { ErrorBoundary } from './ErrorBoundary';
import {
  BarChart3, Bell, Calendar, CalendarPlus, Clock, Layers, type LucideIcon,
  LayoutDashboard, LogOut, Moon, ShieldCheck, SlidersHorizontal, Sun, UserCog, Users, Zap,
} from 'lucide-react';
import { useAuth } from './current-employee';
import { api, type Me, type Role } from './api';
import { Login } from './screens/Login';
import { Avatar } from './design-system/components/core/Avatar';

// Ekrany schodzą do osobnych paczek. Pracownik z rolą EMPLOYEE widzi cztery pozycje menu,
// a pobierał kod Raportów, Heatmapy, Audytu i całej Konfiguracji — trasy, do których backend
// i tak by go nie wpuścił. Login zostaje w głównej paczce: to pierwszy ekran niezalogowanego.
const SCREENS: Record<string, LazyExoticComponent<() => JSX.Element>> = {
  '/pulpit': lazy(() => import('./screens/Pulpit').then((m) => ({ default: m.Pulpit }))),
  '/wpis': lazy(() => import('./screens/Wpis').then((m) => ({ default: m.Wpis }))),
  '/kalendarz': lazy(() => import('./screens/Kalendarz').then((m) => ({ default: m.Kalendarz }))),
  '/historia': lazy(() => import('./screens/Historia').then((m) => ({ default: m.Historia }))),
  '/zespol': lazy(() => import('./screens/Zespol').then((m) => ({ default: m.Zespol }))),
  '/capacity': lazy(() => import('./screens/Capacity').then((m) => ({ default: m.Capacity }))),
  '/raporty': lazy(() => import('./screens/Raporty').then((m) => ({ default: m.Raporty }))),
  '/heatmapa': lazy(() => import('./screens/Heatmapa').then((m) => ({ default: m.Heatmapa }))),
  '/pracownicy': lazy(() => import('./screens/Pracownicy').then((m) => ({ default: m.Pracownicy }))),
  '/konfiguracja': lazy(() => import('./screens/Konfiguracja').then((m) => ({ default: m.Konfiguracja }))),
  '/audyt': lazy(() => import('./screens/Audyt').then((m) => ({ default: m.Audyt }))),
};

// Zapowiedź bez migotania: rezerwujemy wysokość, żeby treść nie podskoczyła po doładowaniu,
// a fakt wczytywania zgłaszamy wyłącznie czytnikowi ekranu. Paczka trasy w sieci wewnętrznej
// schodzi w kilkadziesiąt milisekund — widoczny spinner byłby błyskiem, nie informacją.
function ScreenFallback() {
  return (
    <div style={{ minHeight: 280 }} role="status" aria-live="polite">
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Wczytywanie ekranu…</span>
    </div>
  );
}

// Widoczność pozycji menu odwzorowuje @Roles kontrolerów — użytkownik ma widzieć tylko to, z czego
// realnie skorzysta. Backend pozostaje źródłem prawdy (odpowie 403); przy rozbieżności poprawiamy tutaj.
const isAdmin = (me: Me) => me.role === 'ADMIN';
// FR-A5 — ekran „Zespół" widoczny dla osób mogących korygować cudze wpisy (lider/admin/MODIFY_ABSENCE).
const canManageTeam = (me: Me) => me.role === 'LEADER' || me.role === 'ADMIN' || me.permissions.includes('MODIFY_ABSENCE');
// FR-D2/C4 — capacity i heatmapa pokrycia tylko dla ról planujących (jak RBAC endpointu /capacity).
const canSeeCapacity = (me: Me) => (['PO', 'LEADER', 'DIRECTOR', 'ADMIN'] as Role[]).includes(me.role);
// FR-F2 — raporty jak @Roles kontrolera /reports (PO nie, PMO tak).
const canSeeReports = (me: Me) => (['LEADER', 'DIRECTOR', 'ADMIN', 'PMO'] as Role[]).includes(me.role);
// Konfiguracja to panel administratora; PMO wchodzi wyłącznie po analitykę adopcji (/analytics/adoption).
const canSeeConfig = (me: Me) => me.role === 'ADMIN' || me.role === 'PMO';

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Pracownik', LEADER: 'Lider', PO: 'Product Owner', DIRECTOR: 'Dyrektor', PMO: 'PMO', ADMIN: 'Administrator',
};

// Nawigacja pogrupowana wg odbiorcy (wg prototypu); tytuł w topbarze = label.
type NavItem = { to: string; label: string; icon: LucideIcon; can?: (me: Me) => boolean };
type NavGroup = { group: string; items: NavItem[] };
const NAV: NavGroup[] = [
  { group: 'Pracownik', items: [
    { to: '/pulpit', label: 'Pulpit', icon: LayoutDashboard },
    { to: '/wpis', label: 'Nowa nieobecność', icon: CalendarPlus },
    { to: '/kalendarz', label: 'Kalendarz zespołu', icon: Calendar },
    { to: '/historia', label: 'Moja historia', icon: Clock },
  ] },
  { group: 'Planowanie', items: [
    { to: '/capacity', label: 'Capacity sprintu', icon: Zap, can: canSeeCapacity },
    { to: '/zespol', label: 'Zespół', icon: UserCog, can: canManageTeam },
  ] },
  { group: 'Dyrektor', items: [
    { to: '/raporty', label: 'Raporty i analizy', icon: BarChart3, can: canSeeReports },
    { to: '/heatmapa', label: 'Heatmapa pokrycia', icon: Layers, can: canSeeCapacity },
  ] },
  { group: 'Administracja', items: [
    { to: '/pracownicy', label: 'Pracownicy i struktura', icon: Users, can: isAdmin },
    { to: '/konfiguracja', label: 'Konfiguracja', icon: SlidersHorizontal, can: canSeeConfig },
    { to: '/audyt', label: 'Audyt i RODO', icon: ShieldCheck, can: isAdmin },
  ] },
];
const visibleGroups = (me: Me | undefined): NavGroup[] =>
  NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.can || (me ? n.can(me) : false)) })).filter((g) => g.items.length);
const allItems = NAV.flatMap((g) => g.items);

// Wejście z adresu na ekran ukryty przed rolą: trasa nie istnieje, więc trafia tu. Rozróżniamy brak
// uprawnień od literówki w adresie — „nie znaleziono" dla istniejącej sekcji byłoby nieprawdą.
function NotAvailable() {
  const location = useLocation();
  const known = allItems.some((n) => n.to === location.pathname);
  return (
    <div style={{ animation: 'fu .2s ease' }}>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--ink)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
        {known ? 'Nie masz dostępu do tej sekcji' : 'Nie znaleziono strony'}
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}>
        {known
          ? 'Ta część aplikacji jest dostępna dla innych ról. W menu po lewej widzisz wszystko, do czego masz uprawnienia.'
          : 'Sprawdź adres lub wróć na pulpit.'}
      </p>
      <Link to="/pulpit" style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--brand)' }}>Wróć na pulpit</Link>
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
          <Calendar size={19} aria-hidden="true" />
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Nieobecności</span>
      </div>
      <nav aria-label="Menu główne" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {visibleGroups(current).map(({ group, items }) => (
          <div key={group}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--muted)', padding: '16px 11px 6px' }}>{group}</div>
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} style={({ isActive }) => navA(isActive)}>
                <Icon size={18} aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials={initials} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current ? `${current.firstName} ${current.lastName}` : ''}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted)' }}>{current ? (ROLE_LABEL[current.role] ?? current.role) : ''}</div>
        </div>
        <button type="button" aria-label="Wyloguj" title="Wyloguj" onClick={logout} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 6, borderRadius: 7, border: 'none', background: 'transparent' }}><LogOut size={17} aria-hidden="true" /></button>
      </div>
    </aside>
  );
}

function Topbar({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const location = useLocation();
  const { current } = useAuth();
  // Tytuł tylko z pozycji widocznych dla zalogowanego — inaczej ekran bez dostępu dostałby
  // nagłówek „Konfiguracja · Administrator" nad komunikatem o braku uprawnień.
  const meta = visibleGroups(current).flatMap((g) => g.items).find((n) => n.to === location.pathname);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notif, setNotif] = useState<{ items: { kind: string; text: string; severity: string }[]; count: number }>({ items: [], count: 0 });
  const bellRef = useRef<HTMLButtonElement>(null);
  // Kanał powiadomień odświeżamy przy wejściu i przy otwarciu panelu, a nie przy każdej zmianie
  // trasy — to było dodatkowe żądanie do każdej nawigacji, obok pobrania paczki ekranu.
  // ponytail: licznik może się zestarzeć w długiej sesji; jeśli zacznie to przeszkadzać,
  //           dołóż odświeżanie co kilka minut albo kanał SSE.
  const loadNotif = () => { api.notificationsFeed().then(setNotif).catch(() => {}); };
  useEffect(loadNotif, []);

  // Warstwa nakładana musi dać się zamknąć z klawiatury i oddać fokus temu, kto ją otworzył —
  // bez tego użytkownik klawiatury zostaje uwięziony za otwartym panelem.
  useEffect(() => {
    if (!notifOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setNotifOpen(false); bellRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notifOpen]);

  const iconBtn = { width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;
  return (
    <header style={{ height: 64, flex: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', position: 'sticky', top: 0, zIndex: 5 }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: '-.01em', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{meta?.label ?? 'Nieobecności'}</h1>
        </div>
      </div>
      <TopSearch />
      <button type="button" aria-label={dark ? 'Tryb jasny' : 'Tryb ciemny'} title="Przełącz motyw" onClick={onToggleTheme} style={iconBtn}>
        {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>
      <div style={{ position: 'relative' }}>
        <button ref={bellRef} type="button" aria-expanded={notifOpen} aria-haspopup="true"
          aria-label={notif.count > 0 ? `Powiadomienia: ${notif.count} ${plural(notif.count, ['nowe', 'nowe', 'nowych'])}` : 'Powiadomienia: brak nowych'}
          onClick={() => { if (!notifOpen) loadNotif(); setNotifOpen((v) => !v); }} style={{ ...iconBtn, position: 'relative' }}>
          <Bell size={18} aria-hidden="true" />
          {notif.count > 0 && (
            <span aria-hidden="true" style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--danger)', color: 'var(--on-danger)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', border: '2px solid var(--surface)' }}>{notif.count}</span>
          )}
        </button>
        {notifOpen && (
          <>
            {/* Kliknięcie obok zamyka panel; z klawiatury robi to Esc, dlatego tło jest poza
                kolejnością tabulacji — pełnoekranowy przycisk w tabulacji byłby pułapką. */}
            <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setNotifOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 19, border: 'none', background: 'transparent', cursor: 'default' }} />
            <div role="region" aria-label="Powiadomienia" style={{ position: 'absolute', top: 46, right: 0, width: 320, maxHeight: 'min(60vh, 420px)', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', zIndex: 20 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', position: 'sticky', top: 0, background: 'var(--surface)' }}>Powiadomienia</div>
              {notif.items.length === 0 && <div style={{ padding: 16, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted)' }}>Brak nowych powiadomień.</div>}
              {notif.items.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {notif.items.map((it, i) => {
                    const col = it.severity === 'danger' ? 'var(--danger)' : it.severity === 'warning' ? 'var(--amber)' : 'var(--blue)';
                    return (
                      <li key={i} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: col, marginTop: 5, flex: 'none' }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.8, color: 'var(--ink-2)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{it.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
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
            <Suspense fallback={<ScreenFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/pulpit" replace />} />
              {visibleGroups(current).flatMap((g) => g.items).map(({ to }) => {
                const Screen = SCREENS[to];
                return Screen ? <Route key={to} path={to} element={<Screen />} /> : null;
              })}
              <Route path="*" element={<NotAvailable />} />
            </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
