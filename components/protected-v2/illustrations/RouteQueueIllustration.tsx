type IllustrationProps = { className?: string; decorative?: boolean; ariaLabel?: string };

export function RouteQueueIllustration({ className, decorative = true, ariaLabel = "Route queue" }: IllustrationProps) {
  return <svg aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : ariaLabel} className={className} fill="none" role={decorative ? undefined : "img"} viewBox="0 0 160 120"><circle cx="32" cy="84" fill="#e8eeff" r="12" stroke="#2457d6" strokeWidth="2" /><circle cx="124" cy="34" fill="#f9e8e5" r="12" stroke="#c4332a" strokeWidth="2" /><path d="M43 82h30a16 16 0 0 0 16-16V55a16 16 0 0 1 16-16h7" stroke="#42483f" strokeDasharray="5 6" strokeLinecap="round" strokeWidth="2" /><path d="m108 31 10 3-6 8" stroke="#42483f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /><path d="M20 103h120" stroke="#b7bfb4" strokeWidth="2" /></svg>;
}
