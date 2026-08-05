import type { CSSProperties, ReactNode } from 'react';

export const field: CSSProperties = {
  padding: '9px 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)',
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-sans)', fontSize: 13.5,
};
export const th: CSSProperties = { textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)', padding: '9px 12px', borderBottom: '1px solid var(--border)' };
export const td: CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', padding: '9px 12px', borderBottom: '1px solid var(--border)' };

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 18 }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

export function Notice({ text }: { text: string }) {
  if (!text) return null;
  return <div style={{ marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)' }}>{text}</div>;
}

export function AdminOnly({ ok, children }: { ok: boolean; children: ReactNode }) {
  if (ok) return <>{children}</>;
  return <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--muted)', fontSize: 14 }}>Ta sekcja jest dostępna tylko dla administratora.</p>;
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
