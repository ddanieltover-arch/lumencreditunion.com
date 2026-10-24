import { SEEDED_COUNTRIES } from '@lumenfield/db';
import { resolveHomeCurrency } from '@lumenfield/shared';
import {
  MemberProfile,
  MemberBankIdentity,
  Transaction,
  LoanApplication,
  LedgerPosting,
  FundingRecord,
  AuditLogEntry,
  CountryServiceInfo,
  Currency,
} from '../types';

const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  SEEDED_COUNTRIES.map((c) => [c.code, c.name]),
);

/** Static marketing figures for the public landing preview card (not a real account). */
export const LANDING_PREVIEW = {
  balanceUsd: 12450.0,
  cardNumber: '•••• •••• •••• 4821',
  cardholderName: 'LUMENFIELD MEMBER',
  expiryDate: '09/29',
} as const;

export function bankIdentityFromAuthUser(user: {
  bankScheme?: string | null;
  bankDetails?: MemberBankIdentity['details'] | null;
  accountNumberNormalized?: string | null;
  accountNumberDisplay?: string | null;
}): MemberBankIdentity | null {
  if (
    !user.bankScheme ||
    !user.bankDetails ||
    !user.accountNumberNormalized ||
    !user.accountNumberDisplay
  ) {
    return null;
  }
  return {
    scheme: user.bankScheme as MemberBankIdentity['scheme'],
    details: user.bankDetails,
    accountNumberNormalized: user.accountNumberNormalized,
    accountNumberDisplay: user.accountNumberDisplay,
  };
}

export function createMemberFromAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  countryCode: string;
  bankScheme?: string | null;
  bankDetails?: MemberBankIdentity['details'] | null;
  accountNumberNormalized?: string | null;
  accountNumberDisplay?: string | null;
}): MemberProfile {
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.map((p) => p[0]).join('') || 'LF').slice(0, 2).toUpperCase();
  const memberSince = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const bankIdentity = bankIdentityFromAuthUser(user);
  const seedCountry = SEEDED_COUNTRIES.find((c) => c.code === user.countryCode);
  const homeCurrency = resolveHomeCurrency(user.countryCode, seedCountry?.currency) as Currency;
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    country: COUNTRY_NAMES[user.countryCode] || user.countryCode,
    countryCode: user.countryCode,
    avatarInitials: initials,
    identityVerified: false,
    memberSince,
    wallets: { USD: 0, CAD: 0, GBP: 0, EUR: 0 },
    virtualCard: {
      id: `card-${user.id.slice(0, 8)}`,
      cardNumber: '•••• •••• •••• ----',
      fullNumber: '',
      cardholderName: user.fullName.toUpperCase(),
      expiryDate: '--/--',
      cvv: '•••',
      status: 'active',
      dailyLimit: 2500,
      monthlyLimit: 10000,
      spentThisMonth: 0,
      currency: homeCurrency,
      isVirtual: true,
    },
    documents: [],
    bankIdentity,
  };
}

/** No seeded demo members — real accounts are created at registration. */
export const INITIAL_MEMBERS: MemberProfile[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_LOAN_APPLICATIONS: LoanApplication[] = [];
export const INITIAL_LEDGER_POSTINGS: LedgerPosting[] = [];
export const INITIAL_RECENT_FUNDING: FundingRecord[] = [];
export const INITIAL_AUDIT_LOG: AuditLogEntry[] = [];

export const COUNTRIES: CountryServiceInfo[] = SEEDED_COUNTRIES.map((c) => ({
  id: `c-${c.code.toLowerCase()}`,
  name: c.name,
  code: c.code,
  currency: c.currency,
  currencySymbol: c.currencySymbol,
  acceptedDocs: c.acceptedIdTypes,
  acceptedIdTypes: c.acceptedIdTypes,
  autoLoansEnabled: c.autoLoansEnabled,
  mortgageEnabled: c.mortgageEnabled,
  cardsEnabled: c.cardsEnabled,
  enabled: c.enabled,
  isSanctioned: c.isSanctioned,
  status: 'Active' as const,
}));
