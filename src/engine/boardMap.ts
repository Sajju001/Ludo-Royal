import { PlayerColor } from './types';

export interface GridCoord {
  row: number;
  col: number;
}

/**
 * 52-cell clockwise outer track in (row, col) coordinates on a 15x15 grid (0..14).
 * Index 0 is Red's start square at (6, 1).
 */
export const MAIN_TRACK: GridCoord[] = [
  // Red arm top row moving right (0..4)
  { row: 6, col: 1 }, // 0: Red Start (SAFE)
  { row: 6, col: 2 }, // 1
  { row: 6, col: 3 }, // 2
  { row: 6, col: 4 }, // 3
  { row: 6, col: 5 }, // 4
  // Top arm left col moving up (5..10)
  { row: 5, col: 6 }, // 5
  { row: 4, col: 6 }, // 6
  { row: 3, col: 6 }, // 7
  { row: 2, col: 6 }, // 8: Star Safe
  { row: 1, col: 6 }, // 9
  { row: 0, col: 6 }, // 10
  // Top turn (11..12)
  { row: 0, col: 7 }, // 11 (Green Home entry turn)
  { row: 0, col: 8 }, // 12
  // Top arm right col moving down (13..17)
  { row: 1, col: 8 }, // 13: Green Start (SAFE)
  { row: 2, col: 8 }, // 14
  { row: 3, col: 8 }, // 15
  { row: 4, col: 8 }, // 16
  { row: 5, col: 8 }, // 17
  // Right arm top row moving right (18..23)
  { row: 6, col: 9 }, // 18
  { row: 6, col: 10 }, // 19
  { row: 6, col: 11 }, // 20
  { row: 6, col: 12 }, // 21: Star Safe
  { row: 6, col: 13 }, // 22
  { row: 6, col: 14 }, // 23
  // Right turn (24..25)
  { row: 7, col: 14 }, // 24 (Yellow Home entry turn)
  { row: 8, col: 14 }, // 25
  // Right arm bottom row moving left (26..30)
  { row: 8, col: 13 }, // 26: Yellow Start (SAFE)
  { row: 8, col: 12 }, // 27
  { row: 8, col: 11 }, // 28
  { row: 8, col: 10 }, // 29
  { row: 8, col: 9 }, // 30
  // Bottom arm right col moving down (31..36)
  { row: 9, col: 8 }, // 31
  { row: 10, col: 8 }, // 32
  { row: 11, col: 8 }, // 33
  { row: 12, col: 8 }, // 34: Star Safe
  { row: 13, col: 8 }, // 35
  { row: 14, col: 8 }, // 36
  // Bottom turn (37..38)
  { row: 14, col: 7 }, // 37 (Blue Home entry turn)
  { row: 14, col: 6 }, // 38
  // Bottom arm left col moving up (39..43)
  { row: 13, col: 6 }, // 39: Blue Start (SAFE)
  { row: 12, col: 6 }, // 40
  { row: 11, col: 6 }, // 41
  { row: 10, col: 6 }, // 42
  { row: 9, col: 6 }, // 43
  // Left arm bottom row moving left (44..49)
  { row: 8, col: 5 }, // 44
  { row: 8, col: 4 }, // 45
  { row: 8, col: 3 }, // 46
  { row: 8, col: 2 }, // 47: Star Safe
  { row: 8, col: 1 }, // 48
  { row: 8, col: 0 }, // 49
  // Left turn (50..51)
  { row: 7, col: 0 }, // 50 (Red Home entry turn)
  { row: 6, col: 0 }, // 51
];

export const START_TRACK_OFFSET: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
export const STAR_SAFE_INDICES = new Set<number>([8, 21, 34, 47]);

export const HOME_COLUMN_COORDS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ],
  green: [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
  ],
  yellow: [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
  ],
  blue: [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
  ],
};

// Coordinates inside the 4 yard circles (fractional grid positions for dead-center alignment)
export const YARD_TOKEN_COORDS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { row: 1.85, col: 1.85 },
    { row: 1.85, col: 3.15 },
    { row: 3.15, col: 1.85 },
    { row: 3.15, col: 3.15 },
  ],
  green: [
    { row: 1.85, col: 10.85 },
    { row: 1.85, col: 12.15 },
    { row: 3.15, col: 10.85 },
    { row: 3.15, col: 12.15 },
  ],
  yellow: [
    { row: 10.85, col: 10.85 },
    { row: 10.85, col: 12.15 },
    { row: 12.15, col: 10.85 },
    { row: 12.15, col: 12.15 },
  ],
  blue: [
    { row: 10.85, col: 1.85 },
    { row: 10.85, col: 3.15 },
    { row: 12.15, col: 1.85 },
    { row: 12.15, col: 3.15 },
  ],
};

// Resting coordinates inside the center 3x3 home triangle for finished tokens
export const FINISH_TRIANGLE_COORDS: Record<PlayerColor, GridCoord> = {
  red: { row: 7, col: 6.22 },
  green: { row: 6.22, col: 7 },
  yellow: { row: 7, col: 7.78 },
  blue: { row: 7.78, col: 7 },
};

export function getGlobalTrackIndex(color: PlayerColor, step: number): number | null {
  if (step < 0 || step > 50) return null;
  return (START_TRACK_OFFSET[color] + step) % 52;
}

export function getTokenBoardCoord(color: PlayerColor, tokenId: number, step: number): GridCoord {
  if (step < 0) {
    return YARD_TOKEN_COORDS[color][tokenId];
  }
  if (step <= 50) {
    const idx = getGlobalTrackIndex(color, step)!;
    return MAIN_TRACK[idx];
  }
  if (step <= 55) {
    return HOME_COLUMN_COORDS[color][step - 51];
  }
  return FINISH_TRIANGLE_COORDS[color];
}

export function getColorsForPlayerCount(count: number, preferredColor: PlayerColor = 'red'): PlayerColor[] {
  const clockwise: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  const startIdx = clockwise.indexOf(preferredColor);
  const rotated = [...clockwise.slice(startIdx), ...clockwise.slice(0, startIdx)];

  if (count === 2) {
    // Opposite corners for symmetric 2P balance
    return [rotated[0], rotated[2]];
  }
  if (count === 3) {
    return [rotated[0], rotated[1], rotated[2]];
  }
  return rotated;
}

export const COLOR_LABELS: Record<PlayerColor, string> = {
  red: 'Crimson',
  green: 'Emerald',
  yellow: 'Gold',
  blue: 'Azure',
};

export const COLOR_HEX: Record<PlayerColor, { main: string; dark: string; light: string; ring: string }> = {
  red: { main: '#FF201B', dark: '#B90B08', light: '#FFE4E3', ring: '#FCA5A5' },
  green: { main: '#16A34A', dark: '#14532D', light: '#DCFCE7', ring: '#86EFAC' },
  yellow: { main: '#FACC15', dark: '#CA8A04', light: '#FEF9C3', ring: '#FDE047' },
  blue: { main: '#4396FC', dark: '#1D4ED8', light: '#DBEAFE', ring: '#93C5FD' },
};
