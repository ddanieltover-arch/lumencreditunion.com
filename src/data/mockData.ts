import { SEEDED_COUNTRIES } from '@lumenfield/db';
import {
  MemberProfile,
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

/** Marketing-only teaser for the public landing card (not a selectable account). */
export const LANDING_TEASER_MEMBER: MemberProfile = {
  id: 'teaser',
  name: 'Member',
  email: '',
  country: 'United States',
  countryCode: 'US',
  avatarInitials: 'LF',
  identityVerified: true,
  memberSince: '',
  wallets: { USD: 12450.0, CAD: 0, GBP: 0, EUR: 0 },
  virtualCard: {
    id: 'teaser-card',
    cardNumber: '•••• •••• •••• 4821',
    fullNumber: '',
    cardholderName: 'LUMENFIELD MEMBER',
    expiryDate: '09/29',
    cvv: '•••',
    status: 'active',
    dailyLimit: 2500,
    monthlyLimit: 10000,
    spentThisMonth: 0,
    currency: 'USD',
    isVirtual: true,
  },
  documents: [],
};

export function createMemberFromAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  countryCode: string;
}): MemberProfile {
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.map((p) => p[0]).join('') || 'LF').slice(0, 2).toUpperCase();
  const memberSince = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
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
      currency: 'USD' as Currency,
      isVirtual: true,
    },
    documents: [],
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
