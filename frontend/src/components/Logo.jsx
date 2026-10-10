// NFT Valuator logo — faceted gem on a gradient badge.
// One source of truth: navbar, hero, footer and the favicon all use this mark.
export default function Logo({ size = 32, id = "lg" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82e8" />
          <stop offset="1" stopColor="#7a5cf0" />
        </linearGradient>
        <linearGradient id={`${id}-gem`} x1="24" y1="13" x2="24" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe7ff" />
        </linearGradient>
      </defs>

      {/* badge */}
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill={`url(#${id}-bg)`} />
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      {/* subtle inner glow */}
      <circle cx="33" cy="12" r="14" fill="rgba(255,255,255,.14)" />

      {/* gem */}
      <path d="M16 14 H32 L38 22 L24 40 L10 22 Z" fill={`url(#${id}-gem)`} />
      {/* facets */}
      <g stroke="#5f6ee0" strokeOpacity=".45" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <path d="M10 22 H38" />
        <path d="M16 14 L20 22 L24 40" />
        <path d="M32 14 L28 22 L24 40" />
      </g>
      {/* sparkle */}
      <path
        d="M35.5 31.5 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1 Z"
        fill="#ffffff" opacity=".95"
      />
    </svg>
  );
}

// Standalone SVG string for the favicon (same mark, no React).
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="b" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3b82e8"/><stop offset="1" stop-color="#7a5cf0"/></linearGradient></defs><rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#b)"/><path d="M16 14 H32 L38 22 L24 40 L10 22 Z" fill="#fff"/><g stroke="#5f6ee0" stroke-opacity=".45" stroke-width="1.3" stroke-linejoin="round" fill="none"><path d="M10 22 H38"/><path d="M16 14 L20 22 L24 40"/><path d="M32 14 L28 22 L24 40"/></g></svg>`;
