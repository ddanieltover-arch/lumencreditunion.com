export const BankSchemeSchemaValues = [
  'US_ABA',
  'CA_EFT',
  'GB_SORT',
  'AU_BSB',
  'NZ_ACCOUNT',
  'MX_CLABE',
  'BR_ACCOUNT',
  'IN_IFSC',
  'JP_ZENGIN',
  'IBAN',
  'LUMENFIELD_DOMESTIC',
] as const;

export type BankScheme = (typeof BankSchemeSchemaValues)[number];

/** Scheme-specific deposit coordinates (sandbox / non-routable). */
export interface BankDetails {
  /** Primary human-facing identifier (IBAN, account number, CLABE, etc.). */
  primary: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: 'CHECKING' | 'SAVINGS';
  institutionNumber?: string;
  transitNumber?: string;
  sortCode?: string;
  bsb?: string;
  bankCode?: string;
  branchCode?: string;
  ifsc?: string;
  bic?: string;
  clabe?: string;
  /** Derived IBAN when scheme is national but IBAN also applies (e.g. GB). */
  iban?: string;
  /** Country ISO 3166-1 alpha-2 that issued this identity. */
  countryCode: string;
}

export interface BankIdentity {
  scheme: BankScheme;
  details: BankDetails;
  /** Compact uppercase form used for unique index + lookup. */
  accountNumberNormalized: string;
  /** Grouped display string for UI. */
  accountNumberDisplay: string;
}
