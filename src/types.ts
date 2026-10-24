export type Currency = 'USD' | 'CAD' | 'GBP' | 'EUR';

export type AppView = 'landing' | 'member' | 'admin' | 'contact';

export type MemberTab =
  | 'overview'
  | 'wallet'
  | 'transfers'
  | 'funding'
  | 'loans'
  | 'cards'
  | 'documents'
  | 'settings';

export type AdminTab =
  | 'fund_wallet'
  | 'members'
  | 'identity_reviews'
  | 'loan_applications'
  | 'virtual_cards'
  | 'ledger'
  | 'audit_log'
  | 'country_settings';

export type {
  KycDocumentType,
  KycSubmissionStatus,
  KycDocumentSide,
  KycDocument as SharedKycDocument,
  KycSubmission,
  SubmitKycInput,
  ReviewKycInput,
  VirtualCardRecord,
  CardTransactionRecord,
  CardOneTimeSensitiveDetails,
  CardCreationResponse,
  CardCurrency,
  CardStatus,
} from '@lumenfield/shared';

export interface KYCDocument {
  id: string;
  type: 'passport' | 'id_card' | 'residence_permit' | 'drivers_license';
  documentName: string;
  fileName: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
}

export interface VirtualCard {
  id: string;
  cardNumber: string; // masked e.g. "•••• •••• •••• 4821"
  fullNumber: string; // "4532 8921 7843 4821"
  cardholderName: string;
  expiryDate: string; // "09/29"
  cvv: string; // "742"
  status: 'active' | 'frozen';
  dailyLimit: number;
  monthlyLimit: number;
  spentThisMonth: number;
  currency: Currency;
  isVirtual: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  date: string;
  timestamp: string;
  status: 'Completed' | 'Pending' | 'Failed';
  amount: number;
  currency: Currency;
  type:
    | 'admin_credit'
    | 'transfer_out'
    | 'transfer_in'
    | 'bank_transfer'
    | 'card_purchase'
    | 'loan_disbursement'
    | 'currency_swap';
  counterparty?: string;
  reference?: string;
  category?: string;
}

export interface LoanApplication {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  type: 'auto' | 'mortgage';
  title: string;
  requestedAmount: number;
  termMonths: number;
  interestRateApr: number;
  estimatedMonthlyPayment: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  currentStage: 'Submitted' | 'Review' | 'Decision';
  submittedDate: string;
  currency: Currency;
  purpose: string;
  assetDetails?: string;
  downPayment?: number;
}

export interface LedgerPosting {
  id: string;
  reference: string;
  date: string;
  timestamp: string;
  description: string;
  currency: Currency;
  debitAccount: string;
  debitAmount: number;
  creditAccount: string;
  creditAmount: number;
  memberId: string;
  memberName: string;
  adminActor: string;
}

export interface FundingRecord {
  id: string;
  memberId: string;
  memberName: string;
  reference: string;
  date: string;
  amount: number;
  currency: Currency;
  source: string;
  reason: string;
  adminUser: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: 'Admin' | 'System' | 'Member';
  action: string;
  target: string;
  reference: string;
  details: string;
}

export interface CountryServiceInfo {
  id?: string;
  name: string;
  code: string;
  /** ISO 4217 local currency for the jurisdiction (not limited to wallet currencies). */
  currency: string;
  currencySymbol: string;
  acceptedDocs?: string[];
  acceptedIdTypes?: string[];
  autoLoansEnabled: boolean;
  mortgageEnabled: boolean;
  cardsEnabled: boolean;
  enabled?: boolean;
  status?: 'Active' | 'Partner Underwriting';
  isSanctioned?: boolean;
  sanctionReason?: string | null;
}

export type BankScheme =
  | 'US_ABA'
  | 'CA_EFT'
  | 'GB_SORT'
  | 'AU_BSB'
  | 'NZ_ACCOUNT'
  | 'MX_CLABE'
  | 'BR_ACCOUNT'
  | 'IN_IFSC'
  | 'JP_ZENGIN'
  | 'IBAN'
  | 'LUMENFIELD_DOMESTIC';

export interface MemberBankIdentity {
  scheme: BankScheme;
  details: {
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
    iban?: string;
    countryCode: string;
  };
  accountNumberNormalized: string;
  accountNumberDisplay: string;
}

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  country: string;
  countryCode: string;
  avatarInitials: string;
  identityVerified: boolean;
  emailVerified?: boolean;
  memberSince: string;
  wallets: Record<Currency, number>;
  virtualCard: VirtualCard;
  documents: KYCDocument[];
  /** Country-format deposit / lookup identity (sandbox). */
  bankIdentity?: MemberBankIdentity | null;
}
