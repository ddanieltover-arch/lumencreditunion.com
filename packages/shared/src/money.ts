/**
 * Lumenfield Financial Money Utilities
 * HARD RULE 2: Money is strictly stored as integer minor units (cents/pence)
 * plus an ISO currency code. NEVER use floats for balance storage or math.
 */

import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR'] as const;
export const SupportedCurrencySchema = z.enum(SUPPORTED_CURRENCIES);
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  CAD: 'C$',
  GBP: '£',
  EUR: '€',
};

/** ISO countries that use EUR as local currency (subset used for home-wallet mapping). */
const EUR_COUNTRY_CODES = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU',
  'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
]);

/**
 * Map a member's signup country to a supported ledger wallet currency.
 * Uses the country's ISO-4217 code when it is USD/CAD/GBP/EUR; otherwise
 * applies regional defaults (eurozone → EUR, etc.), then USD.
 */
export function resolveHomeCurrency(
  countryCode?: string | null,
  isoCurrency?: string | null,
): SupportedCurrency {
  const iso = (isoCurrency || '').toUpperCase();
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(iso)) {
    return iso as SupportedCurrency;
  }
  const cc = (countryCode || '').toUpperCase();
  if (cc === 'US' || cc === 'PR' || cc === 'VI' || cc === 'GU' || cc === 'AS' || cc === 'MP') {
    return 'USD';
  }
  if (cc === 'CA') return 'CAD';
  if (cc === 'GB' || cc === 'IM' || cc === 'JE' || cc === 'GG') return 'GBP';
  if (EUR_COUNTRY_CODES.has(cc) || iso === 'EUR') return 'EUR';
  // Commonwealth / dollarized markets without a dedicated ledger → USD
  return 'USD';
}

export function currencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_SYMBOLS[currency] || `${currency} `;
}

export interface Money {
  /**
   * Amount represented strictly in minor units (e.g. 1000 = $10.00 / £10.00)
   * Must always be an integer (Math.floor/Math.round checked).
   */
  amountMinor: number;
  /**
   * 3-letter ISO-4217 Currency Code
   */
  currency: SupportedCurrency;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Validates that an amount is a strict safe integer minor unit.
 */
export function assertValidMinorUnits(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new MoneyError(`Floating point amounts are forbidden. Received: ${amount}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError(`Amount exceeds safe integer range: ${amount}`);
  }
}

/**
 * Creates a validated Money object in minor units.
 */
export function createMoney(amountMinor: number, currency: SupportedCurrency): Money {
  assertValidMinorUnits(amountMinor);
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new MoneyError(`Unsupported currency: ${currency}`);
  }
  return { amountMinor, currency };
}

/**
 * Converts user decimal input string (e.g. "120.50") into integer minor units (12050).
 * Rejects numbers with more decimal places than allowed (2 decimal places).
 */
export function parseMajorToMinor(input: string | number, currency: SupportedCurrency = 'USD'): Money {
  const str = typeof input === 'number' ? input.toString() : input.trim();
  if (!str) {
    throw new MoneyError('Cannot parse empty money string');
  }

  // Ensure valid format: optional minus, digits, optional dot with up to 2 decimal digits
  const regex = /^-?\d+(\.\d{1,2})?$/;
  if (!regex.test(str)) {
    throw new MoneyError(`Invalid monetary string format: "${str}". Maximum 2 decimal places allowed.`);
  }

  const [whole, fractional = ''] = str.split('.');
  const paddedFraction = fractional.padEnd(2, '0');
  const isNegative = whole.startsWith('-');
  const rawWhole = isNegative ? whole.slice(1) : whole;

  const combined = BigInt(rawWhole) * 100n + BigInt(paddedFraction);
  const minorInt = Number(combined) * (isNegative ? -1 : 1);

  assertValidMinorUnits(minorInt);
  return createMoney(minorInt, currency);
}

/**
 * Formats minor units integer into a human-readable string with currency symbol.
 */
export function formatMoney(money: Money): string {
  assertValidMinorUnits(money.amountMinor);

  const isNegative = money.amountMinor < 0;
  const absMinor = Math.abs(money.amountMinor);
  const major = Math.floor(absMinor / 100);
  const minor = absMinor % 100;
  const formattedNumber = `${major.toLocaleString('en-US')}.${minor.toString().padStart(2, '0')}`;
  const symbol = currencySymbol(money.currency);

  return `${isNegative ? '-' : ''}${symbol}${formattedNumber}`;
}

/**
 * Adds two money values of the exact same currency.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: cannot add ${a.currency} to ${b.currency}`);
  }
  const result = a.amountMinor + b.amountMinor;
  assertValidMinorUnits(result);
  return { amountMinor: result, currency: a.currency };
}

/**
 * Subtracts money b from money a of the exact same currency.
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: cannot subtract ${b.currency} from ${a.currency}`);
  }
  const result = a.amountMinor - b.amountMinor;
  assertValidMinorUnits(result);
  return { amountMinor: result, currency: a.currency };
}
