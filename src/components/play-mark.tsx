/** YouTube-style rounded red play button used as the brand mark. */
export function PlayMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={className} aria-hidden>
      <rect width="32" height="24" rx="7" fill="#ff0000" />
      <path d="M13 7.5v9l8-4.5-8-4.5z" fill="#fff" />
    </svg>
  );
}
