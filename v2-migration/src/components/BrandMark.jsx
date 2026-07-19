// Growth Opt Playbook brand mark — a compact upward signal, shared by sidebar,
// header, favicon language, and future share cards.
export default function BrandMark({ size = 28, className = "brand-mark", label = "" }) {
  return (
    <span
      className={className}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" focusable="false">
        <defs>
          <linearGradient id="brandMarkGradient" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--primary-container)" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="11" fill="url(#brandMarkGradient)" />
        <path d="M12 32 21.5 23 28 28l8-13" stroke="var(--brand-mark-ink)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M29.5 15H36v6.5" stroke="var(--brand-mark-ink)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
