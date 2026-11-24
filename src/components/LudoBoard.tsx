import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crown, Star } from 'lucide-react';
import {
  COLOR_HEX,
  getTokenBoardCoord,
  HOME_COLUMN_COORDS,
  MAIN_TRACK,
  STAR_SAFE_INDICES,
  START_TRACK_OFFSET,
} from '../engine/boardMap';
import { BoardTheme, GameState, PlayerColor } from '../engine/types';

interface LudoBoardProps {
  gameState: GameState;
  legalTokenIds: number[];
  canInteract: boolean;
  boardTheme: BoardTheme;
  onSelectToken: (tokenId: number) => void;
}

const THEME_PALETTES: Record<
  BoardTheme,
  {
    frameBg: string;
    frameBorder: string;
    laneBg: string;
    cellBorder: string;
    yardInnerBg: string;
    starColor: string;
    quadrants: Record<PlayerColor, { main: string; deep: string }>;
  }
> = {
  royal: {
    frameBg: '#271257',
    frameBorder: '#FFBC41',
    laneBg: '#FAF8FF',
    cellBorder: '#D8CEF2',
    yardInnerBg: '#FFFFFF',
    starColor: '#7C3AED',
    quadrants: {
      red: { main: '#FF2D28', deep: '#B90B08' },
      green: { main: '#18B252', deep: '#127337' },
      yellow: { main: '#FFC81E', deep: '#CC8D00' },
      blue: { main: '#4396FC', deep: '#1C5AC4' },
    },
  },
  classic: {
    frameBg: '#5C3A21',
    frameBorder: '#D4A373',
    laneBg: '#FFFDF7',
    cellBorder: '#CBD5E1',
    yardInnerBg: '#FFFFFF',
    starColor: '#94A3B8',
    quadrants: {
      red: { main: '#EF233C', deep: '#A4161A' },
      green: { main: '#16A34A', deep: '#14532D' },
      yellow: { main: '#FACC15', deep: '#A16207' },
      blue: { main: '#2563EB', deep: '#1E3A8A' },
    },
  },
  midnight: {
    frameBg: '#0B1120',
    frameBorder: '#38BDF8',
    laneBg: '#1E293B',
    cellBorder: '#334155',
    yardInnerBg: '#0F172A',
    starColor: '#F59E0B',
    quadrants: {
      red: { main: '#F43F5E', deep: '#9F1239' },
      green: { main: '#10B981', deep: '#065F46' },
      yellow: { main: '#F59E0B', deep: '#92400E' },
      blue: { main: '#38BDF8', deep: '#0369A1' },
    },
  },
};

function getStartColorAt(trackIdx: number): PlayerColor | null {
  if (trackIdx === START_TRACK_OFFSET.red) return 'red';
  if (trackIdx === START_TRACK_OFFSET.green) return 'green';
  if (trackIdx === START_TRACK_OFFSET.yellow) return 'yellow';
  if (trackIdx === START_TRACK_OFFSET.blue) return 'blue';
  return null;
}

