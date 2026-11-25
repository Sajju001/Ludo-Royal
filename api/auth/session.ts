import type { IncomingMessage, ServerResponse } from 'http';
import { extractSessionCookie, verifySessionToken } from '../_otpCore.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const token = extractSessionCookie(req.headers.cookie);
    const verified = verifySessionToken(token);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (verified.valid && verified.uid) {
      res.end(JSON.stringify({ authenticated: true, uid: verified.uid }));
      return;
    }
    res.end(JSON.stringify({ authenticated: false }));
  } catch {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ authenticated: false }));
  }
}
