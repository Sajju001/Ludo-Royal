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
  email: string,
  purpose: 'signup' | 'reset' = 'signup'
): Promise<{ challengeToken: string; expiresInSeconds: number }> {
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
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

async function upsertAuthCredentialDoc(
  uid: string,
  passwordHash: string,
  authProof: string
): Promise<void> {
  const credPath = `authCredentials/${uid}`;
  const credRef = doc(db, 'authCredentials', uid);
  let exists = false;
  try {
    const snap = await getDoc(credRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, credPath);
  }

  try {
    if (exists) {
      await updateDoc(credRef, {
        passwordHash,
        authProof,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(credRef, {
        uid,
        passwordHash,
        authProof,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, exists ? OperationType.UPDATE : OperationType.CREATE, credPath);
  }
}

export async function registerWithEmailOtp(params: {
  displayName: string;
  email: string;
  password: string;
  otp: string;
  challengeToken: string;
  preferredAvatar?: AvatarId;
  fallbackCoins?: number;
  fallbackGems?: number;
}): Promise<{ profile: UserProfile; sessionToken: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: params.displayName,
      email: params.email,
      password: params.password,
      otp: params.otp,
      challengeToken: params.challengeToken,
    }),
  });
  const data = await parseApiJson<{
    ok?: boolean;
    uid?: string;
    displayName?: string;
    passwordHash?: string;
    authProof?: string;
    sessionToken?: string;
    error?: string;
  }>(res, '/api/auth/register');

  if (!res.ok || !data.uid || !data.passwordHash || !data.authProof || !data.sessionToken) {
    throw new Error(data.error || 'Account registration failed.');
  }

  setActiveErrorUserId(data.uid);
  await upsertAuthCredentialDoc(data.uid, data.passwordHash, data.authProof);

  const cleanName = sanitizeDisplayName(data.displayName || params.displayName, params.email);
  const profile = await ensureEmailUserProfile({
    uid: data.uid,
    email: params.email,
    preferredName: cleanName,
    preferredAvatar: params.preferredAvatar,
    fallbackCoins: params.fallbackCoins,
    fallbackGems: params.fallbackGems,
  });

  if (profile.displayName !== cleanName) {
    await updateUserProfile(profile.uid, { displayName: cleanName });
    return {
      profile: { ...profile, displayName: cleanName },
      sessionToken: data.sessionToken,
    };
  }

  return { profile, sessionToken: data.sessionToken };
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ profile: UserProfile; sessionToken: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const startRes = await fetch('/api/auth/login-start', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail }),
  });
  const startData = await parseApiJson<{ ok?: boolean; uid?: string; error?: string }>(
    startRes,
    '/api/auth/login-start'
  );
  if (!startRes.ok || !startData.uid) {
    throw new Error(startData.error || 'Could not locate account.');
  }

  const uid = startData.uid;
  setActiveErrorUserId(uid);

  let credData: { passwordHash?: string; authProof?: string } | null = null;
  try {
    const snap = await getDoc(doc(db, 'authCredentials', uid));
    if (snap.exists()) {
      credData = snap.data() as { passwordHash?: string; authProof?: string };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `authCredentials/${uid}`);
  }

  if (!credData?.passwordHash || !credData?.authProof) {
    throw new Error(
      'No password is set for this email yet. Please Sign Up or use Forgot Password to set one.'
    );
  }

  const loginRes = await fetch('/api/auth/login-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: cleanEmail,
      password: params.password,
      passwordHash: credData.passwordHash,
      authProof: credData.authProof,
    }),
  });

  const loginData = await parseApiJson<{
    ok?: boolean;
    uid?: string;
    sessionToken?: string;
    error?: string;
  }>(loginRes, '/api/auth/login-password');

  if (!loginRes.ok || !loginData.uid || !loginData.sessionToken) {
    throw new Error(loginData.error || 'Incorrect email or password.');
  }

  const profile = await ensureEmailUserProfile({
    uid: loginData.uid,
    email: cleanEmail,
  });

  return { profile, sessionToken: loginData.sessionToken };
}

export async function resetPasswordWithOtp(params: {
  email: string;
  otp: string;
  challengeToken: string;
  newPassword: string;
}): Promise<{ profile: UserProfile; sessionToken: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: cleanEmail,
      otp: params.otp,
      challengeToken: params.challengeToken,
      newPassword: params.newPassword,
    }),
  });

  const data = await parseApiJson<{
    ok?: boolean;
    uid?: string;
    passwordHash?: string;
    authProof?: string;
    sessionToken?: string;
    error?: string;
  }>(res, '/api/auth/reset-password');

  if (!res.ok || !data.uid || !data.passwordHash || !data.authProof || !data.sessionToken) {
    throw new Error(data.error || 'Password reset failed.');
  }

  setActiveErrorUserId(data.uid);
  await upsertAuthCredentialDoc(data.uid, data.passwordHash, data.authProof);

  const profile = await ensureEmailUserProfile({
    uid: data.uid,
    email: cleanEmail,
  });

  return { profile, sessionToken: data.sessionToken };
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

export async function restoreServerSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const parsed = JSON.parse(raw) as { authenticated?: boolean; uid?: string };
    if (parsed.authenticated && typeof parsed.uid === 'string' && parsed.uid.length > 0) {
      return parsed.uid;
    }
    return null;
  } catch {
    return null;
  }
}

export async function logoutServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // Non-fatal if network is temporarily unavailable
  }
}

export async function loadUserProfileByUid(uid: string): Promise<UserProfile | null> {
  setActiveErrorUserId(uid);
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const existing = snap.data() as UserProfile;
    return {
      ...existing,
      lastDailyClaimDate: existing.lastDailyClaimDate || '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
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
