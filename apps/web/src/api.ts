const BASE = '/api';

let token: string | null = localStorage.getItem('token');
export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}
export function getToken() {
  return token;
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  if (res.status === 401) {
    setToken(null);
    throw new Error('Wymagane logowanie.');
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const e = await res.json();
      message = Array.isArray(e.message) ? e.message.join(', ') : (e.message ?? message);
    } catch {
      /* brak treści błędu */
    }
    throw new Error(message);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

export interface Me { id: string; firstName: string; lastName: string; role: string; employmentType: string; permissions: string[] }
export interface Employee { id: string; firstName: string; lastName: string; email?: string; login?: string; employmentType: string; role?: string; permissions?: { scope: string }[] }
export interface AbsenceType { id: string; name: string; affectsPool: boolean; specialCategory: boolean }
export interface Balance {
  period: { from: string; to: string; type: string; year: number };
  pool: number; carriedOver: number; used: number; remaining: number; minimumToLeave?: number;
}
export interface Absence { id: string; dateFrom: string; dateTo: string; dayPart: string; hourFrom?: string | null; hourTo?: string | null; type: AbsenceType; source?: string }
export interface Preview { workingDays: number; remaining: number; remainingAfter: number; minimumToLeave?: number; collision?: boolean; collisionFrom?: string | null; collisionTo?: string | null }
export interface CalEntry { employeeId: string; employee: string; dateFrom: string; dateTo: string; dayPart: string }
export interface Sprint { id: string; name: string; dateFrom: string; dateTo: string; squad?: { id: string; name: string } | null }
export interface OrgUnit { id: string; name: string; type: string }
export interface Capacity {
  sprint: { id: string; name: string; dateFrom: string; dateTo: string };
  unit: { id: string; name: string };
  memberCount: number;
  totalPersonDays: number;
  absentPersonDays: number;
  available: number;
  keyRoleCollisions: { dateFrom: string; dateTo: string; employees: [string, string] }[];
}
export interface UsageRow { employeeId: string; name: string; employmentType: string; pool: number; carriedOver: number; used: number; remaining: number }
export interface UsageReport { unitId: string; rows: UsageRow[]; totals: { pool: number; used: number; remaining: number } }
export interface ReportTreeNode { id: string; name: string; type: string; headcount: number; used: number; children: ReportTreeNode[] }
export interface AuditEntry { id: string; entity: string; action: string; userId: string | null; description: string | null; timestamp: string }
export interface Calendar { id: string; name: string; isDefault: boolean; _count?: { holidays: number } }
export interface ProcessingActivity { id: string; name: string; purpose: string; legalBasis: string; dataCategories: string; recipients: string; retention: string; specialCategory: boolean }
export interface Adoption { totalEmployees: number; activeUsers: number; adoptionRate: number; kpiTarget: number; absencesCreated: number; logins: number; securityEvents: number }

async function upload<T>(path: string, file: File, fields?: Record<string, string>): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields ?? {})) fd.append(k, v);
  const res = await fetch(BASE + path, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: fd });
  if (!res.ok) {
    let m = res.statusText;
    try { const e = await res.json(); m = Array.isArray(e.message) ? e.message.join(', ') : (e.message ?? m); } catch { /* */ }
    throw new Error(m);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: async (login: string, password: string) => {
    const r = await req<{ token: string; user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
    setToken(r.token);
    return r;
  },
  me: () => req<Me | null>('/auth/me'),
  employees: () => req<Employee[]>('/employees'),
  types: () => req<AbsenceType[]>('/absence-types'),
  balance: (id: string) => req<Balance>(`/employees/${id}/balance`),
  absences: (employeeId: string) => req<Absence[]>(`/absences?employeeId=${employeeId}`),
  preview: (employeeId: string, from: string, to: string, dayPart = 'FULL', hourFrom?: string, hourTo?: string) => {
    const q = new URLSearchParams({ employeeId, from, to, dayPart });
    if (hourFrom) q.set('hourFrom', hourFrom);
    if (hourTo) q.set('hourTo', hourTo);
    return req<Preview>(`/absences/preview?${q.toString()}`);
  },
  createAbsence: (body: { employeeId: string; typeId: string; dateFrom: string; dateTo: string; dayPart?: string; hourFrom?: string; hourTo?: string }) =>
    req<Absence>('/absences', { method: 'POST', body: JSON.stringify(body) }),
  bulkCreateAbsences: (body: { employeeIds: string[]; typeId: string; dateFrom: string; dateTo: string; dayPart?: string }) =>
    req<{ created: number; errors: { employeeId: string; message: string }[] }>('/absences/bulk', { method: 'POST', body: JSON.stringify(body) }),
  updateAbsence: (id: string, body: { typeId?: string; dateFrom?: string; dateTo?: string; dayPart?: string }) =>
    req<Absence>(`/absences/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAbsence: (id: string) => req<void>(`/absences/${id}`, { method: 'DELETE' }),
  calendar: (from: string, to: string) => req<CalEntry[]>(`/calendar?from=${from}&to=${to}`),
  feedToken: (regenerate = false) => req<{ token: string }>(`/me/feed-token${regenerate ? '?regenerate=true' : ''}`),
  sprints: () => req<Sprint[]>('/sprints'),
  orgUnits: () => req<OrgUnit[]>('/org/units'),
  capacity: (sprintId: string, unitId: string) => req<Capacity>(`/capacity?sprintId=${sprintId}&unitId=${unitId}`),
  reportUsage: (unitId: string) => req<UsageReport>(`/reports/usage?unitId=${unitId}`),
  reportTree: (unitId: string) => req<ReportTreeNode>(`/reports/tree?unitId=${unitId}`),
  reportOverdue: (unitId: string) => req<{ unitId: string; threshold: number; rows: (UsageRow & { zalega: boolean })[] }>(`/reports/overdue?unitId=${unitId}`),
  exportUsage: async (unitId: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/reports/usage/export?unitId=${unitId}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Eksport nieudany.');
    return res.blob();
  },

  // --- administracja ---
  createEmployee: (b: Record<string, unknown>) => req<Employee>('/employees', { method: 'POST', body: JSON.stringify(b) }),
  myTeam: () => req<Employee[]>('/org/my-team'),
  importEmployees: (f: File, mapping?: Record<string, string>) =>
    upload<{ created: number; updated: number; errors: { row: number; message: string }[] }>('/employees/import', f, mapping ? { mapping: JSON.stringify(mapping) } : undefined),
  setPassword: (id: string, password: string) => req<{ ok: boolean }>(`/employees/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  changeEmploymentType: (id: string, employmentType: string) => req<Employee>(`/employees/${id}/employment-type`, { method: 'PATCH', body: JSON.stringify({ employmentType }) }),
  changeRole: (id: string, role: string) => req<Employee>(`/employees/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  grantPermission: (id: string, scope: string) => req<string[]>(`/employees/${id}/permissions`, { method: 'POST', body: JSON.stringify({ scope }) }),
  revokePermission: (id: string, scope: string) => req<string[]>(`/employees/${id}/permissions/${scope}`, { method: 'DELETE' }),
  anonymize: (id: string) => req<{ anonymized: boolean }>(`/employees/${id}/anonymize`, { method: 'POST' }),
  runRetention: () => req<{ months: number; anonymized: number }>('/retention/run', { method: 'POST' }),
  processingRegister: () => req<ProcessingActivity[]>('/processing-register'),
  adoption: () => req<Adoption>('/analytics/adoption'),
  createType: (b: Record<string, unknown>) => req<AbsenceType>('/absence-types', { method: 'POST', body: JSON.stringify(b) }),
  poolDefault: () => req<{ value: number | null }>('/pools/default'),
  setDefaultPool: (value: number) => req('/pools/default', { method: 'PUT', body: JSON.stringify({ value }) }),
  setAllowance: (b: Record<string, unknown>) => req('/pools/allowance', { method: 'PUT', body: JSON.stringify(b) }),
  calendars: () => req<Calendar[]>('/holiday-calendars'),
  createCalendar: (b: Record<string, unknown>) => req<Calendar>('/holiday-calendars', { method: 'POST', body: JSON.stringify(b) }),
  holidays: (calendarId: string) => req<{ id: string; date: string; name: string }[]>(`/holidays?calendarId=${calendarId}`),
  createHoliday: (b: Record<string, unknown>) => req('/holidays', { method: 'POST', body: JSON.stringify(b) }),
  orgTree: () => req<(OrgUnit & { children: OrgUnit[] })[]>('/org/tree'),
  createUnit: (b: Record<string, unknown>) => req<OrgUnit>('/org/units', { method: 'POST', body: JSON.stringify(b) }),
  addMembership: (b: Record<string, unknown>) => req('/org/memberships', { method: 'POST', body: JSON.stringify(b) }),
  createSprint: (b: Record<string, unknown>) => req<Sprint>('/sprints', { method: 'POST', body: JSON.stringify(b) }),
  importSprints: (f: File, mapping?: Record<string, string>) =>
    upload<{ created: number; errors: { row: number; message: string }[] }>('/sprints/import', f, mapping ? { mapping: JSON.stringify(mapping) } : undefined),
  audit: (limit = 100) => req<AuditEntry[]>(`/audit?limit=${limit}`),
  sendReminders: () => req<{ sent: number }>('/notifications/overdue-reminders', { method: 'POST' }),
  notificationsFeed: () => req<{ items: { kind: string; text: string; severity: string }[]; count: number }>('/notifications/feed'),
};
