import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  createOtpChallenge,
  EmailConfigError,
  isEmailProviderConfigured,
  isValidEmail,
  normalizeEmail,
  sendOtpEmail,
  verifyOtpChallenge,
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

  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      const { otp, challengeToken, expiresInSeconds } = createOtpChallenge(email);
      await sendOtpEmail(email, otp);

      res.json({ ok: true, challengeToken, expiresInSeconds });
    } catch (err) {
      const isConfigErr = err instanceof EmailConfigError;
      res.status(isConfigErr ? 503 : 500).json({
        error: err instanceof Error ? err.message : 'Failed to send OTP email.',
      });
    }
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
    if (!result.valid || !result.uid) {
      res.status(401).json({ error: result.reason || 'Invalid OTP.' });
      return;
    }

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
