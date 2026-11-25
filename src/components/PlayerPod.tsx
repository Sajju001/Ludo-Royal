import React from 'react';
import { Bot, Check, Mic, MicOff, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COLOR_HEX } from '../engine/boardMap';
import { EmoteBubble, PlayerState } from '../engine/types';
import { AvatarPortrait } from './CrownEmblem';
import { Dice3D } from './Dice3D';

interface PlayerPodProps {
  player: PlayerState;
  isActiveTurn: boolean;
  canRoll: boolean;
  rolling: boolean;
  diceValue: number | null;
  activeEmote: EmoteBubble | null;
  voiceMicOn?: boolean;
  onRoll: () => void;
  align?: 'left' | 'right';
}

export function PlayerPod({
  player,
  isActiveTurn,
  canRoll,
  rolling,
  diceValue,
  activeEmote,
  voiceMicOn,
  onRoll,
  align = 'left',
}: PlayerPodProps) {
  const c = COLOR_HEX[player.color];
  const showEmote = activeEmote && activeEmote.color === player.color;

  return (
    <div
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all duration-200 ${
        align === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left'
      } ${
        isActiveTurn
          ? 'bg-[#361A78]/95 border-[#FFBC41] shadow-[0_0_24px_rgba(255,188,65,0.28)]'
          : 'bg-[#211048]/85 border-white/10 opacity-85'
      }`}
    >
      {/* Floating Emote Bubble */}
      <AnimatePresence>
        {showEmote && (
          <motion.div
            key={activeEmote.id}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={`absolute -top-9 ${
              align === 'right' ? 'right-2' : 'left-2'
            } z-30 px-3 py-1 rounded-xl bg-white text-[#1B0E3A] text-xs font-bold shadow-lg whitespace-nowrap`}
          >
            {activeEmote.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar + Color Ring */}
      <div className="relative shrink-0">
        <div
          className="p-0.5 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${c.main}, ${c.dark})`,
          }}
        >
          <AvatarPortrait avatarId={player.avatarId} alt={player.name} className="w-11 h-11 sm:w-12 sm:h-12" />
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#1B0E3A] flex items-center justify-center text-[9px] text-white"
          style={{ backgroundColor: c.main }}
          title={player.type === 'ai' ? 'Computer AI' : 'Player'}
        >
          {player.type === 'ai' ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
        </span>
      </div>

      {/* Player Details & Home Progress Pips */}
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <p className="font-display font-bold text-sm text-white truncate max-w-[100px] sm:max-w-[125px]">
            {player.name}
          </p>
          {voiceMicOn !== undefined && (
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full border shrink-0 ${
                voiceMicOn
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-white/5 border-white/15 text-purple-300/60'
              }`}
              title={voiceMicOn ? 'Mic live' : 'Mic muted'}
            >
              {voiceMicOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          {[0, 1, 2, 3].map((pip) => {
            const done = pip < player.finishedCount;
            return (
              <span
                key={pip}
                className="w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: done ? c.main : 'rgba(255,255,255,0.08)',
                  borderColor: done ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                }}
              >
                {done && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
              </span>
            );
          })}
          <span className="text-[11px] text-purple-200/75 ml-1 tabular-nums">
            {player.type === 'ai' ? `AI · ${player.aiDifficulty || 'normal'}` : isActiveTurn ? 'Turn' : 'Wait'}
          </span>
        </div>
      </div>

      {/* Turn Dice Dock */}
      {isActiveTurn && (
        <div className="shrink-0">
          <Dice3D
            value={diceValue}
            rolling={rolling}
            canRoll={canRoll}
            activeColor={player.color}
            onRoll={onRoll}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
