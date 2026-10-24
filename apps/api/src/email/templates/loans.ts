import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type Base = { appUrl: string; supportEmail: string; fullName: string };

export function loanSubmittedEmail(
  base: Base,
  details: { loanType: string; amountFormatted: string; termMonths: number },
): RenderedEmail {
  return buildEmail('Loan application submitted', {
    ...base,
    preheader: `Your ${details.loanType} application is under review.`,
    headline: 'Application submitted',
    greetingName: base.fullName,
    paragraphs: [
      `Your ${details.loanType} loan application for ${details.amountFormatted} has been submitted for underwriting.`,
    ],
    details: [
      { label: 'Type', value: details.loanType },
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Term', value: `${details.termMonths} months` },
      { label: 'Status', value: 'Under review' },
    ],
    cta: { label: 'Track application', url: `${base.appUrl}/` },
  });
}

export function loanUnderReviewEmail(
  base: Base,
  details: { amountFormatted: string },
): RenderedEmail {
  return buildEmail('Loan application under review', {
    ...base,
    preheader: 'Underwriting is reviewing your application.',
    headline: 'Under review',
    greetingName: base.fullName,
    paragraphs: [
      `Your loan application for ${details.amountFormatted} is actively under review. We will email you when a decision is ready.`,
    ],
    cta: { label: 'Track application', url: `${base.appUrl}/` },
  });
}

export function loanApprovedEmail(
  base: Base,
  details: { amountFormatted: string },
): RenderedEmail {
  return buildEmail('Loan approved and disbursed', {
    ...base,
    preheader: `${details.amountFormatted} approved and funded to your wallet.`,
    headline: 'Loan approved',
    greetingName: base.fullName,
    paragraphs: [
      `Congratulations! Your loan of ${details.amountFormatted} has been approved and disbursed to your wallet.`,
    ],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
  });
}

export function loanRejectedEmail(
  base: Base,
  details: { amountFormatted: string; reason?: string },
): RenderedEmail {
  return buildEmail('Loan application decision', {
    ...base,
    preheader: 'Your loan application was not approved.',
    headline: 'Loan application update',
    greetingName: base.fullName,
    paragraphs: [
      `Your loan application for ${details.amountFormatted} could not be approved at this time based on underwriting criteria.`,
    ],
    details: details.reason
      ? [{ label: 'Note', value: details.reason }]
      : undefined,
    cta: { label: 'Contact Member Services', url: `${base.appUrl}/contact` },
  });
}
