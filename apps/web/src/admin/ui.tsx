import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dialog } from '../design-system/components/overlay/Dialog';
import { Button } from '../design-system/components/core/Button';
import { card } from '../design-system/surfaces';

export const field: CSSProperties = {
  padding: '9px 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)',
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 13.5,
};
// Nagłówek i komórka tabeli. Jedna definicja na aplikację — wcześniej Raporty miały własną
// kopię z innym stopniem (10,5 vs 11) i innym paddingiem, więc dwie tabele obok siebie
// czytały się jak dwa produkty. Wartości wg DESIGN.md: rola „Label" to mono 10,5 WERSALIKI
// na wgłębieniu surface-2.
export const th: CSSProperties = {
  textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
  letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)',
  padding: '11px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
};
export const td: CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)',
  padding: '12px 16px', borderBottom: '1px solid var(--border)',
};
/** Komórka liczbowa: mono z cyframi tabelarycznymi, wyrównana do prawej (Reguła mono dla danych). */
export const num: CSSProperties = { ...td, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' };

// FR-A3 — wymiar dnia. Jedna lista dla wszystkich trzech ekranów, które go wybierają
// (nowy wpis, moja historia, zespół): ten sam wybór ma się wszędzie nazywać tak samo,
// a rozjazd etykiet między ekranami czyta się jak różnica znaczenia.
export const DAY_PARTS: readonly [string, string][] = [
  ['FULL', 'Cały dzień'], ['AM', 'Przed poł. (AM)'], ['PM', 'Po poł. (PM)'], ['HOURS', 'Godziny'],
];

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...card, padding: 20, marginBottom: 18 }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

/**
 * Pole z widoczną etykietą. `<label>` opakowuje kontrolkę, więc powiązanie jest niejawne —
 * bez identyfikatorów, których i tak nikt nie utrzyma w formularzu generowanym w pętli.
 * Placeholder nie jest nazwą pola: znika po pierwszym znaku i nie jest czytany jako etykieta.
 */
export function Field({ label, children, hint, width }: { label: string; children: ReactNode; hint?: string; width?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, width }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--muted)' }}>{hint}</span>}
    </label>
  );
}

export type NoticeTone = 'info' | 'ok' | 'error';
export interface NoticeState { text: string; tone: NoticeTone }

const NOTICE_STYLE: Record<NoticeTone, CSSProperties> = {
  info: { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-2)' },
  ok: { background: 'var(--brand-tint)', border: '1px solid var(--brand)', color: 'var(--brand-dark)' },
  error: { background: 'var(--danger-tint)', border: '1px solid var(--danger)', color: 'var(--danger)' },
};

/**
 * Komunikat po operacji. Dwie rzeczy naraz: błąd wygląda inaczej niż potwierdzenie
 * (wcześniej oba były tym samym szarym zdaniem) i jest ogłaszany przez czytnik ekranu —
 * `alert` przerywa lekturę przy błędzie, `status` czeka na przerwę przy sukcesie (WCAG 4.1.3).
 */
export function Notice({ text, tone = 'info' }: { text?: string; tone?: NoticeTone }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      {text ? (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.45, ...NOTICE_STYLE[tone] }}>
          {text}
        </div>
      ) : null}
    </div>
  );
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Stan komunikatu operacji wraz z blokadą na czas jej trwania. Region live musi istnieć
 * w DOM zanim pojawi się treść, więc `Notice` renderuje pusty kontener zawsze — hook trzyma
 * treść, ton i to, czy coś właśnie leci.
 */
export function useNotice(initial: NoticeState = { text: '', tone: 'info' }) {
  const [notice, setNotice] = useState<NoticeState>(initial);
  const ok = useCallback((text: string) => setNotice({ text, tone: 'ok' }), []);
  const info = useCallback((text: string) => setNotice({ text, tone: 'info' }), []);
  const fail = useCallback((e: unknown) => setNotice({ text: errorText(e), tone: 'error' }), []);
  const clear = useCallback(() => setNotice({ text: '', tone: 'info' }), []);

  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  /**
   * Jedna operacja naraz: kasuje poprzedni komunikat, blokuje przyciski na czas trwania,
   * a wynik pokazuje jako potwierdzenie (gdy funkcja zwróci zdanie) albo jako błąd.
   * Wcześniej każdy ekran miał własną kopię tej pętli — sześć razy to samo pięć linijek.
   *
   * Zamek stoi na `ref`, nie na `busy`: dwa kliknięcia w tym samym takcie renderu widzą
   * jeszcze `false`, więc stan sam z siebie nie powstrzymałby drugiego zapisu.
   */
  const run = useCallback(async (fn: () => Promise<string | void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    clear();
    try {
      const done = await fn();
      if (done) ok(done);
    } catch (e) {
      fail(e);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [clear, ok, fail]);

  return { notice, ok, info, fail, clear, busy, run };
}

export function AdminOnly({ ok, children }: { ok: boolean; children: ReactNode }) {
  if (ok) return <>{children}</>;
  return (
    <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 14 }}>
      Ta sekcja jest dostępna tylko dla administratora. Jeśli potrzebujesz do niej dostępu, poproś administratora aplikacji o nadanie uprawnień.
    </p>
  );
}

