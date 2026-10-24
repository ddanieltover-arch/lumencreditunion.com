import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AppView,
  MemberTab,
  AdminTab,
  Currency,
  MemberProfile,
  Transaction,
  LoanApplication,
  LedgerPosting,
  FundingRecord,
  AuditLogEntry,
  CountryServiceInfo,
  KYCDocument,
  KycSubmission,
  KycSubmissionStatus,
  SubmitKycInput,
} from '../types';
import {
  VirtualCardRecord,
  CardTransactionRecord,
  CardOneTimeSensitiveDetails,
  CardCreationResponse,
  CardCurrency,
  formatMoney,
} from '@lumenfield/shared';
import {
  notifyTransferExecuted,
  notifyKycDecision,
  notifyLoanDecision,
} from '../utils/pushNotifications';
import { formatApiError } from '../utils/apiError';
import {
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  INITIAL_LOAN_APPLICATIONS,
  INITIAL_LEDGER_POSTINGS,
  INITIAL_RECENT_FUNDING,
  INITIAL_AUDIT_LOG,
  COUNTRIES,
  createMemberFromAuthUser,
  bankIdentityFromAuthUser,
} from '../data/mockData';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;

  members: MemberProfile[];
  activeMember: MemberProfile | null;
  setActiveMemberId: (id: string) => void;
  /** Reload registered MEMBER profiles for the admin directory (excludes SUPER_ADMIN). */
  fetchAdminMembers: () => Promise<void>;
  /** Reload durable double-entry ledger postings for the admin portal. */
  fetchAdminLedger: (tokenOverride?: string | null) => Promise<void>;
  /** Reload signed-in member wallet balances + transaction history. */
  fetchMemberWalletActivity: (tokenOverride?: string | null) => Promise<void>;

  transactions: Transaction[];
  loanApplications: LoanApplication[];
  ledgerPostings: LedgerPosting[];
  recentFunding: FundingRecord[];
  auditLog: AuditLogEntry[];
  countries: CountryServiceInfo[];
  updateCountryFlags: (
    code: string,
    patch: Partial<Pick<CountryServiceInfo, 'autoLoansEnabled' | 'mortgageEnabled' | 'cardsEnabled'>>,
  ) => void;

  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  dismissToast: (id: string) => void;

  // Actions
  fundWallet: (params: {
    memberId: string;
    amount: number;
    currency: Currency;
    source: string;
    reference: string;
    reason: string;
  }) => boolean;

  sendTransfer: (params: {
    recipient: string;
    amount: number;
    currency: Currency;
  }) => { success: boolean; message: string };

  // Virtual Card State & API Actions
  virtualCards: VirtualCardRecord[];
  activeCardId: string | null;
  setActiveCardId: (id: string | null) => void;
  cardTransactions: CardTransactionRecord[];
  oneTimeCredentials: CardOneTimeSensitiveDetails | null;
  setOneTimeCredentials: (creds: CardOneTimeSensitiveDetails | null) => void;
  /** Session-only PAN/CVV keyed by card id (never persisted server-side). */
  cardSessionSecrets: Record<string, CardOneTimeSensitiveDetails>;
  isCreateCardModalOpen: boolean;
  openCreateCardModal: () => void;
  closeCreateCardModal: () => void;
  isCardLimitsModalOpen: boolean;
  openCardLimitsModal: (card?: VirtualCardRecord) => void;
  closeCardLimitsModal: () => void;
  isSimulatePurchaseModalOpen: boolean;
  openSimulatePurchaseModal: (card?: VirtualCardRecord) => void;
  closeSimulatePurchaseModal: () => void;
  selectedCardForLimits: VirtualCardRecord | null;
  selectedCardForSimulation: VirtualCardRecord | null;
  fetchCards: () => Promise<void>;
  createVirtualCard: (params: {
    currency: CardCurrency;
    cardholderName?: string;
    dailyLimitMinor?: number;
    monthlyLimitMinor?: number;
  }) => Promise<CardCreationResponse>;
  toggleCardFreeze: (cardId?: string) => Promise<any>;
  updateCardLimits: (arg1: any, arg2?: any, arg3?: any) => Promise<any>;
  simulateCardPurchase: (params: {
    cardId: string;
    amountMinor: number;
    merchantName: string;
    merchantCategory?: string;
    currency?: CardCurrency;
  }) => Promise<any>;
  fetchCardTransactions: (cardId: string) => Promise<CardTransactionRecord[]>;

  submitLoanApplication: (params: {
    type: 'auto' | 'mortgage';
    amount: number;
    termMonths: number;
    purpose: string;
    assetDetails?: string;
    downPayment?: number;
  }) => Promise<void>;

  updateLoanStatus: (
    loanId: string,
    status: 'approved' | 'rejected' | 'under_review'
  ) => void;

  uploadKYC: (type: KYCDocument['type'], documentName: string, fileName: string) => void;
  reviewKYC: (memberId: string, docId: string, status: 'approved' | 'rejected') => void;

  // KYC Verification state & methods (HARD RULE 7 & Task Requirements)
  kycSubmission: KycSubmission | null;
  kycStatus: KycSubmissionStatus | 'NOT_SUBMITTED';
  kycNotifications: any[];
  adminKycQueue: KycSubmission[];
  isKycModalOpen: boolean;
  openKycModal: () => void;
  closeKycModal: () => void;
  fetchKycStatus: (
    accessToken?: string | null,
    user?: { id: string; email: string } | null,
  ) => Promise<void>;
  submitKycVerification: (input: SubmitKycInput) => Promise<any>;
  fetchAdminKycQueue: (status?: KycSubmissionStatus) => Promise<void>;
  reviewKycSubmission: (
    submissionId: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO',
    reason?: string
  ) => Promise<any>;
  updateAdminMember: (
    memberId: string,
    patch: {
      fullName?: string;
      email?: string;
      phone?: string | null;
      countryCode?: string;
      emailVerified?: boolean;
    },
  ) => Promise<any>;
  deleteAdminMember: (memberId: string) => Promise<void>;
  updateAdminKyc: (
    submissionId: string,
    patch: {
      memberName?: string;
      memberEmail?: string;
      countryCode?: string;
      documentType?: string;
      status?: KycSubmissionStatus;
      reviewerNote?: string | null;
      rejectionReason?: string | null;
    },
  ) => Promise<any>;
  deleteAdminKyc: (submissionId: string) => Promise<void>;
  getAdminDocumentSignedUrl: (
    docId: string,
    expiresIn?: number
  ) => Promise<{ signedUrl: string; expiresAt: string; expiresInSeconds: number }>;
  markNotificationsRead: () => Promise<void>;

  // Authentication & Security state
  currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: 'MEMBER' | 'SUPER_ADMIN';
    countryCode: string;
    mfaEnabled: boolean;
  } | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppContextType['currentUser']>>;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  refreshToken: string | null;
  setRefreshToken: (token: string | null) => void;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'forgot' | 'reset';
  authResetToken: string;
  openAuthModal: (mode?: 'login' | 'register' | 'forgot' | 'reset', resetToken?: string) => void;
  closeAuthModal: () => void;
  isSecurityModalOpen: boolean;
  securityModalTab: 'mfa' | 'password' | 'sessions' | 'token_rotation';
  openSecurityModal: (tab?: 'mfa' | 'password' | 'sessions' | 'token_rotation') => void;
  closeSecurityModal: () => void;
  loginUser: (params: { email: string; password: string; totpCode?: string }) => Promise<any>;
  completeMfaLogin: (params: { mfaTicket: string; totpCode: string }) => Promise<any>;
  rotateTokens: () => Promise<any>;
  registerUser: (params: any) => Promise<any>;
  logoutUser: (options?: { redirectToLanding?: boolean; silent?: boolean }) => Promise<void>;
  downloadStatement: (format: 'csv' | 'pdf', currency?: string) => Promise<void>;

  convertCurrency: (from: Currency, to: Currency, amount: number) => { success: boolean; message: string };

  isTermsModalOpen: boolean;
  openTermsModal: () => void;
  closeTermsModal: () => void;
  isPrivacyModalOpen: boolean;
  openPrivacyModal: () => void;
  closePrivacyModal: () => void;
  exportPersonalData: () => Promise<void>;
  requestAccountDeletion: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  adminDashboardStats: any;
  fetchAdminDashboardStats: (tokenOverride?: string | null) => Promise<void>;

  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const MEMBER_TAB_SLUGS: Record<MemberTab, string> = {
  overview: 'overview',
  wallet: 'wallet',
  transfers: 'transfers',
  funding: 'funding',
  loans: 'loans',
  cards: 'cards',
  documents: 'documents',
  settings: 'settings',
};

const ADMIN_TAB_SLUGS: Record<AdminTab, string> = {
  members: 'members',
  identity_reviews: 'identity-reviews',
  fund_wallet: 'fund-wallets',
  loan_applications: 'loan-applications',
  virtual_cards: 'virtual-cards',
  ledger: 'ledger',
  audit_log: 'audit-log',
  country_settings: 'country-settings',
};

const MEMBER_SLUG_TO_TAB: Record<string, MemberTab> = Object.fromEntries(
  Object.entries(MEMBER_TAB_SLUGS).map(([tab, slug]) => [slug, tab as MemberTab]),
) as Record<string, MemberTab>;

