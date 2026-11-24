import React, { useEffect, useState } from 'react';
import {
  Bot,
  Check,
  Coins,
  Copy,
  Globe,
  Loader2,
  LogIn,
  Play,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { COLOR_HEX, COLOR_LABELS } from '../engine/boardMap';
import {
  AIDifficulty,
  GameMode,
  OnlineRoom,
  PlayerColor,
  UserProfile,
} from '../engine/types';
import {
  createOnlineRoom,
  findAndJoinPublicMatch,
  joinOnlineRoom,
  leaveWaitingRoom,
  startOnlineRoom,
  subscribeToRoom,
} from '../firebase/roomService';
import { AvatarPortrait } from './CrownEmblem';

interface MatchSetupModalProps {
  mode: GameMode | null;
  onClose: () => void;
  playerName: string;
  threeSixesRule: boolean;
  authProfile: UserProfile | null;
  onOpenLogin: (reason?: string) => void;
  onStartLocalOrAI: (config: {
    mode: 'computer' | 'local';
    playerCount: number;
    preferredColor: PlayerColor;
    aiDifficulty: AIDifficulty;
    stake: number;
    localNames: string[];
  }) => void;
  onEnterOnlineMatch: (room: OnlineRoom) => void;
}

export function MatchSetupModal({
  mode,
  onClose,
  playerName,
  threeSixesRule,
  authProfile,
  onOpenLogin,
  onStartLocalOrAI,
  onEnterOnlineMatch,
}: MatchSetupModalProps) {
  const [playerCount, setPlayerCount] = useState(mode === 'online' ? 2 : 4);
  const [preferredColor, setPreferredColor] = useState<PlayerColor>('red');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('normal');
  const [stake, setStake] = useState(100);
  const [friendsTab, setFriendsTab] = useState<'create' | 'join'>('create');
  const [localNames, setLocalNames] = useState<string[]>([
    playerName,
    'Player 2',
    'Player 3',
    'Player 4',
  ]);

  // Online / Friends lobby state
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<OnlineRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalNames((prev) => [
      playerName,
      prev[1] || 'Player 2',
      prev[2] || 'Player 3',
      prev[3] || 'Player 4',
    ]);
  }, [playerName]);

  useEffect(() => {
    setErrorMsg('');
    setActiveRoom(null);
    setRoomCodeInput('');
    setFriendsTab('create');
    if (mode === 'online') {
      setPlayerCount(2);
    } else if (mode) {
      setPlayerCount(4);
    }
  }, [mode]);

  // Subscribe to active waiting/matchmaking room and auto-launch GameArena when connected!
  useEffect(() => {
    if (!activeRoom) return;
    const unsub = subscribeToRoom(activeRoom.roomCode, (updated) => {
      if (!updated) {
        setActiveRoom(null);
        setErrorMsg('Room was closed by host.');
        return;
      }
      setActiveRoom(updated);

      // Automatic game screen launch for BOTH users once status becomes 'playing'!
      if (updated.status === 'playing' && updated.gameState) {
        onEnterOnlineMatch(updated);
        return;
      }

      // Host backup auto-start if a public matchmaking room fills up
      if (
        updated.isPublic &&
        updated.status === 'waiting' &&
        updated.slots.length >= updated.maxPlayers &&
        updated.hostId === authProfile?.uid
      ) {
        startOnlineRoom(updated).catch(() => {});
      }
    });
    return () => unsub();
  }, [activeRoom?.roomCode, authProfile?.uid, onEnterOnlineMatch]);

  if (!mode) return null;

  const isOnlineMode = mode === 'online' || mode === 'friends';

  const handleFindOnlineMatch = async () => {
    if (!authProfile) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const room = await findAndJoinPublicMatch({
        profile: authProfile,
        maxPlayers: playerCount,
        stake,
        threeSixesRule,
      });
      if (room.status === 'playing' && room.gameState) {
        onEnterOnlineMatch(room);
      } else {
        setActiveRoom(room);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to find online match.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePrivateRoom = async () => {
    if (!authProfile) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const room = await createOnlineRoom({
        hostProfile: authProfile,
        maxPlayers: playerCount,
        stake,
        isPublic: false,
        threeSixesRule,
      });
      setActiveRoom(room);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create room.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    if (!authProfile) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const room = await joinOnlineRoom(code, authProfile);
      if (room.status === 'playing' && room.gameState) {
        onEnterOnlineMatch(room);
      } else {
        setActiveRoom(room);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveLobby = async () => {
    if (activeRoom && authProfile) {
      try {
        await leaveWaitingRoom(activeRoom, authProfile.uid);
      } catch {
        // Ignore cleanup failure
      }
      setActiveRoom(null);
    }
    onClose();
  };

  const handleStartFriendsMatch = async () => {
    if (!activeRoom) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await startOnlineRoom(activeRoom);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start match.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const titles: Record<GameMode, string> = {
    computer: 'Play vs Computer',
    local: 'Local Pass & Play',
    friends: 'Play with Friends',
    online: 'Play Online',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#22104B] border border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            {mode === 'computer' && <Bot className="w-5 h-5 text-[#FFBC41]" />}
            {mode === 'local' && <Users className="w-5 h-5 text-[#FFBC41]" />}
            {mode === 'friends' && <Users className="w-5 h-5 text-[#F300CC]" />}
            {mode === 'online' && <Globe className="w-5 h-5 text-[#4396FC]" />}
            <h2 className="font-display text-xl font-bold text-white">{titles[mode]}</h2>
          </div>
          <button
            type="button"
            onClick={handleLeaveLobby}
            aria-label="Close setup"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MANDATORY LOGIN GATE FOR ONLINE & FRIENDS */}
        {isOnlineMode && !authProfile ? (
          <div className="rounded-2xl bg-[#180A38] border border-white/10 p-6 text-center">
            <p className="font-display font-bold text-base text-white mb-2">
              Email Login Required
            </p>
            <p className="text-xs text-purple-200/80 mb-5 leading-relaxed">
              Login with your Email OTP to enter live Online matchmaking and Play with Friends rooms.
            </p>
            <button
              type="button"
              onClick={() => onOpenLogin('Login is required to play Online or with Friends.')}
              className="px-6 py-3 rounded-xl royal-gold-gradient text-[#24124D] font-display font-bold text-sm inline-flex items-center gap-2 shadow-lg hover:brightness-105 transition"
            >
              <LogIn className="w-4 h-4" />
              Login with Email OTP
            </button>
          </div>
        ) : activeRoom ? (
          /* ACTIVE ONLINE MATCHMAKING OR FRIENDS WAITING LOBBY */
          <div className="space-y-4">
            {activeRoom.isPublic ? (
              <div className="rounded-2xl bg-[#180A38] border border-[#4396FC]/45 p-5 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl royal-blue-gradient flex items-center justify-center mb-3 shadow-lg">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <p className="font-display font-bold text-base text-white">
                  Searching for Online Players...
                </p>
                <p className="text-xs text-purple-200/80 mt-1">
                  Match starts automatically as soon as {activeRoom.maxPlayers} players connect ({activeRoom.slots.length}/{activeRoom.maxPlayers} ready)
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#180A38] border border-[#FFBC41]/40 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-200/75">Share Room Code with Friends</p>
                  <p className="font-display text-2xl font-extrabold tracking-widest text-[#FFBC41] tabular-nums">
                    {activeRoom.roomCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white inline-flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-purple-200/85 mb-2">
                Players Connected ({activeRoom.slots.length}/{activeRoom.maxPlayers})
              </p>
              <div className="space-y-2">
                {activeRoom.slots.map((slot) => (
                  <div
                    key={slot.uid}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#180A38] border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarPortrait avatarId={slot.avatarId} alt={slot.name} className="w-9 h-9" />
                      <div>
                        <p className="font-display font-bold text-sm text-white">{slot.name}</p>
                        <p className="text-[11px] text-purple-200/70">
                          {COLOR_LABELS[slot.color]}
                          {slot.uid === activeRoom.hostId ? ' · Host' : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white"
                      style={{ backgroundColor: COLOR_HEX[slot.color].main }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleLeaveLobby}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-display font-bold text-sm transition"
              >
                Cancel
              </button>
              {!activeRoom.isPublic && (
                activeRoom.hostId === authProfile?.uid ? (
                  <button
                    type="button"
                    disabled={busy || activeRoom.slots.length < 2}
                    onClick={handleStartFriendsMatch}
                    className="flex-1 py-3 rounded-xl royal-gold-gradient text-[#24124D] font-display font-bold text-sm disabled:opacity-50 shadow-lg transition"
                  >
                    {busy
                      ? 'Starting...'
                      : activeRoom.slots.length < 2
                      ? 'Waiting for Friend...'
                      : 'Start Match'}
                  </button>
                ) : (
                  <div className="flex-1 py-3 rounded-xl bg-[#180A38] border border-white/10 text-center text-xs font-semibold text-purple-200 flex items-center justify-center">
                    Waiting for host to start...
                  </div>
                )
              )}
            </div>
          </div>
        ) : mode === 'friends' ? (
          /* PLAY WITH FRIENDS: CREATE ROOM OR JOIN ROOM */
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#180A38] border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setFriendsTab('create');
                  setErrorMsg('');
                }}
                className={`py-2.5 rounded-xl font-display font-bold text-xs inline-flex items-center justify-center gap-1.5 transition ${
                  friendsTab === 'create'
                    ? 'royal-gold-gradient text-[#24124D] shadow'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                Create Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setFriendsTab('join');
                  setErrorMsg('');
                }}
                className={`py-2.5 rounded-xl font-display font-bold text-xs inline-flex items-center justify-center gap-1.5 transition ${
                  friendsTab === 'join'
                    ? 'royal-gold-gradient text-[#24124D] shadow'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Join Room
              </button>
            </div>

            {friendsTab === 'create' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-purple-200/85 mb-2">Number of Players</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setPlayerCount(count)}
                        className={`py-2.5 rounded-xl font-display font-bold text-sm border transition ${
                          playerCount === count
                            ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                            : 'bg-[#180A38] border-white/10 text-purple-100 hover:border-white/25'
                        }`}
                      >
                        {count} Players
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-purple-200/85 mb-2">Table Prize Stake</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[100, 500, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setStake(val)}
                        className={`py-2 rounded-xl font-display font-bold text-xs border inline-flex items-center justify-center gap-1.5 tabular-nums transition ${
                          stake === val
                            ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                            : 'bg-[#180A38] border-white/10 text-purple-100'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5 text-[#FFBC41]" />
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCreatePrivateRoom}
                  className="w-full py-3.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-lg hover:brightness-105 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {busy ? 'Creating Room...' : 'Create Room & Get Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#180A38] border border-white/10 p-4 space-y-3">
                  <label htmlFor="join-room-code" className="block text-xs font-semibold text-purple-200/85">
                    Enter Friend&apos;s 6-Character Room Code
                  </label>
                  <input
                    id="join-room-code"
                    type="text"
                    maxLength={6}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="E.G. AB4K92"
                    className="w-full px-4 py-3 rounded-xl bg-[#14082E] border border-white/15 text-center text-lg font-display font-extrabold tracking-[0.3em] text-[#FFBC41] uppercase focus:outline-none focus:border-[#FFBC41]"
                  />
                </div>

                {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}

                <button
                  type="button"
                  disabled={busy || roomCodeInput.trim().length !== 6}
                  onClick={() => handleJoinRoom(roomCodeInput)}
                  className="w-full py-3.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-sm disabled:opacity-50 shadow-lg hover:brightness-105 transition"
                >
                  {busy ? 'Joining Room...' : 'Join Room'}
                </button>
              </div>
            )}
          </div>
        ) : mode === 'online' ? (
          /* PLAY ONLINE: AUTO MATCHMAKING */
          <div className="space-y-5">
            <p className="text-xs text-purple-200/80 leading-relaxed">
              Choose match size and stake. As soon as an opponent connects, both players automatically enter the live board!
            </p>

            <div>
              <p className="text-xs font-semibold text-purple-200/85 mb-2">Match Type</p>
              <div className="grid grid-cols-2 gap-3">
                {[2, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPlayerCount(count)}
                    className={`py-3 rounded-xl font-display font-bold text-sm border transition ${
                      playerCount === count
                        ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                        : 'bg-[#180A38] border-white/10 text-purple-100 hover:border-white/25'
                    }`}
                  >
                    {count} Players
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-purple-200/85 mb-2">Table Prize Stake</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[100, 500, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStake(val)}
                    className={`py-2 rounded-xl font-display font-bold text-xs border inline-flex items-center justify-center gap-1.5 tabular-nums transition ${
                      stake === val
                        ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                        : 'bg-[#180A38] border-white/10 text-purple-100'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 text-[#FFBC41]" />
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={handleFindOnlineMatch}
              className="w-full py-3.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-lg hover:brightness-105 transition"
            >
              <Globe className="w-4 h-4" />
              {busy ? 'Connecting...' : 'Find Live Match'}
            </button>
          </div>
        ) : (
          /* COMPUTER AI & LOCAL PASS-AND-PLAY SETUP */
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-purple-200/85 mb-2">Number of Players</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPlayerCount(count)}
                    className={`py-2.5 rounded-xl font-display font-bold text-sm border transition ${
                      playerCount === count
                        ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                        : 'bg-[#180A38] border-white/10 text-purple-100 hover:border-white/25'
                    }`}
                  >
                    {count} Players
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-purple-200/85 mb-2">Select Your Color</p>
              <div className="grid grid-cols-4 gap-2.5">
                {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((color) => {
                  const selected = preferredColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPreferredColor(color)}
                      className={`py-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                        selected
                          ? 'bg-[#3A1C71] border-[#FFBC41]'
                          : 'bg-[#180A38] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: COLOR_HEX[color].main }}
                      />
                      <span className="text-[11px] font-semibold text-white">{COLOR_LABELS[color]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === 'computer' && (
              <div>
                <p className="text-xs font-semibold text-purple-200/85 mb-2">AI Difficulty</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['easy', 'normal', 'hard'] as AIDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setAiDifficulty(diff)}
                      className={`py-2.5 rounded-xl font-display font-bold text-xs capitalize border transition ${
                        aiDifficulty === diff
                          ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                          : 'bg-[#180A38] border-white/10 text-purple-100'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'local' && (
              <div>
                <p className="text-xs font-semibold text-purple-200/85 mb-2">Player Names</p>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: playerCount }).map((_, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={20}
                      value={localNames[idx] || ''}
                      onChange={(e) => {
                        const copy = [...localNames];
                        copy[idx] = e.target.value;
                        setLocalNames(copy);
                      }}
                      placeholder={`Player ${idx + 1}`}
                      className="px-3 py-2 rounded-xl bg-[#180A38] border border-white/15 text-xs text-white focus:outline-none focus:border-[#FFBC41]"
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-purple-200/85 mb-2">Table Prize Stake</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[100, 500, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStake(val)}
                    className={`py-2 rounded-xl font-display font-bold text-xs border inline-flex items-center justify-center gap-1.5 tabular-nums transition ${
                      stake === val
                        ? 'bg-[#3A1C71] border-[#FFBC41] text-[#FFBC41]'
                        : 'bg-[#180A38] border-white/10 text-purple-100'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 text-[#FFBC41]" />
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onStartLocalOrAI({
                  mode,
                  playerCount,
                  preferredColor,
                  aiDifficulty,
                  stake,
                  localNames,
                })
              }
              className="w-full py-3.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-lg hover:brightness-105 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Match
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
