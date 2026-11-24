import crypto from 'crypto';
import nodemailer from 'nodemailer';

const FALLBACK_RUNTIME_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret() {
  const configured = process.env.OTP_SECRET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) {
    throw new EmailConfigError(
      'OTP_SECRET is not set in Vercel Environment Variables. Add a long random OTP_SECRET string in Vercel Project Settings.'
    );
  }
  return FALLBACK_RUNTIME_SECRET;
}

export class EmailConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmailConfigError';
  }
}

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length > 3 && email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isEmailProviderConfigured() {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  return hasResend || hasSmtp;
}

function hmacSign(data) {
  return crypto.createHmac('sha256', getSigningSecret()).update(data).digest('base64url');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function deriveUserIdFromEmail(email) {
  return `u_${sha256Hex(`ludo-royale-uid:${email}`).slice(0, 24)}`;
}

export function createOtpChallenge(email) {
  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresInSeconds = 600;
  const exp = Date.now() + expiresInSeconds * 1000;
  const secret = getSigningSecret();
  const otpHash = sha256Hex(`${email}:${otp}:${exp}:${secret}`);

  const payload = Buffer.from(JSON.stringify({ email, otpHash, exp })).toString('base64url');
  const sig = hmacSign(payload);
  return {
    otp,
    challengeToken: `${payload}.${sig}`,
    expiresInSeconds,
  };
}

export async function sendOtpEmail(email, otp) {
  const smtpUser = process.env.SMTP_USER?.trim();
  const fromAddress =
    process.env.EMAIL_FROM?.trim() ||
    (smtpUser ? `Ludo Royale <${smtpUser}>` : 'Ludo Royale <onboarding@resend.dev>');
  const subject = `${otp} is your Ludo Royale login OTP`;
  const textBody = `Your Ludo Royale verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this code, you can safely ignore this email.`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #1B0E3A; color: #ffffff; padding: 28px; border-radius: 16px; border: 2px solid #FFBC41;">
      <h2 style="margin: 0 0 12px; color: #FFBC41; font-size: 22px;">Ludo Royale Verification</h2>
      <p style="margin: 0 0 20px; color: #E9D5FF; font-size: 14px; line-height: 1.5;">
        Enter the 6-digit OTP below to sign in, sync your coins & stats, and play Online:
      </p>
      <div style="background: #2D1665; border: 1px solid rgba(255,188,65,0.45); border-radius: 12px; padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #FFFFFF;">
        ${otp}
      </div>
      <p style="margin: 20px 0 0; color: #C4B5FD; font-size: 12px;">
        Expires in 10 minutes. Never share this code with anyone.
      </p>
    </div>
  `;

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587 || smtpPort === 2525,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Email provider error (${resp.status}): ${errText}`);
    }
    return;
  }

  throw new EmailConfigError(
    'SMTP email delivery is not configured yet. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM in your Secrets or Vercel Environment Variables.'
  );
}

export function verifyOtpChallenge(params) {
  const { email, otp, challengeToken } = params;
  if (!challengeToken || !challengeToken.includes('.')) {
    return { valid: false, reason: 'Invalid or missing OTP challenge.' };
  }

  const [payloadB64, sig] = challengeToken.split('.');
  if (!payloadB64 || !sig) {
    return { valid: false, reason: 'Malformed OTP challenge.' };
  }

  const expectedSig = hmacSign(payloadB64);
  if (!safeEqual(sig, expectedSig)) {
    return { valid: false, reason: 'OTP challenge signature mismatch.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'Corrupted OTP challenge.' };
  }

  if (!parsed.exp || Date.now() > parsed.exp) {
    return { valid: false, reason: 'OTP has expired. Please request a new code.' };
  }

  if (parsed.email !== email) {
    return { valid: false, reason: 'Email does not match the OTP request.' };
  }

  const cleanedOtp = otp.trim();
  if (!/^\d{6}$/.test(cleanedOtp)) {
    return { valid: false, reason: 'Enter a valid 6-digit numeric OTP.' };
  }

  const secret = getSigningSecret();
  const candidateHash = sha256Hex(`${email}:${cleanedOtp}:${parsed.exp}:${secret}`);
  if (!parsed.otpHash || !safeEqual(candidateHash, parsed.otpHash)) {
    return { valid: false, reason: 'Incorrect OTP code.' };
  }

  const uid = deriveUserIdFromEmail(email);
  const sessionPayload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      verified: true,
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sessionSig = hmacSign(sessionPayload);

  return {
    valid: true,
    uid,
    sessionToken: `${sessionPayload}.${sessionSig}`,
  };
}
