import type { ReactNode } from 'react';

export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-footnote font-medium text-label2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-caption text-bad">{error}</span> : hint ? <span className="mt-1 block text-caption text-label3">{hint}</span> : null}
    </label>
  );
}

/** Inset-grouped list section, macOS System Settings style. */
export function Group({ title, children, footer, className = '' }: { title?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h3 className="section-title">{title}</h3>}
      <div className="panel overflow-hidden">{children}</div>
      {footer && <p className="px-1 pt-2 text-caption text-label2">{footer}</p>}
    </section>
  );
}
