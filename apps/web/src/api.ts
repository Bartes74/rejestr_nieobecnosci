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

/** Zdarzenie na `window` — API wykryło wygasłą sesję; AuthProvider sprząta stan i wraca na logowanie. */
export const UNAUTHORIZED = 'nieobecnosci:unauthorized';

// Komunikat ma nazywać problem i drogę wyjścia. Treść z serwera jest najbardziej konkretna
// (walidacja per pole), więc wygrywa; kody bez treści dostają zdanie zrozumiałe dla użytkownika.
const BY_STATUS: Record<number, string> = {
  403: 'Nie masz uprawnień do tej operacji. Jeśli powinieneś je mieć, poproś administratora aplikacji.',
  404: 'Nie znaleziono danych — mogły zostać usunięte lub zmienione przez inną osobę. Odśwież widok.',
  409: 'Ktoś zmienił te dane w międzyczasie. Odśwież widok i spróbuj ponownie.',
  413: 'Plik jest za duży. Podziel import na mniejsze części.',
  429: 'Zbyt wiele żądań. Odczekaj chwilę i spróbuj ponownie.',
  500: 'Błąd serwera. Spróbuj ponownie za chwilę; jeśli się powtarza, zgłoś to administratorowi aplikacji.',
  503: 'Aplikacja jest chwilowo niedostępna (trwa przerwa techniczna lub baza nie odpowiada). Spróbuj za kilka minut.',
};

async function errorMessage(res: Response): Promise<string> {
  try {
    const e = await res.json();
    const m = Array.isArray(e.message) ? e.message.join(', ') : e.message;
    if (m) return String(m);
  } catch {
    /* brak treści błędu — zejdź do komunikatu wg kodu */
  }
  return BY_STATUS[res.status] ?? `Operacja nie powiodła się (${res.status} ${res.statusText}).`;
}

// Brak sieci i przerwane połączenie to najczęstszy błąd w sieci wewnętrznej — `fetch` rzuca wtedy
// TypeError bez użytecznej treści. Zamieniamy go na zdanie, z którego wynika, co zrobić.
async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(BASE + path, init);
  } catch {
    throw new Error('Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.');
  }
}

