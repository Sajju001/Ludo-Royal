import type { IncomingMessage, ServerResponse } from 'http';
import {
  buildSessionCookieHeader,
  hashPassword,
  isHttpsRequest,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  signCredentialProof,
  verifyOtpChallenge,
} from '../_otpCore.js';

interface ReqWithBody extends IncomingMessage {
  body?: unknown;
}

async function readJsonBody(req: ReqWithBody): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export default async function handler(req: ReqWithBody, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const otp = typeof body.otp === 'string' ? body.otp : '';
    const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!isValidEmail(email)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Please enter a valid email address.' }));
      return;
    }

    if (!isValidPassword(newPassword)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'New password must be at least 6 characters.' }));
      return;
    }

    const otpResult = verifyOtpChallenge({ email, otp, challengeToken });
    if (!otpResult.valid || !otpResult.uid || !otpResult.sessionToken) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: otpResult.reason || 'Invalid password reset OTP.' }));
      return;
    }

    const passwordHash = hashPassword(newPassword);
    const authProof = signCredentialProof(otpResult.uid, passwordHash);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Set-Cookie', buildSessionCookieHeader(otpResult.sessionToken, isHttpsRequest(req)));
    res.end(
      JSON.stringify({
        ok: true,
        uid: otpResult.uid,
        passwordHash,
        authProof,
        sessionToken: otpResult.sessionToken,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Password reset failed.',
      })
    );
  }
}
