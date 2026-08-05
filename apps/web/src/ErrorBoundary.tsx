import { Component, type ReactNode } from 'react';

// Izoluje błąd ekranu — jeden uszkodzony widok nie wygasza całej aplikacji.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 30 }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: 'var(--danger)' }}>Błąd ekranu</h2>
          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', marginTop: 8 }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
