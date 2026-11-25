import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Coins,
  Copy,
  Headphones,
  MessageSquare,
  Mic,
  MicOff,
  Music,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getCornerColorsForPerspective } from '../engine/boardMap';
import { chooseAIMove } from '../engine/ludoAI';
import { applyDiceRoll, applyTokenMove, getLegalMoveTokenIds, rollFairDice } from '../engine/ludoEngine';
import { BoardTheme, EmoteBubble, GameState, OnlineRoom, PlayerColor } from '../engine/types';
import { subscribeToRoom, syncOnlineGameState } from '../firebase/roomService';
import { RoomVoiceClient } from '../firebase/voiceService';
import { soundEngine } from '../services/soundEngine';
import { LudoBoard } from './LudoBoard';
import { ExitConfirmModal, VictoryModal } from './Modals';
import { PlayerPod } from './PlayerPod';

const QUICK_EMOTES = ['Good Move!', 'Nice Roll!', 'Thanks!', 'Oops!', 'Hurry Up!', 'Well Played!'];

interface GameArenaProps {
  initialState: GameState;
  onlineRoom: OnlineRoom | null;
  localUid: string | null;
  boardTheme: BoardTheme;
  soundEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onOpenRules: () => void;
  onMatchComplete: (winnerColor: PlayerColor, isLocalHumanWin: boolean, stake: number, playerCount: number) => void;
  onPlayAgainLocal: () => void;
  onExitArena: () => void;
}

