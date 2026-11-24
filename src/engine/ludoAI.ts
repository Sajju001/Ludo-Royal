import { getGlobalTrackIndex, SAFE_TRACK_INDICES } from './boardMap';
import { AIDifficulty, GameState } from './types';

function isDangerBehind(state: GameState, playerIndex: number, globalIdx: number): boolean {
  if (SAFE_TRACK_INDICES.has(globalIdx)) return false;

  for (let i = 0; i < state.players.length; i++) {
    if (i === playerIndex) continue;
    const opp = state.players[i];
    for (const t of opp.tokens) {
      const oppIdx = getGlobalTrackIndex(opp.color, t.step);
      if (oppIdx === null) continue;
      const dist = (globalIdx - oppIdx + 52) % 52;
      if (dist >= 1 && dist <= 6) return true;
    }
  }
  return false;
}

export function chooseAIMove(
  state: GameState,
  playerIndex: number,
  legalTokenIds: number[],
  difficulty: AIDifficulty = 'normal'
): number {
  if (legalTokenIds.length === 0) return 0;
  if (legalTokenIds.length === 1) return legalTokenIds[0];

  const dice = state.diceValue ?? 1;
  const player = state.players[playerIndex];

  if (difficulty === 'easy') {
    // Easy: slight bias toward deploying on 6, otherwise random
    const yardToken = legalTokenIds.find((id) => player.tokens[id].step === -1);
    if (yardToken !== undefined && Math.random() < 0.65) return yardToken;
    return legalTokenIds[Math.floor(Math.random() * legalTokenIds.length)];
  }

  let bestId = legalTokenIds[0];
  let bestScore = -Infinity;

  for (const id of legalTokenIds) {
    const token = player.tokens[id];
    const currentStep = token.step;
    const nextStep = currentStep === -1 ? 0 : currentStep + dice;
    let score = 0;

    // 1. Exact Home Finish
    if (nextStep === 56) {
      score += 140;
    }

    // 2. Deploy from yard on 6
    if (currentStep === -1 && nextStep === 0) {
      score += difficulty === 'hard' ? 78 : 65;
    }

    // 3. Entering safe home column
    if (currentStep <= 50 && nextStep >= 51 && nextStep < 56) {
      score += 55;
    }

    // 4. Main track capture / safe / danger heuristics
    const nextGlobal = getGlobalTrackIndex(player.color, nextStep);
    const currGlobal = getGlobalTrackIndex(player.color, currentStep);

    if (nextGlobal !== null) {
      const safeLanding = SAFE_TRACK_INDICES.has(nextGlobal);
      if (safeLanding) {
        score += 48;
      } else {
        // Check opponent captures
        for (let i = 0; i < state.players.length; i++) {
          if (i === playerIndex) continue;
          const opp = state.players[i];
          for (const oppT of opp.tokens) {
            if (getGlobalTrackIndex(opp.color, oppT.step) === nextGlobal) {
              score += 110 + oppT.step * 0.5;
            }
          }
        }
      }

      if (difficulty === 'hard') {
        if (!safeLanding && isDangerBehind(state, playerIndex, nextGlobal)) {
          score -= 42;
        }
        if (currGlobal !== null && !SAFE_TRACK_INDICES.has(currGlobal) && isDangerBehind(state, playerIndex, currGlobal)) {
          // Escaping immediate danger
          score += 58;
        }
        if (currGlobal !== null && SAFE_TRACK_INDICES.has(currGlobal) && !safeLanding) {
          // Slight caution before leaving a safe zone
          score -= 14;
        }
      }
    }

    // 5. General progress incentive + small tie-breaker jitter
    score += Math.max(0, nextStep) * 0.45 + Math.random() * 2;

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}