// Typ zwrotny wprost: bez niego wnioskowana unia („z tokenem" | „bez") nie jest zgodna
// z `HeadersInit` i każde z trzech wywołań kończy się błędem kompilacji.
const authHeader = (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

/**
 * Wspólna reakcja na odpowiedź: wygasła sesja i błąd HTTP wyglądają tak samo bez względu na to,
 * czy żądanie niosło JSON, plik do wgrania czy arkusz do pobrania. Wcześniej każda z tych trzech
 * dróg miała własną kopię — a eksport .xlsx nie miał jej wcale, więc po wygaśnięciu sesji
 * kończył się nagim „Eksport nieudany" i zostawiał aplikację na ekranie, z którego nic nie działa.
 */
async function assertOk(res: Response): Promise<void> {
  if (res.status === 401) {
    setToken(null);
    // Sam token nie wystarczy — bez tego sygnału aplikacja zostaje na ekranie z wygasłą sesją
    // i każde kolejne żądanie kończy się błędem, którego użytkownik nie umie naprawić.
    window.dispatchEvent(new Event(UNAUTHORIZED));
    throw new Error('Sesja wygasła. Zaloguj się ponownie.');
  }
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await send(path, {
    headers: { 'content-type': 'application/json', ...authHeader() },
    ...opts,
  });
  await assertOk(res);
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

// Role zgodne z `enum Role` w prisma/schema.prisma — unia zamiast string, żeby literówka
// w predykacie widoczności menu była błędem kompilacji, a nie cicho ukrytą pozycją.
export type Role = 'EMPLOYEE' | 'LEADER' | 'PO' | 'DIRECTOR' | 'ADMIN' | 'PMO';
export interface Me { id: string; firstName: string; lastName: string; role: Role; employmentType: string; permissions: string[] }
export interface Employee { id: string; firstName: string; lastName: string; email?: string; login?: string; employmentType: string; role?: string; permissions?: { scope: string }[] }
export interface AbsenceType { id: string; name: string; affectsPool: boolean; specialCategory: boolean; sortOrder?: number }
export interface Balance {
  period: { from: string; to: string; type: string; year: number };
  pool: number; carriedOver: number; used: number; remaining: number; minimumToLeave?: number;
}
export interface Absence { id: string; dateFrom: string; dateTo: string; dayPart: string; hourFrom?: string | null; hourTo?: string | null; type: AbsenceType; source?: string; workingDays: number; coveredBySick?: boolean }
export interface AdminSetting { key: string; value: number; label: string; ref: string }
export interface Preview { workingDays: number; period?: { from: string; to: string; type: string; year: number }; remaining: number; remainingAfter: number; minimumToLeave?: number; collision?: boolean; collisionFrom?: string | null; collisionTo?: string | null; returnedDays?: number }
export interface CalEntry { employeeId: string; employee: string; dateFrom: string; dateTo: string; dayPart: string }
/** Skład Tribe na osi czasu. Pusty wiersz to informacja („dostępna"), nie brak danych. */
export interface TeamPerson { id: string; name: string; initials: string; squad: string | null; keyRole: boolean; leaderOf: string[] }
export interface TeamGrid { people: TeamPerson[]; absences: { employeeId: string; dateFrom: string; dateTo: string; dayPart: string }[] }
export interface Sprint { id: string; name: string; dateFrom: string; dateTo: string; squad?: { id: string; name: string } | null }
export interface OrgUnit { id: string; name: string; type: string; parentId?: string | null; leaderId?: string | null }
/** Komórka siatki pokrycia. `null` oznacza brak pomiaru (nie ma sprintu albo jednostki), nie zero. */
export interface CapacityCell {
  sprintId: string; unitId: string;
  totalPersonDays: number | null; absentPersonDays: number | null;
  available: number | null; memberCount: number | null;
  keyRoleCollisions: { dateFrom: string; dateTo: string; employees: [string, string] }[];
}
export interface UsageRow { employeeId: string; name: string; employmentType: string; pool: number; carriedOver: number; used: number; realized: number; remaining: number }
export interface UsageTotals { pool: number; carriedOver: number; used: number; realized: number; remaining: number }
export interface UsageReport { unitId: string; rows: UsageRow[]; totals: UsageTotals }
export interface ReportTreeNode extends UsageTotals { id: string; name: string; type: string; headcount: number; overdueCount: number; children: ReportTreeNode[] }
/** `subjectId` — kogo zdarzenie dotyczy; `*Name` to identyfikatory rozwinięte przez API przy odczycie. */
export interface AuditEntry { id: string; entity: string; entityId: string | null; action: string; userId: string | null; userName: string | null; subjectId: string | null; subjectName: string | null; description: string | null; timestamp: string }
export interface Calendar { id: string; name: string; isDefault: boolean; _count?: { holidays: number } }
export type EmploymentType = 'UOP' | 'B2B' | 'OUT';
/** `value` = pula wspólna, `byType` = pula ustawiona wprost dla formy (null = dziedziczy wspólną). */
export interface PoolDefaults { value: number | null; byType: Record<EmploymentType, number | null> }
export interface ProcessingActivity { id: string; name: string; purpose: string; legalBasis: string; dataCategories: string; recipients: string; retention: string; specialCategory: boolean }
export interface Adoption { totalEmployees: number; activeUsers: number; adoptionRate: number; kpiTarget: number; absencesCreated: number; logins: number; securityEvents: number }

async function upload<T>(path: string, file: File, fields?: Record<string, string>): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields ?? {})) fd.append(k, v);
  const res = await send(path, { method: 'POST', headers: authHeader(), body: fd });
  await assertOk(res);
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
  // `year` — okres o danym numerze roku zamiast bieżącego (przełącznik okresu na pulpicie).
  balance: (id: string, year?: number) => req<Balance>(`/employees/${id}/balance${year ? `?year=${year}` : ''}`),
  absences: (employeeId: string) => req<Absence[]>(`/absences?employeeId=${employeeId}`),
  preview: (employeeId: string, from: string, to: string, dayPart = 'FULL', hourFrom?: string, hourTo?: string, typeId?: string) => {
    const q = new URLSearchParams({ employeeId, from, to, dayPart });
    if (hourFrom) q.set('hourFrom', hourFrom);
    if (hourTo) q.set('hourTo', hourTo);
    // Bez typu serwer nie odróżni L4 od urlopu, więc pokazałby kolizję tam, gdzie zapis przejdzie.
    if (typeId) q.set('typeId', typeId);
    return req<Preview>(`/absences/preview?${q.toString()}`);
  },
  createAbsence: (body: { employeeId: string; typeId: string; dateFrom: string; dateTo: string; dayPart?: string; hourFrom?: string; hourTo?: string }) =>
    req<Absence>('/absences', { method: 'POST', body: JSON.stringify(body) }),
  bulkCreateAbsences: (body: { employeeIds: string[]; typeId: string; dateFrom: string; dateTo: string; dayPart?: string }) =>
    req<{ created: number; errors: { employeeId: string; message: string }[] }>('/absences/bulk', { method: 'POST', body: JSON.stringify(body) }),
  // Godziny wysyłamy przy `dayPart: 'HOURS'`; serwer zeruje je sam przy przejściu na inny wymiar.
  updateAbsence: (id: string, body: { typeId?: string; dateFrom?: string; dateTo?: string; dayPart?: string; hourFrom?: string; hourTo?: string }) =>
    req<Absence>(`/absences/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAbsence: (id: string) => req<void>(`/absences/${id}`, { method: 'DELETE' }),
  calendar: (from: string, to: string) => req<CalEntry[]>(`/calendar?from=${from}&to=${to}`),
  /** Siatka zespołu: skład Tribe plus nieobecności w oknie — jedno żądanie na widok osi czasu. */
  // `unitId` zawęża do poddrzewa jednostki (zawsze w obrębie zasięgu), `leadersOnly` zostawia liderów jednostek.
  calendarTeam: (from: string, to: string, opts?: { unitId?: string; leadersOnly?: boolean }) => {
    const q = new URLSearchParams({ from, to });
    if (opts?.unitId) q.set('unitId', opts.unitId);
    if (opts?.leadersOnly) q.set('leadersOnly', 'true');
    return req<TeamGrid>(`/calendar/team?${q}`);
  },
  unitMembers: (unitId: string) => req<{ id: string; firstName: string; lastName: string }[]>(`/org/units/${unitId}/members`),
  setUnitLeader: (unitId: string, leaderId: string | null) => req<OrgUnit>(`/org/units/${unitId}/leader`, { method: 'PATCH', body: JSON.stringify({ leaderId }) }),
  feedToken: (regenerate = false) => req<{ token: string }>(`/me/feed-token${regenerate ? '?regenerate=true' : ''}`),
  sprints: () => req<Sprint[]>('/sprints'),
  orgUnits: () => req<OrgUnit[]>('/org/units'),
  /**
   * Cała siatka pokrycia w jednym żądaniu — używa jej heatmapa i ekran capacity sprintu.
   * Wyniki nie są pamiętane po stronie klienta: capacity zależy od wpisów całego squadu, więc
   * korekta zrobiona przez lidera obok i tak nie miałaby jak unieważnić naszej pamięci, a jedno
   * żądanie na wejście na ekran mieści się w budżecie NFR-1 z zapasem dwóch rzędów wielkości.
   */
  capacityMatrix: (sprintIds: string[], unitIds: string[]) =>
    req<{ cells: CapacityCell[] }>(`/capacity/matrix?sprintIds=${sprintIds.join(',')}&unitIds=${unitIds.join(',')}`),
  reportUsage: (unitId: string) => req<UsageReport>(`/reports/usage?unitId=${unitId}`),
  reportTree: (unitId: string) => req<ReportTreeNode>(`/reports/tree?unitId=${unitId}`),
  reportOverdue: (unitId: string) => req<{ unitId: string; threshold: number; rows: (UsageRow & { zalega: boolean })[] }>(`/reports/overdue?unitId=${unitId}`),
  exportUsage: async (unitId: string): Promise<Blob> => {
    const res = await send(`/reports/usage/export?unitId=${unitId}`, { headers: authHeader() });
    await assertOk(res);
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
  settings: () => req<AdminSetting[]>('/settings'),
  setSetting: (key: string, value: number) => req<{ key: string; value: number }>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  processingRegister: () => req<ProcessingActivity[]>('/processing-register'),
  adoption: () => req<Adoption>('/analytics/adoption'),
  createType: (b: Record<string, unknown>) => req<AbsenceType>('/absence-types', { method: 'POST', body: JSON.stringify(b) }),
  // Cała kolejność w jednym żądaniu — serwer zapisuje ją w transakcji albo odrzuca w całości.
  reorderTypes: (ids: string[]) => req<AbsenceType[]>('/absence-types/order/all', { method: 'PATCH', body: JSON.stringify({ ids }) }),
  poolDefault: () => req<PoolDefaults>('/pools/default'),
  setDefaultPool: (value: number, employmentType?: EmploymentType) =>
    req('/pools/default', { method: 'PUT', body: JSON.stringify({ value, employmentType }) }),
  setAllowance: (b: Record<string, unknown>) => req('/pools/allowance', { method: 'PUT', body: JSON.stringify(b) }),
  calendars: () => req<Calendar[]>('/holiday-calendars'),
  createCalendar: (b: Record<string, unknown>) => req<Calendar>('/holiday-calendars', { method: 'POST', body: JSON.stringify(b) }),
  holidays: (calendarId: string) => req<{ id: string; date: string; name: string }[]>(`/holidays?calendarId=${calendarId}`),
  createHoliday: (b: Record<string, unknown>) => req('/holidays', { method: 'POST', body: JSON.stringify(b) }),
  importPolishHolidays: (calendarId: string, year: number) =>
    req<{ year: number; added: number }>(`/holiday-calendars/${calendarId}/import-pl?year=${year}`, { method: 'POST' }),
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
