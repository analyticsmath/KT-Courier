type IllustrationProps = { className?: string; decorative?: boolean; ariaLabel?: string };

export function ParcelDeskIllustration({ className, decorative = true, ariaLabel = "Parcel ready for dispatch" }: IllustrationProps) {
  return <svg aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : ariaLabel} className={className} fill="none" role={decorative ? undefined : "img"} viewBox="0 0 160 120"><path d="M22 96h116" stroke="#b7bfb4" strokeWidth="2" /><path d="m50 54 31-15 31 15-31 15z" fill="#e8eeff" stroke="#2457d6" strokeWidth="2" /><path d="M50 54v29l31 15 31-15V54" stroke="#2457d6" strokeWidth="2" /><path d="M81 69v29M61 49l31 15 10-5" stroke="#c4332a" strokeWidth="2" /><path d="M31 82h14M116 82h14" stroke="#42483f" strokeLinecap="round" strokeWidth="2" /></svg>;
}
