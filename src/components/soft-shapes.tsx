// Decoration for gradient headers: blurred pink and blue glows and two soft waves.
export function SoftShapes() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 700 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="soft-pink">
          <stop offset="0" stopColor="#f6739b" stopOpacity="0.75" />
          <stop offset="1" stopColor="#f6739b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="soft-white">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="soft-blue">
          <stop offset="0" stopColor="#6a85f1" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6a85f1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="620" cy="30" r="170" fill="url(#soft-pink)" />
      <circle cx="470" cy="160" r="120" fill="url(#soft-white)" />
      <circle cx="40" cy="200" r="150" fill="url(#soft-blue)" />
      <path d="M0 160 C 150 130, 300 190, 450 160 S 640 130, 700 150 L700 200 L0 200 Z" fill="#ffffff" opacity="0.1" />
      <path d="M0 178 C 160 150, 320 205, 480 178 S 650 160, 700 170 L700 200 L0 200 Z" fill="#ffffff" opacity="0.1" />
    </svg>
  );
}
