import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type Base = { appUrl: string; supportEmail: string; fullName: string };

export function kycSubmittedEmail(
  base: Base,
  documentType: string,
): RenderedEmail {
  return buildEmail('Identity verification submitted', {
    ...base,
    preheader: 'We received your identity documents.',
    headline: 'Verification submitted',
    greetingName: base.fullName,
    paragraphs: [
      `Your ${documentType} has been securely uploaded. Our compliance team will review your credentials shortly.`,
    ],
    cta: { label: 'View verification status', url: `${base.appUrl}/` },
  });
}

export function kycApprovedEmail(base: Base): RenderedEmail {
  return buildEmail('Identity verification approved', {
    ...base,
    preheader: 'Your KYC is approved — full capabilities unlocked.',
    headline: 'Identity verified',
    greetingName: base.fullName,
    paragraphs: [
      'Congratulations! Your identity credentials have been verified. Wallets, transfers, virtual cards, and loans are now unlocked.',
    ],
    cta: { label: 'Explore your dashboard', url: `${base.appUrl}/` },
  });
}

export function kycRejectedEmail(base: Base, reason: string): RenderedEmail {
  return buildEmail('Identity verification declined', {
    ...base,
    preheader: 'Your KYC submission needs attention.',
    headline: 'Verification declined',
    greetingName: base.fullName,
    paragraphs: [
      'Your identity verification was declined. Please review the requirements and submit updated documentation.',
    ],
    details: [{ label: 'Reason', value: reason }],
    cta: { label: 'Resubmit documents', url: `${base.appUrl}/` },
  });
}

export function kycNeedsMoreInfoEmail(
  base: Base,
  reason: string,
): RenderedEmail {
  return buildEmail('Additional identity information required', {
    ...base,
    preheader: 'Compliance needs more information to finish verification.',
    headline: 'More information needed',
    greetingName: base.fullName,
    paragraphs: [
      'Our compliance team needs additional information to complete your identity verification.',
    ],
    details: [{ label: 'Request', value: reason }],
    cta: { label: 'Upload requested documents', url: `${base.appUrl}/` },
  });
}
