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

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  IE: 'Ireland',
  NL: 'Netherlands',
  ES: 'Spain',
  IT: 'Italy',
};

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

export const COUNTRIES: CountryServiceInfo[] = [
  {
    id: 'c-us',
    name: 'United States',
    code: 'US',
    currency: 'USD',
    currencySymbol: '$',
    acceptedDocs: ['State Driver’s License', 'U.S. Passport', 'Permanent Resident Card'],
    autoLoansEnabled: true,
    mortgageEnabled: true,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-ca',
    name: 'Canada',
    code: 'CA',
    currency: 'CAD',
    currencySymbol: 'C$',
    acceptedDocs: ['Canadian Passport', 'Provincial Driver’s Licence', 'Permanent Resident Card'],
    autoLoansEnabled: true,
    mortgageEnabled: true,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-gb',
    name: 'United Kingdom',
    code: 'GB',
    currency: 'GBP',
    currencySymbol: '£',
    acceptedDocs: ['UK Passport', 'Photocard Driving Licence', 'Biometric Residence Permit'],
    autoLoansEnabled: true,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-de',
    name: 'Germany',
    code: 'DE',
    currency: 'EUR',
    currencySymbol: '€',
    acceptedDocs: ['Personalausweis', 'Reisepass', 'Aufenthaltstitel'],
    autoLoansEnabled: true,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-fr',
    name: 'France',
    code: 'FR',
    currency: 'EUR',
    currencySymbol: '€',
    acceptedDocs: ['Carte Nationale d’Identité', 'Passeport Français', 'Titre de Séjour'],
    autoLoansEnabled: true,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-nl',
    name: 'Netherlands',
    code: 'NL',
    currency: 'EUR',
    currencySymbol: '€',
    acceptedDocs: ['Nederlands Paspoort', 'Identiteitskaart', 'Verblijfsdocument'],
    autoLoansEnabled: false,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-es',
    name: 'Spain',
    code: 'ES',
    currency: 'EUR',
    currencySymbol: '€',
    acceptedDocs: ['DNI (Documento Nacional de Identidad)', 'Pasaporte Español', 'NIE'],
    autoLoansEnabled: true,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-it',
    name: 'Italy',
    code: 'IT',
    currency: 'EUR',
    currencySymbol: '€',
    acceptedDocs: ['Carta d’Identità Elettronica', 'Passaporto Italiano', 'Permesso di Soggiorno'],
    autoLoansEnabled: false,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
  {
    id: 'c-ie',
    name: 'Ireland',
    code: 'IE',
    currency: 'EUR',
    currencySymbol: '€',
    acceptedDocs: ['Irish Passport / Passport Card', 'Public Services Card', 'Irish Driving Licence'],
    autoLoansEnabled: true,
    mortgageEnabled: false,
    cardsEnabled: true,
    status: 'Active',
  },
];
