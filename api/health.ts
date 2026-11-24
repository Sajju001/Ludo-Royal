import type { IncomingMessage, ServerResponse } from 'http';
import { isEmailProviderConfigured } from './_otpCore.js';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      ok: true,
      emailOtpConfigured: isEmailProviderConfigured(),
    })
  );
}
