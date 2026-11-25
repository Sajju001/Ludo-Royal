import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { UserProfile } from '../engine/types';
import {
  loginWithPassword,
  registerWithEmailOtp,
  requestEmailOtp,
  resetPasswordWithOtp,
} from '../firebase/profileService';
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

type AuthMode = 'signin' | 'signup' | 'forgot';

export function LoginModal({
  open,
  reason,
  playerNameHint,
  fallbackCoins,
  fallbackGems,
  onClose,
  onAuthenticated,
}: LoginModalProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (open) {
      setAuthMode('signin');
      setSignupStep('form');
      setForgotStep('email');
      setDisplayName(playerNameHint && playerNameHint !== 'Royal Guest' ? playerNameHint : '');
      setPassword('');
      setNewPassword('');
      setOtp('');
      setChallengeToken('');
      setErrorMsg('');
      setInfoMsg('');
      setShowPassword(false);
    }
  }, [open, playerNameHint]);

  if (!open) return null;

  const switchMode = (next: AuthMode) => {
    setAuthMode(next);
    setSignupStep('form');
    setForgotStep('email');
    setOtp('');
    setChallengeToken('');
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleNormalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      const { profile, sessionToken } = await loginWithPassword({
        email: cleanedEmail,
        password,
      });
      onAuthenticated(profile, sessionToken);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = displayName.trim();
    const cleanedEmail = email.trim().toLowerCase();
    if (cleanedName.length < 2) {
      setErrorMsg('Please enter your name (at least 2 characters).');
      return;
    }
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setErrorMsg('Please enter a valid Gmail or email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await requestEmailOtp(cleanedEmail, 'signup');
      setChallengeToken(res.challengeToken);
      setSignupStep('otp');
      setInfoMsg(`First-time verification OTP sent to ${cleanedEmail}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send verification OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setErrorMsg('Please enter the 6-digit numeric OTP.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      const { profile, sessionToken } = await registerWithEmailOtp({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
        otp: cleanedOtp,
        challengeToken,
        fallbackCoins,
        fallbackGems,
      });
      onAuthenticated(profile, sessionToken);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await requestEmailOtp(cleanedEmail, 'reset');
      setChallengeToken(res.challengeToken);
      setForgotStep('reset');
      setInfoMsg(`Password reset OTP sent to ${cleanedEmail}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send reset OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setErrorMsg('Please enter the 6-digit reset OTP.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      const { profile, sessionToken } = await resetPasswordWithOtp({
        email: email.trim().toLowerCase(),
        otp: cleanedOtp,
        challengeToken,
        newPassword,
      });
      onAuthenticated(profile, sessionToken);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Password reset failed.');
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
            {authMode === 'signin'
              ? 'Player Login'
              : authMode === 'signup'
              ? signupStep === 'form'
                ? 'Create Royal Account'
                : 'Verify Your Email'
              : 'Reset Password'}
          </h2>
          <p className="text-xs text-purple-200/80 mt-1">
            {reason ||
              (authMode === 'signin'
                ? 'Sign in with your Gmail & Password. Your session stays saved.'
                : authMode === 'signup'
                ? 'Set your Name, Email & Password. One-time OTP verification on signup.'
                : 'Verify your Email with an OTP to set a new password.')}
          </p>
        </div>

        {/* Sign In / Sign Up Mode Switcher */}
        {authMode !== 'forgot' ? (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#160B33] border border-white/10 mb-5">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`py-2 rounded-xl font-display font-bold text-xs transition ${
                authMode === 'signin'
                  ? 'royal-gold-gradient text-[#24124D] shadow'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`py-2 rounded-xl font-display font-bold text-xs inline-flex items-center justify-center gap-1.5 transition ${
                authMode === 'signup'
                  ? 'royal-gold-gradient text-[#24124D] shadow'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign Up
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="mb-4 text-xs text-purple-200/80 hover:text-white inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </button>
        )}

        {/* SIGN IN FORM (Normal Email + Password, No OTP Needed) */}
        {authMode === 'signin' && (
          <form onSubmit={handleNormalSignIn} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                Email / Gmail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="signin-password" className="text-xs font-semibold text-purple-200/85">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-semibold text-[#FFBC41] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/70 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
              {busy ? 'Signing In...' : 'Sign In & Play'}
            </button>
          </form>
        )}

        {/* SIGN UP FORM (Name + Email + Password -> 1st-Time OTP) */}
        {authMode === 'signup' && signupStep === 'form' && (
          <form onSubmit={handleSendSignupOtp} className="space-y-3.5">
            <div>
              <label htmlFor="signup-name" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                Player Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-name"
                  type="text"
                  required
                  maxLength={32}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                Email / Gmail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                Create Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set your password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/70 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
              {busy ? 'Sending Verification OTP...' : 'Continue & Send OTP'}
            </button>
          </form>
        )}

        {authMode === 'signup' && signupStep === 'otp' && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            {infoMsg && (
              <div className="rounded-xl bg-emerald-950/50 border border-emerald-400/35 p-3 text-xs text-emerald-200">
                {infoMsg}
              </div>
            )}

            <div>
              <label htmlFor="signup-otp" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                6-Digit Verification OTP
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-otp"
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
              {busy ? 'Creating Account...' : 'Verify OTP & Create Account'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setSignupStep('form');
                  setErrorMsg('');
                }}
                className="text-purple-200/80 hover:text-white inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Edit Details
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSendSignupOtp}
                className="text-[#FFBC41] font-semibold hover:underline"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FLOW (Email -> Reset OTP + New Password) */}
        {authMode === 'forgot' && forgotStep === 'email' && (
          <form onSubmit={handleSendResetOtp} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                Registered Email / Gmail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
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
              {busy ? 'Sending Reset OTP...' : 'Send Password Reset OTP'}
            </button>
          </form>
        )}

        {authMode === 'forgot' && forgotStep === 'reset' && (
          <form onSubmit={handleCompleteReset} className="space-y-3.5">
            {infoMsg && (
              <div className="rounded-xl bg-emerald-950/50 border border-emerald-400/35 p-3 text-xs text-emerald-200">
                {infoMsg}
              </div>
            )}

            <div>
              <label htmlFor="reset-otp" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                6-Digit Reset OTP
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#160B33] border border-white/15 text-base font-display font-bold tracking-[0.35em] text-white focus:outline-none focus:border-[#FFBC41]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reset-new-password" className="block text-xs font-semibold text-purple-200/85 mb-1.5">
                New Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#160B33] border border-white/15 text-sm text-white focus:outline-none focus:border-[#FFBC41]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/70 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
              {busy ? 'Updating Password...' : 'Reset Password & Sign In'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotStep('email');
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
                onClick={handleSendResetOtp}
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
