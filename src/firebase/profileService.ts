import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AvatarId, UserProfile } from '../engine/types';
import { db, handleFirestoreError, OperationType, setActiveErrorUserId } from './firebase';

const VALID_AVATARS: AvatarId[] = ['king', 'archer', 'empress', 'knight'];

function sanitizeDisplayName(raw: string | null | undefined, emailFallback?: string | null): string {
  const fallback = emailFallback ? emailFallback.split('@')[0] : 'Royal Player';
  const trimmed = (raw || fallback).trim().slice(0, 32);
  return trimmed.length > 0 ? trimmed : 'Royal Player';
}

async function parseApiJson<T>(res: Response, endpoint: string): Promise<T> {
  const rawText = await res.text();
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const trimmed = rawText.trim().toLowerCase();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : 'HTML page';
      throw new Error(
        `OTP API (${endpoint}) returned HTTP ${res.status} (${pageTitle}) instead of JSON. If on AI Studio, open the Development App URL directly in a new tab (iframe third-party cookies or Shared static preview can intercept /api routes). If on Vercel, redeploy with the updated /api setup.`
      );
    }
    throw new Error(`Unexpected response from ${endpoint} (HTTP ${res.status}).`);
  }
}

export async function requestEmailOtp(
  email: string
): Promise<{ challengeToken: string; expiresInSeconds: number }> {
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await parseApiJson<{
    ok?: boolean;
    challengeToken?: string;
    expiresInSeconds?: number;
    error?: string;
  }>(res, '/api/auth/send-otp');
  if (!res.ok || !data.challengeToken) {
    throw new Error(data.error || 'Could not send OTP email.');
  }
  return {
    challengeToken: data.challengeToken,
    expiresInSeconds: data.expiresInSeconds ?? 600,
  };
}

export async function verifyEmailOtp(params: {
  email: string;
  otp: string;
  challengeToken: string;
}): Promise<{ uid: string; email: string; sessionToken: string }> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      otp: params.otp,
      challengeToken: params.challengeToken,
    }),
  });
  const data = await parseApiJson<{
    ok?: boolean;
    uid?: string;
    email?: string;
    sessionToken?: string;
    error?: string;
  }>(res, '/api/auth/verify-otp');

  if (!res.ok || !data.uid || !data.sessionToken) {
    throw new Error(data.error || 'OTP verification failed.');
  }

  return {
    uid: data.uid,
    email: data.email || params.email.trim().toLowerCase(),
    sessionToken: data.sessionToken,
  };
}

export async function ensureEmailUserProfile(params: {
  uid: string;
  email: string;
  preferredName?: string;
  preferredAvatar?: AvatarId;
  fallbackCoins?: number;
  fallbackGems?: number;
}): Promise<UserProfile> {
  const {
    uid,
    email,
    preferredName,
    preferredAvatar = 'king',
    fallbackCoins = 2500,
    fallbackGems = 25,
  } = params;

  setActiveErrorUserId(uid);
  const userPath = `users/${uid}`;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      return {
        ...existing,
        lastDailyClaimDate: existing.lastDailyClaimDate || '',
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const cleanPreferred =
    preferredName && preferredName !== 'Royal Guest' ? preferredName : undefined;
  const newProfile: UserProfile = {
    uid,
    displayName: sanitizeDisplayName(cleanPreferred, email),
    avatarId: VALID_AVATARS.includes(preferredAvatar) ? preferredAvatar : 'king',
    coins: Math.max(0, Math.min(10000000, Math.floor(fallbackCoins))),
    gems: Math.max(0, Math.min(1000000, Math.floor(fallbackGems))),
    wins: 0,
    gamesPlayed: 0,
    lastDailyClaimDate: '',
  };

  try {
    await setDoc(doc(db, 'users', uid), {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      'displayName' | 'avatarId' | 'coins' | 'gems' | 'wins' | 'gamesPlayed' | 'lastDailyClaimDate'
    >
  >
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.displayName !== undefined) {
    payload.displayName = sanitizeDisplayName(updates.displayName);
  }
  if (updates.avatarId !== undefined && VALID_AVATARS.includes(updates.avatarId)) {
    payload.avatarId = updates.avatarId;
  }
  if (updates.coins !== undefined) {
    payload.coins = Math.max(0, Math.min(10000000, Math.floor(updates.coins)));
  }
  if (updates.gems !== undefined) {
    payload.gems = Math.max(0, Math.min(1000000, Math.floor(updates.gems)));
  }
  if (updates.wins !== undefined) {
    payload.wins = Math.max(0, Math.min(1000000, Math.floor(updates.wins)));
  }
  if (updates.gamesPlayed !== undefined) {
    payload.gamesPlayed = Math.max(0, Math.min(1000000, Math.floor(updates.gamesPlayed)));
  }
  if (updates.lastDailyClaimDate !== undefined) {
    payload.lastDailyClaimDate = String(updates.lastDailyClaimDate).slice(0, 32);
  }

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordDailyClaim(uid: string, dateKey: string, newCoins: number): Promise<void> {
  await updateUserProfile(uid, {
    coins: newCoins,
    lastDailyClaimDate: dateKey.slice(0, 32),
  });
}
