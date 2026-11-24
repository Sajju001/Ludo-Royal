import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import { AvatarId } from '../engine/types';

export const AVATAR_ASSETS: Record<AvatarId, { src: string; label: string; bg: string }> = {
  king: {
    src: '/src/assets/images/avatar_royal_king_1795494198340.jpg',
    label: 'Royal King',
    bg: 'from-purple-700 to-indigo-950',
  },
  archer: {
    src: '/src/assets/images/avatar_emerald_archer_1795494198677.jpg',
    label: 'Emerald Archer',
    bg: 'from-emerald-700 to-teal-950',
  },
  empress: {
    src: '/src/assets/images/avatar_sun_empress_1795494198590.jpg',
    label: 'Sun Empress',
    bg: 'from-amber-600 to-rose-950',
  },
  knight: {
    src: '/src/assets/images/avatar_azure_knight_1795494198986.jpg',
    label: 'Azure Knight',
    bg: 'from-blue-600 to-slate-950',
  },
};

export function AvatarPortrait({
  avatarId,
  alt,
  className = 'w-12 h-12',
}: {
  avatarId: AvatarId;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const asset = AVATAR_ASSETS[avatarId] || AVATAR_ASSETS.king;

  if (failed) {
    return (
      <div
        className={`${className} rounded-full bg-gradient-to-br ${asset.bg} flex items-center justify-center border-2 border-[#FFBC41]/70 text-[#FFBC41] shrink-0`}
        aria-label={alt}
      >
        <Crown className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img
      src={asset.src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover border-2 border-[#FFBC41]/80 shadow-md shrink-0 bg-[#1B0E3A]`}
    />
  );
}

export function CrownEmblem({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dimensions =
    size === 'sm' ? 'w-28 h-24' : size === 'md' ? 'w-44 h-36' : 'w-56 h-44 sm:w-64 sm:h-52';

  return (
    <div className={`relative select-none mx-auto ${dimensions}`} aria-label="Ludo Royale Crest">
      <svg viewBox="0 0 260 215" className="w-full h-full drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]">
        <defs>
          <linearGradient id="crownGold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF0A8" />
            <stop offset="48%" stopColor="#FFBC41" />
            <stop offset="100%" stopColor="#C97604" />
          </linearGradient>
          <linearGradient id="shieldFace" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2C196B" />
            <stop offset="60%" stopColor="#190E42" />
            <stop offset="100%" stopColor="#10082B" />
          </linearGradient>
          <linearGradient id="ribbonRed" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF4F4A" />
            <stop offset="55%" stopColor="#E11410" />
            <stop offset="100%" stopColor="#940806" />
          </linearGradient>
        </defs>

        {/* Golden Crown */}
        <path
          d="M74 62 L63 24 L98 44 L130 12 L162 44 L197 24 L186 62 Z"
          fill="url(#crownGold)"
          stroke="#FFE89C"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="63" cy="21" r="5" fill="#FFE89C" />
        <circle cx="130" cy="10" r="6.5" fill="#FFE89C" />
        <circle cx="197" cy="21" r="5" fill="#FFE89C" />
        <circle cx="130" cy="43" r="5.5" fill="#FF201B" stroke="#FFE89C" strokeWidth="1.5" />
        <circle cx="101" cy="48" r="4" fill="#4396FC" stroke="#FFE89C" strokeWidth="1.2" />
        <circle cx="159" cy="48" r="4" fill="#16A34A" stroke="#FFE89C" strokeWidth="1.2" />

        {/* Shield Body */}
        <path
          d="M52 62 L208 62 L208 122 C208 162 170 189 130 202 C90 189 52 162 52 122 Z"
          fill="url(#shieldFace)"
          stroke="url(#crownGold)"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M61 70 L199 70 L199 120 C199 154 166 178 130 190 C94 178 61 154 61 120 Z"
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.5"
        />

        {/* Multicolor LUDO Wordmark */}
        <text
          x="130"
          y="117"
          textAnchor="middle"
          fontFamily="Poppins, sans-serif"
          fontWeight="800"
          fontSize="38"
          letterSpacing="2"
        >
          <tspan fill="#FF3B35">L</tspan>
          <tspan fill="#FFCC33">U</tspan>
          <tspan fill="#4EA3FF">D</tspan>
          <tspan fill="#2AD167">O</tspan>
        </text>

        {/* Crimson Ribbon Ends */}
        <path d="M24 134 L56 130 L56 164 L24 168 L36 151 Z" fill="#8A0705" />
        <path d="M236 134 L204 130 L204 164 L236 168 L224 151 Z" fill="#8A0705" />

        {/* Main Crimson Ribbon */}
        <path
          d="M42 128 Q130 116 218 128 L214 162 Q130 150 46 162 Z"
          fill="url(#ribbonRed)"
          stroke="#FFB8B6"
          strokeWidth="1.5"
        />
        <text
          x="130"
          y="150"
          textAnchor="middle"
          fontFamily="Poppins, sans-serif"
          fontWeight="800"
          fontSize="21"
          letterSpacing="4"
          fill="#FFFFFF"
        >
          ROYALE
        </text>

        {/* Mini Dice Accents */}
        <rect x="64" y="136" width="13" height="13" rx="3" fill="#FFF7ED" transform="rotate(-12 70 142)" />
        <circle cx="70" cy="142" r="2" fill="#E11410" />
        <rect x="183" y="136" width="13" height="13" rx="3" fill="#FFF7ED" transform="rotate(12 189 142)" />
        <circle cx="187" cy="140" r="1.5" fill="#1E1B4B" />
        <circle cx="192" cy="145" r="1.5" fill="#1E1B4B" />
      </svg>
    </div>
  );
}
