import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import { UserProfile } from '../engine/types';
import { ensureEmailUserProfile, requestEmailOtp, verifyEmailOtp } from '../firebase/profileService';
import { CrownEmblem } from './CrownEmblem';

interface LoginModalProps {
  open: boolean;
  reason?: string | null;
  playerNameHint: string;
  fallbackCoins: number;
  fallbackGems: number;
  onClose: () => void;
  onAuthenticated: (profile: UserProfile, sessionToken: string) => void;
}

export function LoginModal({
  open,
  reason,
  playerNameHint,
  fallbackCoins,
  fallbackGems,
  onClose,
  onAuthenticated,
}: LoginModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (open) {
      setStep('email');
      setOtp('');
      setErrorMsg('');
      setInfoMsg('');
    }
  }, [open]);

  if (!open) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await requestEmailOtp(cleaned);
      setChallengeToken(res.challengeToken);
      setStep('otp');
      setInfoMsg(`A 6-digit OTP has been sent to ${cleaned}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setErrorMsg('Please enter the 6-digit numeric OTP.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      const verified = await verifyEmailOtp({
        email: email.trim().toLowerCase(),
        otp: cleanedOtp,
        challengeToken,
      });

      const profile = await ensureEmailUserProfile({
        uid: verified.uid,
        email: verified.email,
        preferredName: playerNameHint,
        fallbackCoins,
        fallbackGems,
      });

      onAuthenticated(profile, verified.sessionToken);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-[#22104B] border border-[#FFBC41]/35 p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close login"
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <CrownEmblem size="sm" />
          <h2 className="font-display text-xl font-bold text-white mt-2">
            {step === 'email' ? 'Login with Email OTP' : 'Enter Verification OTP'}
          </h2>
          <p className="text-xs text-purple-200/80 mt-1">
            {reason || 'Enter your email to receive an OTP, create your account, and sync your data.'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="otp-email-input" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="otp-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-400/40 p-3 text-xs text-rose-200 leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-sm shadow-lg hover:brightness-105 disabled:opacity-50 transition"
            >
              {busy ? 'Sending OTP...' : 'Send 6-Digit OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {infoMsg && (
              <div className="rounded-xl bg-emerald-950/50 border border-emerald-400/35 p-3 text-xs text-emerald-200">
                {infoMsg}
              </div>
            )}

            <div>
              <label htmlFor="otp-code-input" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                6-Digit OTP Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="otp-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#160B33] border border-white/15 text-base font-display font-bold tracking-[0.35em] text-white focus:outline-none focus:border-[#FFBC41]"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-400/40 p-3 text-xs text-rose-200 leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="w-full py-3.5 rounded-xl royal-gold-gradient text-[#24124D] font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-lg hover:brightness-105 disabled:opacity-50 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              {busy ? 'Verifying...' : 'Verify OTP & Continue'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setErrorMsg('');
                }}
                className="text-purple-200/80 hover:text-white inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change Email
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSendOtp}
                className="text-[#FFBC41] font-semibold hover:underline"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
