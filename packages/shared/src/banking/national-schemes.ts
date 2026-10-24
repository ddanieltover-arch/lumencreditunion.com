import type { BankScheme } from './types';
import { isIbanCountry } from './iban-registry';
import { buildAbaRouting } from './check-digits';

/** Countries that use a dedicated national scheme instead of (or before) IBAN. */
const NATIONAL_SCHEME_BY_COUNTRY: Readonly<Record<string, BankScheme>> = {
  US: 'US_ABA',
  CA: 'CA_EFT',
  // GB also supports IBAN; we issue GB_SORT (+ derived IBAN in details)
  GB: 'GB_SORT',
  AU: 'AU_BSB',
  NZ: 'NZ_ACCOUNT',
  MX: 'MX_CLABE',
  // BR has IBAN but CLABE-style domestic is more common locally — use IBAN when listed;
  // keep BR_ACCOUNT as optional — prefer IBAN for BR since it's in IBAN registry
  IN: 'IN_IFSC',
  JP: 'JP_ZENGIN',
};

/** Sandbox institution constants — non-routable fictional Lumenfield CU codes. */
export const SANDBOX_INSTITUTIONS = {
  US: {
    /** Valid ABA checksum; clearly sandbox (09xxx Federal Reserve test-style range). */
    routingNumber: buildAbaRouting('09100001'),
    bic: 'LFCUUS33',
  },
  CA: {
    institutionNumber: '899', // fictional
    transitNumber: '00001',
    bic: 'LFCUCATT',
  },
  GB: {
    sortCode: '040004', // fictional
    bic: 'LFCUGB2L',
  },
  AU: {
    bsb: '802-905', // fictional (display); digits 802905
    bic: 'LFCUAU2S',
  },
  NZ: {
    bankCode: '89',
    branchCode: '0001',
  },
  MX: {
    /** 3-digit bank + 3-digit plaza for CLABE body. */
    bankCode: '899',
    plaza: '180',
  },
  IN: {
    ifsc: 'LFCU0000001',
  },
  JP: {
    bankCode: '8990',
    branchCode: '001',
  },
} as const;

/**
 * Resolve which scheme to use for a country.
 * Prefer explicit national schemes; else IBAN if country is in registry; else domestic fallback.
 */
export function resolveBankScheme(countryCode: string): BankScheme {
  const cc = countryCode.toUpperCase();
  if (NATIONAL_SCHEME_BY_COUNTRY[cc]) {
    return NATIONAL_SCHEME_BY_COUNTRY[cc]!;
  }
  if (isIbanCountry(cc)) {
    return 'IBAN';
  }
  return 'LUMENFIELD_DOMESTIC';
}
