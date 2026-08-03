type IllustrationProps = { className?: string; decorative?: boolean; ariaLabel?: string };

export function RouteQueueIllustration({ className, decorative = true, ariaLabel = "Route queue" }: IllustrationProps) {
  return <svg aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : ariaLabel} className={className} fill="none" role={decorative ? undefined : "img"} viewBox="0 0 160 120"><circle cx="32" cy="84" fill="#DFEEEA" r="12" stroke="#0F6B63" strokeWidth="3" /><circle cx="124" cy="34" fill="#F7E5E2" r="12" stroke="#D83A2E" strokeWidth="3" /><path d="M43 82h30a16 16 0 0 0 16-16V55a16 16 0 0 1 16-16h7" stroke="#323733" strokeDasharray="5 6" strokeLinecap="round" strokeWidth="3" /><path d="m108 31 10 3-6 8" stroke="#323733" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /><path d="M20 103h120" stroke="#AEB8B1" strokeWidth="3" /></svg>;
}
