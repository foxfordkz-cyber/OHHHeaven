// The First Year mark: a small shop under an awning, with a lit door. Ink tile, one warm detail.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M6.5 13.2 9 8h14l2.5 5.2v.9a2.3 2.3 0 0 1-4.6.2 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.6-.2Z" fill="var(--on-primary)" />
      <path d="M9 18v6.2h14V18" fill="none" stroke="var(--on-primary)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13.6" y="19.2" width="4.8" height="5" rx="0.8" fill="var(--accent-fill)" />
    </svg>
  );
}

/** Mark and name together, for headers. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo__name">First Year</span>
    </span>
  );
}