export function LudoBoard({
  gameState,
  legalTokenIds,
  canInteract,
  boardTheme,
  onSelectToken,
}: LudoBoardProps) {
  const palette = THEME_PALETTES[boardTheme];
  const currentPlayer = gameState.players[gameState.currentTurnIndex];

  // Lookup map for 52 main track cells and 20 home column cells
  const cellLookup = useMemo(() => {
    const map = new Map<string, { trackIdx?: number; homeColor?: PlayerColor }>();
    MAIN_TRACK.forEach((coord, idx) => {
      map.set(`${coord.row}-${coord.col}`, { trackIdx: idx });
    });
    (['red', 'green', 'yellow', 'blue'] as PlayerColor[]).forEach((color) => {
      HOME_COLUMN_COORDS[color].forEach((coord) => {
        map.set(`${coord.row}-${coord.col}`, { homeColor: color });
      });
    });
    return map;
  }, []);

  // Flatten all tokens and group tokens occupying identical coordinates so we can offset neatly
  const renderedTokens = useMemo(() => {
    const entries: {
      key: string;
      color: PlayerColor;
      tokenId: number;
      step: number;
      row: number;
      col: number;
      isSelectable: boolean;
    }[] = [];

    for (const player of gameState.players) {
      const isCurrent = currentPlayer?.color === player.color;
      for (const token of player.tokens) {
        const coord = getTokenBoardCoord(player.color, token.id, token.step);
        const isSelectable =
          canInteract &&
          isCurrent &&
          gameState.turnPhase === 'SELECT_TOKEN' &&
          legalTokenIds.includes(token.id);
        entries.push({
          key: `${player.color}-${token.id}`,
          color: player.color,
          tokenId: token.id,
          step: token.step,
          row: coord.row,
          col: coord.col,
          isSelectable,
        });
      }
    }

    // Group by rounded cell key to spread stacked tokens gracefully
    const groups = new Map<string, typeof entries>();
    for (const item of entries) {
      const gKey = `${item.row.toFixed(2)}-${item.col.toFixed(2)}`;
      const list = groups.get(gKey) || [];
      list.push(item);
      groups.set(gKey, list);
    }

    const OFFSETS: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [
        [-0.17, -0.1],
        [0.17, 0.1],
      ],
      3: [
        [-0.18, -0.15],
        [0.18, -0.15],
        [0, 0.18],
      ],
      4: [
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ],
    };

    return entries.map((item) => {
      const gKey = `${item.row.toFixed(2)}-${item.col.toFixed(2)}`;
      const group = groups.get(gKey) || [item];
      const idxInGroup = group.indexOf(item);
      const pattern = OFFSETS[Math.min(4, group.length)];
      const [dx, dy] = pattern[idxInGroup % pattern.length];
      return {
        ...item,
        offsetX: dx,
        offsetY: dy,
        stackedCount: group.length,
      };
    });
  }, [gameState, currentPlayer, canInteract, legalTokenIds]);

  const renderYard = (color: PlayerColor, gridArea: string) => {
    const q = palette.quadrants[color];
    const isActiveTurn = currentPlayer?.color === color;
    const isPlayingColor = gameState.players.some((p) => p.color === color);

    return (
      <div
        style={{
          gridArea,
          backgroundColor: q.main,
          borderColor: palette.cellBorder,
        }}
        className={`relative p-[13%] border flex items-center justify-center transition-opacity ${
          isPlayingColor ? 'opacity-100' : 'opacity-45 grayscale-[30%]'
        }`}
      >
        {isActiveTurn && (
          <div
            className="absolute inset-1 rounded-xl pointer-events-none animate-pulse border-2 border-white/80"
            aria-hidden="true"
          />
        )}
        <div
          style={{ backgroundColor: palette.yardInnerBg }}
          className="w-full h-full rounded-2xl shadow-inner grid grid-cols-2 grid-rows-2 gap-[14%] p-[16%] border border-black/10"
        >
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              style={{
                backgroundColor: `${q.main}26`,
                borderColor: `${q.main}99`,
              }}
              className="rounded-full border-2 shadow-inner"
            />
          ))}
        </div>
      </div>
    );
  };

  // Build individual track cells (all cells outside the three 6x6/3x3 regions)
  const trackCells: React.ReactNode[] = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const inTopLeft = row < 6 && col < 6;
      const inTopRight = row < 6 && col > 8;
      const inBottomRight = row > 8 && col > 8;
      const inBottomLeft = row > 8 && col < 6;
      const inCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
      if (inTopLeft || inTopRight || inBottomRight || inBottomLeft || inCenter) continue;

      const meta = cellLookup.get(`${row}-${col}`);
      const startColor = meta?.trackIdx !== undefined ? getStartColorAt(meta.trackIdx) : null;
      const isStar = meta?.trackIdx !== undefined && STAR_SAFE_INDICES.has(meta.trackIdx);
      const homeColor = meta?.homeColor;

      let bg = palette.laneBg;
      if (startColor) bg = palette.quadrants[startColor].main;
      else if (homeColor) bg = palette.quadrants[homeColor].main;

      // Entry arrows right before home column
      const isArrowCell =
        (row === 7 && col === 0) ||
        (row === 0 && col === 7) ||
        (row === 7 && col === 14) ||
        (row === 14 && col === 7);

      trackCells.push(
        <div
          key={`${row}-${col}`}
          style={{
            gridRowStart: row + 1,
            gridColumnStart: col + 1,
            backgroundColor: bg,
            borderColor: palette.cellBorder,
          }}
          className="border-[0.5px] flex items-center justify-center relative select-none"
        >
          {startColor && <Star className="w-[62%] h-[62%] text-white fill-white/90 drop-shadow-sm" />}
          {isStar && (
            <Star
              className="w-[62%] h-[62%]"
              style={{ color: palette.starColor, fill: `${palette.starColor}33` }}
            />
          )}
          {isArrowCell && row === 7 && col === 0 && (
            <ArrowRight className="w-[55%] h-[55%] text-rose-500/75" />
          )}
          {isArrowCell && row === 0 && col === 7 && (
            <ArrowDown className="w-[55%] h-[55%] text-emerald-600/75" />
          )}
          {isArrowCell && row === 7 && col === 14 && (
            <ArrowLeft className="w-[55%] h-[55%] text-amber-500/80" />
          )}
          {isArrowCell && row === 14 && col === 7 && (
            <ArrowUp className="w-[55%] h-[55%] text-blue-500/75" />
          )}
        </div>
      );
    }
  }

  return (
    <div
      style={{
        backgroundColor: palette.frameBg,
        borderColor: palette.frameBorder,
      }}
      className="relative w-full max-w-[540px] aspect-square mx-auto p-2 sm:p-3 rounded-[26px] border-[3px] shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
    >
      {/* 15x15 Board Surface */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-black/20">
        <div
          className="grid w-full h-full"
          style={{
            gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
          }}
        >
          {renderYard('red', '1 / 1 / 7 / 7')}
          {renderYard('green', '1 / 10 / 7 / 16')}
          {renderYard('yellow', '10 / 10 / 16 / 16')}
          {renderYard('blue', '10 / 1 / 16 / 7')}

          {trackCells}

          {/* 3x3 Center Home Finish Triangles */}
          <div
            style={{ gridArea: '7 / 7 / 10 / 10' }}
            className="relative border border-black/15 overflow-hidden"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full block">
              <polygon points="0,0 50,50 0,100" fill={palette.quadrants.red.main} stroke="#fff" strokeWidth="1.5" />
              <polygon points="0,0 100,0 50,50" fill={palette.quadrants.green.main} stroke="#fff" strokeWidth="1.5" />
              <polygon points="100,0 100,100 50,50" fill={palette.quadrants.yellow.main} stroke="#fff" strokeWidth="1.5" />
              <polygon points="0,100 50,50 100,100" fill={palette.quadrants.blue.main} stroke="#fff" strokeWidth="1.5" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full royal-gold-gradient border-2 border-white shadow-md flex items-center justify-center text-[#24124D]">
                <Crown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Animated Token Layer */}
        <div className="absolute inset-0 pointer-events-none">
          {renderedTokens.map((t) => {
            const leftPct = ((t.col + 0.5 + t.offsetX) / 15) * 100;
            const topPct = ((t.row + 0.5 + t.offsetY) / 15) * 100;
            const c = COLOR_HEX[t.color];
            const scale = t.stackedCount > 1 ? 0.8 : 1;

            return (
              <motion.button
                key={t.key}
                type="button"
                disabled={!t.isSelectable}
                onClick={() => t.isSelectable && onSelectToken(t.tokenId)}
                aria-label={`${t.color} token ${t.tokenId + 1}`}
                initial={false}
                animate={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  scale: t.isSelectable ? [scale * 1.05, scale * 1.22, scale * 1.05] : scale,
                }}
                transition={{
                  left: { type: 'spring', stiffness: 360, damping: 28 },
                  top: { type: 'spring', stiffness: 360, damping: 28 },
                  scale: t.isSelectable
                    ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.18 },
                }}
                style={{
                  transform: 'translate(-50%, -50%)',
                  zIndex: t.isSelectable ? 40 : t.step >= 0 ? 20 : 10,
                }}
                className={`absolute w-[6.2%] h-[6.2%] -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center focus-visible:outline-none ${
                  t.isSelectable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
                }`}
              >
                {t.isSelectable && (
                  <span
                    className="absolute -inset-1.5 rounded-full border-2 border-white shadow-[0_0_12px_rgba(255,255,255,0.95)] animate-ping opacity-75"
                    aria-hidden="true"
                  />
                )}
                {/* Tactile 3D Pawn Token */}
                <span
                  className="relative w-full h-full rounded-full border-[2.5px] border-white shadow-[0_4px_6px_rgba(0,0,0,0.45)] flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${c.main} 32%, ${c.dark} 100%)`,
                  }}
                >
                  <span className="w-[42%] h-[42%] rounded-full bg-white/85 shadow-inner" />
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
