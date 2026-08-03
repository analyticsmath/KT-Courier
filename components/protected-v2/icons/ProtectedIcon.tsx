import type { ProtectedIconName } from "@/components/protected-v2/navigation/types";

type ProtectedIconProps = {
  name: ProtectedIconName;
  className?: string;
};

const paths: Record<ProtectedIconName, React.ReactNode> = {
  activity: <path d="M4 13h3l2-7 4 12 2-5h5" />,
  archive: <><path d="M4 5h16v4H4z" /><path d="M6 9v10h12V9M10 13h4" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 22h4" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  building: <><path d="M4 21V4h12v17M16 9h4v12M2 21h20" /><path d="M8 8h4M8 12h4M8 16h4" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="m7 16 4-5 3 2 5-7" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.99l.05.05-2.2 2.2-.05-.05a1.8 1.8 0 0 0-1.99-.36 1.8 1.8 0 0 0-1.07 1.65v.07h-3.1v-.07a1.8 1.8 0 0 0-1.07-1.65 1.8 1.8 0 0 0-1.99.36l-.05.05-2.2-2.2.05-.05A1.8 1.8 0 0 0 6.5 15a1.8 1.8 0 0 0-1.65-1.07h-.07v-3.1h.07A1.8 1.8 0 0 0 6.5 9.76a1.8 1.8 0 0 0-.36-1.99l-.05-.05 2.2-2.2.05.05a1.8 1.8 0 0 0 1.99.36 1.8 1.8 0 0 0 1.07-1.65v-.07h3.1v.07a1.8 1.8 0 0 0 1.07 1.65 1.8 1.8 0 0 0 1.99-.36l.05-.05 2.2 2.2-.05.05a1.8 1.8 0 0 0-.36 1.99 1.8 1.8 0 0 0 1.65 1.07h.07v3.1h-.07A1.8 1.8 0 0 0 19.4 15Z" /></>,
  "credit-card": <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h2" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  folder: <path d="M3 6h7l2 2h9v11H3z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  home: <><path d="m3 11 9-8 9 8v10H3z" /><path d="M9 21v-6h6v6" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 5l3 3M14 7l3 3" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  package: <><path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 21v-2a6 6 0 0 0-3-5.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3v-2a3 3 0 0 1 3-3h1" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  store: <><path d="M4 10v10h16V10M3 5h18l-1 5a3 3 0 0 1-5 1.6A3 3 0 0 1 9 11.6 3 3 0 0 1 4 10z" /><path d="M9 20v-5h6v5" /></>,
  support: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.2-1.7 2.7M12 17h.01" /></>,
  wallet: <><path d="M4 7a3 3 0 0 1 3-3h11v16H6a3 3 0 0 1-3-3V7z" /><path d="M4 7h16a2 2 0 0 1 2 2v7h-5a2 2 0 0 1 0-4h5M17 14h.01" /></>,
};

export function ProtectedIcon({ name, className }: ProtectedIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}
