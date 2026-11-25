import { LocalPreferences } from '../engine/types';

const STORAGE_KEY = 'ludo_royale_prefs_v1';

export const DEFAULT_PREFERENCES: LocalPreferences = {
  soundEnabled: true,
  musicEnabled: false,
  boardTheme: 'royal',
  threeSixesRule: true,
  guestName: 'Royal Guest',
  guestAvatar: 'king',
  guestCoins: 2500,
  guestGems: 25,
  guestWins: 0,
  guestGamesPlayed: 0,
  lastDailyClaimDate: '',
};

export function loadPreferences(): LocalPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<LocalPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: LocalPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors in restricted storage environments
  }
}
