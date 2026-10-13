// Small drawings for empty pages: soft color glows behind a card with a simple picture.
export type SceneName = "calendar" | "books" | "search" | "talk" | "chart" | "sparkle";

const GLYPHS: Record<SceneName, React.ReactNode> = {
  calendar: (
    <>
      <rect x="68" y="58" width="12" height="10" rx="3" fill="#f0ebfd" />
      <rect x="85" y="58" width="12" height="10" rx="3" fill="#f0ebfd" />
      <rect x="102" y="58" width="12" height="10" rx="3" fill="#f0ebfd" />
      <rect x="68" y="74" width="12" height="10" rx="3" fill="#f0ebfd" />
      <rect x="85" y="74" width="12" height="10" rx="3" fill="url(#scene-hot)" />
      <rect x="102" y="74" width="12" height="10" rx="3" fill="#f0ebfd" />
      <rect x="68" y="90" width="12" height="8" rx="3" fill="#f0ebfd" />
      <rect x="85" y="90" width="12" height="8" rx="3" fill="#f0ebfd" />
    </>
  ),
  books: (
    <>
      <rect x="68" y="60" width="54" height="9" rx="3" fill="#c5a4f6" />
      <rect x="72" y="72" width="48" height="9" rx="3" fill="#f6bfdd" />
      <rect x="66" y="84" width="56" height="9" rx="3" fill="#bccdfb" />
    </>
  ),
  search: (
    <>
      <circle cx="90" cy="74" r="13" fill="none" stroke="#9a75ee" strokeWidth="4" />
      <path d="M100 84 l10 10" stroke="#9a75ee" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  talk: (
    <>
      <rect x="68" y="58" width="44" height="22" rx="8" fill="#f0ebfd" />
      <rect x="80" y="78" width="40" height="18" rx="8" fill="url(#scene-hot)" />
    </>
  ),
  chart: (
    <>
      <rect x="70" y="80" width="10" height="16" rx="3" fill="#f0ebfd" />
      <rect x="85" y="70" width="10" height="26" rx="3" fill="#c5a4f6" />
      <rect x="100" y="60" width="10" height="36" rx="3" fill="url(#scene-hot)" />
    </>
  ),
  sparkle: <path d="M95 60l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="url(#scene-hot)" />,
};

export function Scene({ name }: { name: SceneName }) {
  return (
    <svg aria-hidden="true" width="190" height="130" viewBox="0 0 190 130" className="mx-auto">
      <defs>
        <radialGradient id="scene-pink">
          <stop offset="0" stopColor="#ec6cb6" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ec6cb6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="scene-blue">
          <stop offset="0" stopColor="#6978e8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#6978e8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scene-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b7de5" />
          <stop offset="1" stopColor="#e481bb" />
        </linearGradient>
        <linearGradient id="scene-hot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef70b7" />
          <stop offset="1" stopColor="#b66be8" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="70" r="50" fill="url(#scene-blue)" />
      <circle cx="145" cy="55" r="45" fill="url(#scene-pink)" />
      <rect x="58" y="28" width="74" height="78" rx="12" fill="#ffffff" stroke="#ecebf4" strokeWidth="2" />
      <rect x="58" y="28" width="74" height="20" rx="12" fill="url(#scene-brand)" />
      <rect x="58" y="40" width="74" height="8" fill="url(#scene-brand)" />
      {GLYPHS[name]}
      <circle cx="132" cy="100" r="15" fill="url(#scene-hot)" />
      <path d="M125 100l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#b66be8" opacity="0.6" />
      <circle cx="160" cy="20" r="3" fill="#9a75ee" opacity="0.5" />
      <circle cx="30" cy="105" r="2.5" fill="#ec6cb6" opacity="0.6" />
    </svg>
  );
}
