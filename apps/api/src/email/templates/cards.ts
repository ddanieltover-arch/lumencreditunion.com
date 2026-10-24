import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

type Base = { appUrl: string; supportEmail: string; fullName: string };

export function cardCreatedEmail(
  base: Base,
  details: { lastFour: string; currency: string },
): RenderedEmail {
  return buildEmail('Virtual card created', {
    ...base,
    preheader: `Your ${details.currency} virtual card ending in ${details.lastFour} is ready.`,
    headline: 'Virtual card created',
    greetingName: base.fullName,
    paragraphs: [
      `Your ${details.currency} virtual card ending in ${details.lastFour} is active.`,
      'For security, the full card number and CVV were shown only once in the app and are never sent by email.',
    ],
    cta: { label: 'Manage cards', url: `${base.appUrl}/` },
  });
}

export function cardFrozenEmail(
  base: Base,
  details: { lastFour: string },
): RenderedEmail {
  return buildEmail('Virtual card frozen', {
    ...base,
    preheader: `Card •••• ${details.lastFour} is frozen.`,
    headline: 'Card frozen',
    greetingName: base.fullName,
    paragraphs: [
      `Your virtual card ending in ${details.lastFour} has been frozen. All purchases will be declined until you unfreeze it.`,
    ],
    cta: { label: 'Manage card', url: `${base.appUrl}/` },
  });
}

export function cardUnfrozenEmail(
  base: Base,
  details: { lastFour: string },
): RenderedEmail {
  return buildEmail('Virtual card unfrozen', {
    ...base,
    preheader: `Card •••• ${details.lastFour} is active again.`,
    headline: 'Card unfrozen',
    greetingName: base.fullName,
    paragraphs: [
      `Your virtual card ending in ${details.lastFour} is active again and ready for purchases.`,
    ],
    cta: { label: 'Manage card', url: `${base.appUrl}/` },
  });
}

export function cardLimitsUpdatedEmail(
  base: Base,
  details: {
    lastFour: string;
    dailyLimitFormatted: string;
    monthlyLimitFormatted: string;
  },
): RenderedEmail {
  return buildEmail('Card spending limits updated', {
    ...base,
    preheader: `Limits updated for card •••• ${details.lastFour}.`,
    headline: 'Spending limits updated',
    greetingName: base.fullName,
    paragraphs: [
      `Spending limits for your virtual card ending in ${details.lastFour} were updated.`,
    ],
    details: [
      { label: 'Daily limit', value: details.dailyLimitFormatted },
      { label: 'Monthly limit', value: details.monthlyLimitFormatted },
    ],
    cta: { label: 'View card settings', url: `${base.appUrl}/` },
  });
}

export function cardPurchaseApprovedEmail(
  base: Base,
  details: { amountFormatted: string; merchant: string; lastFour: string },
): RenderedEmail {
  return buildEmail('Card purchase approved', {
    ...base,
    preheader: `${details.amountFormatted} at ${details.merchant}.`,
    headline: 'Purchase approved',
    greetingName: base.fullName,
    paragraphs: [
      `${details.amountFormatted} was authorized at ${details.merchant} on virtual card •••• ${details.lastFour}.`,
    ],
    cta: { label: 'View transactions', url: `${base.appUrl}/` },
  });
}

export function cardPurchaseDeclinedEmail(
  base: Base,
  details: { amountFormatted: string; merchant: string; reason: string },
): RenderedEmail {
  return buildEmail('Card purchase declined', {
    ...base,
    preheader: `Purchase declined at ${details.merchant}.`,
    headline: 'Purchase declined',
    greetingName: base.fullName,
    paragraphs: [
      `A purchase of ${details.amountFormatted} at ${details.merchant} was declined.`,
    ],
    details: [{ label: 'Reason', value: details.reason }],
    cta: { label: 'Review card', url: `${base.appUrl}/` },
  });
}
