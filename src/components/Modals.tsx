import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Check,
  Coins,
  Crown,
  Download,
  LogIn,
  LogOut,
  Music,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { COLOR_HEX, COLOR_LABELS } from '../engine/boardMap';
import {
  AvatarId,
  BoardTheme,
  GameState,
  LocalPreferences,
  UserProfile,
} from '../engine/types';
import { AVATAR_ASSETS, AvatarPortrait, CrownEmblem } from './CrownEmblem';
import { Dice3D } from './Dice3D';

/* ---------------- SETTINGS & PROFILE MODAL ---------------- */
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  prefs: LocalPreferences;
  onUpdatePrefs: (next: Partial<LocalPreferences>) => void;
  authProfile: UserProfile | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSaveProfile: (displayName: string, avatarId: AvatarId) => Promise<void>;
}

export function SettingsModal({
  open,
  onClose,
  prefs,
  onUpdatePrefs,
  authProfile,
  onSignIn,
  onSignOut,
  onSaveProfile,
}: SettingsModalProps) {
  const activeName = authProfile ? authProfile.displayName : prefs.guestName;
  const activeAvatar = authProfile ? authProfile.avatarId : prefs.guestAvatar;

  const [nameInput, setNameInput] = useState(activeName);
  const [avatarInput, setAvatarInput] = useState<AvatarId>(activeAvatar);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    if (open) {
      setNameInput(activeName);
      setAvatarInput(activeAvatar);
      setSavedNote('');
    }
  }, [open, activeName, activeAvatar]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameInput.trim().slice(0, 32) || 'Royal Player';
    setSaving(true);
    try {
      await onSaveProfile(cleaned, avatarInput);
      setSavedNote('Profile updated');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#22104B] border border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold text-white">Settings & Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Section */}
        <div className="rounded-2xl bg-[#180A38] border border-white/10 p-4 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <AvatarPortrait avatarId={avatarInput} alt={activeName} className="w-12 h-12" />
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-white truncate">{activeName}</p>
                <p className="text-xs text-purple-200/75">
                  {authProfile ? 'Verified Account · Cloud Synced' : 'Guest Mode · Local Storage'}
                </p>
              </div>
            </div>
            {authProfile ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="px-4 py-2 rounded-xl royal-gold-gradient text-[#24124D] text-xs font-display font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-md hover:brightness-105 transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Display Name & Avatar Picker */}
        <form onSubmit={handleSave} className="space-y-4 mb-6">
          <div>
            <label htmlFor="player-name-input" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                id="player-name-input"
                type="text"
                maxLength={32}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                placeholder="Enter your name"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-[#4396FC] hover:bg-[#3385EB] text-white text-xs font-bold whitespace-nowrap shrink-0 transition"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {savedNote && <p className="text-xs text-emerald-400 mt-1">{savedNote}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold text-purple-200/85 mb-2">Choose Avatar</p>
            <div className="grid grid-cols-4 gap-2.5">
              {(Object.keys(AVATAR_ASSETS) as AvatarId[]).map((id) => {
                const selected = avatarInput === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAvatarInput(id)}
                    className={`p-2 rounded-2xl border flex flex-col items-center gap-1.5 transition ${
                      selected
                        ? 'bg-[#3A1C71] border-[#FFBC41] ring-2 ring-[#FFBC41]/40'
                        : 'bg-[#180A38] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <AvatarPortrait avatarId={id} alt={AVATAR_ASSETS[id].label} className="w-12 h-12" />
                    <span className="text-[11px] font-medium text-purple-100 truncate max-w-full">
                      {AVATAR_ASSETS[id].label.split(' ')[1]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Audio & Rules Toggles */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#180A38] border border-white/10">
            <div className="flex items-center gap-3">
              {prefs.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-[#FFBC41]" />
              ) : (
                <VolumeX className="w-5 h-5 text-purple-300/60" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">Sound Effects</p>
                <p className="text-xs text-purple-200/70">Dice roll, hops, captures, victory</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                prefs.soundEnabled ? 'bg-emerald-500 text-white' : 'bg-white/10 text-purple-200'
              }`}
            >
              {prefs.soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#180A38] border border-white/10">
            <div className="flex items-center gap-3">
              <Music className={`w-5 h-5 ${prefs.musicEnabled ? 'text-[#FFBC41]' : 'text-purple-300/60'}`} />
              <div>
                <p className="text-sm font-semibold text-white">Ambient Music</p>
                <p className="text-xs text-purple-200/70">Gentle royal background melody</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrefs({ musicEnabled: !prefs.musicEnabled })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                prefs.musicEnabled ? 'bg-emerald-500 text-white' : 'bg-white/10 text-purple-200'
              }`}
            >
              {prefs.musicEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#180A38] border border-white/10">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-[#FFBC41]" />
              <div>
                <p className="text-sm font-semibold text-white">Three-Sixes Forfeit Rule</p>
                <p className="text-xs text-purple-200/70">Rolling 6 three times passes turn</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrefs({ threeSixesRule: !prefs.threeSixesRule })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                prefs.threeSixesRule ? 'bg-emerald-500 text-white' : 'bg-white/10 text-purple-200'
              }`}
            >
              {prefs.threeSixesRule ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Board Theme Selector */}
        <div>
          <p className="text-xs font-semibold text-purple-200/85 mb-2">Board Theme</p>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'royal', label: 'Royal Velvet', swatch: 'from-[#5A2DAB] to-[#271257]' },
                { id: 'classic', label: 'Heritage Wood', swatch: 'from-[#8B5A2B] to-[#5C3A21]' },
                { id: 'midnight', label: 'Midnight Arena', swatch: 'from-[#1E293B] to-[#0B1120]' },
              ] as { id: BoardTheme; label: string; swatch: string }[]
            ).map((theme) => {
              const active = prefs.boardTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdatePrefs({ boardTheme: theme.id })}
                  className={`p-3 rounded-2xl border text-center transition ${
                    active
                      ? 'bg-[#3A1C71] border-[#FFBC41] ring-2 ring-[#FFBC41]/40'
                      : 'bg-[#180A38] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className={`h-7 rounded-lg bg-gradient-to-br ${theme.swatch} border border-white/20 mb-2`} />
                  <span className="text-xs font-semibold text-white">{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Android APK Download */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Android App</p>
            <p className="text-xs text-purple-200/70">Install Ludo Royale on your Android phone</p>
          </div>
          <a
            href="https://github.com/Sajju001/Ludo-Royal/releases/download/Ludo-Royal/ludo_royal.apk"
            download="ludo_royal.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-300/35 text-xs font-display font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-md transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download APK
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------------- RULES / INSTRUCTIONS MODAL ---------------- */
export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const rules = [
    {
      title: '1. Entering the Board',
      body: 'Roll a 6 to deploy a token from your home yard onto your colored starting star square.',
    },
    {
      title: '2. Bonus Rolls',
      body: 'Rolling a 6, capturing an opponent token, or guiding a token into the center crown grants an extra roll.',
    },
    {
      title: '3. Safe Star Squares',
      body: 'Colored starting squares and star squares (8 total) are safe zones where no token can be captured.',
    },
    {
      title: '4. Capturing Opponents',
      body: 'Landing on an opponent token outside a safe zone sends it back to their yard and awards a bonus roll.',
    },
    {
      title: '5. Exact Finish',
      body: 'Tokens travel into their matching colored home lane and need an exact dice roll to enter the center crown.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-[#22104B] border border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#FFBC41]" />
            <h2 className="font-display text-lg font-bold text-white">Classic Ludo Rules</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.title} className="rounded-2xl bg-[#180A38] border border-white/10 p-3.5">
              <h3 className="font-display font-bold text-sm text-[#FFBC41] mb-1">{r.title}</h3>
              <p className="text-xs leading-relaxed text-purple-100/85">{r.body}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-xl royal-gold-gradient text-[#24124D] font-display font-bold text-sm shadow-lg"
        >
          Got It
        </button>
      </div>
    </div>
  );
}

/* ---------------- DAILY LUCKY DICE BONUS MODAL ---------------- */
export function DailyBonusModal({
  open,
  onClose,
  alreadyClaimed,
  onClaim,
}: {
  open: boolean;
  onClose: () => void;
  alreadyClaimed: boolean;
  onClaim: (rewardCoins: number) => void;
}) {
  const [rolling, setRolling] = useState(false);
  const [targetFace, setTargetFace] = useState<number | null>(null);
  const [rolledFace, setRolledFace] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setRolling(false);
      setTargetFace(null);
      setRolledFace(null);
    }
  }, [open]);

  if (!open) return null;

  const handleLuckyRoll = () => {
    if (alreadyClaimed || rolling || rolledFace !== null) return;
    const face = Math.floor(Math.random() * 6) + 1;
    setTargetFace(face);
    setRolling(true);
    setTimeout(() => {
      setRolledFace(face);
      setRolling(false);
      onClaim(face * 150);
    }, 640);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-[#241152] border border-[#FFBC41]/40 p-6 text-center shadow-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl royal-crimson-gradient text-white font-display font-bold text-sm shadow-md mb-3">
          <Sparkles className="w-4 h-4" />
          LUCKY DICE
        </div>
        <h2 className="font-display text-xl font-bold text-white mb-1">Daily Royal Bonus</h2>
        <p className="text-xs text-purple-200/80 mb-5">
          {alreadyClaimed && rolledFace === null
            ? 'You already claimed today’s Lucky Dice reward. Come back tomorrow!'
            : 'Roll the Lucky Die once every day to win up to 900 Gold Coins!'}
        </p>

        <div className="flex justify-center my-4">
          <Dice3D
            value={rolledFace ?? targetFace ?? 6}
            rolling={rolling}
            canRoll={!alreadyClaimed && rolledFace === null}
            activeColor="yellow"
            onRoll={handleLuckyRoll}
            size="lg"
          />
        </div>

        {rolledFace !== null ? (
          <div className="mt-4 rounded-2xl bg-[#180A38] border border-[#FFBC41]/40 p-3.5">
            <p className="text-xs text-purple-200">You rolled a {rolledFace}!</p>
            <p className="font-display text-lg font-bold text-[#FFBC41] mt-0.5 tabular-nums">
              +{rolledFace * 150} Coins Added
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={alreadyClaimed || rolling}
            onClick={handleLuckyRoll}
            className={`w-full mt-4 py-3 rounded-xl font-display font-bold text-sm transition ${
              alreadyClaimed
                ? 'bg-white/10 text-purple-300/60 cursor-not-allowed'
                : 'royal-gold-gradient text-[#24124D] shadow-lg hover:brightness-105'
            }`}
          >
            {alreadyClaimed ? 'Claimed Today' : rolling ? 'Rolling...' : 'Roll Lucky Dice'}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs font-semibold text-purple-200/80 hover:text-white transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------------- EXIT MATCH CONFIRM MODAL ---------------- */
export function ExitConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-3xl bg-[#241152] border border-white/15 p-6 text-center shadow-2xl">
        <h2 className="font-display text-xl font-bold text-white mb-2">EXIT MATCH?</h2>
        <p className="text-xs text-purple-200/80 mb-6">
          Are you sure you want to leave the current game? Match progress will be lost.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="py-2.5 rounded-xl royal-crimson-gradient text-white font-display font-bold text-sm shadow-md hover:brightness-110 transition"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-display font-bold text-sm shadow-md transition"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- VICTORY / MATCH RESULT MODAL ---------------- */
export function VictoryModal({
  gameState,
  onPlayAgain,
  onReturnHome,
}: {
  gameState: GameState;
  onPlayAgain: () => void;
  onReturnHome: () => void;
}) {
  useEffect(() => {
    if (gameState.turnPhase === 'GAME_OVER') {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.55 },
        colors: ['#FFBC41', '#FF201B', '#4396FC', '#16A34A', '#F300CC'],
      });
    }
  }, [gameState.turnPhase]);

  if (gameState.turnPhase !== 'GAME_OVER') return null;

  const ranked = [...gameState.players].sort((a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99));
  const winner = ranked[0];
  const rewardCoins = gameState.stake > 0 ? gameState.stake * gameState.players.length : 300;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl bg-[#241152] border-2 border-[#FFBC41]/60 p-6 text-center shadow-[0_25px_70px_rgba(0,0,0,0.75)]">
        <CrownEmblem size="sm" />

        <div className="inline-block -mt-2 mb-4 px-7 py-2 rounded-xl royal-crimson-gradient border border-rose-300/40 shadow-lg">
          <span className="font-display font-extrabold text-lg tracking-wider text-white">
            {winner ? `${winner.name.toUpperCase()} WINS!` : 'YOU WIN!'}
          </span>
        </div>

        {/* Reward Summary */}
        <div className="flex items-center justify-center gap-2 mb-5 text-sm font-semibold text-[#FFBC41] tabular-nums">
          <Coins className="w-5 h-5" />
          <span>Winner Prize: +{rewardCoins} Coins</span>
        </div>

        {/* Podium Standings */}
        <div className="space-y-2 mb-6 text-left">
          {ranked.map((p, idx) => {
            const c = COLOR_HEX[p.color];
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border ${
                  idx === 0
                    ? 'bg-[#3A1C71] border-[#FFBC41]/70'
                    : 'bg-[#180A38] border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center font-display font-bold text-sm text-[#FFBC41] tabular-nums">
                    #{idx + 1}
                  </span>
                  <AvatarPortrait avatarId={p.avatarId} alt={p.name} className="w-9 h-9" />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-white truncate">{p.name}</p>
                    <p className="text-[11px] text-purple-200/70">
                      {COLOR_LABELS[p.color]} · {p.finishedCount}/4 Home
                    </p>
                  </div>
                </div>
                {idx === 0 ? (
                  <Trophy className="w-5 h-5 text-[#FFBC41] shrink-0" />
                ) : (
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.main }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReturnHome}
            className="py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-display font-bold text-sm transition"
          >
            Home
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="py-3 rounded-xl royal-gold-gradient text-[#24124D] font-display font-bold text-sm inline-flex items-center justify-center gap-1.5 shadow-lg hover:brightness-105 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
