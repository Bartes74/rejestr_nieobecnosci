import { useEffect, useState } from 'react';
import { api, type AuditEntry } from '../api';
import { useAuth } from '../current-employee';
import { AdminOnly, th, td } from '../admin/ui';
import { cardClipped } from '../design-system/surfaces';

const actionColor: Record<string, string> = {
  LOGIN_FAILED: 'var(--danger)', ACCESS_DENIED: 'var(--danger)', VIEW_TYPES: 'var(--amber)',
};

export function Audyt() {
  const { current } = useAuth();
  const isAdmin = current?.role === 'ADMIN';
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    api.audit(200).then(setRows).catch((e: Error) => setErr(e.message));
  }, [isAdmin]);

  return (
    <div>
      <AdminOnly ok={isAdmin}>
        <div role="alert" aria-live="assertive">
          {err && <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--danger-tint)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 13.5 }}>{err}</div>}
        </div>
        <div style={cardClipped}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th scope="col" style={th}>Czas</th><th scope="col" style={th}>Akcja</th><th scope="col" style={th}>Encja</th><th scope="col" style={th}>Opis</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleString('pl-PL')}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12, color: actionColor[r.action] ?? 'var(--ink-2)', fontWeight: 600 }}>{r.action}</td>
                  <td style={td}>{r.entity}</td>
                  <td style={{ ...td, color: 'var(--ink-2)' }}>{r.description ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={4}>Brak zdarzeń w dzienniku audytu.</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminOnly>
    </div>
  );
}
