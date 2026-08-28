import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function KtIconHome({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M3 10.5 12 3l9 7.5v9.5a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

export function KtIconShop({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M3 9l2-5h14l2 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
      <path d="M3 9h18" />
      <path d="M9 13a3 3 0 0 0 6 0" />
    </svg>
  );
}

export function KtIconSend({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

export function KtIconOrders({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect height="4" rx="1" width="8" x="8" y="3" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

export function KtIconAccount({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function KtIconCart({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="20" cy="20" r="1" />
      <path d="M1 1h4l2.68 12.86a2 2 0 0 0 2 1.64h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function KtIconMenu({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function KtIconClose({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function KtIconBack({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function KtIconArrowRight({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function KtIconArrowUpRight({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  );
}

export function KtIconSearch({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function KtIconLocation({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function KtIconCheck({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function KtIconLock({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <rect height="11" rx="2" width="18" x="3" y="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function KtIconChevronDown({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function KtIconPackage({ size = 20, ...props }: IconProps) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size} {...props}>
      <path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" x2="12" y1="22.08" y2="12" />
    </svg>
  );
}
