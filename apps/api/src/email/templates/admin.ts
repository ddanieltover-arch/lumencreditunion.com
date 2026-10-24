import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type AdminBase = { appUrl: string; supportEmail: string };

export function adminNewKycEmail(
  base: AdminBase,
  details: { memberName: string; memberEmail: string; documentType: string; submissionId: string },
): RenderedEmail {
  return buildEmail('Admin: new KYC submission', {
    ...base,
    preheader: `${details.memberName} submitted identity documents.`,
    headline: 'New identity review',
    paragraphs: [
      'A member submitted identity documents for compliance review.',
    ],
    details: [
      { label: 'Member', value: details.memberName },
      { label: 'Email', value: details.memberEmail },
      { label: 'Document', value: details.documentType },
      { label: 'Submission ID', value: details.submissionId },
    ],
    cta: { label: 'Open admin portal', url: `${base.appUrl}/` },
  });
}

export function adminNewLoanEmail(
  base: AdminBase,
  details: {
    memberName: string;
    loanType: string;
    amountFormatted: string;
    loanId: string;
  },
): RenderedEmail {
  return buildEmail('Admin: new loan application', {
    ...base,
    preheader: `${details.memberName} applied for a ${details.loanType} loan.`,
    headline: 'New loan application',
    paragraphs: ['A member submitted a loan application for underwriting.'],
    details: [
      { label: 'Member', value: details.memberName },
      { label: 'Type', value: details.loanType },
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Application ID', value: details.loanId },
    ],
    cta: { label: 'Open underwriting queue', url: `${base.appUrl}/` },
  });
}

export function adminDualApprovalPendingEmail(
  base: AdminBase,
  details: {
    amountFormatted: string;
    reference: string;
    memberId: string;
    transactionId: string;
  },
): RenderedEmail {
  return buildEmail('Admin: funding awaits second approval', {
    ...base,
    preheader: `${details.amountFormatted} funding requires dual-control approval.`,
    headline: 'Dual-control approval required',
    paragraphs: [
      'A wallet funding transaction is pending second-approver dual-control review.',
    ],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Reference', value: details.reference },
      { label: 'Member ID', value: details.memberId },
      { label: 'Transaction ID', value: details.transactionId },
    ],
    cta: { label: 'Review in admin portal', url: `${base.appUrl}/` },
  });
}

export function adminFlaggedTransferEmail(
  base: AdminBase,
  details: {
    amountFormatted: string;
    reference: string;
    flags: string;
    transferId: string;
  },
): RenderedEmail {
  return buildEmail('Admin: flagged transfer review', {
    ...base,
    preheader: `Transfer ${details.reference} flagged for fraud review.`,
    headline: 'Flagged transfer',
    paragraphs: [
      'A member transfer was flagged and requires Super Admin adjudication.',
    ],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Reference', value: details.reference },
      { label: 'Flags', value: details.flags },
      { label: 'Transfer ID', value: details.transferId },
    ],
    cta: { label: 'Open fraud review queue', url: `${base.appUrl}/` },
  });
}