const ADMIN_SLUG_TO_TAB: Record<string, AdminTab> = Object.fromEntries(
  Object.entries(ADMIN_TAB_SLUGS).map(([tab, slug]) => [slug, tab as AdminTab]),
) as Record<string, AdminTab>;

function parseLocation(pathname: string): {
  view: AppView;
  memberTab: MemberTab;
  adminTab: AdminTab;
} {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const root = parts[0] || '';
  const slug = parts[1] || '';

  if (root === 'admin') {
    return {
      view: 'admin',
      memberTab: 'overview',
      adminTab: (slug && ADMIN_SLUG_TO_TAB[slug]) || 'members',
    };
  }
  if (root === 'member') {
    return {
      view: 'member',
      memberTab: (slug && MEMBER_SLUG_TO_TAB[slug]) || 'overview',
      adminTab: 'members',
    };
  }
  if (root === 'contact') {
    return { view: 'contact', memberTab: 'overview', adminTab: 'members' };
  }
  return { view: 'landing', memberTab: 'overview', adminTab: 'members' };
}

function pathFor(view: AppView, memberTab: MemberTab, adminTab: AdminTab): string {
  if (view === 'admin') return `/admin/${ADMIN_TAB_SLUGS[adminTab]}`;
  if (view === 'member') return `/member/${MEMBER_TAB_SLUGS[memberTab]}`;
  if (view === 'contact') return '/contact';
  return '/';
}

