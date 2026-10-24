import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type Base = { appUrl: string; supportEmail: string; fullName: string };

export function walletFundedEmail(
  base: Base,
  details: { amountFormatted: string; currency: string; reference: string; reason?: string },
): RenderedEmail {
  return buildEmail('Your Lumenfield wallet was funded', {
    ...base,
    preheader: `${details.amountFormatted} credited to your ${details.currency} wallet.`,
    headline: 'Wallet funded',
    greetingName: base.fullName,
    paragraphs: [
      `An administrator credited ${details.amountFormatted} to your ${details.currency} wallet.`,
    ],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Currency', value: details.currency },
      { label: 'Reference', value: details.reference },
      ...(details.reason ? [{ label: 'Reason', value: details.reason }] : []),
    ],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
  });
}

export function dualApprovalPostedEmail(
  base: Base,
  details: { amountFormatted: string; reference: string },
): RenderedEmail {
  return buildEmail('Funding approved and posted', {
    ...base,
    preheader: 'Dual-control funding has been posted to your wallet.',
    headline: 'Funding posted',
    greetingName: base.fullName,
    paragraphs: [
      'A pending wallet funding that required dual-control approval has been posted to your account.',
    ],
    details: [
      { label: 'Amount', value: details.amountFormatted },
      { label: 'Reference', value: details.reference },
    ],
    cta: { label: 'View wallet', url: `${base.appUrl}/` },
  });
}

export function currencySwapEmail(
  base: Base,
  details: {
    fromAmount: string;
    toAmount: string;
    fromCurrency: string;
    toCurrency: string;
  },
): RenderedEmail {
  return buildEmail('Currency swap completed', {
    ...base,
    preheader: `Converted ${details.fromAmount} ${details.fromCurrency} → ${details.toAmount} ${details.toCurrency}.`,
    headline: 'Currency swap completed',
    greetingName: base.fullName,
    paragraphs: ['Your currency conversion has been applied to your wallets.'],
    details: [
      { label: 'From', value: `${details.fromAmount} ${details.fromCurrency}` },
      { label: 'To', value: `${details.toAmount} ${details.toCurrency}` },
    ],
    cta: { label: 'View wallets', url: `${base.appUrl}/` },
  });
}

export function statementReadyEmail(
  base: Base,
  currency?: string,
): RenderedEmail {
  return buildEmail('Your Lumenfield statement is ready', {
    ...base,
    preheader: 'Your account statement export is available.',
    headline: 'Statement ready',
    greetingName: base.fullName,
    paragraphs: [
      currency
        ? `Your ${currency} account statement export was prepared. Sign in to download CSV or printable HTML from your wallet.`
        : 'Your account statement export was prepared. Sign in to download CSV or printable HTML from your wallet.',
    ],
    cta: { label: 'Download statement', url: `${base.appUrl}/` },
  });
}
