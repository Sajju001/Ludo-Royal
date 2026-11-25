import type { IncomingMessage, ServerResponse } from 'http';
import { buildClearSessionCookieHeader, isHttpsRequest } from '../_otpCore.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Set-Cookie', buildClearSessionCookieHeader(isHttpsRequest(req)));
  res.end(JSON.stringify({ ok: true }));
}
