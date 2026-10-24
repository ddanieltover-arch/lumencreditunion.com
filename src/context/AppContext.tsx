import React, { createContext, useContext, useState, useEffect } from 'react';
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
import {
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  INITIAL_LOAN_APPLICATION,
  INITIAL_LEDGER_POSTINGS,
  INITIAL_RECENT_FUNDING,
  INITIAL_AUDIT_LOG,
  COUNTRIES,
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
  activeMember: MemberProfile;
  setActiveMemberId: (id: string) => void;

  transactions: Transaction[];
  loanApplications: LoanApplication[];
  ledgerPostings: LedgerPosting[];
  recentFunding: FundingRecord[];
  auditLog: AuditLogEntry[];
  countries: CountryServiceInfo[];

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
  }) => void;

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
  fetchKycStatus: () => Promise<void>;
  submitKycVerification: (input: SubmitKycInput) => Promise<any>;
  fetchAdminKycQueue: (status?: KycSubmissionStatus) => Promise<void>;
  reviewKycSubmission: (
    submissionId: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO',
    reason?: string
  ) => Promise<any>;
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
  openSecurityModal: () => void;
  closeSecurityModal: () => void;
  loginUser: (params: { email: string; password: string; totpCode?: string }) => Promise<any>;
  completeMfaLogin: (params: { mfaTicket: string; totpCode: string }) => Promise<any>;
  rotateTokens: () => Promise<any>;
  registerUser: (params: any) => Promise<any>;
  logoutUser: () => Promise<void>;
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
  fetchAdminDashboardStats: () => Promise<void>;

  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [memberTab, setMemberTab] = useState<MemberTab>('overview');
  const [adminTab, setAdminTab] = useState<AdminTab>('fund_wallet');

  const [members, setMembers] = useState<MemberProfile[]>(INITIAL_MEMBERS);
  const [activeMemberId, setActiveMemberId] = useState<string>('LF-000124');

  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([
    INITIAL_LOAN_APPLICATION,
  ]);
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

  const fetchAdminDashboardStats = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/admin/dashboard-stats', { headers });
      if (res.ok) {
        const stats = await res.json();
        setAdminDashboardStats(stats);
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
            status: c.status || 'Live Sandbox',
          }));
          setCountries(normalized);
        }
      })
      .catch((err) => {
        console.debug('Loaded seeded in-memory countries fallback:', err);
      });
  }, []);

  const [currentUser, setCurrentUser] = useState<AppContextType['currentUser']>({
    id: '00000000-0000-0000-0000-000000000002',
    email: 'amara.o@lumenfield.test',
    fullName: 'Amara Okafor',
    role: 'MEMBER',
    countryCode: 'US',
    mfaEnabled: false,
  });
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [authResetToken, setAuthResetToken] = useState('');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // KYC Verification State (HARD RULE 7 & Task Requirements)
  const [kycSubmission, setKycSubmission] = useState<KycSubmission | null>(null);
  const [kycStatus, setKycStatus] = useState<KycSubmissionStatus | 'NOT_SUBMITTED'>('NOT_SUBMITTED');
  const [kycNotifications, setKycNotifications] = useState<any[]>([]);
  const [adminKycQueue, setAdminKycQueue] = useState<KycSubmission[]>([]);
  const [isKycModalOpen, setIsKycModalOpen] = useState<boolean>(false);

  const openKycModal = () => setIsKycModalOpen(true);
  const closeKycModal = () => setIsKycModalOpen(false);

  // Virtual Card State & Modals
  const [virtualCards, setVirtualCards] = useState<VirtualCardRecord[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardTransactions, setCardTransactions] = useState<CardTransactionRecord[]>([]);
  const [oneTimeCredentials, setOneTimeCredentials] = useState<CardOneTimeSensitiveDetails | null>(null);
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
              return;
            }
          } else {
            // Stale or expired session on server: clear it
            localStorage.removeItem('lumenfield_refresh_token');
          }
        }

        // Live mode: no auto-login — users must sign in explicitly
      } catch (err) {
        console.debug('[AppContext] Init session:', err);
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

  const openSecurityModal = () => setIsSecurityModalOpen(true);
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
    if (data.user.role === 'SUPER_ADMIN') {
      setCurrentView('admin');
    } else {
      setCurrentView('member');
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
    if (data.user.role === 'SUPER_ADMIN') {
      setCurrentView('admin');
    } else {
      setCurrentView('member');
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
      throw new Error(data.message || 'Registration failed.');
    }
    return data;
  };

  const logoutUser = async () => {
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
    setCurrentUser(null);
    setCurrentView('landing');
    showToast('Signed out successfully.', 'info');
  };

  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const activeMember =
    members.find((m) => m.id === activeMemberId) || members[0];

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
        "Forbidden: role 'MEMBER' lacks permission for this endpoint. (HARD RULE 5: A MEMBER cannot call any admin route)",
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

    // Call server API route with Bearer token
    if (authToken) {
      const idempotencyKey = `idemp-fund-${targetMember.id}-${Date.now()}`;
      fetch('/admin/funding', {
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
          reason: reason || 'Sandbox test funds credit.',
          idempotencyKey,
        }),
      }).catch((e) => console.error('Server funding sync:', e));
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
      counterparty: 'Sandbox funding pool',
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
      description: reason || 'Sandbox test funds credit.',
      currency: currency,
      debitAccount: 'Sandbox funding pool',
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
    .banner { background: #FFF1CC; color: #5A4100; padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center; margin-bottom: 24px; border: 1px solid #F0D58A; }
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
  <div class="banner">Sandbox environment: all balances are test funds, not real money.</div>
  <div class="header">
    <div>
      <div class="title">Lumenfield Financial Sandbox</div>
      <div style="color: #4A5B60; font-size: 14px; margin-top: 4px;">Member: ${activeMember.name} (${activeMember.id})</div>
      <div style="color: #8FA5A3; font-size: 12px;">Country: ${activeMember.country}</div>
    </div>
    <div style="text-align: right; font-size: 13px; color: #4A5B60;">
      <div>Generated: ${new Date().toUTCString()}</div>
      <div>Status: Sandbox Verified</div>
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
          <td>${t.counterparty || 'Sandbox rail'}</td>
          <td>${t.currency}</td>
          <td class="text-right ${t.amount > 0 ? 'credit' : 'debit'}">${t.amount > 0 ? '+' : ''}$${Math.abs(t.amount).toFixed(2)}</td>
          <td>${t.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    Notice: Lumenfield is a private financial testbed. Balances represent test sandbox assets. Not an insured bank or chartered depository.
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

    if (data.transaction) {
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

  // Submit loan application
  const submitLoanApplication = ({
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
    const apr = type === 'auto' ? 5.4 : 6.2;
    const monthlyRate = apr / 100 / 12;
    const monthlyPayment =
      (amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    const newApp: LoanApplication = {
      id: `loan-${type}-${Date.now().toString().slice(-4)}`,
      memberId: activeMember.id,
      memberName: activeMember.name,
      type,
      title: type === 'auto' ? 'Auto loan application' : 'Mortgage loan application',
      requestedAmount: amount,
      termMonths,
      interestRateApr: apr,
      estimatedMonthlyPayment: Number(monthlyPayment.toFixed(2)),
      status: 'under_review',
      currentStage: 'Review',
      submittedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      currency: 'USD',
      purpose,
      assetDetails: assetDetails || (type === 'auto' ? 'Vehicle under evaluation' : 'Real estate parcel evaluation'),
      downPayment,
    };

    setLoanApplications((prev) => [newApp, ...prev]);

    logAudit(
      'LOAN_APPLICATION_SUBMITTED',
      `${type.toUpperCase()} Loan ($${amount.toLocaleString()})`,
      newApp.id,
      `Requested $${amount.toLocaleString()} over ${termMonths} months for ${purpose}.`,
      activeMember.email,
      'Member'
    );

    showToast(`Your ${type} loan application for $${amount.toLocaleString()} has been submitted for review!`, 'success');
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
    }

    showToast(`Loan application #${loanId} updated to ${status}.`, 'info');
  };

  // Upload KYC
  const uploadKYC = (type: KYCDocument['type'], documentName: string, fileName: string) => {
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

  const fetchKycStatus = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/kyc/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setKycStatus(data.status);
        if (data.submission) {
          setKycSubmission(data.submission);
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
  const convertCurrency = (from: Currency, to: Currency, amount: number) => {
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

    showToast(
      `Converted ${from} ${amount.toFixed(2)} to ${to} ${convertedAmount.toFixed(2)} successfully!`,
      'success'
    );
    return { success: true, message: 'Exchange completed.' };
  };

  const resetDemoData = () => {
    setMembers(INITIAL_MEMBERS);
    setActiveMemberId('LF-000124');
    setTransactions(INITIAL_TRANSACTIONS);
    setLoanApplications([INITIAL_LOAN_APPLICATION]);
    setLedgerPostings(INITIAL_LEDGER_POSTINGS);
    setRecentFunding(INITIAL_RECENT_FUNDING);
    setAuditLog(INITIAL_AUDIT_LOG);
    showToast('Sandbox demo data has been reset to original design state.', 'info');
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
        transactions,
        loanApplications,
        ledgerPostings,
        recentFunding,
        auditLog,
        countries,
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
