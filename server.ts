import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  createOtpChallenge,
  createSessionTokenForUid,
  deriveUserIdFromEmail,
  EmailConfigError,
  extractSessionCookie,
  hashPassword,
  isEmailProviderConfigured,
  isHttpsRequest,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  sanitizeDisplayName,
  sendOtpEmail,
  signCredentialProof,
  verifyCredentialProof,
  verifyOtpChallenge,
  verifyPasswordHash,
  verifySessionToken,
} from './api/_otpCore.js';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      emailOtpConfigured: isEmailProviderConfigured(),
    });
  });

  app.get('/api/auth/session', (req, res) => {
    try {
      const token = extractSessionCookie(req.headers.cookie);
      const verified = verifySessionToken(token);
      res.setHeader('Cache-Control', 'no-store');
      if (verified.valid && verified.uid) {
        res.json({ authenticated: true, uid: verified.uid });
        return;
      }
      res.json({ authenticated: false });
    } catch {
      res.json({ authenticated: false });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', buildClearSessionCookieHeader(isHttpsRequest(req)));
    res.json({ ok: true });
  });

  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const purpose = req.body?.purpose === 'reset' ? 'reset' : 'signup';
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      const { otp, challengeToken, expiresInSeconds } = createOtpChallenge(email);
      await sendOtpEmail(email, otp, purpose);

      res.json({ ok: true, challengeToken, expiresInSeconds });
    } catch (err) {
      const isConfigErr = err instanceof EmailConfigError;
      res.status(isConfigErr ? 503 : 500).json({
        error: err instanceof Error ? err.message : 'Failed to send OTP email.',
      });
    }
  });

  app.post('/api/auth/login-start', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    res.json({ ok: true, uid: deriveUserIdFromEmail(email) });
  });

  app.post('/api/auth/register', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === 'string' ? req.body.otp : '';
    const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName = sanitizeDisplayName(
      typeof req.body?.displayName === 'string' ? req.body.displayName : '',
      email
    );

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const otpResult = verifyOtpChallenge({ email, otp, challengeToken });
    if (!otpResult.valid || !otpResult.uid || !otpResult.sessionToken) {
      res.status(401).json({ error: otpResult.reason || 'Invalid verification OTP.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const authProof = signCredentialProof(otpResult.uid, passwordHash);
    res.setHeader('Set-Cookie', buildSessionCookieHeader(otpResult.sessionToken, isHttpsRequest(req)));
    res.json({
      ok: true,
      uid: otpResult.uid,
      displayName,
      passwordHash,
      authProof,
      sessionToken: otpResult.sessionToken,
    });
  });

  app.post('/api/auth/login-password', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const passwordHash = typeof req.body?.passwordHash === 'string' ? req.body.passwordHash : '';
    const authProof = typeof req.body?.authProof === 'string' ? req.body.authProof : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'Incorrect email or password.' });
      return;
    }

    const uid = deriveUserIdFromEmail(email);
    if (!verifyCredentialProof(uid, passwordHash, authProof) || !verifyPasswordHash(password, passwordHash)) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const sessionToken = createSessionTokenForUid(uid);
    res.setHeader('Set-Cookie', buildSessionCookieHeader(sessionToken, isHttpsRequest(req)));
    res.json({ ok: true, uid, sessionToken });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === 'string' ? req.body.otp : '';
    const challengeToken = typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!isValidPassword(newPassword)) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const otpResult = verifyOtpChallenge({ email, otp, challengeToken });
    if (!otpResult.valid || !otpResult.uid || !otpResult.sessionToken) {
      res.status(401).json({ error: otpResult.reason || 'Invalid password reset OTP.' });
      return;
    }

    const passwordHash = hashPassword(newPassword);
    const authProof = signCredentialProof(otpResult.uid, passwordHash);
    res.setHeader('Set-Cookie', buildSessionCookieHeader(otpResult.sessionToken, isHttpsRequest(req)));
    res.json({
      ok: true,
      uid: otpResult.uid,
      passwordHash,
      authProof,
      sessionToken: otpResult.sessionToken,
    });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === 'string' ? req.body.otp : '';
    const challengeToken =
      typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }

    const result = verifyOtpChallenge({ email, otp, challengeToken });
    if (!result.valid || !result.uid || !result.sessionToken) {
      res.status(401).json({ error: result.reason || 'Invalid OTP.' });
      return;
    }

    res.setHeader('Set-Cookie', buildSessionCookieHeader(result.sessionToken, isHttpsRequest(req)));
    res.json({
      ok: true,
      uid: result.uid,
      email,
      sessionToken: result.sessionToken,
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Ludo Royale server running on http://0.0.0.0:${port}`);
  });
}

startServer();
