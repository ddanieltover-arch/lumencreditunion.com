import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type Base = { appUrl: string; supportEmail: string; fullName: string };

export function transferSentEmail(
  base: Base,
  details: { amountFormatted: string; recipient: string; reference: string },
): RenderedEmail {
  return buildEmail('Transfer sent', {
    ...base,
    preheader: `You sent ${details.amountFormatted} to ${details.recipient}.`,
    headline: 'Transfer sent',
    greetingName: base.fullName,
    paragraphs: [`You sent ${details.amountFormatted} to ${details.recipient}.`],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Recipient', value: details.recipient },
      { label: 'Reference', value: details.reference },
    ],
    cta: { label: 'View receipt', url: `${base.appUrl}/` },
  });
}

export function transferReceivedEmail(
  base: Base,
  details: { amountFormatted: string; sender: string; reference: string },
): RenderedEmail {
  return buildEmail('Funds received', {
    ...base,
    preheader: `You received ${details.amountFormatted}.`,
    headline: 'Funds received',
    greetingName: base.fullName,
    paragraphs: [`You received ${details.amountFormatted} from ${details.sender}.`],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'From', value: details.sender },
      { label: 'Reference', value: details.reference },
    ],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
  });
}

export function beneficiaryAddedEmail(
  base: Base,
  details: { name: string; countryCode: string; coolingHours: number },
): RenderedEmail {
  return buildEmail('New beneficiary added', {
    ...base,
    preheader: `${details.name} added — cooling-off period active.`,
    headline: 'Beneficiary added',
    greetingName: base.fullName,
    paragraphs: [
      `${details.name} (${details.countryCode}) was added to your beneficiaries. A ${details.coolingHours}-hour security cooling-off period is active before bank transfers are allowed.`,
    ],
    cta: { label: 'View beneficiaries', url: `${base.appUrl}/` },
  });
}

export function beneficiaryReadyEmail(
  base: Base,
  details: { name: string },
): RenderedEmail {
  return buildEmail('Beneficiary ready for transfers', {
    ...base,
    preheader: `${details.name} cooling-off period has ended.`,
    headline: 'Beneficiary ready',
    greetingName: base.fullName,
    paragraphs: [
      `The security cooling-off period for ${details.name} has ended. You can now send bank transfers to this beneficiary.`,
    ],
    cta: { label: 'Send bank transfer', url: `${base.appUrl}/` },
  });
}

export function bankTransferInitiatedEmail(
  base: Base,
  details: { amountFormatted: string; beneficiary: string; reference: string },
): RenderedEmail {
  return buildEmail('Bank transfer initiated', {
    ...base,
    preheader: `${details.amountFormatted} to ${details.beneficiary} is pending clearing.`,
    headline: 'Bank transfer pending',
    greetingName: base.fullName,
    paragraphs: [
      `Your bank transfer of ${details.amountFormatted} to ${details.beneficiary} is now pending external clearing.`,
    ],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Beneficiary', value: details.beneficiary },
      { label: 'Reference', value: details.reference },
      { label: 'Status', value: 'PENDING' },
    ],
    cta: { label: 'Track transfer', url: `${base.appUrl}/` },
  });
}

export function bankTransferClearedEmail(
  base: Base,
  details: { amountFormatted: string; reference: string },
): RenderedEmail {
  return buildEmail('Bank transfer cleared', {
    ...base,
    preheader: `Transfer ${details.reference} completed.`,
    headline: 'Bank transfer cleared',
    greetingName: base.fullName,
    paragraphs: [
      `Bank transfer ${details.reference} (${details.amountFormatted}) has completed external clearing.`,
    ],
    cta: { label: 'View receipt', url: `${base.appUrl}/` },
  });
}

export function bankTransferFailedEmail(
  base: Base,
  details: { amountFormatted: string; reference: string; reason: string },
): RenderedEmail {
  return buildEmail('Bank transfer failed — funds refunded', {
    ...base,
    preheader: `Transfer ${details.reference} failed and was refunded.`,
    headline: 'Bank transfer failed',
    greetingName: base.fullName,
    paragraphs: [
      `Transfer ${details.reference} failed. ${details.amountFormatted} has been credited back to your wallet.`,
    ],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Reference', value: details.reference },
      { label: 'Reason', value: details.reason },
    ],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
  });
}

export function transferFlaggedMemberEmail(
  base: Base,
  details: { amountFormatted: string; reference: string },
): RenderedEmail {
  return buildEmail('Transfer under review', {
    ...base,
    preheader: `Transfer ${details.reference} was flagged for compliance review.`,
    headline: 'Transfer under review',
    greetingName: base.fullName,
    paragraphs: [
      `Your transfer of ${details.amountFormatted} (${details.reference}) was flagged for compliance review. We will notify you when a decision is made.`,
    ],
    cta: { label: 'Track transfer', url: `${base.appUrl}/` },
  });
}

export function transferFlagClearedEmail(
  base: Base,
  details: { reference: string },
): RenderedEmail {
  return buildEmail('Flagged transfer cleared', {
    ...base,
    preheader: `Transfer ${details.reference} was cleared by compliance.`,
    headline: 'Transfer cleared',
    greetingName: base.fullName,
    paragraphs: [
      `Compliance has cleared transfer ${details.reference}. You can continue using your account as usual.`,
    ],
    cta: { label: 'View transfer', url: `${base.appUrl}/` },
  });
}

export function transferFlagRejectedEmail(
  base: Base,
  details: { reference: string; reason: string },
): RenderedEmail {
  return buildEmail('Flagged transfer rejected', {
    ...base,
    preheader: `Transfer ${details.reference} was rejected by compliance.`,
    headline: 'Transfer rejected',
    greetingName: base.fullName,
    paragraphs: [
      `Compliance rejected transfer ${details.reference}. Any reserved funds have been handled according to clearing rules.`,
    ],
    details: [{ label: 'Reason', value: details.reason }],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
    secondaryLinks: [
      { label: 'Contact support', url: `${base.appUrl}/contact` },
    ],
  });
}

export function cryptoDepositEmail(
  base: Base,
  details: { amountFormatted: string; network: string },
): RenderedEmail {
  return buildEmail('Crypto deposit credited', {
    ...base,
    preheader: `${details.amountFormatted} credited via ${details.network}.`,
    headline: 'Crypto deposit credited',
    greetingName: base.fullName,
    paragraphs: [
      `A deposit of ${details.amountFormatted} via ${details.network} has been credited to your wallet.`,
    ],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
  });
}

export function cryptoWithdrawalEmail(
  base: Base,
  details: { amountFormatted: string; network: string; txHashShort: string },
): RenderedEmail {
  return buildEmail('Crypto withdrawal completed', {
    ...base,
    preheader: `${details.amountFormatted} withdrawn via ${details.network}.`,
    headline: 'Crypto withdrawal completed',
    greetingName: base.fullName,
    paragraphs: [
      `Your withdrawal of ${details.amountFormatted} via ${details.network} completed.`,
    ],
    details: [
      { label: 'Network', value: details.network },
      { label: 'Tx hash', value: details.txHashShort },
    ],
    cta: { label: 'View receipt', url: `${base.appUrl}/` },
  });
}
