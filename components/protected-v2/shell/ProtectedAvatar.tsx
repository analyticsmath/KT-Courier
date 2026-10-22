import Image from "next/image";

/**
 * The uploaded account avatar is delivered by the existing, authenticated
 * /api/platform/avatar endpoint. The icon is a deliberate neutral fallback,
 * never a fabricated portrait or a colored initials badge.
 */
export function ProtectedAvatar({
  name,
  src,
  className = "",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <span className={`eo-avatar eo-avatar--portrait ${className}`} aria-label={`${name} profile picture`} role="img">
      {src ? (
        <Image alt="" className="eo-avatar__image" src={src} width={40} height={40} unoptimized />
      ) : (
        <svg aria-hidden="true" className="eo-avatar__fallback" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8.1" r="3.4" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
