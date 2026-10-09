/** Revenue Copilot mark (same artwork as app/icon.svg), drawn in the current theme colors. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="16" className="fill-primary" />
      <path
        d="M9 21.5 14 16.5l3 3 6-6.5M18.5 13H23v4.5"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-on-primary"
      />
    </svg>
  );
}
