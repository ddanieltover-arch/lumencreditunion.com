export type Currency = 'USD' | 'CAD' | 'GBP' | 'EUR';

export type AppView = 'landing' | 'member' | 'admin';

export type MemberTab =
  | 'overview'
  | 'wallet'
  | 'transfers'
  | 'loans'
  | 'cards'
  | 'documents'
  | 'settings';

export type AdminTab =
  | 'fund_wallet'
  | 'members'
  | 'identity_reviews'
  | 'loan_applications'
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
  currency: Currency;
  currencySymbol: string;
  acceptedDocs?: string[];
  acceptedIdTypes?: string[];
  autoLoansEnabled: boolean;
  mortgageEnabled: boolean;
  cardsEnabled: boolean;
  enabled?: boolean;
  status?: 'Live Sandbox' | 'Partner Underwriting';
  isSanctioned?: boolean;
  sanctionReason?: string | null;
}

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  country: string;
  countryCode: string;
  avatarInitials: string;
  identityVerified: boolean;
  memberSince: string;
  wallets: Record<Currency, number>;
  virtualCard: VirtualCard;
  documents: KYCDocument[];
}
