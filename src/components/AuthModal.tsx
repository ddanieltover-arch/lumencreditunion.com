import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
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
import { t } from '../../apps/web/src/translations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { countries, showToast, loginUser, registerUser, completeMfaLogin, currentUser } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset' | 'mfa_prompt'>(
    initialMode,
  );

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [dateOfBirth, setDateOfBirth] = useState('1995-05-15');
  const [totpCode, setTotpCode] = useState('');
  const [mfaTicket, setMfaTicket] = useState('');
  const [sandboxMfaHint, setSandboxMfaHint] = useState<{ totpCode?: string; recoveryCodes?: string[] } | null>(null);
  const [isRecoveryCodeMode, setIsRecoveryCodeMode] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState<number | null>(null);

  if (!isOpen) return null;

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
        if (res.sandboxMfaHint) {
          setSandboxMfaHint(res.sandboxMfaHint);
        }
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

    try {
      const res = await registerUser({
        email,
        password,
        fullName,
        countryCode,
        dateOfBirth,
        role: 'MEMBER',
      });
      showToast(`Account registered successfully for ${res.user.fullName}!`, 'success');
      setInfoMsg('Account created! In sandbox simulation, your email has been automatically verified.');
      setMode('login');
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
      if (data.sandboxResetToken) {
        setResetToken(data.sandboxResetToken);
        setMode('reset');
        showToast('Password reset token generated (Sandbox mode).', 'info');
      } else {
        setInfoMsg(data.message || 'Password reset link dispatched.');
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1B1F]/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#DCE5E3] overflow-hidden my-8">
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
              <p className="text-xs text-[#DCE5E3]/80">
                {mode === 'login' && t('auth.signInSubtitle')}
                {mode === 'register' && t('auth.registerSubtitle')}
                {mode === 'mfa_prompt' && (isRecoveryCodeMode ? t('auth.recoveryCodeSubtitle') : t('auth.totpSubtitle'))}
                {mode === 'forgot' && t('auth.resetPasswordSubtitle')}
                {mode === 'reset' && 'Create a strong new password.'}
              </p>
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

        {/* Persistent Sandbox Warning inside modal */}
        <div className="bg-[#FFF1CC] px-4 py-2 text-[11px] font-medium text-[#5A4100] border-b border-[#F0D58A] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F5B942] shrink-0" />
          <span>Sandbox mode: all accounts and credentials operate on test funds only.</span>
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
                    placeholder="member@lumenfield.test"
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

              {/* Demo Quick Logins */}
              <div className="mt-4 pt-4 border-t border-[#DCE5E3] text-xs">
                <p className="text-[#4A5B60] mb-2 font-medium">Quick Sandbox Logins:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('amara.o@lumenfield.test');
                      setPassword('Password123!@#');
                    }}
                    className="p-2 text-left rounded-lg border border-[#DCE5E3] hover:bg-[#F4F7F6] transition text-[11px] cursor-pointer"
                  >
                    <span className="font-bold block text-[#0E1B1F]">Amara O. (US)</span>
                    <span className="text-[#4A5B60]">Role: MEMBER</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@lumenfield.internal');
                      setPassword('LumenAdmin2026!#Secure');
                    }}
                    className="p-2 text-left rounded-lg border border-[#F5B942] bg-[#FFF1CC]/40 hover:bg-[#FFF1CC] transition text-[11px] cursor-pointer"
                  >
                    <span className="font-bold block text-[#0E1B1F]">Admin Console</span>
                    <span className="text-[#5A4100]">SUPER_ADMIN (MFA)</span>
                  </button>
                </div>
              </div>

              <div className="text-center pt-2 text-xs text-[#4A5B60]">
                <span>Don't have a test account? </span>
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
              {/* Sandbox MFA Assistant Banner */}
              {sandboxMfaHint && (
                <div className="p-3 bg-[#FFF1CC] border border-[#F0D58A] rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#5A4100]">
                    <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
                    <span>Sandbox MFA Assistant (Simulated Authenticator)</span>
                  </div>
                  {sandboxMfaHint.totpCode && (
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-[#F0D58A]">
                      <span className="text-[#4A5B60] text-[11px]">Current 6-Digit TOTP:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecoveryCodeMode(false);
                          setTotpCode(sandboxMfaHint.totpCode || '');
                        }}
                        className="font-mono font-bold text-[#0A3D3F] hover:underline cursor-pointer bg-[#F4F7F6] px-2 py-0.5 rounded text-xs"
                      >
                        {sandboxMfaHint.totpCode} (Click to fill)
                      </button>
                    </div>
                  )}
                  {sandboxMfaHint.recoveryCodes && sandboxMfaHint.recoveryCodes.length > 0 && (
                    <div className="text-[11px] text-[#5A4100]">
                      <span className="block font-semibold mb-1">Emergency Recovery Codes:</span>
                      <div className="grid grid-cols-2 gap-1 font-mono">
                        {sandboxMfaHint.recoveryCodes.slice(0, 2).map((code, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setIsRecoveryCodeMode(true);
                              setTotpCode(code);
                            }}
                            className="bg-white hover:bg-white/80 border border-[#F0D58A] p-1 rounded text-center text-[10px] font-bold text-[#0E1B1F] cursor-pointer"
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                      {registrationCountries.map((c) => (
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
      </div>
    </div>
  );
};
