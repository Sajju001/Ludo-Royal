import { COLOR_LABELS, getGlobalTrackIndex, SAFE_TRACK_INDICES } from './boardMap';
import {
  AIDifficulty,
  AvatarId,
  GameEvent,
  GameMode,
  GameState,
  PlayerColor,
  PlayerState,
  PlayerType,
} from './types';

export interface PlayerSetupConfig {
  id: string;
  uid?: string;
  color: PlayerColor;
  name: string;
  avatarId: AvatarId;
  type: PlayerType;
  aiDifficulty?: AIDifficulty;
}

export function rollFairDice(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

export function createInitialGameState(
  mode: GameMode,
  playerConfigs: PlayerSetupConfig[],
  threeSixesRule: boolean,
  stake = 0
): GameState {
  const players: PlayerState[] = playerConfigs.map((cfg) => ({
    id: cfg.id,
    ...(cfg.uid ? { uid: cfg.uid } : {}),
    color: cfg.color,
    name: cfg.name,
    avatarId: cfg.avatarId,
    type: cfg.type,
    ...(cfg.aiDifficulty ? { aiDifficulty: cfg.aiDifficulty } : {}),
    tokens: [
      { id: 0, step: -1 },
      { id: 1, step: -1 },
      { id: 2, step: -1 },
      { id: 3, step: -1 },
    ],
    finishedCount: 0,
    finishRank: null,
  }));

  return {
    mode,
    players,
    currentTurnIndex: 0,
    diceValue: null,
    turnPhase: 'WAITING_ROLL',
    consecutiveSixes: 0,
    threeSixesRule,
    turnNumber: 1,
    stake,
    winners: [],
    lastEvent: {
      id: 1,
      type: 'ROLL',
      color: players[0].color,
      message: `${players[0].name}'s turn to roll!`,
    },
    lastEmote: null,
  };
}

export function getLegalMoveTokenIds(state: GameState, playerIndex: number, diceValue: number): number[] {
  const player = state.players[playerIndex];
  if (!player || player.finishRank !== null) return [];

  const legal: number[] = [];
  for (const token of player.tokens) {
    if (token.step === -1) {
      if (diceValue === 6) legal.push(token.id);
    } else if (token.step < 56) {
      if (token.step + diceValue <= 56) legal.push(token.id);
    }
  }
  return legal;
}

function getNextActivePlayerIndex(players: PlayerState[], currentIndex: number): number {
  const count = players.length;
  for (let offset = 1; offset <= count; offset++) {
    const idx = (currentIndex + offset) % count;
    if (players[idx].finishRank === null) {
      return idx;
    }
  }
  return currentIndex;
}

export function applyDiceRoll(state: GameState, rolledValue?: number): GameState {
  if (state.turnPhase !== 'WAITING_ROLL' && state.turnPhase !== 'ROLLING') {
    return state;
  }

  const value = rolledValue ?? rollFairDice();
  const currentPlayer = state.players[state.currentTurnIndex];
  const nextSixes = value === 6 ? state.consecutiveSixes + 1 : 0;

  // Optional 3 consecutive sixes forfeit rule
  if (state.threeSixesRule && nextSixes >= 3) {
    const nextIdx = getNextActivePlayerIndex(state.players, state.currentTurnIndex);
    return {
      ...state,
      diceValue: value,
      consecutiveSixes: 0,
      currentTurnIndex: nextIdx,
      turnPhase: 'WAITING_ROLL',
      turnNumber: state.turnNumber + 1,
      lastEvent: {
        id: Date.now(),
        type: 'THREE_SIXES',
        color: currentPlayer.color,
        diceValue: value,
        message: `${currentPlayer.name} rolled three 6s! Turn forfeited.`,
      },
    };
  }

  const legalMoves = getLegalMoveTokenIds(state, state.currentTurnIndex, value);
  if (legalMoves.length === 0) {
    const nextIdx = getNextActivePlayerIndex(state.players, state.currentTurnIndex);
    return {
      ...state,
      diceValue: value,
      consecutiveSixes: 0,
      currentTurnIndex: nextIdx,
      turnPhase: 'WAITING_ROLL',
      turnNumber: state.turnNumber + 1,
      lastEvent: {
        id: Date.now(),
        type: 'NO_MOVES',
        color: currentPlayer.color,
        diceValue: value,
        message: `${currentPlayer.name} rolled ${value} — no legal moves.`,
      },
    };
  }

  return {
    ...state,
    diceValue: value,
    consecutiveSixes: nextSixes,
    turnPhase: 'SELECT_TOKEN',
    lastEvent: {
      id: Date.now(),
      type: 'ROLL',
      color: currentPlayer.color,
      diceValue: value,
      message: `${currentPlayer.name} rolled a ${value}!`,
    },
  };
}

export function applyTokenMove(state: GameState, tokenId: number): GameState {
  if (state.turnPhase !== 'SELECT_TOKEN' && state.turnPhase !== 'ANIMATING_MOVE') {
    return state;
  }
  const diceValue = state.diceValue;
  if (!diceValue) return state;

  const legalMoves = getLegalMoveTokenIds(state, state.currentTurnIndex, diceValue);
  if (!legalMoves.includes(tokenId)) return state;

  const players: PlayerState[] = state.players.map((p) => ({
    ...p,
    tokens: p.tokens.map((t) => ({ ...t })),
  }));

  const currentPlayer = players[state.currentTurnIndex];
  const token = currentPlayer.tokens[tokenId];
  const wasInYard = token.step === -1;
  const newStep = wasInYard ? 0 : token.step + diceValue;
  token.step = newStep;

  let capturedColor: PlayerColor | undefined;
  let reachedHome = false;
  let landedSafe = false;

  // Check capture on main track (0..50)
  const targetGlobalIdx = getGlobalTrackIndex(currentPlayer.color, newStep);
  if (targetGlobalIdx !== null) {
    if (SAFE_TRACK_INDICES.has(targetGlobalIdx)) {
      landedSafe = true;
    } else {
      for (let i = 0; i < players.length; i++) {
        if (i === state.currentTurnIndex) continue;
        const opp = players[i];
        for (const oppToken of opp.tokens) {
          const oppGlobal = getGlobalTrackIndex(opp.color, oppToken.step);
          if (oppGlobal === targetGlobalIdx) {
            oppToken.step = -1;
            capturedColor = opp.color;
          }
        }
      }
    }
  }

  // Check if token finished exact home (step 56)
  if (newStep === 56) {
    reachedHome = true;
    currentPlayer.finishedCount = currentPlayer.tokens.filter((t) => t.step === 56).length;
  }

  // Check winner
  const winners = [...state.winners];
  if (currentPlayer.finishedCount === 4 && currentPlayer.finishRank === null) {
    currentPlayer.finishRank = winners.length + 1;
    winners.push(currentPlayer.color);

    // Rank remaining players by total token progress so podium is always complete
    const remaining = players
      .filter((p) => p.finishRank === null)
      .sort((a, b) => {
        const scoreA = a.tokens.reduce((sum, t) => sum + Math.max(0, t.step + 1), 0);
        const scoreB = b.tokens.reduce((sum, t) => sum + Math.max(0, t.step + 1), 0);
        return scoreB - scoreA;
      });

    remaining.forEach((p, idx) => {
      p.finishRank = winners.length + idx + 1;
    });

    return {
      ...state,
      players,
      winners,
      turnPhase: 'GAME_OVER',
      turnNumber: state.turnNumber + 1,
      lastEvent: {
        id: Date.now(),
        type: 'WIN',
        color: currentPlayer.color,
        message: `${currentPlayer.name} (${COLOR_LABELS[currentPlayer.color]}) wins the match!`,
      },
    };
  }

  // Bonus turn on rolling 6, capturing an opponent, or finishing a token
  const bonusTurn = diceValue === 6 || Boolean(capturedColor) || reachedHome;
  const nextTurnIndex = bonusTurn
    ? state.currentTurnIndex
    : getNextActivePlayerIndex(players, state.currentTurnIndex);

  let eventType: GameEvent['type'] = 'MOVE';
  let eventMessage = `${currentPlayer.name} moved a token ${diceValue}.`;

  if (capturedColor) {
    eventType = 'CAPTURE';
    eventMessage = `${currentPlayer.name} captured ${COLOR_LABELS[capturedColor]}! Bonus roll!`;
  } else if (reachedHome) {
    eventType = 'HOME';
    eventMessage = `${currentPlayer.name} brought a token home! Bonus roll!`;
  } else if (wasInYard) {
    eventType = 'DEPLOY';
    eventMessage = `${currentPlayer.name} deployed a token!`;
  } else if (landedSafe) {
    eventType = 'SAFE';
    eventMessage = `${currentPlayer.name} landed on a safe star.`;
  }

  return {
    ...state,
    players,
    winners,
    currentTurnIndex: nextTurnIndex,
    diceValue: null,
    consecutiveSixes: bonusTurn ? (diceValue === 6 ? state.consecutiveSixes : 0) : 0,
    turnPhase: 'WAITING_ROLL',
    turnNumber: state.turnNumber + 1,
    lastEvent: {
      id: Date.now(),
      type: eventType,
      color: currentPlayer.color,
      capturedColor,
      diceValue,
      message: eventMessage,
    },
  };
}
