import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getColorsForPlayerCount } from '../engine/boardMap';
import { createInitialGameState, PlayerSetupConfig } from '../engine/ludoEngine';
import { GameState, OnlineRoom, RoomSlot, UserProfile } from '../engine/types';
import { db, handleFirestoreError, OperationType } from './firebase';

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function buildGameStateFromSlots(
  slots: RoomSlot[],
  isPublic: boolean,
  threeSixesRule: boolean,
  stake: number
): GameState {
  const configs: PlayerSetupConfig[] = slots.map((slot) => ({
    id: slot.uid,
    uid: slot.uid,
    color: slot.color,
    name: slot.name,
    avatarId: slot.avatarId,
    type: 'remote',
  }));
  return createInitialGameState(isPublic ? 'online' : 'friends', configs, threeSixesRule, stake);
}

export async function createOnlineRoom(params: {
  hostProfile: UserProfile;
  maxPlayers: number;
  stake: number;
  isPublic: boolean;
  threeSixesRule: boolean;
}): Promise<OnlineRoom> {
  const { hostProfile, maxPlayers, stake, isPublic, threeSixesRule } = params;
  const clampedPlayers = Math.max(2, Math.min(4, Math.floor(maxPlayers)));
  const clampedStake = Math.max(0, Math.min(50000, Math.floor(stake)));

  const roomCode = generateRoomCode();
  const colors = getColorsForPlayerCount(clampedPlayers, 'red');

  const firstSlot: RoomSlot = {
    color: colors[0],
    uid: hostProfile.uid,
    name: hostProfile.displayName.slice(0, 32),
    avatarId: hostProfile.avatarId,
    isReady: true,
  };

  const roomPayload: Omit<OnlineRoom, 'createdAt' | 'updatedAt'> = {
    roomCode,
    hostId: hostProfile.uid,
    isPublic,
    status: 'waiting',
    maxPlayers: clampedPlayers,
    stake: clampedStake,
    threeSixesRule,
    playerUids: [hostProfile.uid],
    slots: [firstSlot],
  };

  const path = `rooms/${roomCode}`;
  try {
    await setDoc(doc(db, 'rooms', roomCode), {
      ...roomPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return roomPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinOnlineRoom(roomCodeRaw: string, profile: UserProfile): Promise<OnlineRoom> {
  const roomCode = roomCodeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    throw new Error('Room code must be 6 letters or numbers.');
  }

  const path = `rooms/${roomCode}`;
  let roomSnap;
  try {
    roomSnap = await getDoc(doc(db, 'rooms', roomCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!roomSnap.exists()) {
    throw new Error(`Room ${roomCode} was not found.`);
  }

  const room = roomSnap.data() as OnlineRoom;
  if (room.playerUids.includes(profile.uid)) {
    return room;
  }

  if (room.status !== 'waiting') {
    throw new Error('This match has already started.');
  }

  if (room.playerUids.length >= room.maxPlayers) {
    throw new Error('This room is already full.');
  }

  const colors = getColorsForPlayerCount(room.maxPlayers, 'red');
  const takenColors = new Set(room.slots.map((s) => s.color));
  const assignedColor = colors.find((c) => !takenColors.has(c)) || colors[room.slots.length];

  const newSlot: RoomSlot = {
    color: assignedColor,
    uid: profile.uid,
    name: profile.displayName.slice(0, 32),
    avatarId: profile.avatarId,
    isReady: true,
  };

  const nextUids = [...room.playerUids, profile.uid];
  const nextSlots = [...room.slots, newSlot];

  // Auto-start immediately when a public matchmaking room fills up
  const shouldAutoStart = room.isPublic && nextUids.length === room.maxPlayers;

  try {
    if (shouldAutoStart) {
      const initialGame = stripUndefinedDeep(
        buildGameStateFromSlots(nextSlots, true, room.threeSixesRule, room.stake)
      );
      await updateDoc(doc(db, 'rooms', roomCode), {
        playerUids: nextUids,
        slots: nextSlots,
        status: 'playing',
        gameState: initialGame,
        updatedAt: serverTimestamp(),
      });
      return {
        ...room,
        playerUids: nextUids,
        slots: nextSlots,
        status: 'playing',
        gameState: initialGame,
      };
    }

    await updateDoc(doc(db, 'rooms', roomCode), {
      playerUids: nextUids,
      slots: nextSlots,
      updatedAt: serverTimestamp(),
    });
    return {
      ...room,
      playerUids: nextUids,
      slots: nextSlots,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function findAndJoinPublicMatch(params: {
  profile: UserProfile;
  maxPlayers: number;
  stake: number;
  threeSixesRule: boolean;
}): Promise<OnlineRoom> {
  const { profile, maxPlayers, stake, threeSixesRule } = params;
  const waitingRooms = await listPublicWaitingRooms();

  // Look for an open public room matching player count with open slots
  const candidate = waitingRooms.find(
    (r) =>
      r.status === 'waiting' &&
      r.maxPlayers === maxPlayers &&
      r.playerUids.length < r.maxPlayers &&
      !r.playerUids.includes(profile.uid)
  );

  if (candidate) {
    return joinOnlineRoom(candidate.roomCode, profile);
  }

  // Otherwise host a new public matchmaking room and wait for opponent(s)
  return createOnlineRoom({
    hostProfile: profile,
    maxPlayers,
    stake,
    isPublic: true,
    threeSixesRule,
  });
}

export async function listPublicWaitingRooms(): Promise<OnlineRoom[]> {
  const path = 'rooms';
  try {
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      where('status', '==', 'waiting'),
      limit(15)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OnlineRoom);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToRoom(
  roomCode: string,
  onRoomUpdate: (room: OnlineRoom | null) => void
): Unsubscribe {
  const path = `rooms/${roomCode}`;
  return onSnapshot(
    doc(db, 'rooms', roomCode),
    (snapshot) => {
      if (!snapshot.exists()) {
        onRoomUpdate(null);
        return;
      }
      onRoomUpdate(snapshot.data() as OnlineRoom);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function leaveWaitingRoom(room: OnlineRoom, uid: string): Promise<void> {
  const path = `rooms/${room.roomCode}`;
  if (room.hostId === uid && room.status === 'waiting') {
    try {
      await deleteDoc(doc(db, 'rooms', room.roomCode));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    return;
  }

  const nextUids = room.playerUids.filter((id) => id !== uid);
  const nextSlots = room.slots.filter((s) => s.uid !== uid);
  try {
    await updateDoc(doc(db, 'rooms', room.roomCode), {
      playerUids: nextUids,
      slots: nextSlots,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function startOnlineRoom(room: OnlineRoom): Promise<GameState> {
  if (room.slots.length < 2) {
    throw new Error('Need at least 2 players to start.');
  }

  const initialGame = buildGameStateFromSlots(
    room.slots,
    room.isPublic,
    room.threeSixesRule,
    room.stake
  );

  const cleanState = stripUndefinedDeep(initialGame);
  const path = `rooms/${room.roomCode}`;

  try {
    await updateDoc(doc(db, 'rooms', room.roomCode), {
      status: 'playing',
      gameState: cleanState,
      updatedAt: serverTimestamp(),
    });
    return initialGame;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncOnlineGameState(
  roomCode: string,
  gameState: GameState,
  winnerUid?: string
): Promise<void> {
  const path = `rooms/${roomCode}`;
  const cleanState = stripUndefinedDeep(gameState);
  const isFinished = gameState.turnPhase === 'GAME_OVER';

  const payload: Record<string, unknown> = {
    gameState: cleanState,
    status: isFinished ? 'finished' : 'playing',
    updatedAt: serverTimestamp(),
  };

  if (isFinished && winnerUid) {
    payload.winnerUid = winnerUid;
  }

  try {
    await updateDoc(doc(db, 'rooms', roomCode), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
