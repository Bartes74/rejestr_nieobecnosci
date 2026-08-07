import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Info, Lock, User } from 'lucide-react';
import { useAuth } from '../current-employee';
import { panel } from '../design-system/surfaces';

const inputWrap = {
  display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)',
  borderRadius: 10, padding: '12px 14px', marginBottom: 16,
} as const;
const inputEl = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)',
  fontFamily: 'var(--font-sans)', fontSize: 14, minWidth: 0,
} as const;
const labelEl = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } as const;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [l, setL] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(l.trim(), p);
      // Zawsze na pulpit: adres przeżywa wylogowanie, więc bez tego kolejny użytkownik
      // ląduje na ekranie poprzednika (często poza swoimi uprawnieniami). `replace` —
      // żeby „wstecz" nie wracało do sesji poprzednika.
      navigate('/pulpit', { replace: true });
    } catch (e) {
      // Brak sieci i niedostępny serwer to inny problem niż złe hasło — zlanie ich w jeden
      // komunikat kazałoby użytkownikowi w kółko przepisywać poprawne hasło.
      const m = e instanceof Error ? e.message : '';
      setErr(/połączeni|niedostępn|serwer/i.test(m) ? m : 'Błędny login lub hasło.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--canvas)' }}>
      {/* HERO (lewa) — chowana na wąskich ekranach */}
      <div className="login-hero" style={{ flex: 1.05, background: 'linear-gradient(150deg,#006A4E 0%,#007A53 55%,#00533E 100%)', color: '#fff', padding: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 1px 1px,#fff 1.4px,transparent 0)', backgroundSize: '26px 26px' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center' }}><Calendar size={22} /></div>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, letterSpacing: '.01em' }}>Nieobecności</span>
        </div>
        <div style={{ position: 'relative', maxWidth: 460 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 18 }}>Jedno źródło prawdy</div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 40, lineHeight: 1.12, fontWeight: 800, margin: '0 0 18px', letterSpacing: '-.02em' }}>Planowanie i monitorowanie nieobecności całego departamentu</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15.5, lineHeight: 1.6, opacity: 0.86, margin: 0 }}>Koniec z awaryjnymi plikami Excel i blokadami. Wielodostęp w czasie rzeczywistym, automatyczna agregacja w górę hierarchii i czytelny licznik wykorzystania urlopu.</p>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 30, fontFamily: 'var(--font-sans)', fontSize: 13, opacity: 0.82 }}>
          {[['~300', 'użytkowników'], ['6', 'zespołów'], ['0', 'blokad pliku']].map(([n, t]) => (
            <div key={t}><div style={{ fontWeight: 700, fontSize: 21, fontFamily: 'var(--font-mono)' }}>{n}</div>{t}</div>
          ))}
        </div>
      </div>

      {/* FORMULARZ (prawa) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 25, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-.01em', color: 'var(--ink)' }}>Zaloguj się</h2>
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 14, margin: '0 0 30px' }}>Użyj konta służbowego, aby kontynuować.</p>

          <label htmlFor="login" style={labelEl}>Login</label>
          <div style={inputWrap}>
            <User size={17} color="var(--muted)" style={{ flex: 'none' }} aria-hidden="true" />
            <input id="login" style={inputEl} value={l} onChange={(e) => setL(e.target.value)} autoComplete="username"
              placeholder="np. anna" required aria-invalid={!!err || undefined} aria-describedby={err ? 'login-error' : undefined} />
          </div>

          <label htmlFor="haslo" style={labelEl}>Hasło</label>
          <div style={{ ...inputWrap, marginBottom: 22 }}>
            <Lock size={17} color="var(--muted)" style={{ flex: 'none' }} aria-hidden="true" />
            <input id="haslo" type="password" style={inputEl} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password"
              placeholder="••••••••" required aria-invalid={!!err || undefined} aria-describedby={err ? 'login-error' : undefined} />
          </div>

          <div id="login-error" role="alert" aria-live="assertive">
            {err && <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 10, background: 'var(--danger-tint)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.45 }}>{err}</div>}
          </div>

          <button type="submit" disabled={busy || !l.trim() || !p} style={{ width: '100%', border: 'none', cursor: busy || !l.trim() || !p ? 'not-allowed' : 'pointer', background: 'var(--brand)', color: 'var(--on-brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 10, boxShadow: 'var(--shadow-sm)', opacity: busy || !l.trim() || !p ? 0.7 : 1 }}>
            {busy ? 'Logowanie…' : 'Zaloguj się'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />MVP<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ ...panel, display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5 }}>
            <Info size={16} color="var(--brand)" style={{ flex: 'none', marginTop: 1 }} />
            <span>Logowanie kontem w aplikacji. Logowanie jednokrotne <b>SSO przez Active Directory</b> planowane w wersji docelowej.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
