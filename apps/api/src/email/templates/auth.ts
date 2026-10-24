import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type Base = { appUrl: string; supportEmail: string; fullName: string };

export function verificationEmail(
  base: Base,
  token: string,
): RenderedEmail {
  const url = `${base.appUrl}/?verifyEmail=${encodeURIComponent(token)}`;
  return buildEmail('Verify your Lumenfield Credit Union email', {
    ...base,
    preheader: 'Confirm your email to activate your account.',
    headline: 'Verify your email',
    greetingName: base.fullName,
    paragraphs: [
      'Confirm your email address to activate your Lumenfield Credit Union account.',
      'This link expires in 24 hours.',
    ],
    cta: { label: 'Verify email', url },
    securityNote: 'If you did not create this account, you can ignore this email.',
  });
}

export function welcomeEmail(base: Base): RenderedEmail {
  return buildEmail('Welcome to Lumenfield Credit Union', {
    ...base,
    preheader: 'Your email is verified. Your member account is ready.',
    headline: 'Welcome aboard',
    greetingName: base.fullName,
    paragraphs: [
      'Your email has been verified and your Lumenfield member account is active.',
      'Next, complete identity verification to unlock wallets, transfers, virtual cards, and loans.',
    ],
    cta: { label: 'Open member dashboard', url: `${base.appUrl}/` },
    secondaryLinks: [
      { label: 'Contact support', url: `${base.appUrl}/contact` },
    ],
  });
}

export function passwordResetRequestEmail(
  base: Base,
  token: string,
): RenderedEmail {
  const url = `${base.appUrl}/?resetToken=${encodeURIComponent(token)}`;
  return buildEmail('Reset your Lumenfield Credit Union password', {
    ...base,
    preheader: 'Password reset link — valid for 1 hour.',
    headline: 'Password reset',
    greetingName: base.fullName,
    paragraphs: [
      'We received a request to reset your password. This link expires in 1 hour.',
    ],
    cta: { label: 'Reset password', url },
    securityNote: 'If you did not request a reset, no action is needed.',
  });
}

export function passwordResetConfirmedEmail(base: Base): RenderedEmail {
  return buildEmail('Your Lumenfield password was reset', {
    ...base,
    preheader: 'Your password was changed successfully.',
    headline: 'Password reset confirmed',
    greetingName: base.fullName,
    paragraphs: [
      'Your password has been reset successfully. All previous sessions have been signed out for your security.',
      'You can sign in now with your new password.',
    ],
    cta: { label: 'Sign in', url: `${base.appUrl}/` },
    securityNote:
      'If you did not reset your password, contact Member Services immediately.',
  });
}

export function passwordChangedEmail(base: Base): RenderedEmail {
  return buildEmail('Your Lumenfield password was changed', {
    ...base,
    preheader: 'Security notice: password updated on your account.',
    headline: 'Password changed',
    greetingName: base.fullName,
    paragraphs: [
      'Your account password was changed from Security settings. Other active sessions were signed out.',
    ],
    cta: { label: 'Review security settings', url: `${base.appUrl}/` },
    securityNote:
      'If you did not make this change, reset your password and contact support.',
  });
}

export function accountLockedEmail(
  base: Base,
  minutesLocked: number,
): RenderedEmail {
  return buildEmail('Your Lumenfield account is temporarily locked', {
    ...base,
    preheader: 'Too many failed sign-in attempts.',
    headline: 'Account temporarily locked',
    greetingName: base.fullName,
    paragraphs: [
      `Your account was locked after repeated failed sign-in attempts. Please wait about ${minutesLocked} minute(s) before trying again, or reset your password.`,
    ],
    cta: { label: 'Reset password', url: `${base.appUrl}/` },
    securityNote:
      'If this was not you, reset your password and enable two-factor authentication.',
  });
}

export function newLoginEmail(
  base: Base,
  details: { deviceInfo: string; ipAddress: string; when: string },
): RenderedEmail {
  return buildEmail('New sign-in to your Lumenfield account', {
    ...base,
    preheader: 'We noticed a new sign-in on your account.',
    headline: 'New sign-in detected',
    greetingName: base.fullName,
    paragraphs: [
      'A new session was created on your Lumenfield account. If this was you, no action is needed.',
    ],
    details: [
      { label: 'Device', value: details.deviceInfo },
      { label: 'IP address', value: details.ipAddress },
      { label: 'Time (UTC)', value: details.when },
    ],
    cta: { label: 'Review active sessions', url: `${base.appUrl}/` },
    securityNote:
      'If this was not you, change your password and revoke unfamiliar sessions immediately.',
  });
}

export function sessionRevokedEmail(
  base: Base,
  reason: string,
): RenderedEmail {
  return buildEmail('Security alert: Lumenfield session revoked', {
    ...base,
    preheader: 'A session on your account was revoked for security.',
    headline: 'Session revoked',
    greetingName: base.fullName,
    paragraphs: [
      'A session on your account was revoked for security reasons.',
      reason,
    ],
    cta: { label: 'Sign in securely', url: `${base.appUrl}/` },
    securityNote:
      'If you did not expect this, reset your password and contact Member Services.',
  });
}

export function mfaEnabledEmail(base: Base): RenderedEmail {
  return buildEmail('Two-factor authentication enabled', {
    ...base,
    preheader: 'Your Lumenfield account is more secure.',
    headline: 'Two-factor authentication enabled',
    greetingName: base.fullName,
    paragraphs: [
      'Authenticator-based two-factor authentication is now enabled on your account. Keep your recovery codes in a safe place.',
    ],
    cta: { label: 'Manage security', url: `${base.appUrl}/` },
  });
}

export function mfaDisabledEmail(base: Base): RenderedEmail {
  return buildEmail('Two-factor authentication disabled', {
    ...base,
    preheader: 'MFA was turned off on your Lumenfield account.',
    headline: 'Two-factor authentication disabled',
    greetingName: base.fullName,
    paragraphs: [
      'Two-factor authentication was disabled on your account. We recommend re-enabling it for stronger protection.',
    ],
    cta: { label: 'Re-enable MFA', url: `${base.appUrl}/` },
    securityNote:
      'If you did not disable MFA, secure your account immediately.',
  });
}

export function accountDeletionScheduledEmail(
  base: Base,
  purgeDateIso: string,
): RenderedEmail {
  return buildEmail('Account deletion scheduled', {
    ...base,
    preheader: 'Your Lumenfield deletion request is confirmed.',
    headline: 'Deletion request received',
    greetingName: base.fullName,
    paragraphs: [
      'We received your request to delete your Lumenfield Credit Union account in accordance with GDPR/CCPA.',
      'Your account will remain in a holding period before permanent erasure. Contact Member Services if you wish to cancel.',
    ],
    details: [{ label: 'Scheduled purge (UTC)', value: purgeDateIso }],
    cta: { label: 'Contact Member Services', url: `${base.appUrl}/contact` },
  });
}

export function dataExportReadyEmail(base: Base): RenderedEmail {
  return buildEmail('Your Lumenfield data export is ready', {
    ...base,
    preheader: 'Your personal data archive download was prepared.',
    headline: 'Data export ready',
    greetingName: base.fullName,
    paragraphs: [
      'Your GDPR/CCPA personal data export was generated. If your browser did not download the file, sign in and request the export again from Settings.',
    ],
    cta: { label: 'Open settings', url: `${base.appUrl}/` },
  });
}
