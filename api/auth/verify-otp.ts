import type { IncomingMessage, ServerResponse } from 'http';
import { isValidEmail, normalizeEmail, verifyOtpChallenge } from '../_otpCore.js';

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

    if (!isValidEmail(email)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid email address.' }));
      return;
    }

    const result = verifyOtpChallenge({ email, otp, challengeToken });
    if (!result.valid || !result.uid) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: result.reason || 'Invalid OTP.' }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        uid: result.uid,
        email,
        sessionToken: result.sessionToken,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'OTP verification failed.',
      })
    );
  }
}
