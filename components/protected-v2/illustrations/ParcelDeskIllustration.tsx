type IllustrationProps = { className?: string; decorative?: boolean; ariaLabel?: string };

export function ParcelDeskIllustration({ className, decorative = true, ariaLabel = "Parcel ready for dispatch" }: IllustrationProps) {
  return <svg aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : ariaLabel} className={className} fill="none" role={decorative ? undefined : "img"} viewBox="0 0 160 120"><path d="M22 96h116" stroke="#AEB8B1" strokeWidth="3" /><path d="m50 54 31-15 31 15-31 15z" fill="#DFEEEA" stroke="#0F6B63" strokeWidth="3" /><path d="M50 54v29l31 15 31-15V54" stroke="#0F6B63" strokeWidth="3" /><path d="M81 69v29M61 49l31 15 10-5" stroke="#D83A2E" strokeWidth="3" /><path d="M31 82h14M116 82h14" stroke="#323733" strokeLinecap="round" strokeWidth="3" /></svg>;
}
