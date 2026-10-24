import React, { useEffect, useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  Globe2,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ModalMotion } from '../motion';
import { t } from '../../apps/web/src/translations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  initialResetToken?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  initialResetToken = '',
}) => {
  const { countries, showToast, loginUser, registerUser, completeMfaLogin, currentUser } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset' | 'mfa_prompt'>(
    initialMode,
  );

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaTicket, setMfaTicket] = useState('');
  const [isRecoveryCodeMode, setIsRecoveryCodeMode] = useState(false);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    if (initialResetToken) {
      setResetToken(initialResetToken);
    }
    setErrorMsg(null);
    setInfoMsg(null);
  }, [isOpen, initialMode, initialResetToken]);

  // Filter out any sanctioned countries for registration
  const registrationCountries = countries.filter((c) => c.enabled && !c.isSanctioned);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await loginUser({ email, password, totpCode: totpCode.trim() || undefined });
      if (res.requiresMfa) {
        setMfaTicket(res.mfaTicket);
        setMode('mfa_prompt');
        showToast('Two-Factor Authentication required. Enter code to continue.', 'info');
      } else {
        showToast(`Welcome back, ${res.user.fullName}!`, 'success');
        onClose();
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      if (msg.includes('locked')) {
        setLockoutSec(900); // 15 min
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await completeMfaLogin({ mfaTicket, totpCode: totpCode.trim() });
      showToast(`Two-Factor Authentication verified. Welcome back, ${res.user.fullName}!`, 'success');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid Two-Factor Authentication code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    // Calculate age client-side for immediate guidance
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

    if (age < 18) {
      setErrorMsg('You must be at least 18 years of age to register for Lumenfield.');
      setLoading(false);
      return;
    }

    // Mirror server password policy for clearer client-side feedback
    const passwordIssues: string[] = [];
    if (password.length < 12) passwordIssues.push('Password must be at least 12 characters.');
    if (!/[A-Z]/.test(password)) passwordIssues.push('Include at least one uppercase letter.');
    if (!/[a-z]/.test(password)) passwordIssues.push('Include at least one lowercase letter.');
    if (!/[0-9]/.test(password)) passwordIssues.push('Include at least one number.');
    if (!/[^A-Za-z0-9]/.test(password)) {
      passwordIssues.push('Include at least one special character (e.g. !@#$%).');
    }
    if (passwordIssues.length) {
      setErrorMsg(passwordIssues.join(' '));
      setLoading(false);
      return;
    }

    try {
      const res = await registerUser({
        email,
        password,
        fullName,
        phone: phone.trim(),
        countryCode,
        dateOfBirth,
        role: 'MEMBER',
      });
      showToast(`Welcome, ${res.user.fullName}! Your account is ready.`, 'success');
      if (res.accessToken) {
        onClose();
      } else {
        setInfoMsg(
          res.message ||
            'Account created. Check your email for a verification link before signing in.',
        );
        setMode('login');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please check form inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error requesting password reset.');
      }
      // Sandbox shortcut only — live mode emails the reset link via Resend
      if (data.sandboxResetToken) {
        setResetToken(data.sandboxResetToken);
        setMode('reset');
        showToast('Password reset ready. Continue to set a new password.', 'info');
      } else {
        setInfoMsg(
          data.message ||
            'If that email is registered, you will receive password reset instructions shortly.',
        );
        showToast('Check your email for reset instructions.', 'info');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error resetting password.');
      }
      showToast('Password reset successfully! Please sign in with your new password.', 'success');
      setMode('login');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalMotion
      open={isOpen}
      onClose={onClose}
      labelledBy="auth-modal-title"
      panelClassName="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#DCE5E3] overflow-hidden my-8"
      overlayClassName="fixed inset-0 flex items-center justify-center p-4 bg-[#0E1B1F]/60 backdrop-blur-xs overflow-y-auto"
    >
        {/* Header Ribbon */}
        <div className="bg-[#0A3D3F] px-6 py-5 text-white flex items-center justify-between border-b border-[#072F30]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0F766E] flex items-center justify-center border border-[#F5B942]/30">
              <KeyRound className="w-4 h-4 text-[#F5B942]" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold font-display text-white">
                {mode === 'login' && t('auth.signInTitle')}
                {mode === 'register' && t('auth.registerTitle')}
                {mode === 'mfa_prompt' && t('auth.totpTitle')}
                {mode === 'forgot' && t('auth.resetPasswordTitle')}
                {mode === 'reset' && t('auth.confirmResetTitle')}
              </h2>
              {mode !== 'register' && (
                <p className="text-xs text-[#DCE5E3]/80">
                  {mode === 'login' && t('auth.signInSubtitle')}
                  {mode === 'mfa_prompt' &&
                    (isRecoveryCodeMode ? t('auth.recoveryCodeSubtitle') : t('auth.totpSubtitle'))}
                  {mode === 'forgot' && t('auth.resetPasswordSubtitle')}
                  {mode === 'reset' && 'Create a strong new password.'}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#DCE5E3] hover:text-white hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications & Error banner */}
        <div className="px-6 pt-4">
          {errorMsg && (
            <div className="p-3 mb-3 bg-[#FDF2F2] border border-[#D9383A]/30 text-[#D9383A] text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 mb-3 bg-[#EAF7EE] border border-[#107E54]/30 text-[#107E54] text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{infoMsg}</div>
            </div>
          )}
        </div>

        {/* Modal Form Bodies */}
        <div className="p-6 pt-2">
          {/* 1. SIGN IN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-[#0E1B1F]">
                    {t('auth.password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F5B942] hover:bg-[#F0D58A] text-[#0E1B1F] font-bold py-2.5 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{t('nav.login')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2 text-xs text-[#4A5B60]">
                <span>Don&apos;t have an account? </span>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-bold text-[#0A3D3F] hover:underline cursor-pointer"
                >
                  {t('nav.register')}
                </button>
              </div>
            </form>
          )}

          {/* 2. TWO-FACTOR AUTHENTICATION PROMPT */}
          {mode === 'mfa_prompt' && (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label htmlFor="totp-code" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  {isRecoveryCodeMode ? 'Emergency Recovery Code (8 Chars)' : '6-Digit TOTP Code'}
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-[#0F766E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="totp-code"
                    type="text"
                    required
                    autoFocus
                    maxLength={isRecoveryCodeMode ? 10 : 6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.toUpperCase())}
                    placeholder={isRecoveryCodeMode ? 'A1B2-C3D4' : '123456'}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-center text-lg font-mono font-bold tracking-widest text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsRecoveryCodeMode(!isRecoveryCodeMode);
                  setTotpCode('');
                }}
                className="text-xs font-semibold text-[#0F766E] hover:underline block cursor-pointer"
              >
                {isRecoveryCodeMode ? t('auth.useTotpCode') : t('auth.useRecoveryCode')}
              </button>

              <button
                type="submit"
                disabled={loading || !totpCode}
                className="w-full bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code & Sign In'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-semibold text-[#4A5B60] hover:text-[#0E1B1F] cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. REGISTRATION FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-semibold text-[#0E1B1F] mb-1">
                  {t('auth.fullName')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-10 pr-3 py-2 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-[#0E1B1F] mb-1">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    className="w-full pl-10 pr-3 py-2 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold text-[#0E1B1F] mb-1">
                  {t('auth.phone')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 415 555 0100"
                    className="w-full pl-10 pr-3 py-2 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-country" className="block text-xs font-semibold text-[#0E1B1F] mb-1">
                    {t('auth.country')}
                  </label>
                  <div className="relative">
                    <Globe2 className="w-4 h-4 text-[#4A5B60] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      id="reg-country"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full pl-9 pr-2 py-2 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-xs font-semibold text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px] cursor-pointer"
                    >
                      {[...registrationCountries]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.currency})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-dob" className="block text-xs font-semibold text-[#0E1B1F] mb-1">
                    Date of Birth (18+)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#4A5B60] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-dob"
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full pl-9 pr-2 py-2 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-xs font-medium text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-xs font-semibold text-[#0E1B1F] mb-1">
                  {t('auth.password')} (min 12 characters with upper, lower, number, symbol)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-3 py-2 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('nav.register')}
                </button>
              </div>

              <div className="text-center pt-2 text-xs text-[#4A5B60]">
                <span>Already registered? </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-bold text-[#0A3D3F] hover:underline cursor-pointer"
                >
                  {t('nav.login')}
                </button>
              </div>
            </form>
          )}

          {/* 4. FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#4A5B60] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition min-h-[44px] cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Reset Instructions'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-semibold text-[#4A5B60] hover:text-[#0E1B1F] cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 5. CONFIRM PASSWORD RESET FORM */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-new-password" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  {t('auth.newPassword')}
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2.5 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  {t('auth.confirmNewPassword')}
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2.5 bg-[#F4F7F6] border border-[#DCE5E3] rounded-xl text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] min-h-[44px]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F5B942] hover:bg-[#F0D58A] text-[#0E1B1F] font-bold py-2.5 px-4 rounded-xl shadow-xs transition min-h-[44px] cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Set New Password & Log In'}
              </button>
            </form>
          )}
        </div>
    </ModalMotion>
  );
};
