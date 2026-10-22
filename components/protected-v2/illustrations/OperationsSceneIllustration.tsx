type Props = { className?: string };
/** A static, multi-layer logistics scene (not a route-arrow placeholder). */
export function OperationsSceneIllustration({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 320 184" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="scene-blue" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#395FF5"/><stop offset="1" stopColor="#7658D9"/>
        </linearGradient>
        <linearGradient id="scene-window" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#DFECFF"/><stop offset="1" stopColor="#ACC8FC"/>
        </linearGradient>
        <filter id="scene-shadow" x="-30%" y="-50%" width="160%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#213B80" floodOpacity=".13"/>
        </filter>
      </defs>
      <circle cx="267" cy="53" r="56" fill="#E3E9FF"/>
      <circle cx="63" cy="137" r="58" fill="#EFF2FF"/>
      <path d="M23 145h274" stroke="#CCD5EC" strokeWidth="1.5"/>
      <path d="M30 143c13-17 18-45 51-44 33 1 39 35 73 33 24-2 36-51 66-49 29 2 44 24 62 4"
        stroke="#ACBCE9" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round"/>
      <g filter="url(#scene-shadow)">
        <rect x="60" y="45" width="118" height="99" rx="13" fill="white"/>
        <rect x="60.5" y="45.5" width="117" height="98" rx="12.5" stroke="#D6DFF4"/>
        <rect x="75" y="60" width="46" height="6" rx="3" fill="#ABB8D3"/>
        <rect x="75" y="73" width="85" height="5" rx="2.5" fill="#E1E6F1"/>
        <rect x="75" y="84" width="61" height="5" rx="2.5" fill="#E1E6F1"/>
        <rect x="75" y="110" width="18" height="21" rx="4" fill="#AEC5FF"/>
        <rect x="99" y="100" width="18" height="31" rx="4" fill="#6F92FC"/>
        <rect x="123" y="92" width="18" height="39" rx="4" fill="url(#scene-blue)"/>
        <rect x="147" y="116" width="15" height="15" rx="4" fill="#2CB3A3"/>
      </g>
      <g filter="url(#scene-shadow)">
        <rect x="161" y="95" width="88" height="47" rx="9" fill="url(#scene-blue)"/>
        <path d="M249 108h24l19 19v15h-43z" fill="#222E56"/>
        <path d="M255 112h15l12 12h-27z" fill="url(#scene-window)"/>
        <path d="M170 106h36M170 115h19" stroke="#D6DFFF" strokeWidth="3" strokeLinecap="round"/>
        <rect x="213" y="98" width="22" height="20" rx="5" fill="#FFFFFF" fillOpacity=".16"/>
        <path d="M218 108h12m-6-6v12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="187" cy="143" r="12" fill="#182139"/><circle cx="187" cy="143" r="5" fill="#E4EBFF"/>
        <circle cx="268" cy="143" r="12" fill="#182139"/><circle cx="268" cy="143" r="5" fill="#E4EBFF"/>
      </g>
      <g filter="url(#scene-shadow)">
        <path d="M27 121l18-8 18 8-18 9z" fill="#F4BE79"/>
        <path d="M27 121v19l18 9v-19z" fill="#D9874D"/>
        <path d="M63 121v19l-18 9v-19z" fill="#F1A765"/>
        <path d="M45 130v19" stroke="#BD7146" strokeWidth="1.5"/>
      </g>
      <circle cx="278" cy="36" r="13" fill="white" stroke="#C9D6F9" strokeWidth="1.5"/>
      <path d="m272 36 4 4 8-9" stroke="#19A785" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/>
      <circle cx="136" cy="29" r="8" fill="#EF8B79" fillOpacity=".8"/>
      <circle cx="300" cy="87" r="4" fill="#5C73EA"/>
    </svg>
  );
}
