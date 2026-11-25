import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { COLOR_HEX } from '../engine/boardMap';
import { PlayerColor } from '../engine/types';

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

// Target cube rotation (modulo 360) so the given face (1..6) faces directly forward
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

interface Dice3DProps {
  value: number | null;
  rolling: boolean;
  canRoll: boolean;
  activeColor: PlayerColor;
  onRoll: () => void;
  size?: 'sm' | 'md' | 'lg';
}

function DiceFace({
  faceValue,
  transform,
  borderColor,
}: {
  faceValue: number;
  transform: string;
  borderColor: string;
}) {
  const pips = PIP_POSITIONS[faceValue] || PIP_POSITIONS[6];
  return (
    <div
      style={{
        transform,
        backfaceVisibility: 'hidden',
        background: 'linear-gradient(145deg, #FFFFFF 0%, #F4F6FB 65%, #DCE3EE 100%)',
        boxShadow: 'inset 0 0 6px rgba(15, 23, 42, 0.14)',
        borderColor,
      }}
      className="absolute inset-0 rounded-[22%] border flex items-center justify-center"
    >
      <svg viewBox="0 0 100 100" className="w-[84%] h-[84%]">
        {pips.map(([cx, cy], idx) => (
          <g key={idx}>
            <circle
              cx={cx}
              cy={cy + 1.5}
              r={faceValue === 1 ? 14.5 : 9.8}
              fill="rgba(255,255,255,0.65)"
            />
            <circle
              cx={cx}
              cy={cy}
              r={faceValue === 1 ? 14 : 9.5}
              fill={faceValue === 1 ? '#E11D48' : '#1E1B4B'}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function nextRotationAngle(current: number, targetMod: number, minSpin = 360): number {
  const currentMod = ((current % 360) + 360) % 360;
  const targetNorm = ((targetMod % 360) + 360) % 360;
  let delta = targetNorm - currentMod;
  if (delta < 0) delta += 360;
  return current + minSpin + delta;
}

export function Dice3D({
  value,
  rolling,
  canRoll,
  activeColor,
  onRoll,
  size = 'md',
}: Dice3DProps) {
  const displayVal = value ?? 6;
  const colorMeta = COLOR_HEX[activeColor];

  const cubePx = size === 'sm' ? 46 : size === 'lg' ? 64 : 54;
  const halfPx = cubePx / 2;

  // Track cumulative 360°+ rotations so every click spins cleanly forward without snapping back
  const [rotation, setRotation] = useState<{ x: number; y: number; z: number }>(() => {
    const initial = FACE_ROTATIONS[displayVal] || FACE_ROTATIONS[6];
    return { x: initial.x, y: initial.y, z: 0 };
  });
  const wasRollingRef = useRef(false);

  useEffect(() => {
    const target = FACE_ROTATIONS[displayVal] || FACE_ROTATIONS[6];

    if (rolling && !wasRollingRef.current) {
      // Spin cleanly on X, Y, and Z axes when a roll starts (works even if value arrives after spin finishes)
      setRotation((prev) => ({
        x: prev.x + 450,
        y: prev.y + 450,
        z: prev.z + 360,
      }));
    } else if (!rolling) {
      // Snap smoothly onto the exact rolled face once rolling completes or updates externally
      setRotation((prev) => {
        const normX = ((prev.x % 360) + 360) % 360;
        const normY = ((prev.y % 360) + 360) % 360;
        const tgtNormX = ((target.x % 360) + 360) % 360;
        const tgtNormY = ((target.y % 360) + 360) % 360;
        if (normX === tgtNormX && normY === tgtNormY && !wasRollingRef.current) {
          return prev;
        }
        return {
          x: nextRotationAngle(prev.x, target.x, wasRollingRef.current ? 180 : 0),
          y: nextRotationAngle(prev.y, target.y, wasRollingRef.current ? 180 : 0),
          z: prev.z,
        };
      });
    }

    wasRollingRef.current = rolling;
  }, [rolling, displayVal]);

  const faceBorder = canRoll ? `${colorMeta.main}88` : 'rgba(148, 163, 184, 0.45)';

  return (
    <motion.button
      type="button"
      onClick={onRoll}
      disabled={!canRoll || rolling}
      aria-label={canRoll ? 'Roll dice' : `Dice showing ${displayVal}`}
      whileTap={canRoll ? { scale: 0.9 } : undefined}
      style={{
        width: cubePx,
        height: cubePx,
        perspective: 650,
      }}
      className={`relative flex items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBC41] ${
        canRoll ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* Active Turn Glow Ring */}
      {canRoll && !rolling && (
        <motion.span
          aria-hidden="true"
          animate={{ scale: [1, 1.18, 1], opacity: [0.65, 0.2, 0.65] }}
          transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-1.5 rounded-2xl border-2 border-[#FFBC41] shadow-[0_0_16px_rgba(255,188,65,0.6)] pointer-events-none"
        />
      )}

      {/* Ground Shadow */}
      <motion.span
        aria-hidden="true"
        animate={
          rolling
            ? {
                scale: [1, 0.55, 0.95, 1],
                opacity: [0.45, 0.16, 0.4, 0.35],
              }
            : { scale: 1, opacity: 0.35 }
        }
        transition={{ duration: 0.62, ease: 'easeOut' }}
        className="absolute -bottom-1.5 w-[82%] h-2.5 rounded-full bg-black/65 blur-[3px] pointer-events-none"
      />

      {/* Hopping & Tossing Wrapper */}
      <motion.div
        animate={
          rolling
            ? {
                y: [0, -18, 2, -4, 0],
                scale: [1, 1.18, 0.94, 1.04, 1],
              }
            : canRoll
            ? {
                y: [0, -2, 0],
                scale: 1,
              }
            : { y: 0, scale: 1 }
        }
        transition={
          rolling
            ? { duration: 0.62, ease: [0.22, 1, 0.36, 1] }
            : canRoll
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
        style={{
          width: cubePx,
          height: cubePx,
          transformStyle: 'preserve-3d',
        }}
        className="relative"
      >
        {/* 6-Sided 3D Cube */}
        <motion.div
          animate={{
            rotateX: rotation.x,
            rotateY: rotation.y,
            rotateZ: rotation.z,
          }}
          transition={{
            duration: rolling ? 0.62 : 0.4,
            ease: [0.18, 0.92, 0.28, 1],
          }}
          style={{
            width: cubePx,
            height: cubePx,
            transformStyle: 'preserve-3d',
          }}
          className="relative"
        >
          <DiceFace faceValue={1} transform={`rotateY(0deg) translateZ(${halfPx}px)`} borderColor={faceBorder} />
          <DiceFace faceValue={6} transform={`rotateY(180deg) translateZ(${halfPx}px)`} borderColor={faceBorder} />
          <DiceFace faceValue={2} transform={`rotateY(90deg) translateZ(${halfPx}px)`} borderColor={faceBorder} />
          <DiceFace faceValue={5} transform={`rotateY(-90deg) translateZ(${halfPx}px)`} borderColor={faceBorder} />
          <DiceFace faceValue={3} transform={`rotateX(90deg) translateZ(${halfPx}px)`} borderColor={faceBorder} />
          <DiceFace faceValue={4} transform={`rotateX(-90deg) translateZ(${halfPx}px)`} borderColor={faceBorder} />
        </motion.div>
      </motion.div>
    </motion.button>
  );
}
