import React from 'react';
import {
  BookOpen,
  Bot,
  Coins,
  Download,
  Gem,
  Globe,
  LogIn,
  Palette,
  Settings,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { GameMode, LocalPreferences, UserProfile } from '../engine/types';
import { AvatarPortrait, CrownEmblem } from './CrownEmblem';

interface HomeDashboardProps {
  prefs: LocalPreferences;
  authProfile: UserProfile | null;
  dailyClaimed: boolean;
  onSelectMode: (mode: GameMode) => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenDailyBonus: () => void;
  onOpenLogin: () => void;
}

export function HomeDashboard({
  prefs,
  authProfile,
  dailyClaimed,
  onSelectMode,
  onOpenSettings,
  onOpenRules,
  onOpenDailyBonus,
  onOpenLogin,
}: HomeDashboardProps) {
  const displayName = authProfile ? authProfile.displayName : prefs.guestName;
  const avatarId = authProfile ? authProfile.avatarId : prefs.guestAvatar;
  const coins = authProfile ? authProfile.coins : prefs.guestCoins;
  const gems = authProfile ? authProfile.gems : prefs.guestGems;
  const wins = authProfile ? authProfile.wins : prefs.guestWins;
  const gamesPlayed = authProfile ? authProfile.gamesPlayed : prefs.guestGamesPlayed;

  const modes: {
    id: GameMode;
    title: string;
    subtitle: string;
    gradient: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'online',
      title: 'Play Online',
      subtitle: 'Public tables & live room codes',
      gradient: 'royal-blue-gradient',
      icon: <Globe className="w-7 h-7 text-white drop-shadow" />,
    },
    {
      id: 'friends',
      title: 'Play with Friends',
      subtitle: 'Create or join private rooms',
      gradient: 'royal-magenta-gradient',
      icon: <Users className="w-7 h-7 text-white drop-shadow" />,
    },
    {
      id: 'computer',
      title: 'Play vs Computer',
      subtitle: 'Smart AI · Easy, Normal, Hard',
      gradient: 'royal-gold-gradient',
      icon: <Bot className="w-7 h-7 text-[#24124D] drop-shadow-sm" />,
    },
    {
      id: 'local',
      title: 'Local Multiplayer',
      subtitle: 'Pass & Play · 2 to 4 Players',
      gradient: 'royal-crimson-gradient',
      icon: <Smartphone className="w-7 h-7 text-white drop-shadow" />,
    },
  ];

  return (
    <div className="min-h-screen royal-bg-radial flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        {/* Profile Summary */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-3 text-left group focus-visible:outline-none"
        >
          <AvatarPortrait
            avatarId={avatarId}
            alt={displayName}
            className="w-11 h-11 sm:w-12 sm:h-12 group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <p className="font-display font-bold text-sm sm:text-base text-white truncate max-w-[140px] sm:max-w-[200px]">
              {displayName}
            </p>
            <p className="text-xs text-purple-200/75 tabular-nums">
              {wins} Wins · {gamesPlayed} Matches
            </p>
          </div>
        </button>

        {/* Currency & Utility Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden xs:flex sm:flex items-center gap-4 px-3.5 py-2 rounded-2xl bg-[#22104B]/90 border border-white/10">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-display font-bold text-[#FFBC41] tabular-nums">
              <Coins className="w-4 h-4" />
              <span>{coins.toLocaleString()}</span>
            </div>
            <span className="text-white/20" aria-hidden="true">
              |
            </span>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-display font-bold text-sky-300 tabular-nums">
              <Gem className="w-4 h-4" />
              <span>{gems.toLocaleString()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDailyBonus}
            aria-label="Daily Lucky Dice Bonus"
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#2B155E] hover:bg-[#3A1D7A] border border-[#FFBC41]/40 flex items-center justify-center text-[#FFBC41] transition"
            title="Lucky Dice Daily Reward"
          >
            <Sparkles className="w-5 h-5" />
            {!dailyClaimed && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FF201B] border-2 border-[#1B0E3A]" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenRules}
            aria-label="Game Rules"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#2B155E] hover:bg-[#3A1D7A] border border-white/15 flex items-center justify-center text-white transition"
            title="Classic Ludo Rules"
          >
            <BookOpen className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#2B155E] hover:bg-[#3A1D7A] border border-white/15 flex items-center justify-center text-white transition"
            title="Settings & Profile"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Hero & Mode Selection */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-6 sm:mb-8"
        >
          <CrownEmblem size="lg" />
          <h1 className="sr-only">Ludo Royale</h1>
          <p className="text-sm sm:text-base text-purple-100/85 mt-1 max-w-md mx-auto">
            Classic board strategy with smart AI, local pass-and-play, and real-time room codes.
          </p>

          {/* Compact mobile coin strip */}
          <div className="mt-3 flex sm:hidden items-center justify-center gap-4 text-xs font-display font-bold tabular-nums">
            <span className="inline-flex items-center gap-1 text-[#FFBC41]">
              <Coins className="w-4 h-4" />
              {coins.toLocaleString()} Coins
            </span>
            <span className="text-white/25">·</span>
            <span className="inline-flex items-center gap-1 text-sky-300">
              <Gem className="w-4 h-4" />
              {gems.toLocaleString()} Gems
            </span>
          </div>
        </motion.div>

        {/* 4 Core Game Mode Cards */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modes.map((m, idx) => {
            const isLightText = m.id !== 'computer';
            return (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: idx * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectMode(m.id)}
                className={`group relative overflow-hidden rounded-3xl ${m.gradient} p-5 sm:p-6 text-left shadow-[0_12px_30px_rgba(0,0,0,0.4)] border border-white/25 flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    isLightText ? 'bg-black/20' : 'bg-white/35'
                  }`}
                >
                  {m.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    className={`font-display font-extrabold text-lg sm:text-xl leading-tight ${
                      isLightText ? 'text-white' : 'text-[#24124D]'
                    }`}
                  >
                    {m.title}
                  </h2>
                  <p
                    className={`text-xs sm:text-sm mt-0.5 ${
                      isLightText ? 'text-white/85' : 'text-[#24124D]/80 font-medium'
                    }`}
                  >
                    {m.subtitle}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Bottom Quick Action Bar */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenDailyBonus}
            className="px-4 py-2.5 rounded-xl bg-[#271357] hover:bg-[#341A73] border border-[#FFBC41]/35 text-xs font-display font-bold text-[#FFBC41] inline-flex items-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4" />
            {dailyClaimed ? 'Daily Bonus Claimed' : 'Roll Lucky Dice'}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="px-4 py-2.5 rounded-xl bg-[#271357] hover:bg-[#341A73] border border-white/15 text-xs font-display font-bold text-white inline-flex items-center gap-2 transition"
          >
            <Palette className="w-4 h-4 text-purple-200" />
            Theme: {prefs.boardTheme === 'royal' ? 'Royal Velvet' : prefs.boardTheme === 'classic' ? 'Heritage Wood' : 'Midnight Arena'}
          </button>

          {!authProfile && (
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-display font-bold text-white inline-flex items-center gap-2 transition"
            >
              <LogIn className="w-4 h-4 text-[#FFBC41]" />
              Login with Email OTP
            </button>
          )}

          <a
            href="https://github.com/Sajju001/Ludo-Royal/releases/download/Ludo-Royal/ludo_royal.apk"
            download="ludo_royal.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-300/40 text-xs font-display font-bold text-white inline-flex items-center gap-2 shadow-md transition"
          >
            <Download className="w-4 h-4" />
            Download APK
          </a>
        </div>
      </main>
    </div>
  );
}