export function GameArena({
  initialState,
  onlineRoom,
  localUid,
  boardTheme,
  soundEnabled,
  musicEnabled,
  onToggleSound,
  onToggleMusic,
  onOpenRules,
  onMatchComplete,
  onPlayAgainLocal,
  onExitArena,
}: GameArenaProps) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [rolling, setRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showEmotes, setShowEmotes] = useState(false);

  // Voice chat state (starts muted on match entry)
  const [micOn, setMicOn] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [peerMicMap, setPeerMicMap] = useState<Record<string, boolean>>({});
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const voiceClientRef = useRef<RoomVoiceClient | null>(null);

  const rewardedRef = useRef(false);
  const lastEventIdRef = useRef<number | null>(null);
  const lastRemoteRollNonceRef = useRef<number | null>(null);
  const autoMovingRef = useRef(false);

  // Reset when initialState changes (e.g., Play Again)
  useEffect(() => {
    setGameState(initialState);
    setRolling(false);
    setRollingValue(null);
    rewardedRef.current = false;
    autoMovingRef.current = false;
    lastRemoteRollNonceRef.current = initialState.rollNonce ?? null;
  }, [initialState]);

  // Subscribe to real-time Firestore updates in online rooms
  useEffect(() => {
    if (!onlineRoom) return;
    const unsub = subscribeToRoom(onlineRoom.roomCode, (updated) => {
      if (updated?.gameState) {
        setGameState(updated.gameState);
      }
    });
    return () => unsub();
  }, [onlineRoom?.roomCode]);

  // Initialize WebRTC peer-to-peer voice chat in Online / Friends rooms
  useEffect(() => {
    if (!onlineRoom || !localUid) return;
    setMicOn(false);
    setSpeakerMuted(false);
    setPeerMicMap({});
    setVoiceNotice(null);

    const client = new RoomVoiceClient({
      roomCode: onlineRoom.roomCode,
      localUid,
      peerUids: onlineRoom.playerUids,
      onMicMapChange: (map) => setPeerMicMap(map),
      onError: (msg) => {
        setVoiceNotice(msg);
        window.setTimeout(() => setVoiceNotice((curr) => (curr === msg ? null : curr)), 4000);
      },
    });
    voiceClientRef.current = client;

    return () => {
      client.dispose();
      voiceClientRef.current = null;
    };
  }, [onlineRoom?.roomCode, localUid]);

  const handleToggleMic = useCallback(async () => {
    const client = voiceClientRef.current;
    if (!client) return;
    const next = await client.toggleMic();
    setMicOn(next);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    voiceClientRef.current?.setSpeakerMuted(next);
  }, [speakerMuted]);

  const currentPlayer = gameState.players[gameState.currentTurnIndex];

  const isLocalTurn = useMemo(() => {
    if (!currentPlayer) return false;
    if (gameState.mode === 'online' || gameState.mode === 'friends') {
      return Boolean(localUid && currentPlayer.uid === localUid);
    }
    return currentPlayer.type === 'human';
  }, [currentPlayer, gameState.mode, localUid]);

  // Bottom-Left player perspective:
  // - Online / Friends: local player's color sits at Bottom-Left
  // - vs Computer: human player's color sits at Bottom-Left
  // - Local Pass & Play: fixed 'blue' orientation so shared device doesn't flip each turn
  const perspectiveColor: PlayerColor = useMemo(() => {
    if (gameState.mode === 'online' || gameState.mode === 'friends') {
      const me = gameState.players.find((p) => p.uid === localUid);
      return me?.color || 'blue';
    }
    if (gameState.mode === 'computer') {
      const human = gameState.players.find((p) => p.type === 'human');
      return human?.color || 'blue';
    }
    return 'blue';
  }, [gameState.mode, gameState.players, localUid]);

  const rotatedCorners = useMemo(
    () => getCornerColorsForPerspective(perspectiveColor),
    [perspectiveColor]
  );

  const legalTokenIds = useMemo(() => {
    if (gameState.turnPhase !== 'SELECT_TOKEN' || !gameState.diceValue) return [];
    return getLegalMoveTokenIds(gameState, gameState.currentTurnIndex, gameState.diceValue);
  }, [gameState]);

  // Audio feedback for remote ROLLING broadcasts so all players hear & see live spins
  useEffect(() => {
    if (
      gameState.turnPhase === 'ROLLING' &&
      !isLocalTurn &&
      gameState.rollNonce &&
      gameState.rollNonce !== lastRemoteRollNonceRef.current
    ) {
      lastRemoteRollNonceRef.current = gameState.rollNonce;
      soundEngine.playDiceRoll();
    }
  }, [gameState.turnPhase, gameState.rollNonce, isLocalTurn]);

  // Audio feedback for incoming state events (works identically for local, AI, and remote moves!)
  useEffect(() => {
    const ev = gameState.lastEvent;
    if (!ev || ev.id === lastEventIdRef.current) return;
    lastEventIdRef.current = ev.id;

    if (ev.type === 'CAPTURE') soundEngine.playCapture();
    else if (ev.type === 'HOME') soundEngine.playHomeFinish();
    else if (ev.type === 'SAFE') soundEngine.playSafe();
    else if (ev.type === 'WIN') soundEngine.playVictory();
    else if (ev.type === 'DEPLOY' || ev.type === 'MOVE') soundEngine.playHop(gameState.turnNumber);
  }, [gameState.lastEvent, gameState.turnNumber]);

  // Trigger match completion callback once when GAME_OVER occurs
  useEffect(() => {
    if (gameState.turnPhase === 'GAME_OVER' && !rewardedRef.current) {
      rewardedRef.current = true;
      const winnerColor = gameState.winners[0];
      const winnerPlayer = gameState.players.find((p) => p.color === winnerColor);
      const isLocalHumanWin =
        Boolean(winnerPlayer) &&
        (gameState.mode === 'online' || gameState.mode === 'friends'
          ? winnerPlayer?.uid === localUid
          : winnerPlayer?.type === 'human');

      if (winnerColor) {
        onMatchComplete(winnerColor, isLocalHumanWin, gameState.stake, gameState.players.length);
      }
    }
  }, [gameState, localUid, onMatchComplete]);

  const commitState = useCallback(
    async (next: GameState) => {
      setGameState(next);
      if (onlineRoom) {
        const winnerColor = next.winners[0];
        const winnerUid = winnerColor
          ? next.players.find((p) => p.color === winnerColor)?.uid
          : undefined;
        await syncOnlineGameState(onlineRoom.roomCode, next, winnerUid);
      }
    },
    [onlineRoom]
  );

  const handleRollDice = useCallback(() => {
    if (rolling || autoMovingRef.current || !isLocalTurn || gameState.turnPhase !== 'WAITING_ROLL') return;
    const rolled = rollFairDice();
    const rollingNonce = Date.now();
    const rollingState: GameState = {
      ...gameState,
      turnPhase: 'ROLLING',
      diceValue: null,
      rollNonce: rollingNonce,
    };

    setRollingValue(rolled);
    setRolling(true);
    soundEngine.playDiceRoll();
    // Broadcast ROLLING immediately so remote opponents see the 3D dice spin live
    void commitState(rollingState);

    window.setTimeout(() => {
      setRolling(false);
      setRollingValue(null);
      const next = applyDiceRoll(rollingState, rolled);
      void commitState(next);

      // Smart Auto-Move Rule:
      if (next.turnPhase === 'SELECT_TOKEN') {
        const legal = getLegalMoveTokenIds(next, next.currentTurnIndex, rolled);
        const activePlayer = next.players[next.currentTurnIndex];
        const unfinishedCount = activePlayer.tokens.filter((t) => t.step < 56).length;

        if (legal.length === 1 && (rolled !== 6 || unfinishedCount === 1)) {
          autoMovingRef.current = true;
          window.setTimeout(() => {
            autoMovingRef.current = false;
            const autoMoved = applyTokenMove(next, legal[0]);
            void commitState(autoMoved);
          }, 340);
        }
      }
    }, 580);
  }, [rolling, isLocalTurn, gameState, commitState]);

  const handleSelectToken = useCallback(
    (tokenId: number) => {
      if (autoMovingRef.current || !isLocalTurn || gameState.turnPhase !== 'SELECT_TOKEN') return;
      if (!legalTokenIds.includes(tokenId)) return;
      const next = applyTokenMove(gameState, tokenId);
      void commitState(next);
    },
    [isLocalTurn, gameState, legalTokenIds, commitState]
  );

  const handleSendEmote = useCallback(
    (text: string) => {
      const sender =
        gameState.mode === 'online' || gameState.mode === 'friends'
          ? gameState.players.find((p) => p.uid === localUid)
          : currentPlayer;
      if (!sender) return;

      const emote: EmoteBubble = {
        id: Date.now(),
        color: sender.color,
        text,
        timestamp: Date.now(),
      };
      setShowEmotes(false);
      void commitState({ ...gameState, lastEmote: emote });
    },
    [gameState, localUid, currentPlayer, commitState]
  );

  // Auto-clear emote bubble after 2.5s locally
  useEffect(() => {
    if (!gameState.lastEmote) return;
    const timer = window.setTimeout(() => {
      setGameState((prev) => (prev.lastEmote ? { ...prev, lastEmote: null } : prev));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [gameState.lastEmote?.id]);

  // AI Turn Driver
  useEffect(() => {
    if (gameState.turnPhase === 'GAME_OVER') return;
    const active = gameState.players[gameState.currentTurnIndex];
    if (!active || active.type !== 'ai') return;

    if (gameState.turnPhase === 'WAITING_ROLL' && !rolling) {
      const timer = window.setTimeout(() => {
        const rolled = rollFairDice();
        setRollingValue(rolled);
        setRolling(true);
        soundEngine.playDiceRoll();
        window.setTimeout(() => {
          setRolling(false);
          setRollingValue(null);
          setGameState((prev) => applyDiceRoll(prev, rolled));
        }, 580);
      }, 440);
      return () => window.clearTimeout(timer);
    }

    if (gameState.turnPhase === 'SELECT_TOKEN') {
      const timer = window.setTimeout(() => {
        setGameState((prev) => {
          const legal = prev.diceValue
            ? getLegalMoveTokenIds(prev, prev.currentTurnIndex, prev.diceValue)
            : [];
          if (legal.length === 0) return prev;
          const chosen = chooseAIMove(
            prev,
            prev.currentTurnIndex,
            legal,
            prev.players[prev.currentTurnIndex].aiDifficulty || 'normal'
          );
          return applyTokenMove(prev, chosen);
        });
      }, 560);
      return () => window.clearTimeout(timer);
    }
  }, [gameState.turnPhase, gameState.currentTurnIndex, gameState.turnNumber, rolling]);

  // Map players to colors
  const playerByColor = useMemo(() => {
    const map: Partial<Record<PlayerColor, GameState['players'][number]>> = {};
    gameState.players.forEach((p) => {
      map[p.color] = p;
    });
    return map;
  }, [gameState.players]);

  const activeEmote =
    gameState.lastEmote && Date.now() - gameState.lastEmote.timestamp < 4000
      ? gameState.lastEmote
      : null;

  const isDiceSpinningNow = rolling || gameState.turnPhase === 'ROLLING';

  const renderCornerPod = (color: PlayerColor, align: 'left' | 'right') => {
    const p = playerByColor[color];
    if (!p) {
      return <div className="hidden sm:block h-[66px]" aria-hidden="true" />;
    }
    const isTurn = currentPlayer?.color === color && gameState.turnPhase !== 'GAME_OVER';
    const isOnlineRoom = Boolean(onlineRoom && p.uid);
    const playerMicState = isOnlineRoom
      ? p.uid === localUid
        ? micOn
        : Boolean(peerMicMap[p.uid!])
      : undefined;

    return (
      <PlayerPod
        player={p}
        isActiveTurn={isTurn}
        canRoll={isTurn && isLocalTurn && gameState.turnPhase === 'WAITING_ROLL' && !isDiceSpinningNow}
        rolling={isTurn && isDiceSpinningNow}
        diceValue={isTurn ? (rolling ? rollingValue : gameState.diceValue) : null}
        activeEmote={activeEmote}
        voiceMicOn={playerMicState}
        onRoll={handleRollDice}
        align={align}
      />
    );
  };

  return (
    <div className="min-h-screen royal-bg-radial flex flex-col">
      {/* In-Game Top Navigation Bar */}
      <header className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExitModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-[#271357] hover:bg-[#351A75] border border-white/15 text-xs font-display font-bold text-white inline-flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit
        </button>

        {/* Pot / Room Info */}
        <div className="flex items-center gap-3 text-xs sm:text-sm font-display font-bold">
          {onlineRoom ? (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(onlineRoom.roomCode);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 1600);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#271357] border border-[#FFBC41]/40 text-[#FFBC41] inline-flex items-center gap-1.5 tabular-nums"
            >
              <span>Room {onlineRoom.roomCode}</span>
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="text-purple-100 inline-flex items-center gap-1.5 tabular-nums">
              <Coins className="w-4 h-4 text-[#FFBC41]" />
              Pot: {(gameState.stake * gameState.players.length).toLocaleString()}
            </span>
          )}
        </div>

        {/* Audio & Rules Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            className="w-9 h-9 rounded-xl bg-[#271357] hover:bg-[#351A75] border border-white/15 flex items-center justify-center text-white transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#FFBC41]" /> : <VolumeX className="w-4 h-4 text-purple-300/60" />}
          </button>
          <button
            type="button"
            onClick={onToggleMusic}
            aria-label={musicEnabled ? 'Stop music' : 'Play music'}
            className="w-9 h-9 rounded-xl bg-[#271357] hover:bg-[#351A75] border border-white/15 flex items-center justify-center text-white transition"
          >
            <Music className={`w-4 h-4 ${musicEnabled ? 'text-[#FFBC41]' : 'text-purple-300/60'}`} />
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            aria-label="Rules"
            className="w-9 h-9 rounded-xl bg-[#271357] hover:bg-[#351A75] border border-white/15 flex items-center justify-center text-white transition"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Arena Layout */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 pb-5 flex flex-col justify-center gap-3">
        {/* Live Match Announcer Line */}
        <div className="text-center min-h-6 flex items-center justify-center">
          <p className="text-xs sm:text-sm font-medium text-purple-100/90 truncate px-3">
            {voiceNotice
              ? voiceNotice
              : gameState.turnPhase === 'ROLLING'
              ? `${currentPlayer?.name} is rolling...`
              : gameState.lastEvent?.message || `${currentPlayer?.name}'s turn`}
            {gameState.turnPhase === 'SELECT_TOKEN' && isLocalTurn ? ' · Tap a highlighted token!' : ''}
          </p>
        </div>

        {/* Top Player Row (Rotated Top-Left, Top-Right) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-[540px] w-full mx-auto">
          {renderCornerPod(rotatedCorners.topLeft, 'left')}
          {renderCornerPod(rotatedCorners.topRight, 'right')}
        </div>

        {/* Center Interactive 15x15 Board (Rotated so local player is Bottom-Left) */}
        <LudoBoard
          gameState={gameState}
          legalTokenIds={legalTokenIds}
          canInteract={isLocalTurn}
          boardTheme={boardTheme}
          perspectiveColor={perspectiveColor}
          onSelectToken={handleSelectToken}
        />

        {/* Bottom Player Row (Rotated Bottom-Left = Local Player, Bottom-Right) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-[540px] w-full mx-auto">
          {renderCornerPod(rotatedCorners.bottomLeft, 'left')}
          {renderCornerPod(rotatedCorners.bottomRight, 'right')}
        </div>

        {/* Bottom Action Strip (Quick Chat + Voice Mic On/Off + Roll Shortcut) */}
        <div className="max-w-[540px] w-full mx-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setShowEmotes((s) => !s)}
              className="px-3 py-2 rounded-xl bg-[#271357] hover:bg-[#341A73] border border-white/15 text-xs font-semibold text-purple-100 inline-flex items-center gap-1.5 whitespace-nowrap transition"
            >
              <MessageSquare className="w-4 h-4 text-[#FFBC41]" />
              Chat
            </button>

            {onlineRoom && localUid && (
              <>
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`px-3 py-2 rounded-xl border text-xs font-display font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                    micOn
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.28)]'
                      : 'bg-[#271357] hover:bg-[#341A73] border-white/15 text-purple-100'
                  }`}
                >
                  {micOn ? <Mic className="w-4 h-4 text-emerald-300" /> : <MicOff className="w-4 h-4 text-rose-300" />}
                  {micOn ? 'Mic On' : 'Mic Off'}
                </button>

                <button
                  type="button"
                  onClick={handleToggleSpeaker}
                  aria-label={speakerMuted ? 'Unmute voice audio' : 'Mute voice audio'}
                  title={speakerMuted ? 'Unmute players voice' : 'Mute players voice'}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                    speakerMuted
                      ? 'bg-rose-950/50 border-rose-400/40 text-rose-300'
                      : 'bg-[#271357] hover:bg-[#341A73] border-white/15 text-[#FFBC41]'
                  }`}
                >
                  <Headphones className="w-4 h-4" />
                </button>
              </>
            )}

            {showEmotes && (
              <div className="absolute bottom-12 left-0 z-30 flex flex-wrap gap-1.5 p-2 rounded-2xl bg-[#1D0D42] border border-white/15 shadow-2xl w-64">
                {QUICK_EMOTES.map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => handleSendEmote(txt)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#FFBC41] hover:text-[#24124D] text-xs font-semibold text-white transition"
                  >
                    {txt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!isLocalTurn || gameState.turnPhase !== 'WAITING_ROLL' || isDiceSpinningNow}
            onClick={handleRollDice}
            className="px-6 py-2.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-xs sm:text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 whitespace-nowrap transition"
          >
            {isDiceSpinningNow
              ? `${currentPlayer?.name} Rolling...`
              : !isLocalTurn
              ? `${currentPlayer?.name}'s Turn`
              : gameState.turnPhase === 'SELECT_TOKEN'
              ? `Choose Token (${gameState.diceValue})`
              : 'Roll Dice'}
          </button>
        </div>
      </main>

      <ExitConfirmModal
        open={exitModalOpen}
        onCancel={() => setExitModalOpen(false)}
        onConfirm={() => {
          setExitModalOpen(false);
          onExitArena();
        }}
      />

      <VictoryModal
        gameState={gameState}
        onPlayAgain={() => {
          if (onlineRoom) {
            onExitArena();
          } else {
            onPlayAgainLocal();
          }
        }}
        onReturnHome={onExitArena}
      />
    </div>
  );
}
