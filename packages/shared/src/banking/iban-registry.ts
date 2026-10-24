/**
 * ISO 13616 IBAN total lengths (country code + check + BBAN).
 * Only countries that officially use IBAN are listed.
 */
export const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MR: 27,
  MT: 31,
  MU: 30,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  SA: 24,
  SC: 31,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
};

/**
 * Sandbox bank / branch prefixes used when building BBAN.
 * Remainder of BBAN is filled with the zero-padded account sequence.
 * Length of prefix + account digits must equal BBAN length (IBAN length − 4).
 */
export const IBAN_SANDBOX_BANK_PREFIX: Readonly<Record<string, string>> = {
  // Western / primary markets
  DE: '10070024', // 8-digit BLZ-style + 10-digit account
  FR: '30006000', // bank(5)+branch(5) then account+rib — we pad numerically
  NL: 'LFCU', // 4-char bank + 10-digit account
  ES: '2100', // 4 bank — rest numeric
  IT: 'X', // check char + ABI/CAB numeric rest
  IE: 'LFCU', // 4-char + 14 numeric (sort+account style)
  GB: 'LFCU', // 4-char + 14 numeric (sort 6 + account 8)
  AT: '10000', // 5-digit bank
  BE: '100', // 3-digit bank
  PT: '0001', // bank
  FI: '100000', //
  SE: '100', // clearing-style
  DK: '1000',
  NO: '1000',
  CH: '10000',
  LU: '001',
  PL: '10000000', // 8-digit bank
  CZ: '1000',
  SK: '1000',
  HU: '10000000',
  RO: 'LFCU',
  GR: '011',
  CY: '001',
  MT: 'LFCU',
  HR: '1001000',
  SI: '10000',
  BG: 'LFCU',
  EE: '10',
  LV: 'LFCU',
  LT: '10000',
  IS: '1000',
  LI: '10000',
  MC: '30006',
  AD: '0001',
  SM: 'X',
  VA: '001',
  AL: '100',
  BA: '100',
  ME: '100',
  MK: '100',
  RS: '100',
  XK: '100',
  TR: '00010',
  UA: '100000',
  GE: 'LFCU',
  AZ: '100',
  KZ: '100',
  BY: '100',
  MD: '100',
  AE: '001',
  SA: '10',
  BH: 'LFCU',
  KW: 'LFCU',
  QA: 'LFCU',
  JO: 'LFCU',
  LB: '0001',
  IL: '010',
  EG: '0001',
  PK: 'LFCU',
  BR: '00000000', // bank+branch placeholders inside BBAN
  CR: '0',
  DO: '000',
  GT: 'LFCU',
  SV: 'LFCU',
  LC: 'LFCU',
  VG: 'LFCU',
  GI: 'LFCU',
  FO: '1000',
  GL: '1000',
  IQ: '001',
  MR: '00013',
  MU: 'LFCU',
  PS: 'LFCU',
  SC: 'LFCU',
  ST: '0001',
  TL: '001',
  TN: '10',
};

export function isIbanCountry(countryCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(IBAN_LENGTHS, countryCode.toUpperCase());
}

export function ibanBbanLength(countryCode: string): number {
  const len = IBAN_LENGTHS[countryCode.toUpperCase()];
  if (!len) throw new Error(`No IBAN length for ${countryCode}`);
  return len - 4;
}
