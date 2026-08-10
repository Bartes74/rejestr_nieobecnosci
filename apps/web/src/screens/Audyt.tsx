import { useEffect, useState } from 'react';
import { api, type AuditEntry } from '../api';
import { useAuth } from '../current-employee';
import { AdminOnly, th, td } from '../admin/ui';
import { cardClipped } from '../design-system/surfaces';

const actionColor: Record<string, string> = {
  LOGIN_FAILED: 'var(--danger)', ACCESS_DENIED: 'var(--danger)', VIEW_TYPES: 'var(--amber)',
};

// Dziennik czyta administrator, nie serwer: „VIEW_TYPES" i „ABSENCE_TO_L4" nie mówią nic osobie,
// która sprawdza, kto sięgnął po cudze dane. Kod zostaje w podpowiedzi wiersza — bywa potrzebny
// przy zgłoszeniu do zespołu — a w tabeli stoi zdanie po polsku.
const ACTION_LABEL: Record<string, string> = {
  ABSENCE_CREATE: 'Dodanie nieobecności', ABSENCE_UPDATE: 'Korekta nieobecności',
  ABSENCE_DELETE: 'Usunięcie nieobecności', ABSENCE_TO_L4: 'Konwersja na L4',
  VIEW_TYPES: 'Wgląd w dane szczególne', ACCESS_DENIED: 'Odmowa dostępu',
  LOGIN_SUCCESS: 'Logowanie', LOGIN_FAILED: 'Nieudane logowanie',
  EMAIL_SENT: 'Wysłano e-mail', EMAIL_FAILED: 'Błąd wysyłki e-maila',
  EMPLOYMENT_TYPE_CHANGE: 'Zmiana formy zatrudnienia', ROLE_CHANGE: 'Zmiana roli',
  PERMISSION_GRANT: 'Nadanie uprawnienia', PERMISSION_REVOKE: 'Odebranie uprawnienia',
  ANONYMIZE: 'Anonimizacja (RODO)',
};
const ENTITY_LABEL: Record<string, string> = {
  Absence: 'Nieobecność', Employee: 'Pracownik', Permission: 'Uprawnienie',
  Auth: 'Dostęp', Email: 'E-mail', Report: 'Raport',
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
          {err && <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 'var(--radius-md)', background: 'var(--danger-tint)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-sans)', fontSize: 13.5 }}>{err}</div>}
        </div>
        <div style={cardClipped}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th scope="col" style={th}>Czas</th><th scope="col" style={th}>Kto</th><th scope="col" style={th}>Akcja</th><th scope="col" style={th}>Kogo/czego dotyczy</th><th scope="col" style={th}>Opis</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleString('pl-PL')}</td>
                  {/* Zdarzenie bez sprawcy to nie brak danych: nieudane logowanie na nieistniejący
                      login i wysyłka z zadania cyklicznego nie mają kto — „system" nie kłamie.
                      Gdy sprawca jest, a nazwiska nie znamy, pokazujemy identyfikator: da się po nim
                      przefiltrować dziennik. Napis „konto usunięte" byłby zgadywaniem — kont się tu
                      nie usuwa (FR-J2 anonimizuje), a przyczyną bywa choćby przeładowana baza. */}
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {r.userName ?? (r.userId
                      ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }} title="Konto spoza tej bazy — nazwiska nie da się rozwinąć">{r.userId}</span>
                      : 'System')}
                  </td>
                  <td style={{ ...td, fontSize: 13, color: actionColor[r.action] ?? 'var(--ink-2)', fontWeight: 600 }} title={r.action}>{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td style={td}>
                    {ENTITY_LABEL[r.entity] ?? r.entity}
                    {r.subjectName && <span style={{ color: 'var(--ink-2)' }}> — {r.subjectName}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--ink-2)' }}>{r.description ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={5}>Brak zdarzeń w dzienniku audytu.</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminOnly>
    </div>
  );
}
