export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type PlayerType = 'human' | 'ai' | 'remote';
export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type AvatarId = 'king' | 'archer' | 'empress' | 'knight';
export type BoardTheme = 'royal' | 'classic' | 'midnight';
export type TurnPhase = 'WAITING_ROLL' | 'ROLLING' | 'SELECT_TOKEN' | 'ANIMATING_MOVE' | 'GAME_OVER';
export type GameMode = 'computer' | 'local' | 'friends' | 'online';

export interface TokenState {
  id: number; // 0..3
  step: number; // -1 = yard, 0..50 = main track relative, 51..55 = home stretch, 56 = finished
}

export interface PlayerState {
  id: string;
  uid?: string;
  color: PlayerColor;
  name: string;
  avatarId: AvatarId;
  type: PlayerType;
  aiDifficulty?: AIDifficulty;
  tokens: TokenState[];
  finishedCount: number;
  finishRank: number | null; // 1 = winner, 2, 3, 4
}

export interface GameEvent {
  id: number;
  type: 'ROLL' | 'DEPLOY' | 'MOVE' | 'CAPTURE' | 'SAFE' | 'HOME' | 'NO_MOVES' | 'THREE_SIXES' | 'WIN';
  color: PlayerColor;
  message: string;
  diceValue?: number;
  capturedColor?: PlayerColor;
}

export interface EmoteBubble {
  id: number;
  color: PlayerColor;
  text: string;
  timestamp: number;
}

export interface GameState {
  mode: GameMode;
  players: PlayerState[];
  currentTurnIndex: number;
  diceValue: number | null;
  turnPhase: TurnPhase;
  consecutiveSixes: number;
  threeSixesRule: boolean;
  turnNumber: number;
  stake: number;
  winners: PlayerColor[];
  lastEvent: GameEvent | null;
  lastEmote: EmoteBubble | null;
  rollNonce?: number;
}

export interface LocalPreferences {
  soundEnabled: boolean;
  musicEnabled: boolean;
  boardTheme: BoardTheme;
  threeSixesRule: boolean;
  guestName: string;
  guestAvatar: AvatarId;
  guestCoins: number;
  guestGems: number;
  guestWins: number;
  guestGamesPlayed: number;
  lastDailyClaimDate: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  avatarId: AvatarId;
  coins: number;
  gems: number;
  wins: number;
  gamesPlayed: number;
  lastDailyClaimDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoomSlot {
  color: PlayerColor;
  uid: string;
  name: string;
  avatarId: AvatarId;
  isReady: boolean;
}

export interface OnlineRoom {
  roomCode: string;
  hostId: string;
  isPublic: boolean;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  stake: number;
  threeSixesRule: boolean;
  playerUids: string[];
  slots: RoomSlot[];
  gameState?: GameState;
  winnerUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
