import React, { useCallback, useEffect, useState } from 'react';
import { GameArena } from './components/GameArena';
import { HomeDashboard } from './components/HomeDashboard';
import { LoginModal } from './components/LoginModal';
import { MatchSetupModal } from './components/MatchSetupModal';
import { DailyBonusModal, RulesModal, SettingsModal } from './components/Modals';
import { getColorsForPlayerCount } from './engine/boardMap';
import { createInitialGameState, PlayerSetupConfig } from './engine/ludoEngine';
import {
  AIDifficulty,
  AvatarId,
  GameMode,
  GameState,
  LocalPreferences,
  OnlineRoom,
  PlayerColor,
  UserProfile,
} from './engine/types';
import { setActiveErrorUserId, testConnection } from './firebase/firebase';
import { recordDailyClaim, updateUserProfile } from './firebase/profileService';
import { soundEngine } from './services/soundEngine';
import { loadPreferences, savePreferences } from './services/storage';

const AI_NAMES = ['Royal Bot', 'Emerald Bot', 'Sun Bot', 'Azure Bot'];
const AI_AVATARS: AvatarId[] = ['king', 'archer', 'empress', 'knight'];

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [prefs, setPrefs] = useState<LocalPreferences>(() => loadPreferences());
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null);
  const [, setOtpSessionToken] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Navigation & Modal State
  const [setupMode, setSetupMode] = useState<GameMode | null>(null);
  const [pendingModeAfterLogin, setPendingModeAfterLogin] = useState<GameMode | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);

  // Active Match State
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [activeOnlineRoom, setActiveOnlineRoom] = useState<OnlineRoom | null>(null);
  const [lastLocalConfig, setLastLocalConfig] = useState<{
    mode: 'computer' | 'local';
    playerCount: number;
    preferredColor: PlayerColor;
    aiDifficulty: AIDifficulty;
    stake: number;
    localNames: string[];
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 3500);
  }, []);

  // Sync audio preferences with Web Audio Engine
  useEffect(() => {
    soundEngine.setSoundEnabled(prefs.soundEnabled);
    soundEngine.setMusicEnabled(prefs.musicEnabled);
    savePreferences(prefs);
  }, [prefs]);

  // Verify Firestore connection on boot
  useEffect(() => {
    testConnection();
  }, []);

  // If user logged in after clicking Play Online / Play with Friends, proceed automatically
  useEffect(() => {
    if (authProfile && pendingModeAfterLogin) {
      setSetupMode(pendingModeAfterLogin);
      setPendingModeAfterLogin(null);
    }
  }, [authProfile, pendingModeAfterLogin]);

  const updatePrefs = useCallback((patch: Partial<LocalPreferences>) => {
    soundEngine.playClick();
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const openLoginModal = useCallback((reason?: string) => {
    setLoginReason(reason || null);
    setLoginOpen(true);
  }, []);

  const handleSignOut = useCallback(() => {
    setAuthProfile(null);
    setOtpSessionToken(null);
    setActiveErrorUserId(null);
    showToast('Signed out to Guest Mode.');
  }, [showToast]);

  const handleSaveProfile = useCallback(
    async (displayName: string, avatarId: AvatarId) => {
      if (authProfile) {
        await updateUserProfile(authProfile.uid, { displayName, avatarId });
        setAuthProfile((prev) => (prev ? { ...prev, displayName, avatarId } : prev));
      } else {
        setPrefs((prev) => ({ ...prev, guestName: displayName, guestAvatar: avatarId }));
      }
    },
    [authProfile]
  );

  const todayKey = getTodayKey();
  const dailyClaimed = authProfile
    ? authProfile.lastDailyClaimDate === todayKey
    : prefs.lastDailyClaimDate === todayKey;

  const handleClaimDailyBonus = useCallback(
    async (rewardCoins: number) => {
      soundEngine.playHomeFinish();
      if (authProfile) {
        const nextCoins = authProfile.coins + rewardCoins;
        setAuthProfile((prev) =>
          prev ? { ...prev, coins: nextCoins, lastDailyClaimDate: todayKey } : prev
        );
        await recordDailyClaim(authProfile.uid, todayKey, nextCoins);
      } else {
        setPrefs((prev) => ({
          ...prev,
          guestCoins: prev.guestCoins + rewardCoins,
          lastDailyClaimDate: todayKey,
        }));
      }
    },
    [authProfile, todayKey]
  );

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      soundEngine.playClick();
      if ((mode === 'online' || mode === 'friends') && !authProfile) {
        setPendingModeAfterLogin(mode);
        openLoginModal(
          mode === 'online'
            ? 'Email OTP login is required for live Online Play.'
            : 'Email OTP login is required to create or join Friend rooms.'
        );
        return;
      }
      setSetupMode(mode);
    },
    [authProfile, openLoginModal]
  );

  const startLocalOrAI = useCallback(
    (cfg: {
      mode: 'computer' | 'local';
      playerCount: number;
      preferredColor: PlayerColor;
      aiDifficulty: AIDifficulty;
      stake: number;
      localNames: string[];
    }) => {
      soundEngine.playClick();
      setLastLocalConfig(cfg);
      const colors = getColorsForPlayerCount(cfg.playerCount, cfg.preferredColor);
      const activeName = authProfile ? authProfile.displayName : prefs.guestName;
      const activeAvatar = authProfile ? authProfile.avatarId : prefs.guestAvatar;

      const playerConfigs: PlayerSetupConfig[] = colors.map((color, idx) => {
        if (cfg.mode === 'computer') {
          if (idx === 0) {
            return {
              id: `human-0`,
              color,
              name: activeName,
              avatarId: activeAvatar,
              type: 'human',
            };
          }
          return {
            id: `ai-${idx}`,
            color,
            name: AI_NAMES[idx % AI_NAMES.length],
            avatarId: AI_AVATARS[idx % AI_AVATARS.length],
            type: 'ai',
            aiDifficulty: cfg.aiDifficulty,
          };
        }

        return {
          id: `local-${idx}`,
          color,
          name: (cfg.localNames[idx] || `Player ${idx + 1}`).trim() || `Player ${idx + 1}`,
          avatarId: idx === 0 ? activeAvatar : AI_AVATARS[idx % AI_AVATARS.length],
          type: 'human',
        };
      });

      const initialState = createInitialGameState(
        cfg.mode,
        playerConfigs,
        prefs.threeSixesRule,
        cfg.stake
      );
      setActiveOnlineRoom(null);
      setActiveGame(initialState);
      setSetupMode(null);
    },
    [authProfile, prefs.guestName, prefs.guestAvatar, prefs.threeSixesRule]
  );

  const handleEnterOnlineMatch = useCallback((room: OnlineRoom) => {
    if (!room.gameState) return;
    setActiveOnlineRoom(room);
    setActiveGame(room.gameState);
    setSetupMode(null);
  }, []);

  const handleMatchComplete = useCallback(
    async (
      _winnerColor: PlayerColor,
      isLocalHumanWin: boolean,
      stake: number,
      playerCount: number
    ) => {
      const prize = stake > 0 ? stake * playerCount : 300;
      const earnedCoins = isLocalHumanWin ? prize : 50;

      if (authProfile) {
        const nextCoins = authProfile.coins + earnedCoins;
        const nextWins = authProfile.wins + (isLocalHumanWin ? 1 : 0);
        const nextGames = authProfile.gamesPlayed + 1;
        setAuthProfile((prev) =>
          prev
            ? {
                ...prev,
                coins: nextCoins,
                wins: nextWins,
                gamesPlayed: nextGames,
              }
            : prev
        );
        try {
          await updateUserProfile(authProfile.uid, {
            coins: nextCoins,
            wins: nextWins,
            gamesPlayed: nextGames,
          });
        } catch {
          // Non-fatal if offline briefly
        }
      } else {
        setPrefs((prev) => ({
          ...prev,
          guestCoins: prev.guestCoins + earnedCoins,
          guestWins: prev.guestWins + (isLocalHumanWin ? 1 : 0),
          guestGamesPlayed: prev.guestGamesPlayed + 1,
        }));
      }
    },
    [authProfile]
  );

  return (
    <>
      {activeGame ? (
        <GameArena
          initialState={activeGame}
          onlineRoom={activeOnlineRoom}
          localUid={authProfile?.uid ?? null}
          boardTheme={prefs.boardTheme}
          soundEnabled={prefs.soundEnabled}
          musicEnabled={prefs.musicEnabled}
          onToggleSound={() => updatePrefs({ soundEnabled: !prefs.soundEnabled })}
          onToggleMusic={() => updatePrefs({ musicEnabled: !prefs.musicEnabled })}
          onOpenRules={() => setRulesOpen(true)}
          onMatchComplete={handleMatchComplete}
          onPlayAgainLocal={() => lastLocalConfig && startLocalOrAI(lastLocalConfig)}
          onExitArena={() => {
            setActiveGame(null);
            setActiveOnlineRoom(null);
          }}
        />
      ) : (
        <HomeDashboard
          prefs={prefs}
          authProfile={authProfile}
          dailyClaimed={dailyClaimed}
          onSelectMode={handleSelectMode}
          onOpenSettings={() => {
            soundEngine.playClick();
            setSettingsOpen(true);
          }}
          onOpenRules={() => {
            soundEngine.playClick();
            setRulesOpen(true);
          }}
          onOpenDailyBonus={() => {
            soundEngine.playClick();
            setDailyOpen(true);
          }}
          onOpenLogin={() => openLoginModal()}
        />
      )}

      {/* Modals */}
      <MatchSetupModal
        mode={setupMode}
        onClose={() => setSetupMode(null)}
        playerName={authProfile ? authProfile.displayName : prefs.guestName}
        threeSixesRule={prefs.threeSixesRule}
        authProfile={authProfile}
        onOpenLogin={(reason) => {
          setSetupMode(null);
          openLoginModal(reason);
        }}
        onStartLocalOrAI={startLocalOrAI}
        onEnterOnlineMatch={handleEnterOnlineMatch}
      />

      <LoginModal
        open={loginOpen}
        reason={loginReason}
        playerNameHint={prefs.guestName}
        fallbackCoins={prefs.guestCoins}
        fallbackGems={prefs.guestGems}
        onClose={() => {
          setLoginOpen(false);
          setPendingModeAfterLogin(null);
        }}
        onAuthenticated={(profile, token) => {
          setAuthProfile(profile);
          setOtpSessionToken(token);
          showToast(`Welcome, ${profile.displayName}! Data synced.`);
        }}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onUpdatePrefs={updatePrefs}
        authProfile={authProfile}
        onSignIn={() => {
          setSettingsOpen(false);
          openLoginModal();
        }}
        onSignOut={handleSignOut}
        onSaveProfile={handleSaveProfile}
      />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <DailyBonusModal
        open={dailyOpen}
        onClose={() => setDailyOpen(false)}
        alreadyClaimed={dailyClaimed}
        onClaim={handleClaimDailyBonus}
      />

      {/* Lightweight Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-2xl bg-[#271257] border border-[#FFBC41]/60 text-xs font-display font-bold text-white shadow-2xl">
          {toastMsg}
        </div>
      )}
    </>
  );
}
