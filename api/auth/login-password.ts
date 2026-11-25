import type { IncomingMessage, ServerResponse } from 'http';
import {
  buildSessionCookieHeader,
  createSessionTokenForUid,
  deriveUserIdFromEmail,
  isHttpsRequest,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  verifyCredentialProof,
  verifyPasswordHash,
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
    const password = typeof body.password === 'string' ? body.password : '';
    const passwordHash = typeof body.passwordHash === 'string' ? body.passwordHash : '';
    const authProof = typeof body.authProof === 'string' ? body.authProof : '';

    if (!isValidEmail(email)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Please enter a valid email address.' }));
      return;
    }

    if (!isValidPassword(password)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Incorrect email or password.' }));
      return;
    }

    const uid = deriveUserIdFromEmail(email);
    if (!verifyCredentialProof(uid, passwordHash, authProof) || !verifyPasswordHash(password, passwordHash)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Incorrect email or password.' }));
      return;
    }

    const sessionToken = createSessionTokenForUid(uid);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Set-Cookie', buildSessionCookieHeader(sessionToken, isHttpsRequest(req)));
    res.end(JSON.stringify({ ok: true, uid, sessionToken }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Password login failed.',
      })
    );
  }
}
