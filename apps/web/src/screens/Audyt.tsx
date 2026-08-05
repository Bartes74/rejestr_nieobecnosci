import { useEffect, useState } from 'react';
import { api, type AuditEntry } from '../api';
import { useAuth } from '../current-employee';
import { AdminOnly, th, td } from '../admin/ui';

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
        {err && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 14 }}>{err}</div>}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Czas</th><th style={th}>Akcja</th><th style={th}>Encja</th><th style={th}>Opis</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleString('pl-PL')}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12, color: actionColor[r.action] ?? 'var(--ink-2)', fontWeight: 600 }}>{r.action}</td>
                  <td style={td}>{r.entity}</td>
                  <td style={{ ...td, color: 'var(--ink-2)' }}>{r.description ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={4}>Brak zdarzeń.</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminOnly>
    </div>
  );
}