// FR-G5/D4 — konfigurowalne mapowanie nagłówków .xlsx: pole → nazwa kolumny w pliku (domyślne wartości prefilled).
export function ColumnMap({ fields, value, onChange }: {
  fields: { key: string; label: string }[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
      {fields.map((f) => (
        <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>{f.label}</span>
          <input style={{ ...field, fontSize: 12, padding: '5px 8px', width: 130 }} value={value[f.key] ?? ''} aria-label={`Nagłówek kolumny dla: ${f.label}`} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
        </label>
      ))}
    </div>
  );
}

/**
 * Potwierdzenie operacji. Zastępuje `window.confirm`, który nie da się ostylować, nie mówi,
 * co dokładnie zniknie, i w oknach osadzonych bywa blokowany przez przeglądarkę.
 * `confirmPhrase` wymusza przepisanie słowa przy operacjach nieodwracalnych (RODO) —
 * pojedyncze „OK" jest za tanie dla czegoś, czego nie da się cofnąć.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, confirmPhrase, danger, busy, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmPhrase?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const armed = !confirmPhrase || typed.trim().toUpperCase() === confirmPhrase.toUpperCase();
  const close = () => { setTyped(''); onCancel(); };
  const confirm = () => { if (armed && !busy) { setTyped(''); onConfirm(); } };

  return (
    <Dialog open={open} onClose={close} title={title} width={440} initialFocusRef={confirmPhrase ? inputRef : undefined}
      footer={<>
        <Button variant="secondary" onClick={close}>Anuluj</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} disabled={!armed || busy}>{busy ? 'Wykonywanie…' : confirmLabel}</Button>
      </>}>
      {children}
      {confirmPhrase && (
        <label style={{ display: 'block', marginTop: 16 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 }}>
            Wpisz <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{confirmPhrase}</b>, aby potwierdzić
          </span>
          <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false}
            onKeyDown={(e) => { if (e.key === 'Enter' && armed) confirm(); }}
            style={{ ...field, width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
        </label>
      )}
    </Dialog>
  );
}

/**
 * Ustawienie hasła pracownikowi. Zastępuje `window.prompt`, który pokazywał hasło jawnym
 * tekstem, nie pozwalał go potwierdzić i nie dawał żadnej walidacji.
 */
export function PasswordDialog({ open, employeeName, busy, onSubmit, onCancel }: {
  open: boolean;
  employeeName: string;
  busy?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [pwd, setPwd] = useState('');
  const [repeat, setRepeat] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tooShort = pwd.length > 0 && pwd.length < 8;
  const mismatch = repeat.length > 0 && pwd !== repeat;
  const armed = pwd.length >= 8 && pwd === repeat && !busy;
  const close = () => { setPwd(''); setRepeat(''); onCancel(); };
  const submit = () => { if (armed) { onSubmit(pwd); setPwd(''); setRepeat(''); } };
  const label = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } as const;
  const input = { ...field, width: '100%', boxSizing: 'border-box' } as const;

  return (
    <Dialog open={open} onClose={close} title="Ustaw hasło" width={400} initialFocusRef={inputRef}
      footer={<>
        <Button variant="secondary" onClick={close}>Anuluj</Button>
        <Button onClick={submit} disabled={!armed}>{busy ? 'Zapisywanie…' : 'Ustaw hasło'}</Button>
      </>}>
      <p style={{ margin: '0 0 16px' }}>Nowe hasło dla: <b style={{ color: 'var(--ink)' }}>{employeeName}</b>. Przekaż je bezpiecznym kanałem — aplikacja nie wyśle go e-mailem.</p>
      <label htmlFor="pwd-new" style={label}>Hasło (min. 8 znaków)</label>
      <input id="pwd-new" ref={inputRef} type="password" value={pwd} autoComplete="new-password"
        aria-invalid={tooShort || undefined} aria-describedby={tooShort ? 'pwd-error' : undefined}
        onChange={(e) => setPwd(e.target.value)} style={{ ...input, marginBottom: 14 }} />
      <label htmlFor="pwd-repeat" style={label}>Powtórz hasło</label>
      <input id="pwd-repeat" type="password" value={repeat} autoComplete="new-password"
        aria-invalid={mismatch || undefined} aria-describedby={mismatch ? 'pwd-error' : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter' && armed) submit(); }}
        onChange={(e) => setRepeat(e.target.value)} style={input} />
      <div id="pwd-error" role="alert" aria-live="assertive" style={{ minHeight: 18, marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>
        {tooShort ? 'Hasło musi mieć co najmniej 8 znaków.' : mismatch ? 'Hasła nie są identyczne.' : ''}
      </div>
    </Dialog>
  );
}