function replacePath(next: string) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== next) {
    window.history.pushState({}, '', next);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial =
    typeof window !== 'undefined'
      ? parseLocation(window.location.pathname)
      : { view: 'landing' as AppView, memberTab: 'overview' as MemberTab, adminTab: 'members' as AdminTab };

  const [currentView, setCurrentViewState] = useState<AppView>(initial.view);
  const [memberTab, setMemberTabState] = useState<MemberTab>(initial.memberTab);
  const [adminTab, setAdminTabState] = useState<AdminTab>(initial.adminTab);

  const setCurrentView = useCallback(
    (view: AppView) => {
      setCurrentViewState(view);
      // Default landing tabs when entering a section from elsewhere
      if (view === 'member') {
        setMemberTabState((mt) => {
          replacePath(pathFor('member', mt, 'members'));
          return mt;
        });
      } else if (view === 'admin') {
        setAdminTabState((at) => {
          replacePath(pathFor('admin', 'overview', at));
          return at;
        });
      } else {
        replacePath(pathFor(view, 'overview', 'members'));
      }
    },
    [],
  );

  const setMemberTab = useCallback((tab: MemberTab) => {
    setMemberTabState(tab);
    setCurrentViewState('member');
    replacePath(pathFor('member', tab, 'members'));
  }, []);

  const setAdminTab = useCallback((tab: AdminTab) => {
    setAdminTabState(tab);
    setCurrentViewState('admin');
    replacePath(pathFor('admin', 'overview', tab));
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const loc = parseLocation(window.location.pathname);
      setCurrentViewState(loc.view);
      setMemberTabState(loc.memberTab);
      setAdminTabState(loc.adminTab);
    };
    window.addEventListener('popstate', onPopState);
    // Normalize bare /member or /admin to default tab slug
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (path === '/member' || path === '/admin') {
        const loc = parseLocation(path);
        replacePath(pathFor(loc.view, loc.memberTab, loc.adminTab));
      }
    }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [members, setMembers] = useState<MemberProfile[]>(INITIAL_MEMBERS);
  const [activeMemberId, setActiveMemberId] = useState<string>('');

  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>(
    INITIAL_LOAN_APPLICATIONS,
  );

  const ensureMemberForUser = (user: {
    id: string;
    email: string;
    fullName: string;
    countryCode: string;
    role?: string;
    bankScheme?: string | null;
    bankDetails?: any;
    accountNumberNormalized?: string | null;
    accountNumberDisplay?: string | null;
  }) => {
    // Super admins are operators — never appear in the registered members directory
    if (user.role === 'SUPER_ADMIN') {
      setMembers((prev) =>
        prev.filter(
          (m) =>
            m.id !== user.id &&
            m.id !== '00000000-0000-0000-0000-000000000001' &&
            m.email.toLowerCase() !== user.email.toLowerCase(),
        ),
      );
      return;
    }
    const bankIdentity = bankIdentityFromAuthUser(user);
    setMembers((prev) => {
      const cleaned = prev.filter(
        (m) => m.id !== '00000000-0000-0000-0000-000000000001',
      );
      const existingIdx = cleaned.findIndex(
        (m) => m.id === user.id || m.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (existingIdx >= 0) {
        if (!bankIdentity) return cleaned;
        const next = [...cleaned];
        next[existingIdx] = { ...next[existingIdx]!, bankIdentity };
        return next;
      }
      return [...cleaned, createMemberFromAuthUser(user)];
    });
    setActiveMemberId(user.id);
  };

  const mapRemoteMembers = (remote: any[]): MemberProfile[] =>
    (Array.isArray(remote) ? remote : []).map((u) => {
      const profile = createMemberFromAuthUser({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        countryCode: u.countryCode,
        bankScheme: u.bankScheme,
        bankDetails: u.bankDetails,
        accountNumberNormalized: u.accountNumberNormalized,
        accountNumberDisplay: u.accountNumberDisplay,
      });
      return {
        ...profile,
        identityVerified: Boolean(u.identityVerified),
        emailVerified: Boolean(u.emailVerified),
        memberSince: u.createdAt
          ? new Date(u.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' })
          : profile.memberSince,
        wallets: {
          USD: Number(u.wallets?.USD ?? 0),
          CAD: Number(u.wallets?.CAD ?? 0),
          GBP: Number(u.wallets?.GBP ?? 0),
          EUR: Number(u.wallets?.EUR ?? 0),
        },
      };
    });

  const mapRemoteLoans = (remote: any[]): LoanApplication[] =>
    (Array.isArray(remote) ? remote : []).map((l) => {
      const type = l.type === 'mortgage' ? 'mortgage' : 'auto';
      const amount = Number(l.requestedAmount || 0);
      const termMonths = Number(l.termMonths || 60);
      const apr = type === 'auto' ? 5.4 : 6.2;
      const monthlyRate = apr / 100 / 12;
      const estimatedMonthlyPayment =
        amount > 0 && termMonths > 0
          ? Number(
              (
                (amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
                (Math.pow(1 + monthlyRate, termMonths) - 1)
              ).toFixed(2),
            )
          : 0;
      const status = (l.status || 'under_review') as LoanApplication['status'];
      return {
        id: l.id,
        memberId: l.memberId,
        memberName: l.memberName || 'Member',
        memberEmail: l.memberEmail,
        type,
        title: type === 'auto' ? 'Auto loan application' : 'Mortgage loan application',
        requestedAmount: amount,
        termMonths,
        interestRateApr: apr,
        estimatedMonthlyPayment,
        status,
        currentStage:
          status === 'approved' || status === 'rejected' ? 'Decision' : 'Review',
        submittedDate: l.createdAt
          ? new Date(l.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '',
        currency: (l.currency || 'USD') as Currency,
        purpose: l.purpose || '',
        assetDetails: l.assetDetails,
        downPayment: l.downPayment,
      };
    });

  const ledgerAccountLabel = (entry: any): string => {
    if (!entry) return '—';
    const type = String(entry.accountType || '');
    const currency = String(entry.currency || 'USD');
    if (type === 'SANDBOX_FUNDING_POOL') return 'Funding pool';
    if (type === 'MEMBER_WALLET') return `Member wallet (${currency})`;
    if (type === 'EXTERNAL_CLEARING') return `External clearing (${currency})`;
    if (type === 'FEE') return `Platform fee (${currency})`;
    if (type === 'LOAN_RECEIVABLE') return `Loan receivable (${currency})`;
    if (type === 'ASSET') return `Asset (${currency})`;
    return entry.accountId || type || 'Account';
  };

  const mapRemoteLedgerTransactions = (
    remote: any[],
    nameById?: Map<string, string>,
  ): LedgerPosting[] =>
    (Array.isArray(remote) ? remote : [])
      .map((tx) => {
        const entries = Array.isArray(tx.entries) ? tx.entries : [];
        const debit = entries.find((e: any) => e.direction === 'DEBIT');
        const credit = entries.find((e: any) => e.direction === 'CREDIT');
        const amountMinor = Number(debit?.amountMinor ?? credit?.amountMinor ?? 0);
        const created = tx.createdAt ? new Date(tx.createdAt) : new Date();
        const memberId = String(tx.metadata?.memberId || '');
        const memberName =
          (memberId && nameById?.get(memberId)) ||
          members.find((m) => m.id === memberId)?.name ||
          (memberId ? `Member ${memberId.slice(0, 8)}` : 'System');
        return {
          id: String(tx.id || `ledg-${tx.reference || Date.now()}`),
          reference: String(tx.reference || tx.id || '—'),
          date: created.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          timestamp: created.toISOString(),
          description: String(tx.description || 'Ledger posting'),
          currency: (tx.currency || 'USD') as Currency,
          debitAccount: ledgerAccountLabel(debit),
          debitAmount: amountMinor / 100,
          creditAccount: ledgerAccountLabel(credit),
          creditAmount: amountMinor / 100,
          memberId,
          memberName,
          adminActor: String(tx.createdById || 'System'),
        } satisfies LedgerPosting;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const mapSourceToTxType = (
    source: string,
    direction: 'DEBIT' | 'CREDIT',
  ): Transaction['type'] => {
    const src = (source || '').toUpperCase();
    if (src === 'TEST' || src === 'DEPOSIT' || src === 'BANK') return 'admin_credit';
    if (src.includes('LOAN')) return 'loan_disbursement';
    if (src.includes('SWAP') || src.includes('FX')) return 'currency_swap';
    if (src.includes('CARD')) return 'card_purchase';
    if (src.includes('BANK')) return 'bank_transfer';
    return direction === 'CREDIT' ? 'transfer_in' : 'transfer_out';
  };

  const mapRemoteWalletTransactions = (remote: any[]): Transaction[] =>
    (Array.isArray(remote) ? remote : [])
      .map((row) => {
        const direction = row.direction === 'DEBIT' ? 'DEBIT' : 'CREDIT';
        const amountMajor = Number(row.amountMinor || 0) / 100;
        const created = row.createdAt ? new Date(row.createdAt) : new Date();
        const statusRaw = String(row.status || 'POSTED').toUpperCase();
        const status: Transaction['status'] =
          statusRaw === 'POSTED'
            ? 'Completed'
            : statusRaw === 'PENDING_APPROVAL' || statusRaw === 'PENDING'
              ? 'Pending'
              : 'Failed';
        return {
          id: String(row.id || row.transactionId || `tx-${created.getTime()}`),
          description: String(row.description || 'Wallet movement'),
          date: created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          timestamp: created.toISOString(),
          status,
          amount: direction === 'CREDIT' ? amountMajor : -amountMajor,
          currency: (row.currency || 'USD') as Currency,
          type: mapSourceToTxType(String(row.source || ''), direction),
          reference: row.reference ? String(row.reference) : undefined,
          category: String(row.source || 'Ledger'),
          counterparty: direction === 'CREDIT' ? 'Lumenfield Credit Union' : undefined,
        } satisfies Transaction;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const fetchAdminMembers = async (tokenOverride?: string | null) => {
    try {
      const token = tokenOverride ?? authToken;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/admin/member-directory', { headers });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      setMembers(mapRemoteMembers(data.members));
    } catch (err) {
      console.debug('Failed to fetch admin members:', err);
    }
  };
  const [ledgerPostings, setLedgerPostings] = useState<LedgerPosting[]>(INITIAL_LEDGER_POSTINGS);
  const [recentFunding, setRecentFunding] = useState<FundingRecord[]>(INITIAL_RECENT_FUNDING);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOG);
  const [countries, setCountries] = useState<CountryServiceInfo[]>(COUNTRIES);

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [adminDashboardStats, setAdminDashboardStats] = useState<any>(null);

  const openTermsModal = () => setIsTermsModalOpen(true);
  const closeTermsModal = () => setIsTermsModalOpen(false);
  const openPrivacyModal = () => setIsPrivacyModalOpen(true);
  const closePrivacyModal = () => setIsPrivacyModalOpen(false);

  const fetchAdminLedger = async (tokenOverride?: string | null) => {
    try {
      const token = tokenOverride ?? authToken;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/admin/ledger/transactions', { headers });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.transactions || [];
      const nameById = new Map(members.map((m) => [m.id, m.name]));
      setLedgerPostings(mapRemoteLedgerTransactions(rows, nameById));
    } catch (err) {
      console.debug('Failed to fetch admin ledger:', err);
    }
  };

  const fetchMemberWalletActivity = async (tokenOverride?: string | null) => {
    try {
      const token = tokenOverride ?? authToken;
      if (!token) return;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      };
      const cacheBust = `_=${Date.now()}`;
      const [txRes, balRes] = await Promise.all([
        fetch(`/wallet/transactions?limit=100&page=1&${cacheBust}`, { headers, cache: 'no-store' }),
        fetch(`/wallet/balances?${cacheBust}`, { headers, cache: 'no-store' }),
      ]);

      if (txRes.ok) {
        const contentType = txRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const payload = await txRes.json();
          const rows = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];
          setTransactions(mapRemoteWalletTransactions(rows));
        }
      }

      if (balRes.ok) {
        const contentType = balRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const balances = await balRes.json();
          const walletPatch: Partial<Record<Currency, number>> = {
            USD: 0,
            CAD: 0,
            GBP: 0,
            EUR: 0,
          };
          const list = Array.isArray(balances)
            ? balances
            : Array.isArray(balances?.balances)
              ? balances.balances
              : [];
          for (const row of list) {
            const currency = String(row.currency || '').toUpperCase() as Currency;
            if (!['USD', 'CAD', 'GBP', 'EUR'].includes(currency)) continue;
            const major =
              typeof row.balanceMinor === 'number'
                ? row.balanceMinor / 100
                : Number(String(row.balanceFormatted || '').replace(/[^0-9.-]/g, '') || 0);
            walletPatch[currency] = major;
          }

          setMembers((prev) => {
            const matchIdx = prev.findIndex(
              (m) =>
                m.id === activeMemberId ||
                (currentUser &&
                  (m.id === currentUser.id ||
                    m.email.toLowerCase() === currentUser.email.toLowerCase())),
            );
            if (matchIdx >= 0) {
              const next = [...prev];
              const current = next[matchIdx]!;
              next[matchIdx] = {
                ...current,
                wallets: {
                  ...current.wallets,
                  ...walletPatch,
                },
              };
              return next;
            }
            if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
              const profile = createMemberFromAuthUser(currentUser);
              return [
                ...prev,
                {
                  ...profile,
                  wallets: {
                    ...profile.wallets,
                    ...walletPatch,
                  },
                },
              ];
            }
            return prev;
          });

          if (currentUser?.id && !activeMemberId) {
            setActiveMemberId(currentUser.id);
          }
        }
      }
    } catch (err) {
      console.debug('Failed to fetch member wallet activity:', err);
    }
  };

  const fetchAdminDashboardStats = async (tokenOverride?: string | null) => {
    try {
      const token = tokenOverride ?? authToken;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/admin/dashboard-stats', { headers });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const stats = await res.json();
      setAdminDashboardStats(stats);
      // Prefer members/loans embedded in stats so every admin tile matches durable data
      let nameById = new Map<string, string>();
      if (Array.isArray(stats.members)) {
        const mapped = mapRemoteMembers(stats.members);
        setMembers(mapped);
        nameById = new Map(mapped.map((m) => [m.id, m.name]));
      } else {
        await fetchAdminMembers(token);
      }
      if (Array.isArray(stats.loans)) {
        setLoanApplications(mapRemoteLoans(stats.loans));
      }
      if (Array.isArray(stats.kycSubmissions)) {
        setAdminKycQueue(stats.kycSubmissions);
      }
      if (Array.isArray(stats.ledgerTransactions)) {
        setLedgerPostings(mapRemoteLedgerTransactions(stats.ledgerTransactions, nameById));
      } else {
        await fetchAdminLedger(token);
      }
    } catch (err) {
      console.debug('Failed to fetch admin dashboard stats:', err);
    }
  };

  const exportPersonalData = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/auth/data-export', { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lumenfield-data-export-${currentUser?.id || 'member'}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Exported complete GDPR/CCPA personal data archive.', 'success');
        return;
      }
      throw new Error('Export request failed');
    } catch (err: any) {
      showToast(`Data export error: ${err.message}`, 'warning');
    }
  };

  const requestAccountDeletion = async (reason?: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/auth/account-deletion', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Account scheduled for deletion.', 'success');
        logoutUser();
        return { success: true };
      }
      throw new Error(data.message || 'Deletion failed');
    } catch (err: any) {
      showToast(err.message, 'warning');
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetch('/countries')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          // Merge API country data ensuring acceptedDocs is populated
          const normalized = data.map((c: any) => ({
            ...c,
            id: c.id || `c-${c.code.toLowerCase()}`,
            acceptedDocs: c.acceptedDocs || c.acceptedIdTypes || ['Passport', 'National ID'],
            status: c.status || 'Active',
          }));
          setCountries(normalized);
        }
      })
      .catch((err) => {
        console.debug('Loaded seeded in-memory countries fallback:', err);
      });
  }, []);

  const [currentUser, setCurrentUser] = useState<AppContextType['currentUser']>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [authResetToken, setAuthResetToken] = useState('');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityModalTab, setSecurityModalTab] = useState<
    'mfa' | 'password' | 'sessions' | 'token_rotation'
  >('mfa');

  // KYC Verification State (HARD RULE 7 & Task Requirements)
  const [kycSubmission, setKycSubmission] = useState<KycSubmission | null>(null);
  const [kycStatus, setKycStatus] = useState<KycSubmissionStatus | 'NOT_SUBMITTED'>('NOT_SUBMITTED');
  const [kycNotifications, setKycNotifications] = useState<any[]>([]);
  const [adminKycQueue, setAdminKycQueue] = useState<KycSubmission[]>([]);
  const [isKycModalOpen, setIsKycModalOpen] = useState<boolean>(false);

  const openKycModal = () => setIsKycModalOpen(true);
  const closeKycModal = () => setIsKycModalOpen(false);

  const CARD_SECRETS_STORAGE_KEY = 'lumenfield_card_session_secrets';

  const readCardSessionSecrets = (): Record<string, CardOneTimeSensitiveDetails> => {
    try {
      const raw = sessionStorage.getItem(CARD_SECRETS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeCardSessionSecrets = (next: Record<string, CardOneTimeSensitiveDetails>) => {
    try {
      sessionStorage.setItem(CARD_SECRETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  };

  // Virtual Card State & Modals
  const [virtualCards, setVirtualCards] = useState<VirtualCardRecord[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardTransactions, setCardTransactions] = useState<CardTransactionRecord[]>([]);
  const [oneTimeCredentials, setOneTimeCredentials] = useState<CardOneTimeSensitiveDetails | null>(null);
  const [cardSessionSecrets, setCardSessionSecrets] = useState<
    Record<string, CardOneTimeSensitiveDetails>
  >(() => readCardSessionSecrets());
  const [isCreateCardModalOpen, setIsCreateCardModalOpen] = useState(false);
  const [isCardLimitsModalOpen, setIsCardLimitsModalOpen] = useState(false);
  const [isSimulatePurchaseModalOpen, setIsSimulatePurchaseModalOpen] = useState(false);
  const [selectedCardForLimits, setSelectedCardForLimits] = useState<VirtualCardRecord | null>(null);
  const [selectedCardForSimulation, setSelectedCardForSimulation] = useState<VirtualCardRecord | null>(null);

  const openCreateCardModal = () => setIsCreateCardModalOpen(true);
  const closeCreateCardModal = () => setIsCreateCardModalOpen(false);

  const openCardLimitsModal = (card?: VirtualCardRecord) => {
    setSelectedCardForLimits(card || virtualCards.find((c) => c.id === activeCardId) || virtualCards[0] || null);
    setIsCardLimitsModalOpen(true);
  };
  const closeCardLimitsModal = () => {
    setIsCardLimitsModalOpen(false);
    setSelectedCardForLimits(null);
  };

  const openSimulatePurchaseModal = (card?: VirtualCardRecord) => {
    setSelectedCardForSimulation(card || virtualCards.find((c) => c.id === activeCardId) || virtualCards[0] || null);
    setIsSimulatePurchaseModalOpen(true);
  };
  const closeSimulatePurchaseModal = () => {
    setIsSimulatePurchaseModalOpen(false);
    setSelectedCardForSimulation(null);
  };

  // Initialize with a live authenticated session from server
  useEffect(() => {
    const initSession = async () => {
      try {
        const storedRefresh = localStorage.getItem('lumenfield_refresh_token');
        if (storedRefresh) {
          const res = await fetch('/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
          });
          if (res.ok) {
            const data = await res.json();
            setAuthToken(data.accessToken);
            setRefreshToken(data.refreshToken);
            localStorage.setItem('lumenfield_refresh_token', data.refreshToken);
            const meRes = await fetch('/auth/me', {
              headers: { Authorization: `Bearer ${data.accessToken}` },
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              setCurrentUser(meData.user);
              if (meData.user) {
                ensureMemberForUser(meData.user);
                if (meData.user.role !== 'SUPER_ADMIN') {
                  await fetchKycStatus(data.accessToken, meData.user);
                }
              }
              if (meData.user?.role === 'SUPER_ADMIN') {
                setAdminTab('members');
                setCurrentView('admin');
                await fetchAdminDashboardStats(data.accessToken);
              } else {
                setCurrentView('member');
                await fetchMemberWalletActivity(data.accessToken);
              }
              return;
            }
          } else {
            // Stale or expired session on server: clear it
            localStorage.removeItem('lumenfield_refresh_token');
          }
        }

        // No valid session — stay signed out on the landing page
        setCurrentUser(null);
      } catch (err) {
        console.debug('[AppContext] Init session:', err);
        setCurrentUser(null);
      }
    };

    initSession();
  }, []);

  const openAuthModal = (
    mode: 'login' | 'register' | 'forgot' | 'reset' = 'login',
    resetToken = '',
  ) => {
    setAuthModalMode(mode);
    setAuthResetToken(resetToken);
    setIsAuthModalOpen(true);
  };
  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthResetToken('');
  };

  const openSecurityModal = (tab: 'mfa' | 'password' | 'sessions' | 'token_rotation' = 'mfa') => {
    setSecurityModalTab(tab);
    setIsSecurityModalOpen(true);
  };
  const closeSecurityModal = () => setIsSecurityModalOpen(false);

  const loginUser = async (params: { email: string; password: string; totpCode?: string }) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed.');
    }
    if (data.requiresMfa) {
      return data;
    }
    setAuthToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    localStorage.setItem('lumenfield_refresh_token', data.refreshToken);
    setCurrentUser(data.user);
    ensureMemberForUser(data.user);
    if (data.user.role === 'SUPER_ADMIN') {
      setAdminTab('members');
      setCurrentView('admin');
      await fetchAdminDashboardStats(data.accessToken);
    } else {
      setCurrentView('member');
      await fetchKycStatus(data.accessToken, data.user);
      await fetchMemberWalletActivity(data.accessToken);
    }
    return data;
  };

  const completeMfaLogin = async (params: { mfaTicket: string; totpCode: string }) => {
    const res = await fetch('/auth/mfa-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Two-Factor Authentication verification failed.');
    }
    setAuthToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    localStorage.setItem('lumenfield_refresh_token', data.refreshToken);
    setCurrentUser(data.user);
    ensureMemberForUser(data.user);
    if (data.user.role === 'SUPER_ADMIN') {
      setAdminTab('members');
      setCurrentView('admin');
      await fetchAdminDashboardStats(data.accessToken);
    } else {
      setCurrentView('member');
      await fetchKycStatus(data.accessToken, data.user);
      await fetchMemberWalletActivity(data.accessToken);
    }
    return data;
  };

  const rotateTokens = async () => {
    if (!refreshToken) {
      throw new Error('No active refresh token available.');
    }
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Replay attack detected or revoked token -> Clear session
      setAuthToken(null);
      setRefreshToken(null);
      localStorage.removeItem('lumenfield_refresh_token');
      setCurrentUser(null);
      setCurrentView('landing');
      throw new Error(data.message || 'Session invalidated during token rotation.');
    }
    setAuthToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    localStorage.setItem('lumenfield_refresh_token', data.refreshToken);
    return data;
  };

  const registerUser = async (params: any) => {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(formatApiError(data, 'Registration failed.'));
    }
    // New accounts receive a session so they land on the member dashboard immediately
    if (data.accessToken && data.refreshToken && data.user) {
      setAuthToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      localStorage.setItem('lumenfield_refresh_token', data.refreshToken);
      setCurrentUser(data.user);
      ensureMemberForUser(data.user);
      if (data.user.role === 'SUPER_ADMIN') {
        setAdminTab('members');
        setCurrentView('admin');
      } else {
        setCurrentView('member');
      }
    }
    return data;
  };

  const logoutUser = async (options?: { redirectToLanding?: boolean; silent?: boolean }) => {
    const redirectToLanding = options?.redirectToLanding !== false;
    try {
      if (authToken) {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
    } catch {}
    setAuthToken(null);
    setRefreshToken(null);
    localStorage.removeItem('lumenfield_refresh_token');
    try {
      sessionStorage.removeItem(CARD_SECRETS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCardSessionSecrets({});
    setOneTimeCredentials(null);
    setCurrentUser(null);
    setActiveMemberId('');
    setKycStatus('NOT_SUBMITTED');
    setKycSubmission(null);
    setKycNotifications([]);
    if (redirectToLanding) {
      setCurrentView('landing');
    }
    if (!options?.silent) {
      showToast('Signed out successfully.', 'info');
    }
  };

  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  // Only a real signed-in member profile — never a marketing teaser / guest stub
  const activeMember =
    (activeMemberId && members.find((m) => m.id === activeMemberId)) ||
    (currentUser?.role === 'MEMBER'
      ? members.find((m) => m.id === currentUser.id) || null
      : null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit = (
    action: string,
    target: string,
    reference: string,
    details: string,
    actor = 'admin@lumenfield.test',
    role: 'Admin' | 'Member' | 'System' = 'Admin'
  ) => {
    const newEntry: AuditLogEntry = {
      id: 'audit-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      actor,
      role,
      action,
      target,
      reference,
      details,
    };
    setAuditLog((prev) => [newEntry, ...prev]);
  };

  // Fund Wallet (Admin action)
  const fundWallet = ({
    memberId,
    amount,
    currency,
    source,
    reference,
    reason,
  }: {
    memberId: string;
    amount: number;
    currency: Currency;
    source: string;
    reference: string;
    reason: string;
  }) => {
    if (currentUser?.role !== 'SUPER_ADMIN') {
      showToast(
        "Forbidden: administrator access is required for this action.",
        'warning'
      );
      return false;
    }

    if (!amount || amount <= 0) {
      showToast('Please enter a valid funding amount greater than 0.', 'warning');
      return false;
    }

    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) {
      showToast('Target member not found.', 'warning');
      return false;
    }

    // ACCEPTANCE CRITERIA: Funding an unverified member is rejected.
    if (!targetMember.identityVerified) {
      showToast(
        `Funding rejected: Member ${targetMember.name} (${targetMember.id}) is UNVERIFIED. Under compliance rules, KYC identity verification must be APPROVED before wallet funding is permitted. (HTTP 403 Forbidden)`,
        'warning'
      );
      return false;
    }

    // Call server API route with Bearer token — durable source of truth for ledger
    if (authToken) {
      const idempotencyKey = `idemp-fund-${targetMember.id}-${Date.now()}`;
      void fetch('/admin/funding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          memberId: targetMember.id,
          amountMinor: Math.round(amount * 100),
          currency,
          source: 'TEST',
          reference,
          reason: reason || 'Member wallet credit.',
          idempotencyKey,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.error('Server funding sync failed:', errBody);
            return;
          }
          await fetchAdminDashboardStats(authToken);
        })
        .catch((e) => console.error('Server funding sync:', e));
    }

    // 1. Update Member Wallet Balance
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const currentBal = m.wallets[currency] || 0;
          return {
            ...m,
            wallets: {
              ...m.wallets,
              [currency]: currentBal + amount,
            },
          };
        }
        return m;
      })
    );

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // 2. Add Transaction to Member's History if active member or target member
    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      description: `Test funding, administrator credit (${reference})`,
      date: dateFormatted,
      timestamp: now.toISOString(),
      status: 'Completed',
      amount: amount,
      currency: currency,
      type: 'admin_credit',
      counterparty: 'Funding pool',
      reference: reference,
      category: 'Funding',
    };
    setTransactions((prev) => [newTx, ...prev]);

    // 3. Post Balanced Double-Entry to Ledger
    const newLedger: LedgerPosting = {
      id: 'ledg-' + Date.now(),
      reference: reference,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp: now.toISOString(),
      description: reason || 'Member wallet credit.',
      currency: currency,
      debitAccount: 'Funding pool',
      debitAmount: amount,
      creditAccount: `Member wallet (${currency})`,
      creditAmount: amount,
      memberId: targetMember.id,
      memberName: targetMember.name,
      adminActor: 'Admin Operator (LF-ADM-01)',
    };
    setLedgerPostings((prev) => [newLedger, ...prev]);

    // 4. Record to Recent Funding
    const newFundingRecord: FundingRecord = {
      id: 'fund-' + Date.now(),
      memberId: targetMember.id,
      memberName: targetMember.name,
      reference: reference,
      date: dateFormatted,
      amount: amount,
      currency: currency,
      source: source,
      reason: reason,
      adminUser: 'Admin Operator',
    };
    setRecentFunding((prev) => [newFundingRecord, ...prev]);

    // 5. Audit Log
    logAudit(
      'FUND_WALLET_CREDIT',
      `${targetMember.name} (${targetMember.id})`,
      reference,
      `Credited ${currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : currency === 'GBP' ? '£' : '€'}${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to wallet via ${source}. Reason: ${reason}`
    );

    showToast(
      `Successfully funded ${targetMember.name}'s ${currency} wallet with ${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}!`,
      'success'
    );

    return true;
  };

  // Send Money (Member action)
  const sendTransfer = ({
    recipient,
    amount,
    currency,
  }: {
    recipient: string;
    amount: number;
    currency: Currency;
  }) => {
    if (!activeMember) {
      return { success: false, message: 'Please sign in to send money.' };
    }
    if (!recipient.trim()) {
      return { success: false, message: 'Please specify a recipient name or Lumenfield ID.' };
    }
    if (!amount || amount <= 0) {
      return { success: false, message: 'Please enter a transfer amount greater than 0.' };
    }

    const currentBal = activeMember.wallets[currency] || 0;
    if (amount > currentBal) {
      return {
        success: false,
        message: `Insufficient funds. Your available ${currency} balance is ${currentBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
      };
    }

    // Deduct from sender
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === activeMember.id) {
          return {
            ...m,
            wallets: {
              ...m.wallets,
              [currency]: m.wallets[currency] - amount,
            },
          };
        }
        // If recipient matches a registered member, credit them!
        if (
          m.id.toLowerCase() === recipient.toLowerCase() ||
          m.name.toLowerCase() === recipient.toLowerCase()
        ) {
          return {
            ...m,
            wallets: {
              ...m.wallets,
              [currency]: (m.wallets[currency] || 0) + amount,
            },
          };
        }
        return m;
      })
    );

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ref = 'TR-' + Math.floor(1000 + Math.random() * 9000);

    // Add transaction to history
    const tx: Transaction = {
      id: 'tx-' + Date.now(),
      description: `Transfer to ${recipient}`,
      date: dateFormatted,
      timestamp: now.toISOString(),
      status: 'Completed',
      amount: -amount,
      currency: currency,
      type: 'transfer_out',
      counterparty: recipient,
      reference: ref,
      category: 'Member Transfer',
    };
    setTransactions((prev) => [tx, ...prev]);

    // Double entry posting
    const ledger: LedgerPosting = {
      id: 'ledg-' + Date.now(),
      reference: ref,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp: now.toISOString(),
      description: `P2P transfer to ${recipient}`,
      currency: currency,
      debitAccount: `Member wallet (${activeMember.name})`,
      debitAmount: amount,
      creditAccount: `Destination: ${recipient}`,
      creditAmount: amount,
      memberId: activeMember.id,
      memberName: activeMember.name,
      adminActor: 'System (P2P Rail)',
    };
    setLedgerPostings((prev) => [ledger, ...prev]);

    logAudit(
      'P2P_TRANSFER',
      recipient,
      ref,
      `Sent ${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${recipient}.`,
      activeMember.email,
      'Member'
    );

    showToast(`Transferred ${currency} ${amount.toFixed(2)} to ${recipient} successfully!`, 'success');
    notifyTransferExecuted(recipient, `${currency} ${amount.toFixed(2)}`).catch(() => {});
    return { success: true, message: 'Transfer completed instantly.' };
  };

  // Download Member Statement (CSV and PDF)
  const downloadStatement = async (format: 'csv' | 'pdf', currency?: string) => {
    if (!activeMember) {
      showToast('Please sign in to download a statement.', 'warning');
      return;
    }
    try {
      if (authToken) {
        const queryParams = new URLSearchParams({ format });
        if (currency && currency !== 'ALL') queryParams.set('currency', currency);
        const res = await fetch(`/wallet/statement?${queryParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lumenfield-statement-${Date.now()}.${format === 'csv' ? 'csv' : 'html'}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          showToast(`Downloaded ${format.toUpperCase()} account statement.`, 'success');
          return;
        }
      }

      // Offline / fallback generator
      if (format === 'csv') {
        const headers = ['Date', 'Reference', 'Description', 'Counterparty', 'Currency', 'Amount', 'Status'];
        const rows = transactions.map((t) => [
          `"${t.date}"`,
          `"${t.reference || t.id}"`,
          `"${t.description.replace(/"/g, '""')}"`,
          `"${t.counterparty || ''}"`,
          `"${t.currency}"`,
          t.amount,
          `"${t.status}"`,
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lumenfield-statement-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Downloaded CSV account statement.', 'success');
      } else {
        const printWindow = window.open('', '_blank');
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Lumenfield Account Statement</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0E1B1F; margin: 40px; background: #fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0A3D3F; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: bold; color: #0A3D3F; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { background: #F4F7F6; padding: 8px 12px; text-align: left; border-bottom: 1px solid #DCE5E3; color: #4A5B60; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #EDF2F1; }
    .text-right { text-align: right; }
    .credit { color: #0A5C47; font-weight: 600; }
    .debit { color: #0E1B1F; font-weight: 600; }
    .footer { font-size: 11px; color: #8FA5A3; margin-top: 40px; text-align: center; border-top: 1px solid #DCE5E3; padding-top: 16px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Lumenfield Credit Union</div>
      <div style="color: #4A5B60; font-size: 14px; margin-top: 4px;">Member: ${activeMember.name} (${activeMember.id})</div>
      <div style="color: #8FA5A3; font-size: 12px;">Country: ${activeMember.country}</div>
    </div>
    <div style="text-align: right; font-size: 13px; color: #4A5B60;">
      <div>Generated: ${new Date().toUTCString()}</div>
      <div>Status: Verified Member</div>
    </div>
  </div>
  <h3>Account Balances</h3>
  <table>
    <thead><tr><th>Currency</th><th>Account Type</th><th class="text-right">Balance</th></tr></thead>
    <tbody>
      <tr><td>USD</td><td>Member Wallet</td><td class="text-right">$${activeMember.wallets.USD.toFixed(2)}</td></tr>
      <tr><td>CAD</td><td>Member Wallet</td><td class="text-right">C$${activeMember.wallets.CAD.toFixed(2)}</td></tr>
      <tr><td>GBP</td><td>Member Wallet</td><td class="text-right">£${activeMember.wallets.GBP.toFixed(2)}</td></tr>
      <tr><td>EUR</td><td>Member Wallet</td><td class="text-right">€${activeMember.wallets.EUR.toFixed(2)}</td></tr>
    </tbody>
  </table>
  <h3 style="margin-top: 32px;">Transaction Activity</h3>
  <table>
    <thead>
      <tr><th>Date</th><th>Reference</th><th>Description</th><th>Counterparty</th><th>Currency</th><th class="text-right">Amount</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${transactions.map((t) => `
        <tr>
          <td>${t.date}</td>
          <td style="font-family: monospace;">${t.reference || t.id}</td>
          <td>${t.description}</td>
          <td>${t.counterparty || 'Transfer rail'}</td>
          <td>${t.currency}</td>
          <td class="text-right ${t.amount > 0 ? 'credit' : 'debit'}">${t.amount > 0 ? '+' : ''}$${Math.abs(t.amount).toFixed(2)}</td>
          <td>${t.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    Lumenfield Credit Union — Member account statement. www.lumenfieldcu.com
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        } else {
          const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lumenfield-statement-${Date.now()}.html`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
        showToast('Generated printable PDF statement.', 'success');
      }
    } catch (err: any) {
      showToast(`Failed to export statement: ${err.message}`, 'warning');
    }
  };

  // ---------------------------------------------------------------------------
  // VIRTUAL CARDS API METHODS
  // ---------------------------------------------------------------------------
  const fetchCards = async (): Promise<void> => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/cards', { headers });
      if (res.ok) {
        const data: VirtualCardRecord[] = await res.json();
        setVirtualCards(data);
        if (data.length > 0 && !activeCardId) {
          setActiveCardId(data[0].id);
        }
      }
    } catch (err) {
      console.debug('Failed to fetch cards:', err);
    }
  };

  const fetchCardTransactions = async (cardId: string): Promise<CardTransactionRecord[]> => {
    if (!cardId) return [];
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/cards/${cardId}/transactions`, { headers });
      if (res.ok) {
        const txs: CardTransactionRecord[] = await res.json();
        setCardTransactions(txs);
        return txs;
      }
    } catch (err) {
      console.debug('Failed to fetch card transactions:', err);
    }
    return [];
  };

  const createVirtualCard = async (params: {
    currency: CardCurrency;
    cardholderName?: string;
    dailyLimitMinor?: number;
    monthlyLimitMinor?: number;
  }): Promise<CardCreationResponse> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch('/cards', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.message || 'Failed to create virtual card.';
      showToast(msg, 'warning');
      throw new Error(msg);
    }

    setOneTimeCredentials(data.oneTimeCredentials);
    if (data.card?.id && data.oneTimeCredentials) {
      setCardSessionSecrets((prev) => {
        const next = { ...prev, [data.card.id]: data.oneTimeCredentials };
        writeCardSessionSecrets(next);
        return next;
      });
    }
    await fetchCards();
    setActiveCardId(data.card.id);
    showToast(`Virtual card for ${params.currency} wallet created successfully!`, 'success');
    return data;
  };

  const toggleCardFreeze = async (cardId?: string) => {
    const targetId = cardId || activeCardId || virtualCards[0]?.id;
    if (!targetId) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/cards/${targetId}/toggle-freeze`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to toggle card status.');
      }

      await fetchCards();
      const newStatus = data.card.status === 'ACTIVE' ? 'active' : 'frozen';
      if (activeMember) {
        setMembers((prev) =>
          prev.map((m) => {
            if (m.id === activeMember.id) {
              return {
                ...m,
                virtualCard: {
                  ...m.virtualCard,
                  status: newStatus,
                },
              };
            }
            return m;
          })
        );
      }

      showToast(
        data.card.status === 'FROZEN'
          ? 'Virtual card has been frozen. All simulated purchases will be declined.'
          : 'Virtual card is active and ready for simulated purchases.',
        data.card.status === 'FROZEN' ? 'info' : 'success'
      );
      return data.card;
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle freeze status.', 'warning');
      throw err;
    }
  };

  const updateCardLimits = async (arg1: any, arg2?: any, arg3?: any) => {
    let targetCardId = activeCardId || virtualCards[0]?.id;
    let dailyLimitMinor = 100000;
    let monthlyLimitMinor = 500000;

    if (typeof arg1 === 'object' && arg1 !== null) {
      targetCardId = arg1.cardId || targetCardId;
      dailyLimitMinor = arg1.dailyLimitMinor ?? 100000;
      monthlyLimitMinor = arg1.monthlyLimitMinor ?? 500000;
    } else if (typeof arg1 === 'number') {
      dailyLimitMinor = Math.round(arg1 * 100);
      monthlyLimitMinor = arg2 ? Math.round(arg2 * 100) : dailyLimitMinor * 5;
    }

    if (!targetCardId) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/cards/${targetCardId}/limits`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          dailyLimitMinor,
          monthlyLimitMinor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update card limits.');
      }

      await fetchCards();
      if (activeMember) {
        setMembers((prev) =>
          prev.map((m) => {
            if (m.id === activeMember.id) {
              return {
                ...m,
                virtualCard: {
                  ...m.virtualCard,
                  dailyLimit: Math.round(dailyLimitMinor / 100),
                  monthlyLimit: Math.round(monthlyLimitMinor / 100),
                },
              };
            }
            return m;
          })
        );
      }

      showToast('Virtual card spending limits updated.', 'success');
      return data.card;
    } catch (err: any) {
      showToast(err.message || 'Failed to update spending limits.', 'warning');
      throw err;
    }
  };

  const simulateCardPurchase = async (params: {
    cardId: string;
    amountMinor: number;
    merchantName: string;
    merchantCategory?: string;
    currency?: CardCurrency;
  }) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`/cards/${params.cardId}/simulate-purchase`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json();

    await fetchCardTransactions(params.cardId);
    await fetchCards();

    if (!res.ok) {
      throw new Error(data.message || 'Transaction declined.');
    }

    if (data.transaction && activeMember) {
      const cur = data.transaction.currency as Currency;
      const majorAmt = data.transaction.amountMinor / 100;
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === activeMember.id) {
            return {
              ...m,
              wallets: {
                ...m.wallets,
                [cur]: Math.max(0, (m.wallets[cur] || 0) - majorAmt),
              },
            };
          }
          return m;
        })
      );
    }

    showToast(
      `Approved: ${params.merchantName} (${formatMoney({ amountMinor: params.amountMinor, currency: data.transaction.currency })})`,
      'success'
    );
    return data;
  };

  // Sync cards on login or active card change
  useEffect(() => {
    if (authToken) {
      fetchCards();
    }
  }, [authToken]);

  useEffect(() => {
    if (activeCardId) {
      fetchCardTransactions(activeCardId);
    }
  }, [activeCardId]);

  // Submit loan application (persisted server-side so admin dashboard sees it)
  const submitLoanApplication = async ({
    type,
    amount,
    termMonths,
    purpose,
    assetDetails,
    downPayment = 0,
  }: {
    type: 'auto' | 'mortgage';
    amount: number;
    termMonths: number;
    purpose: string;
    assetDetails?: string;
    downPayment?: number;
  }) => {
    if (!activeMember) {
      showToast('Please sign in to apply for a loan.', 'warning');
      return;
    }
    const apr = type === 'auto' ? 5.4 : 6.2;
    const monthlyRate = apr / 100 / 12;
    const monthlyPayment =
      (amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    const optimistic: LoanApplication = {
      id: `loan-${type}-pending`,
      memberId: activeMember.id,
      memberName: activeMember.name,
      memberEmail: activeMember.email,
      type,
      title: type === 'auto' ? 'Auto loan application' : 'Mortgage loan application',
      requestedAmount: amount,
      termMonths,
      interestRateApr: apr,
      estimatedMonthlyPayment: Number(monthlyPayment.toFixed(2)),
      status: 'under_review',
      currentStage: 'Review',
      submittedDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      currency: 'USD',
      purpose,
      assetDetails:
        assetDetails ||
        (type === 'auto' ? 'Vehicle under evaluation' : 'Real estate parcel evaluation'),
      downPayment,
    };

    setLoanApplications((prev) => [optimistic, ...prev.filter((l) => l.id !== optimistic.id)]);

    if (!authToken) {
      showToast('Sign in again to submit a loan application.', 'warning');
      return;
    }

    try {
      const res = await fetch('/loans/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          type,
          amount,
          termMonths,
          purpose,
          assetDetails: optimistic.assetDetails,
          downPayment,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data.message || 'Could not submit loan application.');
      }
      const saved = data.loan
        ? mapRemoteLoans([data.loan])[0]
        : { ...optimistic, id: data.loan?.id || optimistic.id };
      setLoanApplications((prev) => [
        saved!,
        ...prev.filter((l) => l.id !== optimistic.id && l.id !== saved!.id),
      ]);
      logAudit(
        'LOAN_APPLICATION_SUBMITTED',
        `${type.toUpperCase()} Loan ($${amount.toLocaleString()})`,
        saved!.id,
        `Requested $${amount.toLocaleString()} over ${termMonths} months for ${purpose}.`,
        activeMember.email,
        'Member',
      );
      showToast(
        `Your ${type} loan application for $${amount.toLocaleString()} has been submitted for review!`,
        'success',
      );
    } catch (err: any) {
      setLoanApplications((prev) => prev.filter((l) => l.id !== optimistic.id));
      showToast(err.message || 'Loan application failed.', 'warning');
    }
  };

  const updateLoanStatus = (
    loanId: string,
    status: 'approved' | 'rejected' | 'under_review'
  ) => {
    setLoanApplications((prev) =>
      prev.map((app) => {
        if (app.id === loanId) {
          const currentStage = status === 'approved' || status === 'rejected' ? 'Decision' : 'Review';
          return { ...app, status, currentStage };
        }
        return app;
      })
    );

    // If approved, optionally disburse funds to member wallet
    const app = loanApplications.find((l) => l.id === loanId);
    if (app && status === 'approved') {
      const now = new Date();
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === app.memberId) {
            return {
              ...m,
              wallets: {
                ...m.wallets,
                [app.currency]: (m.wallets[app.currency] || 0) + app.requestedAmount,
              },
            };
          }
          return m;
        })
      );

      const ref = 'DISB-' + loanId;
      setTransactions((prev) => [
        {
          id: 'tx-' + Date.now(),
          description: `${app.title} Disbursement`,
          date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          timestamp: now.toISOString(),
          status: 'Completed',
          amount: app.requestedAmount,
          currency: app.currency,
          type: 'loan_disbursement',
          counterparty: 'Lumenfield Credit Committee',
          reference: ref,
          category: 'Loan',
        },
        ...prev,
      ]);

      setLedgerPostings((prev) => [
        {
          id: 'ledg-' + Date.now(),
          reference: ref,
          date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          timestamp: now.toISOString(),
          description: `Disbursement for ${app.title}`,
          currency: app.currency,
          debitAccount: 'Loan Principal Asset Pool',
          debitAmount: app.requestedAmount,
          creditAccount: `Member wallet (${app.currency})`,
          creditAmount: app.requestedAmount,
          memberId: app.memberId,
          memberName: app.memberName,
          adminActor: 'Credit Officer (LF-ADM-02)',
        },
        ...prev,
      ]);
    }

    logAudit(
      'LOAN_STATUS_UPDATED',
      loanId,
      status.toUpperCase(),
      `Status changed to ${status}.`
    );

    if (app && (status === 'approved' || status === 'rejected')) {
      const curSymbol = app.currency === 'USD' ? '$' : app.currency === 'CAD' ? 'C$' : app.currency === 'GBP' ? '£' : '€';
      notifyLoanDecision(
        status === 'approved' ? 'APPROVED' : 'REJECTED',
        `${curSymbol}${app.requestedAmount.toLocaleString()}`
      ).catch(() => {});

      if (authToken && app) {
        void fetch(`/admin/loans/${loanId}/decision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            decision: status === 'approved' ? 'APPROVE' : 'REJECT',
            memberId: app.memberId,
            memberName: app.memberName,
            memberEmail:
              app.memberEmail ||
              members.find((m) => m.id === app.memberId)?.email,
            requestedAmount: app.requestedAmount,
            type: app.type,
            termMonths: app.termMonths,
            currency: app.currency,
            purpose: app.purpose,
          }),
        })
          .then(() => fetchAdminDashboardStats(authToken))
          .catch((e) => console.error('Loan decision sync:', e));
      }
    }

    showToast(`Loan application #${loanId} updated to ${status}.`, 'info');
  };

  // Upload KYC
  const uploadKYC = (type: KYCDocument['type'], documentName: string, fileName: string) => {
    if (!activeMember) {
      showToast('Please sign in to upload documents.', 'warning');
      return;
    }
    const newDoc: KYCDocument = {
      id: 'doc-' + Date.now(),
      type,
      documentName,
      fileName,
      submittedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'pending',
    };

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === activeMember.id) {
          return {
            ...m,
            documents: [newDoc, ...m.documents],
          };
        }
        return m;
      })
    );

    logAudit(
      'KYC_DOCUMENT_UPLOADED',
      documentName,
      newDoc.id,
      `Member uploaded ${documentName} (${fileName}) for compliance verification.`,
      activeMember.email,
      'Member'
    );

    showToast(`Document "${documentName}" uploaded and queued for admin review.`, 'success');
  };

  // Review KYC
  const reviewKYC = (memberId: string, docId: string, status: 'approved' | 'rejected') => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const updatedDocs = m.documents.map((d) =>
            d.id === docId ? { ...d, status, reviewedBy: 'Admin (LF-ADM-01)' } : d
          );
          const hasApproved = updatedDocs.some((d) => d.status === 'approved');
          return {
            ...m,
            documents: updatedDocs,
            identityVerified: hasApproved,
          };
        }
        return m;
      })
    );

    logAudit(
      'KYC_DOCUMENT_REVIEWED',
      docId,
      status.toUpperCase(),
      `Review completed for member ${memberId}. Decision: ${status}.`
    );

    showToast(`Document ${docId} has been ${status}.`, 'info');
  };

  // ---------------------------------------------------------------------------
  // FULL KYC VERIFICATION & REVIEW QUEUE (HARD RULE 7 & Task Requirements)
  // ---------------------------------------------------------------------------
  const getAdminToken = async (): Promise<string> => {
    if (currentUser?.role === 'SUPER_ADMIN' && authToken) {
      return authToken;
    }
    return '';
  };

  const applyKycStatusToMember = (
    userId: string,
    userEmail: string | undefined,
    data: {
      status?: KycSubmissionStatus | 'NOT_SUBMITTED';
      isApproved?: boolean;
      submission?: KycSubmission | null;
    },
  ) => {
    const status = data.status || (data.isApproved ? 'APPROVED' : 'NOT_SUBMITTED');
    setKycStatus(status);
    if (data.submission) {
      setKycSubmission(data.submission);
    } else if (status === 'NOT_SUBMITTED') {
      setKycSubmission(null);
    }

    const verified = Boolean(data.isApproved) || status === 'APPROVED';
    const mapDocType = (raw: string): KYCDocument['type'] => {
      const key = raw.toUpperCase();
      if (key === 'ID_CARD') return 'id_card';
      if (key === 'RESIDENCE_PERMIT') return 'residence_permit';
      if (key === 'DRIVERS_LICENSE') return 'drivers_license';
      return 'passport';
    };
    const docsFromSubmission: KYCDocument[] = (data.submission?.documents || []).map((d: any) => ({
      id: d.id,
      type: mapDocType(String(d.type || 'PASSPORT')),
      documentName: `${data.submission?.countryCode || ''} ${String(d.type || 'document').replace(/_/g, ' ')}`.trim(),
      fileName: d.fileName,
      submittedAt: new Date(d.uploadedAt || data.submission?.submittedAt || Date.now()).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' },
      ),
      status:
        status === 'APPROVED'
          ? 'approved'
          : status === 'REJECTED'
          ? 'rejected'
          : 'pending',
      rejectionReason: data.submission?.rejectionReason || undefined,
      reviewedBy: data.submission?.reviewedAt ? 'Super Admin' : undefined,
    }));

    setMembers((prev) =>
      prev.map((m) => {
        const match =
          m.id === userId ||
          (!!userEmail && m.email.toLowerCase() === userEmail.toLowerCase());
        if (!match) return m;
        return {
          ...m,
          identityVerified: verified,
          documents: docsFromSubmission.length ? docsFromSubmission : m.documents,
        };
      }),
    );
  };

  const fetchKycStatus = async (accessToken?: string | null, user?: { id: string; email: string } | null) => {
    try {
      const token = accessToken ?? authToken;
      const targetUser = user ?? currentUser;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/kyc/status', { headers });
      if (res.ok) {
        const data = await res.json();
        if (targetUser) {
          applyKycStatusToMember(targetUser.id, targetUser.email, data);
        } else {
          setKycStatus(data.status || 'NOT_SUBMITTED');
          setKycSubmission(data.submission || null);
        }
      }
      const notifRes = await fetch('/kyc/notifications', { headers });
      if (notifRes.ok) {
        const notifs = await notifRes.json();
        setKycNotifications(notifs);
      }
    } catch (err) {
      console.debug('Fetch KYC status:', err);
    }
  };

  const submitKycVerification = async (input: SubmitKycInput) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch('/kyc/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Identity verification submission failed.');
    }

    setKycSubmission(data);
    setKycStatus(data.status);

    const newDocs: KYCDocument[] = data.documents.map((d: any) => ({
      id: d.id,
      type: d.type.toLowerCase(),
      documentName: `${input.countryCode} ${d.type.replace('_', ' ')}`,
      fileName: d.fileName,
      submittedAt: new Date(d.uploadedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'pending',
    }));

    if (activeMember) {
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === activeMember.id) {
            return {
              ...m,
              documents: [...newDocs, ...m.documents],
            };
          }
          return m;
        })
      );
    }

    await fetchKycStatus();
    await fetchAdminKycQueue();

    return data;
  };

  const fetchAdminKycQueue = async (status?: KycSubmissionStatus) => {
    try {
      const token = await getAdminToken();
      const url = status ? `/admin/kyc/queue?status=${status}` : '/admin/kyc/queue';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const queue = await res.json();
        setAdminKycQueue(queue);
      }
    } catch (err) {
      console.debug('Failed to fetch admin KYC queue:', err);
    }
  };

  const readAdminJson = async (res: Response): Promise<any> => {
    const text = await res.text();
    if (!text) {
      if (!res.ok) {
        throw new Error(`Request failed (${res.status}). Please try again.`);
      }
      return {};
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? 'Unexpected server response. Please refresh and try again.'
          : `Request failed (${res.status}). Please try again.`,
      );
    }
  };

  const updateAdminMember = async (
    memberId: string,
    patch: {
      fullName?: string;
      email?: string;
      phone?: string | null;
      countryCode?: string;
      emailVerified?: boolean;
    },
  ) => {
    const token = await getAdminToken();
    const res = await fetch(`/admin/member-directory/${memberId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(patch),
    });
    const data = await readAdminJson(res);
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update member.');
    }
    await fetchAdminDashboardStats(token);
    await fetchAdminKycQueue();
    showToast('Member profile updated.', 'success');
    return data;
  };

  const deleteAdminMember = async (memberId: string) => {
    const token = await getAdminToken();
    // POST /delete is more reliable than HTTP DELETE behind some proxies
    const res = await fetch(`/admin/member-directory/${encodeURIComponent(memberId)}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({}),
    });
    const data = await readAdminJson(res);
    if (!res.ok) {
      throw new Error(data.message || `Failed to delete member (${res.status}).`);
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    await fetchAdminDashboardStats(token);
    await fetchAdminKycQueue();
    showToast('Member account deleted.', 'info');
  };

  const updateAdminKyc = async (
    submissionId: string,
    patch: {
      memberName?: string;
      memberEmail?: string;
      countryCode?: string;
      documentType?: string;
      status?: KycSubmissionStatus;
      reviewerNote?: string | null;
      rejectionReason?: string | null;
    },
  ) => {
    const token = await getAdminToken();
    const res = await fetch(`/admin/kyc/submissions/${submissionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(patch),
    });
    const data = await readAdminJson(res);
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update KYC submission.');
    }
    await fetchAdminKycQueue();
    await fetchAdminDashboardStats(token);
    showToast('KYC record updated.', 'success');
    return data;
  };

  const deleteAdminKyc = async (submissionId: string) => {
    const token = await getAdminToken();
    const res = await fetch(`/admin/kyc/submissions/${submissionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const data = await readAdminJson(res);
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete KYC submission.');
    }
    setAdminKycQueue((prev) => prev.filter((s) => s.id !== submissionId));
    await fetchAdminDashboardStats(token);
    showToast('KYC submission deleted.', 'info');
  };

  const reviewKycSubmission = async (
    submissionId: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO',
    reason?: string
  ) => {
    const token = await getAdminToken();
    const res = await fetch(`/admin/kyc/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Adjudication failed.');
    }

    await fetchAdminKycQueue();
    await fetchAdminMembers(token);

    // Update target member in members list
    setMembers((prev) =>
      prev.map((m) => {
        if (
          m.id === data.memberId ||
          m.email?.toLowerCase() === data.memberEmail?.toLowerCase()
        ) {
          return {
            ...m,
            identityVerified: data.status === 'APPROVED',
            documents: data.documents.map((d: any) => ({
              id: d.id,
              type: d.type.toLowerCase(),
              documentName: `${d.type.replace('_', ' ')} (${d.fileName})`,
              fileName: d.fileName,
              submittedAt: new Date(d.uploadedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              status: data.status.toLowerCase(),
              rejectionReason: data.rejectionReason,
              reviewedBy: 'Super Admin',
            })),
          };
        }
        return m;
      })
    );

    logAudit(
      decision === 'APPROVE'
        ? 'ADMIN_APPROVE_KYC_DOCUMENT'
        : decision === 'REJECT'
        ? 'ADMIN_REJECT_KYC_DOCUMENT'
        : 'ADMIN_UPDATE_MEMBER_STATUS',
      `KYC Submission (${data.id})`,
      data.sanctionsReferenceId || data.id,
      `Super Admin decision: ${decision}. ${reason || 'Adjudication recorded.'}`,
      'support@lumenfieldcu.com',
      'Admin'
    );

    showToast(
      decision === 'APPROVE'
        ? `Submission #${submissionId} approved! Member operations unlocked.`
        : decision === 'REJECT'
        ? `Submission #${submissionId} declined: ${reason}`
        : `Requested additional information for submission #${submissionId}.`,
      decision === 'APPROVE' ? 'success' : decision === 'REJECT' ? 'warning' : 'info'
    );

    if (decision === 'APPROVE' || decision === 'REJECT') {
      notifyKycDecision(decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reason).catch(() => {});
    }

    return data;
  };

  const getAdminDocumentSignedUrl = async (docId: string, expiresIn = 300) => {
    const token = await getAdminToken();
    const res = await fetch(`/admin/kyc/documents/${docId}/signed-url?expiresIn=${expiresIn}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to generate document signed URL.');
    }
    return data;
  };

  const markNotificationsRead = async () => {
    try {
      if (!authToken) return;
      await fetch('/kyc/notifications/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setKycNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  // Convert Currency
  const updateCountryFlags = (
    code: string,
    patch: Partial<Pick<CountryServiceInfo, 'autoLoansEnabled' | 'mortgageEnabled' | 'cardsEnabled'>>,
  ) => {
    if (currentUser?.role !== 'SUPER_ADMIN') {
      showToast('Only administrators can change jurisdiction product rules.', 'warning');
      return;
    }
    setCountries((prev) =>
      prev.map((c) => (c.code === code || c.id === code ? { ...c, ...patch } : c)),
    );
    const label = Object.entries(patch)
      .map(([k, v]) => `${k}=${v ? 'on' : 'off'}`)
      .join(', ');
    logAudit(
      'COUNTRY_PRODUCT_RULES_UPDATED',
      code,
      `CTR-${code}`,
      `Updated jurisdiction flags: ${label}`,
    );
    showToast(`Updated product rules for ${code}.`, 'success');
  };

  const convertCurrency = (from: Currency, to: Currency, amount: number) => {
    if (!activeMember) {
      return { success: false, message: 'Please sign in to convert currency.' };
    }
    if (from === to) {
      return { success: false, message: 'Source and target currencies must be different.' };
    }
    const current = activeMember.wallets[from] || 0;
    if (amount > current) {
      return { success: false, message: `Insufficient ${from} balance.` };
    }

    // Static test rates
    const ratesToUSD: Record<Currency, number> = {
      USD: 1.0,
      CAD: 0.74,
      GBP: 1.28,
      EUR: 1.08,
    };

    const amountInUSD = amount * ratesToUSD[from];
    const convertedAmount = amountInUSD / ratesToUSD[to];

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === activeMember.id) {
          return {
            ...m,
            wallets: {
              ...m.wallets,
              [from]: m.wallets[from] - amount,
              [to]: (m.wallets[to] || 0) + convertedAmount,
            },
          };
        }
        return m;
      })
    );

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ref = 'SWAP-' + Math.floor(1000 + Math.random() * 9000);

    setTransactions((prev) => [
      {
        id: 'tx-' + Date.now(),
        description: `Currency Swap ${from} → ${to}`,
        date: dateFormatted,
        timestamp: now.toISOString(),
        status: 'Completed',
        amount: -amount,
        currency: from,
        type: 'currency_swap',
        counterparty: `Lumenfield FX (+${to} ${convertedAmount.toFixed(2)})`,
        reference: ref,
        category: 'FX Swap',
      },
      ...prev,
    ]);

    if (authToken) {
      fetch('/wallet/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fromCurrency: from,
          toCurrency: to,
          amount,
        }),
      }).catch((e) => console.error('Currency swap sync:', e));
    }

    showToast(
      `Converted ${from} ${amount.toFixed(2)} to ${to} ${convertedAmount.toFixed(2)} successfully!`,
      'success'
    );
    return { success: true, message: 'Exchange completed.' };
  };

  const resetDemoData = () => {
    setMembers(INITIAL_MEMBERS);
    setActiveMemberId('');
    setTransactions(INITIAL_TRANSACTIONS);
    setLoanApplications(INITIAL_LOAN_APPLICATIONS);
    setLedgerPostings(INITIAL_LEDGER_POSTINGS);
    setRecentFunding(INITIAL_RECENT_FUNDING);
    setAuditLog(INITIAL_AUDIT_LOG);
    if (currentUser) {
      ensureMemberForUser(currentUser);
    }
    showToast('Account data has been reset.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        memberTab,
        setMemberTab,
        adminTab,
        setAdminTab,
        members,
        activeMember,
        setActiveMemberId,
        fetchAdminMembers,
        fetchAdminLedger,
        fetchMemberWalletActivity,
        transactions,
        loanApplications,
        ledgerPostings,
        recentFunding,
        auditLog,
        countries,
        updateCountryFlags,
        toasts,
        showToast,
        dismissToast,
        fundWallet,
        sendTransfer,
        // Virtual Cards State & API Methods
        virtualCards,
        activeCardId,
        setActiveCardId,
        cardTransactions,
        oneTimeCredentials,
        setOneTimeCredentials,
        cardSessionSecrets,
        isCreateCardModalOpen,
        openCreateCardModal,
        closeCreateCardModal,
        isCardLimitsModalOpen,
        openCardLimitsModal,
        closeCardLimitsModal,
        isSimulatePurchaseModalOpen,
        openSimulatePurchaseModal,
        closeSimulatePurchaseModal,
        selectedCardForLimits,
        selectedCardForSimulation,
        fetchCards,
        createVirtualCard,
        toggleCardFreeze,
        updateCardLimits,
        simulateCardPurchase,
        fetchCardTransactions,
        submitLoanApplication,
        updateLoanStatus,
        uploadKYC,
        reviewKYC,
        kycSubmission,
        kycStatus,
        kycNotifications,
        adminKycQueue,
        isKycModalOpen,
        openKycModal,
        closeKycModal,
        fetchKycStatus,
        submitKycVerification,
        fetchAdminKycQueue,
        reviewKycSubmission,
        updateAdminMember,
        deleteAdminMember,
        updateAdminKyc,
        deleteAdminKyc,
        getAdminDocumentSignedUrl,
        markNotificationsRead,
        convertCurrency,
        resetDemoData,
        currentUser,
        setCurrentUser,
        authToken,
        setAuthToken,
        refreshToken,
        setRefreshToken,
        isAuthModalOpen,
        authModalMode,
        authResetToken,
        openAuthModal,
        closeAuthModal,
        isSecurityModalOpen,
        securityModalTab,
        openSecurityModal,
        closeSecurityModal,
        loginUser,
        completeMfaLogin,
        rotateTokens,
        registerUser,
        logoutUser,
        downloadStatement,
        isTermsModalOpen,
        openTermsModal,
        closeTermsModal,
        isPrivacyModalOpen,
        openPrivacyModal,
        closePrivacyModal,
        exportPersonalData,
        requestAccountDeletion,
        adminDashboardStats,
        fetchAdminDashboardStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
