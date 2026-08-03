type IllustrationProps = { className?: string; decorative?: boolean; ariaLabel?: string };

export function SecureLedgerIllustration({ className, decorative = true, ariaLabel = "Verified ledger" }: IllustrationProps) {
  return <svg aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : ariaLabel} className={className} fill="none" role={decorative ? undefined : "img"} viewBox="0 0 160 120"><rect fill="#F8F9F8" height="76" rx="8" stroke="#323733" strokeWidth="3" width="94" x="33" y="22" /><path d="M49 43h62M49 58h38M49 73h26" stroke="#AEB8B1" strokeLinecap="round" strokeWidth="4" /><circle cx="111" cy="73" fill="#DFEEEA" r="16" stroke="#0F6B63" strokeWidth="3" /><path d="m103 73 5 5 10-11" stroke="#0F6B63" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /><path d="M38 104h84" stroke="#D83A2E" strokeLinecap="round" strokeWidth="3" /></svg>;
}
