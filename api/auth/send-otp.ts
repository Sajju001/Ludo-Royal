import type { IncomingMessage, ServerResponse } from 'http';
import {
  createOtpChallenge,
  EmailConfigError,
  isValidEmail,
  normalizeEmail,
  sendOtpEmail,
} from '../_otpCore.js';

interface ReqWithBody extends IncomingMessage {
  body?: unknown;
}

interface ResLike extends ServerResponse {
  status: (code: number) => ResLike;
  json: (data: unknown) => void;
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

export default async function handler(req: ReqWithBody, res: ResLike) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const purpose = body.purpose === 'reset' ? 'reset' : 'signup';
    if (!isValidEmail(email)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Please enter a valid email address.' }));
      return;
    }

    const { otp, challengeToken, expiresInSeconds } = createOtpChallenge(email);
    await sendOtpEmail(email, otp, purpose);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, challengeToken, expiresInSeconds }));
  } catch (err) {
    const isConfigErr = err instanceof EmailConfigError;
    res.statusCode = isConfigErr ? 503 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to send OTP email.',
      })
    );
  }
}
