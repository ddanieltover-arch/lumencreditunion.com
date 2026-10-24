import type { BankDetails, BankIdentity } from './types';
import {
  buildClabe,
  buildIban,
  computeLuhnCheckDigit,
  isValidAbaRouting,
  isValidClabe,
  isValidIban,
} from './check-digits';
import { IBAN_LENGTHS, IBAN_SANDBOX_BANK_PREFIX, ibanBbanLength } from './iban-registry';
import { resolveBankScheme, SANDBOX_INSTITUTIONS } from './national-schemes';

export function normalizeBankIdentity(raw: string): string {
  return raw.replace(/[\s\-./]/g, '').toUpperCase();
}

export function formatIbanDisplay(iban: string): string {
  const clean = normalizeBankIdentity(iban);
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

export function formatSortCodeDisplay(sortCode: string): string {
  const d = sortCode.replace(/\D/g, '');
  if (d.length !== 6) return sortCode;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

function padAccount(sequence: number, length: number): string {
  if (sequence < 0) throw new Error('sequence must be non-negative');
  const max = 10 ** length;
  const n = sequence % max;
  return n.toString().padStart(length, '0');
}

/** Build BBAN of exact length from sandbox prefix + numeric account sequence. */
function buildBban(countryCode: string, sequence: number): string {
  const cc = countryCode.toUpperCase();
  const bbanLen = ibanBbanLength(cc);
  const prefix = IBAN_SANDBOX_BANK_PREFIX[cc] ?? 'LF';
  if (prefix.length >= bbanLen) {
    return (prefix.slice(0, bbanLen - 1) + padAccount(sequence, 1)).slice(0, bbanLen);
  }
  const accountLen = bbanLen - prefix.length;
  return (prefix + padAccount(sequence, accountLen)).slice(0, bbanLen);
}

function generateIbanIdentity(countryCode: string, sequence: number): BankIdentity {
  const cc = countryCode.toUpperCase();
  const bban = buildBban(cc, sequence);
  const iban = buildIban(cc, bban);
  const expectedLen = IBAN_LENGTHS[cc];
  if (expectedLen && iban.length !== expectedLen) {
    throw new Error(
      `IBAN length mismatch for ${cc}: got ${iban.length}, expected ${expectedLen}`,
    );
  }
  const details: BankDetails = {
    primary: iban,
    accountNumber: bban.slice(-Math.min(12, bban.length)),
    bankCode: IBAN_SANDBOX_BANK_PREFIX[cc],
    bic: `LFCU${cc}2X`,
    countryCode: cc,
  };
  return {
    scheme: 'IBAN',
    details,
    accountNumberNormalized: normalizeBankIdentity(iban),
    accountNumberDisplay: formatIbanDisplay(iban),
  };
}

function generateUs(sequence: number): BankIdentity {
  const routing = SANDBOX_INSTITUTIONS.US.routingNumber;
  const accountNumber = padAccount(sequence, 10);
  const details: BankDetails = {
    primary: accountNumber,
    routingNumber: routing,
    accountNumber,
    accountType: 'CHECKING',
    bic: SANDBOX_INSTITUTIONS.US.bic,
    countryCode: 'US',
  };
  return {
    scheme: 'US_ABA',
    details,
    accountNumberNormalized: normalizeBankIdentity(`${routing}${accountNumber}`),
    accountNumberDisplay: accountNumber,
  };
}

function generateCa(sequence: number): BankIdentity {
  const { institutionNumber, transitNumber, bic } = SANDBOX_INSTITUTIONS.CA;
  const accountNumber = padAccount(sequence, 10);
  const details: BankDetails = {
    primary: accountNumber,
    institutionNumber,
    transitNumber,
    accountNumber,
    bic,
    countryCode: 'CA',
  };
  return {
    scheme: 'CA_EFT',
    details,
    accountNumberNormalized: normalizeBankIdentity(
      `${institutionNumber}${transitNumber}${accountNumber}`,
    ),
    accountNumberDisplay: accountNumber,
  };
}

function generateGb(sequence: number): BankIdentity {
  const { sortCode, bic } = SANDBOX_INSTITUTIONS.GB;
  const accountNumber = padAccount(sequence, 8);
  const bban = `LFCU${sortCode}${accountNumber}`;
  const iban = buildIban('GB', bban);
  const details: BankDetails = {
    primary: accountNumber,
    sortCode,
    accountNumber,
    bic,
    iban,
    bankCode: 'LFCU',
    countryCode: 'GB',
  };

  return {
    scheme: 'GB_SORT',
    details,
    accountNumberNormalized: normalizeBankIdentity(`${sortCode}${accountNumber}`),
    accountNumberDisplay: `${formatSortCodeDisplay(sortCode)} · ${accountNumber}`,
  };
}

function generateAu(sequence: number): BankIdentity {
  const bsbDigits = SANDBOX_INSTITUTIONS.AU.bsb.replace(/\D/g, '');
  const accountNumber = padAccount(sequence, 9);
  const details: BankDetails = {
    primary: accountNumber,
    bsb: SANDBOX_INSTITUTIONS.AU.bsb,
    accountNumber,
    bic: SANDBOX_INSTITUTIONS.AU.bic,
    countryCode: 'AU',
  };
  return {
    scheme: 'AU_BSB',
    details,
    accountNumberNormalized: normalizeBankIdentity(`${bsbDigits}${accountNumber}`),
    accountNumberDisplay: `${SANDBOX_INSTITUTIONS.AU.bsb} · ${accountNumber}`,
  };
}

function generateNz(sequence: number): BankIdentity {
  const { bankCode, branchCode } = SANDBOX_INSTITUTIONS.NZ;
  const accountNumber = padAccount(sequence, 7);
  const suffix = '000';
  const full = `${bankCode}-${branchCode}-${accountNumber}-${suffix}`;
  const details: BankDetails = {
    primary: full,
    bankCode,
    branchCode,
    accountNumber,
    countryCode: 'NZ',
  };
  return {
    scheme: 'NZ_ACCOUNT',
    details,
    accountNumberNormalized: normalizeBankIdentity(full),
    accountNumberDisplay: full,
  };
}

function generateMx(sequence: number): BankIdentity {
  const { bankCode, plaza } = SANDBOX_INSTITUTIONS.MX;
  const account = padAccount(sequence, 11);
  const body17 = `${bankCode}${plaza}${account}`;
  const clabe = buildClabe(body17);
  const details: BankDetails = {
    primary: clabe,
    clabe,
    accountNumber: account,
    bankCode,
    countryCode: 'MX',
  };
  return {
    scheme: 'MX_CLABE',
    details,
    accountNumberNormalized: normalizeBankIdentity(clabe),
    accountNumberDisplay: clabe.replace(/(.{4})/g, '$1 ').trim(),
  };
}

function generateIn(sequence: number): BankIdentity {
  const ifsc = SANDBOX_INSTITUTIONS.IN.ifsc;
  const accountNumber = padAccount(sequence, 12);
  const details: BankDetails = {
    primary: accountNumber,
    ifsc,
    accountNumber,
    countryCode: 'IN',
  };
  return {
    scheme: 'IN_IFSC',
    details,
    accountNumberNormalized: normalizeBankIdentity(`${ifsc}${accountNumber}`),
    accountNumberDisplay: `${ifsc} · ${accountNumber}`,
  };
}

function generateJp(sequence: number): BankIdentity {
  const { bankCode, branchCode } = SANDBOX_INSTITUTIONS.JP;
  const accountNumber = padAccount(sequence, 7);
  const details: BankDetails = {
    primary: accountNumber,
    bankCode,
    branchCode,
    accountNumber,
    countryCode: 'JP',
  };
  return {
    scheme: 'JP_ZENGIN',
    details,
    accountNumberNormalized: normalizeBankIdentity(
      `${bankCode}${branchCode}${accountNumber}`,
    ),
    accountNumberDisplay: `${bankCode}-${branchCode}-${accountNumber}`,
  };
}

function generateDomestic(countryCode: string, sequence: number): BankIdentity {
  const cc = countryCode.toUpperCase();
  const payload = `${cc}${padAccount(sequence, 12)}`;
  const check = computeLuhnCheckDigit(payload);
  const primary = `LF${payload}${check}`;
  const details: BankDetails = {
    primary,
    accountNumber: primary,
    countryCode: cc,
  };
  return {
    scheme: 'LUMENFIELD_DOMESTIC',
    details,
    accountNumberNormalized: normalizeBankIdentity(primary),
    accountNumberDisplay: primary.replace(/(.{4})/g, '$1 ').trim(),
  };
}

/**
 * Generate a format-valid sandbox bank identity for the member's country.
 * @param countryCode ISO 3166-1 alpha-2
 * @param sequence Monotonic unique integer (per deployment)
 */
export function generateBankIdentity(countryCode: string, sequence: number): BankIdentity {
  const cc = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    throw new Error(`Invalid country code: ${countryCode}`);
  }
  const scheme = resolveBankScheme(cc);

  switch (scheme) {
    case 'US_ABA':
      return generateUs(sequence);
    case 'CA_EFT':
      return generateCa(sequence);
    case 'GB_SORT':
      return generateGb(sequence);
    case 'AU_BSB':
      return generateAu(sequence);
    case 'NZ_ACCOUNT':
      return generateNz(sequence);
    case 'MX_CLABE':
      return generateMx(sequence);
    case 'IN_IFSC':
      return generateIn(sequence);
    case 'JP_ZENGIN':
      return generateJp(sequence);
    case 'IBAN':
      return generateIbanIdentity(cc, sequence);
    case 'LUMENFIELD_DOMESTIC':
    default:
      if (IBAN_LENGTHS[cc]) {
        return generateIbanIdentity(cc, sequence);
      }
      return generateDomestic(cc, sequence);
  }
}

export function formatBankIdentity(identity: BankIdentity): string {
  return identity.accountNumberDisplay;
}

/**
 * Structural validation of a generated (or user-entered) identity.
 */
export function validateBankIdentity(identity: BankIdentity): boolean {
  const { scheme, details, accountNumberNormalized } = identity;
  if (
    !accountNumberNormalized ||
    accountNumberNormalized !== normalizeBankIdentity(accountNumberNormalized)
  ) {
    return false;
  }
  switch (scheme) {
    case 'US_ABA':
      return (
        !!details.routingNumber &&
        isValidAbaRouting(details.routingNumber) &&
        !!details.accountNumber &&
        /^\d{4,17}$/.test(details.accountNumber)
      );
    case 'CA_EFT':
      return (
        /^\d{3}$/.test(details.institutionNumber || '') &&
        /^\d{5}$/.test(details.transitNumber || '') &&
        /^\d{7,12}$/.test(details.accountNumber || '')
      );
    case 'GB_SORT':
      return (
        /^\d{6}$/.test((details.sortCode || '').replace(/\D/g, '')) &&
        /^\d{8}$/.test(details.accountNumber || '')
      );
    case 'AU_BSB':
      return (
        /^\d{6}$/.test((details.bsb || '').replace(/\D/g, '')) &&
        /^\d{6,10}$/.test(details.accountNumber || '')
      );
    case 'MX_CLABE':
      return isValidClabe(details.clabe || details.primary);
    case 'IBAN':
      return isValidIban(details.primary);
    case 'NZ_ACCOUNT':
    case 'IN_IFSC':
    case 'JP_ZENGIN':
    case 'BR_ACCOUNT':
    case 'LUMENFIELD_DOMESTIC':
      return details.primary.length >= 8;
    default:
      return false;
  }
}
