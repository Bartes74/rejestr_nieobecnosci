import { Component, type ReactNode } from 'react';

/**
 * Izoluje błąd ekranu — jeden uszkodzony widok nie wygasza całej aplikacji.
 *
 * Komunikat mówi po polsku i nazywa drogę wyjścia, jak reszta aplikacji. Wcześniej pokazywał
 * surowe `error.message` — angielski tekst wyjątku JavaScriptu, z którego pracownik kadr nie
 * ma jak skorzystać, a który potrafi ujawnić wnętrze aplikacji. Treść techniczna zostaje,
 * ale schowana w `<details>`: administrator ma ją podać w zgłoszeniu, użytkownik może zignorować.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)', padding: 24, maxWidth: 560,
      }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>
          Ten ekran się nie wczytał
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)', margin: '0 0 16px' }}>
          Reszta aplikacji działa — możesz przejść do innej sekcji w menu po lewej. Twoje wpisy
          są bezpieczne: ten błąd dotyczy wyświetlania, nie zapisu danych.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="ds-primary" onClick={() => this.setState({ error: null })}
            style={{ border: 'none', cursor: 'pointer', background: 'var(--brand)', color: 'var(--on-brand)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, padding: '10px 16px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
            Spróbuj ponownie
          </button>
          <button type="button" className="ds-quiet" onClick={() => window.location.reload()}
            style={{ border: '1px solid var(--border-2)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, padding: '10px 16px', borderRadius: 'var(--radius-md)' }}>
            Przeładuj aplikację
          </button>
        </div>
        <details style={{ marginTop: 18 }}>
          <summary style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
            Szczegóły techniczne — do zgłoszenia administratorowi
          </summary>
          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '8px 0 0', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
