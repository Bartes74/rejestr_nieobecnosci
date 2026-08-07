import React from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let seq = 0;

/**
 * Okno modalne. Klawiatura jest tu warunkiem użyteczności, nie dodatkiem:
 * Esc zamyka, Tab krąży wewnątrz okna, a po zamknięciu fokus wraca tam, skąd przyszedł —
 * bez tego użytkownik klawiatury po zamknięciu okna ląduje na początku dokumentu.
 */
export function Dialog({ open, onClose, title, children, footer, width = 460, initialFocusRef }) {
  const panelRef = React.useRef(null);
  const restoreRef = React.useRef(null);
  const titleId = React.useMemo(() => `ds-dialog-title-${++seq}`, []);

  React.useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = initialFocusRef?.current ?? panel?.querySelector(FOCUSABLE) ?? panel;
    first?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose && onClose(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge || !panel.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;
  return (
    <div role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,20,16,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}
        style={{ width, maxWidth: '100%', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div id={titleId} style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Zamknij okno" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flex: 'none', padding: 10, margin: -10, borderRadius: 'var(--radius-sm)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 20px 20px' }}>{footer}</div>}
      </div>
    </div>
  );
}
