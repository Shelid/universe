import React, { useId } from 'react';

interface UniverseLogoProps {
  size?: 'sm' | 'md' | 'hero';
  animated?: boolean;
  className?: string;
}

const SIZE_CLASS_MAP: Record<NonNullable<UniverseLogoProps['size']>, string> = {
  sm: 'w-7 h-7',
  md: 'w-11 h-11',
  hero: 'w-28 h-28 sm:w-36 sm:h-36',
};

/**
 * Emblema vetorial oficial do Universe Explorer com núcleo planetário,
 * anéis orbitais inclinados e retículo astrométrico.
 */
export const UniverseLogo: React.FC<UniverseLogoProps> = ({
  size = 'hero',
  animated = true,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `${uid}-bg`;
  const planetId = `${uid}-planet`;
  const coronaId = `${uid}-corona`;
  const ring1Id = `${uid}-ring1`;
  const ring2Id = `${uid}-ring2`;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${SIZE_CLASS_MAP[size]} ${className}`}>
      {size === 'hero' && (
        <div
          className={`absolute inset-1 rounded-full bg-gradient-to-tr from-sky-500/30 via-cyan-400/20 to-indigo-500/30 blur-2xl ${
            animated ? 'animate-universe-glow' : ''
          }`}
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
        aria-label="Universe Explorer Logo"
      >
        <defs>
          <radialGradient id={bgId} cx="50%" cy="46%" r="55%">
            <stop offset="0%" stopColor="#0f2547" />
            <stop offset="68%" stopColor="#050c1d" />
            <stop offset="100%" stopColor="#02040a" />
          </radialGradient>
          <radialGradient id={coronaId} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={planetId} cx="34%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="28%" stopColor="#38bdf8" />
            <stop offset="62%" stopColor="#1d4ed8" />
            <stop offset="88%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#050816" />
          </radialGradient>
          <linearGradient id={ring1Id} x1="10" y1="88" x2="118" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="48%" stopColor="#7dd3fc" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={ring2Id} x1="18" y1="28" x2="110" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15" />
            <stop offset="52%" stopColor="#38bdf8" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {size === 'sm' ? (
          <rect width="128" height="128" rx="30" fill={`url(#${bgId})`} />
        ) : (
          <circle cx="64" cy="64" r="61" fill={`url(#${bgId})`} fillOpacity="0.88" />
        )}

        {/* Astrometric compass ring */}
        <g
          className={animated ? 'animate-universe-spin' : undefined}
          style={{ transformOrigin: '64px 64px' }}
        >
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="#38bdf8"
            strokeOpacity="0.28"
            strokeWidth="1.2"
            strokeDasharray="3 6"
          />
          <line x1="64" y1="4" x2="64" y2="11" stroke="#7dd3fc" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="64" y1="117" x2="64" y2="124" stroke="#7dd3fc" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="4" y1="64" x2="11" y2="64" stroke="#7dd3fc" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="117" y1="64" x2="124" y2="64" stroke="#7dd3fc" strokeOpacity="0.7" strokeWidth="1.5" />
        </g>

        {/* Outer halo behind planet */}
        <circle cx="64" cy="64" r="34" fill={`url(#${coronaId})`} />

        {/* Back arc of secondary tilted orbit */}
        <g transform="rotate(30 64 64)">
          <ellipse
            cx="64"
            cy="64"
            rx="48"
            ry="15"
            stroke={`url(#${ring2Id})`}
            strokeWidth="1.8"
            strokeOpacity="0.8"
          />
        </g>

        {/* Primary equatorial orbital ring */}
        <g transform="rotate(-24 64 64)">
          <ellipse cx="64" cy="64" rx="52" ry="18" stroke={`url(#${ring1Id})`} strokeWidth="2.4" />
        </g>

        {/* Planetary core */}
        <circle cx="64" cy="64" r="22" fill={`url(#${planetId})`} />
        <path
          d="M 46 53 C 52 44, 65 41, 76 46 C 63 45, 52 52, 47 64 Z"
          fill="#e0f2fe"
          fillOpacity="0.38"
        />
        <circle cx="64" cy="64" r="22.8" stroke="#7dd3fc" strokeOpacity="0.58" strokeWidth="1.1" />

        {/* Orbiting satellite beacons */}
        <g
          className={animated ? 'animate-universe-spin-reverse' : undefined}
          style={{ transformOrigin: '64px 64px' }}
        >
          <circle cx="109" cy="46" r="3.6" fill="#38bdf8" />
          <circle cx="109" cy="46" r="7" fill="#38bdf8" fillOpacity="0.22" />
          <circle cx="23" cy="83" r="2.7" fill="#fbbf24" />
        </g>
      </svg>
    </div>
  );
};

