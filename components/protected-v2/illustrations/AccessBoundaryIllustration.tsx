type IllustrationProps = { className?: string; decorative?: boolean; ariaLabel?: string };

export function AccessBoundaryIllustration({ className, decorative = true, ariaLabel = "Access boundary" }: IllustrationProps) {
  return <svg aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : ariaLabel} className={className} fill="none" role={decorative ? undefined : "img"} viewBox="0 0 160 120"><path d="M80 18 117 32v25c0 24-15 39-37 47-22-8-37-23-37-47V32z" fill="#F8F9F8" stroke="#323733" strokeWidth="3" /><rect fill="#DFEEEA" height="22" rx="5" stroke="#0F6B63" strokeWidth="3" width="38" x="61" y="54" /><path d="M69 54v-7a11 11 0 0 1 22 0v7M80 63v5" stroke="#0F6B63" strokeLinecap="round" strokeWidth="3" /><path d="M31 28v18M22 37h18M129 75v18M120 84h18" stroke="#D83A2E" strokeLinecap="round" strokeWidth="3" /></svg>;
}
