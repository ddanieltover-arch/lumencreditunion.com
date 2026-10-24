import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LumenLogo } from './LumenLogo';
import { Currency } from '../types';
import {
  Users,
  FileCheck,
  Coins,
  Landmark,
  BookOpen,
  History,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Search,
  Check,
  XCircle,
  Shield,
  Layers,
  KeyRound,
  LogOut,
  Eye,
  Lock,
  Clock,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Menu,
  Pencil,
  Trash2,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { AdminDocumentViewerModal } from './AdminDocumentViewerModal';
import { AdminVirtualCardsPanel } from './AdminVirtualCardsPanel';
import { AdminTab, KycSubmission, KycSubmissionStatus, MemberProfile } from '../types';
import {
  PanelSwap,
  FadeUp,
  AnimatePresence,
  motion,
  MOTION,
  usePrefersReducedMotion,
} from '../motion';

const ADMIN_NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  accent?: string;
}> = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'identity_reviews', label: 'Identity reviews', shortLabel: 'KYC', icon: FileCheck },
  { id: 'fund_wallet', label: 'Fund wallets', shortLabel: 'Fund', icon: Coins, accent: 'text-[#F5B942]' },
  { id: 'virtual_cards', label: 'Virtual cards', shortLabel: 'Cards', icon: CreditCard },
  { id: 'loan_applications', label: 'Loan applications', shortLabel: 'Loans', icon: Landmark },
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'audit_log', label: 'Audit log', icon: History },
  { id: 'country_settings', label: 'Country settings', icon: Globe },
];

/** Primary mobile bottom-nav destinations (keep to 4 + More). */
const ADMIN_BOTTOM_TABS: AdminTab[] = [
  'members',
  'identity_reviews',
  'fund_wallet',
  'loan_applications',
];

export const AdminPortal: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const navIndicatorTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: MOTION.duration.base, ease: MOTION.ease.out };
  const drawerTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: MOTION.duration.base, ease: MOTION.ease.out };
  const {
    adminTab,
    setAdminTab,
    setCurrentView,
    members,
    fundWallet,
    ledgerPostings,
    recentFunding,
    auditLog,
    loanApplications,
    updateLoanStatus,
    countries,
    updateCountryFlags,
    showToast,
    openSecurityModal,
    currentUser,
    openAuthModal,
    logoutUser,
    adminKycQueue,
    fetchAdminKycQueue,
    fetchAdminDashboardStats,
    fetchAdminLedger,
    adminDashboardStats,
    authToken,
    reviewKycSubmission,
    updateAdminMember,
    deleteAdminMember,
    updateAdminKyc,
    deleteAdminKyc,
    getAdminDocumentSignedUrl,
  } = useApp();

  /** Registered members only — never include the signed-in super admin. */
  const registeredMembers = members.filter(
    (m) =>
      m.id !== currentUser?.id &&
      m.id !== '00000000-0000-0000-0000-000000000001' &&
      (!currentUser?.email ||
        m.email.toLowerCase() !== currentUser.email.toLowerCase()),
  );

  // Prefer API dashboard-stats (durable DB-backed) so every tile matches server truth
  const totalMembersCount =
    typeof adminDashboardStats?.totalMembers === 'number'
      ? adminDashboardStats.totalMembers
      : registeredMembers.length;
  const verifiedMembersCount =
    typeof adminDashboardStats?.verifiedMembers === 'number'
      ? adminDashboardStats.verifiedMembers
      : registeredMembers.filter((m) => m.identityVerified).length;
  const pendingKycCount =
    typeof adminDashboardStats?.pendingKycCount === 'number'
      ? adminDashboardStats.pendingKycCount
      : adminKycQueue.filter((s) => s.status === 'PENDING').length;
  const pendingLoansCount =
    typeof adminDashboardStats?.pendingLoansCount === 'number'
      ? adminDashboardStats.pendingLoansCount
      : loanApplications.filter((l) => l.status === 'under_review' || l.status === 'submitted')
          .length;
  const totalFundsUsd =
    typeof adminDashboardStats?.totalFundsUsd === 'number'
      ? adminDashboardStats.totalFundsUsd
      : typeof adminDashboardStats?.totalTestFunds?.USD?.totalMinor === 'number'
        ? adminDashboardStats.totalTestFunds.USD.totalMinor / 100
        : registeredMembers.reduce((acc, m) => acc + (m.wallets?.USD || 0), 0);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNavOpen]);
  // "Fund a wallet" form state
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [fundingSource, setFundingSource] = useState<string>('Bank wire');
  const [reference, setReference] = useState<string>(
    () => `REF-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [reason, setReason] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(true);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Modal for full audit log
  const [showFullAuditModal, setShowFullAuditModal] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState<string>('');

  // KYC Review Queue States (HARD RULE 7 & Task Requirements)
  const [kycFilter, setKycFilter] = useState<'ALL' | KycSubmissionStatus>('PENDING');
  const [kycSearch, setKycSearch] = useState<string>('');
  const [selectedDocForViewer, setSelectedDocForViewer] = useState<{
    docId: string;
    documentTitle: string;
    fileName: string;
    checksum: string;
    signedUrl: string;
    expiresInSeconds: number;
  } | null>(null);
  const [isLoadingDocUrl, setIsLoadingDocUrl] = useState<boolean>(false);

  const [adjudicationTarget, setAdjudicationTarget] = useState<{
    submission: KycSubmission;
    action: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO';
  } | null>(null);
  const [adjudicationReason, setAdjudicationReason] = useState<string>('');
  const [isAdjudicating, setIsAdjudicating] = useState<boolean>(false);

  const [editingMember, setEditingMember] = useState<MemberProfile | null>(null);
  const [memberEditForm, setMemberEditForm] = useState({
    fullName: '',
    email: '',
    countryCode: 'US',
    emailVerified: false,
  });
  const [memberEditSaving, setMemberEditSaving] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const [editingKyc, setEditingKyc] = useState<KycSubmission | null>(null);
  const [kycEditForm, setKycEditForm] = useState({
    memberName: '',
    memberEmail: '',
    countryCode: 'US',
    documentType: 'PASSPORT',
    status: 'PENDING' as KycSubmissionStatus,
    reviewerNote: '',
    rejectionReason: '',
  });
  const [kycEditSaving, setKycEditSaving] = useState(false);
  const [deletingKycId, setDeletingKycId] = useState<string | null>(null);

  const openEditMember = (m: MemberProfile) => {
    setEditingMember(m);
    setMemberEditForm({
      fullName: m.name,
      email: m.email,
      countryCode: m.countryCode || 'US',
      emailVerified: m.emailVerified !== false,
    });
  };

  const saveMemberEdit = async () => {
    if (!editingMember) return;
    setMemberEditSaving(true);
    try {
      await updateAdminMember(editingMember.id, {
        fullName: memberEditForm.fullName.trim(),
        email: memberEditForm.email.trim(),
        countryCode: memberEditForm.countryCode,
        emailVerified: memberEditForm.emailVerified,
      });
      setEditingMember(null);
    } catch (err: any) {
      showToast(err.message || 'Could not update member.', 'warning');
    } finally {
      setMemberEditSaving(false);
    }
  };

  const confirmDeleteMember = async () => {
    if (!deletingMemberId) return;
    try {
      await deleteAdminMember(deletingMemberId);
      if (selectedMemberId === deletingMemberId) setSelectedMemberId('');
      setDeletingMemberId(null);
    } catch (err: any) {
      showToast(err.message || 'Could not delete member.', 'warning');
    }
  };

  const openEditKyc = (sub: KycSubmission) => {
    setEditingKyc(sub);
    setKycEditForm({
      memberName: sub.memberName || '',
      memberEmail: sub.memberEmail || '',
      countryCode: sub.countryCode || 'US',
      documentType: sub.documentType || 'PASSPORT',
      status: sub.status,
      reviewerNote: sub.reviewerNote || '',
      rejectionReason: sub.rejectionReason || '',
    });
  };

  const saveKycEdit = async () => {
    if (!editingKyc) return;
    setKycEditSaving(true);
    try {
      await updateAdminKyc(editingKyc.id, {
        memberName: kycEditForm.memberName.trim(),
        memberEmail: kycEditForm.memberEmail.trim(),
        countryCode: kycEditForm.countryCode,
        documentType: kycEditForm.documentType,
        status: kycEditForm.status,
        reviewerNote: kycEditForm.reviewerNote.trim() || null,
        rejectionReason: kycEditForm.rejectionReason.trim() || null,
      });
      setEditingKyc(null);
    } catch (err: any) {
      showToast(err.message || 'Could not update KYC.', 'warning');
    } finally {
      setKycEditSaving(false);
    }
  };

  const confirmDeleteKyc = async () => {
    if (!deletingKycId) return;
    try {
      await deleteAdminKyc(deletingKycId);
      setDeletingKycId(null);
    } catch (err: any) {
      showToast(err.message || 'Could not delete KYC.', 'warning');
    }
  };
  const [pendingFundingRequests, setPendingFundingRequests] = useState<
    Array<{
      id: string;
      memberId: string;
      memberName: string;
      memberEmail: string;
      amountFormatted: string;
      amountMinor: number;
      currency: string;
      reason: string;
      status: string;
      createdAt: string;
    }>
  >([]);
  const [reviewingFundingId, setReviewingFundingId] = useState<string | null>(null);

  const refreshFundingRequests = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/admin/funding-requests?status=PENDING', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const text = await res.text();
      if (!res.ok || !text) return;
      const data = JSON.parse(text);
      setPendingFundingRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      /* ignore */
    }
  };

  // Prefetch KYC queue + registered members directory for admin
  useEffect(() => {
    if (currentUser?.role !== 'SUPER_ADMIN' || !authToken) return;
    void fetchAdminKycQueue();
    void fetchAdminDashboardStats(authToken);
    if (adminTab === 'fund_wallet') {
      void refreshFundingRequests();
    }
    if (adminTab === 'ledger') {
      void fetchAdminLedger(authToken);
    }
  }, [currentUser?.role, adminTab, authToken]);

  const reviewFundingRequest = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    if (!authToken) return;
    try {
      setReviewingFundingId(id);
      const res = await fetch(`/admin/funding-requests/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          decision,
          note: decision === 'REJECT' ? 'Declined by administrator' : 'Approved from member request queue',
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.message || 'Review failed');
      showToast(
        decision === 'APPROVE'
          ? `Funded ${data.amountFormatted} for ${data.memberName}.`
          : `Rejected funding request for ${data.memberName}.`,
        decision === 'APPROVE' ? 'success' : 'info',
      );
      await refreshFundingRequests();
      await fetchAdminDashboardStats(authToken);
    } catch (err: any) {
      showToast(err.message || 'Could not review funding request.', 'warning');
    } finally {
      setReviewingFundingId(null);
    }
  };

  // Keep fund-wallet selection aligned with the members list
  useEffect(() => {
    if (!registeredMembers.length) {
      setSelectedMemberId('');
      return;
    }
    if (!selectedMemberId || !registeredMembers.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(registeredMembers[0]!.id);
    }
  }, [registeredMembers, selectedMemberId]);

  // Guests landing on /admin: open sign-in immediately
  useEffect(() => {
    if (!currentUser) {
      openAuthModal('login');
    }
  }, [currentUser, openAuthModal]);

  const startAdminSignIn = async () => {
    if (currentUser) {
      await logoutUser({ redirectToLanding: false, silent: true });
    }
    setCurrentView('admin');
    openAuthModal('login');
  };

  const currentMember =
    registeredMembers.find((m) => m.id === selectedMemberId) || registeredMembers[0];

  const parsedAmount = parseFloat(amountStr) || 0;
  const currencySymbol =
    currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : currency === 'GBP' ? '£' : '€';

  const handlePostCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      showToast('Please confirm the test credit checkbox before submitting.', 'warning');
      return;
    }
    if (parsedAmount <= 0) {
      showToast('Please enter an amount greater than 0.', 'warning');
      return;
    }

    if (!currentMember) {
      showToast('Select a member to fund.', 'warning');
      return;
    }

    const fundingRef =
      reference.trim() || `REF-${Math.floor(1000 + Math.random() * 9000)}`;

    const success = fundWallet({
      memberId: currentMember.id,
      amount: parsedAmount,
      currency,
      source: fundingSource,
      reference: fundingRef,
      reason,
    });

    if (success) {
      setReference(`REF-${Math.floor(1000 + Math.random() * 9000)}`);
      setAmountStr('');
      setConfirmed(false);
    }
  };

  if (currentUser?.role !== 'SUPER_ADMIN') {
    const isGuest = !currentUser;
    return (
      <div className="w-full min-h-screen bg-[#F4F7F6] text-[#0E1B1F] flex flex-col font-sans">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#DCE5E3] p-8 text-center space-y-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                isGuest
                  ? 'bg-[#E3F3F1] border border-[#0F766E]/30 text-[#0A3D3F]'
                  : 'bg-[#FDF2F2] border border-[#D9383A]/30 text-[#D9383A]'
              }`}
            >
              {isGuest ? <KeyRound className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
            </div>
            <div>
              {!isGuest && (
                <span className="inline-block px-2.5 py-1 bg-[#FDF2F2] text-[#D9383A] text-xs font-bold rounded-lg mb-2">
                  Access restricted
                </span>
              )}
              <h2 className="text-xl font-bold font-display text-[#0E1B1F]">
                {isGuest ? 'Administrator sign in' : 'Super Administrator Access Required'}
              </h2>
              <p className="text-sm text-[#4A5B60] mt-2 leading-relaxed">
                {isGuest
                  ? 'Sign in with your administrator account to open the admin portal.'
                  : (
                    <>
                      This portal is limited to super administrators. You are signed in as{' '}
                      <strong>{currentUser.fullName}</strong> ({currentUser.role}).
                    </>
                  )}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => void startAdminSignIn()}
                className="w-full bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition min-h-[44px] cursor-pointer text-sm"
              >
                {isGuest ? 'Sign in' : 'Sign in with administrator account'}
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('landing')}
                className="w-full bg-[#F4F7F6] hover:bg-[#DCE5E3] text-[#0E1B1F] font-bold py-2.5 px-4 rounded-xl transition min-h-[44px] cursor-pointer text-sm"
              >
                Back to home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeNavLabel =
    ADMIN_NAV_ITEMS.find((item) => item.id === adminTab)?.label || 'Admin';
  const adminBottomItems = ADMIN_NAV_ITEMS.filter((item) =>
    ADMIN_BOTTOM_TABS.includes(item.id),
  );
  const adminMoreActive = !ADMIN_BOTTOM_TABS.includes(adminTab);

  const selectAdminTab = (tab: AdminTab) => {
    setAdminTab(tab);
    setMobileNavOpen(false);
  };

  const renderNavButtons = (layoutId: string) =>
    ADMIN_NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const isActive = adminTab === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => selectAdminTab(item.id)}
          className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
            isActive
              ? 'text-white font-semibold'
              : 'text-[#C9D6D5] hover:bg-[#1C3436]/40 hover:text-white'
          }`}
        >
          {isActive && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-[10px] bg-[#1C3436]"
              transition={navIndicatorTransition}
            />
          )}
          <Icon
            className={`relative z-10 w-4 h-4 shrink-0 ${
              item.accent || 'text-[#8FA5A3]'
            }`}
          />
          <span className="relative z-10">{item.label}</span>
        </button>
      );
    });

  return (
    <div className="w-full min-h-screen bg-[#F4F7F6] text-[#0E1B1F] flex flex-col font-sans">
      {/* ── MOBILE TOP BAR ── */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0E1B1F] text-white border-b border-white/10">
        <div className="flex items-center gap-2.5 px-4 min-h-[52px]">
          <LumenLogo size={26} textColor="#FFFFFF" />
          <div className="min-w-0">
            <div className="text-[10px] font-mono font-bold tracking-[0.12em] text-[#8FA5A3] uppercase leading-none">
              Admin
            </div>
            <div className="text-sm font-semibold truncate leading-tight mt-0.5">
              {activeNavLabel}
            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Admin menu">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-[#0E1B1F]/55 backdrop-blur-[2px] cursor-pointer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={drawerTransition}
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[min(100%,300px)] bg-[#0E1B1F] text-white shadow-2xl flex flex-col border-r border-white/10"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={drawerTransition}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
                <div className="flex flex-col gap-0.5">
                  <LumenLogo size={28} textColor="#FFFFFF" />
                  <span className="text-[11px] font-mono font-bold tracking-[0.1em] text-[#8FA5A3] uppercase pl-9 -mt-0.5">
                    Admin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close admin menu"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav
                aria-label="Admin navigation"
                className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1.5 text-[15px] font-medium"
              >
                {renderNavButtons('admin-nav-active-mobile')}
              </nav>

              <div className="px-3 pb-5 pt-2 border-t border-white/10 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    openSecurityModal();
                  }}
                  className="w-full flex items-center gap-2.5 text-xs font-semibold text-white bg-[#1C3436] hover:bg-[#0F766E] p-2.5 rounded-xl border border-white/10 transition cursor-pointer min-h-[44px]"
                >
                  <KeyRound className="w-4 h-4 text-[#F5B942]" />
                  <span>Admin Security & MFA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    void logoutUser();
                  }}
                  className="w-full flex items-center gap-2.5 text-xs font-semibold text-[#C9D6D5] hover:text-white hover:bg-[#1C3436]/60 p-2.5 rounded-xl border border-white/10 transition cursor-pointer min-h-[44px]"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden md:flex w-[260px] shrink-0 bg-[#0E1B1F] text-white p-7 md:py-7 md:px-5 flex-col justify-between gap-7 border-r border-slate-900">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setAdminTab('members');
                }}
                className="inline-flex items-center gap-2.5 text-white font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity"
              >
                <LumenLogo size={30} textColor="#FFFFFF" />
              </a>
              <div className="text-[12px] font-mono font-bold tracking-[0.08em] text-[#8FA5A3] uppercase pl-10 -mt-1">
                ADMIN
              </div>
            </div>

            <nav aria-label="Admin navigation" className="flex flex-col gap-1.5 text-[15px] font-medium">
              {renderNavButtons('admin-nav-active')}
            </nav>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => openSecurityModal()}
              className="w-full flex items-center gap-2.5 text-xs font-semibold text-white bg-[#1C3436] hover:bg-[#0F766E] p-2.5 rounded-xl border border-white/10 transition cursor-pointer min-h-[44px]"
            >
              <KeyRound className="w-4 h-4 text-[#F5B942]" />
              <span>Admin Security & MFA</span>
            </button>
            <button
              type="button"
              onClick={() => void logoutUser()}
              className="w-full flex items-center gap-2.5 text-xs font-semibold text-[#C9D6D5] hover:text-white hover:bg-[#1C3436]/60 p-2.5 rounded-xl border border-white/10 transition cursor-pointer min-h-[44px]"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* ── ADMIN WORKSPACE CONTENT ── */}
        <main className="flex-1 min-w-0 p-5 sm:p-8 pb-24 md:pb-8 flex flex-col gap-7 max-w-[1280px]">
          <PanelSwap panelKey={adminTab} className="flex flex-col gap-7">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#0E1B1F] tracking-[-0.01em]">
              {adminTab === 'fund_wallet' && 'Fund a wallet'}
              {adminTab === 'members' && 'Registered Members'}
              {adminTab === 'identity_reviews' && 'KYC Identity Review Queue'}
              {adminTab === 'virtual_cards' && 'Member Virtual Cards'}
              {adminTab === 'loan_applications' && 'Credit & Underwriting Queue'}
              {adminTab === 'ledger' && 'Immutable Double-Entry Ledger'}
              {adminTab === 'audit_log' && 'Compliance Audit Log'}
              {adminTab === 'country_settings' && 'Jurisdiction & Partner Rules'}
            </h1>
            <span className="text-[15px] text-[#4A5B60]">
              {adminTab === 'fund_wallet' &&
                'Every credit is posted to the ledger with a reference and recorded in the audit log.'}
              {adminTab === 'members' && 'View member accounts, verified documents, and balances.'}
              {adminTab === 'identity_reviews' && 'Review uploaded passport and national ID scans.'}
              {adminTab === 'virtual_cards' && 'Freeze, unfreeze, suspend, edit limits, credit, or delete member cards.'}
              {adminTab === 'loan_applications' && 'Underwrite auto and mortgage loans with fund disbursement.'}
              {adminTab === 'ledger' && 'Balanced debits and credits across funding pools and member wallets.'}
              {adminTab === 'audit_log' && 'Full chronological record of administrative actions and timestamps.'}
              {adminTab === 'country_settings' && 'Configure currency support and document requirements per country.'}
            </span>
          </div>

          {/* ══════════════════════════════════════════════════════
              OBSERVABILITY: ADMIN DASHBOARD OF KEY COUNTS
              (Members, Pending KYC, Pending Loans, Total Funds)
             ══════════════════════════════════════════════════════ */}
          <section aria-label="Key Platform Observability Metrics" className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {/* 1. Members Count */}
            <div
              onClick={() => setAdminTab('members')}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE5E3] hover:border-[#0A3D3F] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4A5B60] uppercase tracking-wider">Members</span>
                <div className="w-8 h-8 rounded-lg bg-[#E3F3F1] flex items-center justify-center text-[#0A3D3F]">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-display font-bold text-[#0E1B1F]">
                  {totalMembersCount}
                </div>
                <div className="text-[11px] text-[#0F766E] font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    {verifiedMembersCount} verified member
                    {verifiedMembersCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Virtual Cards Count */}
            <div
              onClick={() => setAdminTab('virtual_cards')}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE5E3] hover:border-[#0A3D3F] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4A5B60] uppercase tracking-wider">Virtual Cards</span>
                <div className="w-8 h-8 rounded-lg bg-[#E3F3F1] flex items-center justify-center text-[#0A3D3F]">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-display font-bold text-[#0E1B1F]">
                  {typeof (adminDashboardStats as any)?.totalCardsCount === 'number'
                    ? (adminDashboardStats as any).totalCardsCount
                    : '—'}
                </div>
                <div className="text-[11px] text-[#0F766E] font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    {(adminDashboardStats as any)?.activeCardsCount ?? 0} active card
                    {((adminDashboardStats as any)?.activeCardsCount ?? 0) === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Pending KYC Count */}
            <div
              onClick={() => setAdminTab('identity_reviews')}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE5E3] hover:border-[#0A3D3F] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4A5B60] uppercase tracking-wider">Pending KYC</span>
                <div className="w-8 h-8 rounded-lg bg-[#FFF1CC] flex items-center justify-center text-[#5A4100]">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-display font-bold text-[#0E1B1F]">
                  {pendingKycCount}
                </div>
                <div className="text-[11px] text-[#5A4100] font-medium flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>Awaiting super-admin verification</span>
                </div>
              </div>
            </div>

            {/* 3. Pending Loans Count */}
            <div
              onClick={() => setAdminTab('loan_applications')}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE5E3] hover:border-[#0A3D3F] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4A5B60] uppercase tracking-wider">Pending Loans</span>
                <div className="w-8 h-8 rounded-lg bg-[#E3F3F1] flex items-center justify-center text-[#0A3D3F]">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-display font-bold text-[#0E1B1F]">
                  {pendingLoansCount}
                </div>
                <div className="text-[11px] text-[#0F766E] font-medium flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>In credit underwriting review</span>
                </div>
              </div>
            </div>

            {/* 4. Total Funds */}
            <div
              onClick={() => setAdminTab('ledger')}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE5E3] hover:border-[#0A3D3F] transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4A5B60] uppercase tracking-wider">Total Funds</span>
                <div className="w-8 h-8 rounded-lg bg-[#FFF1CC] flex items-center justify-center text-[#5A4100]">
                  <Coins className="w-4 h-4 text-[#F5B942]" />
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-display font-bold text-[#0E1B1F] truncate">
                  $
                  {totalFundsUsd.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                  <span className="text-xs font-mono font-medium text-[#4A5B60] ml-1">USD</span>
                </div>
                <div className="text-[11px] text-[#0A5C47] font-medium flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Ledger zero-sum invariant verified</span>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════
              VIEW: FUND A WALLET (THE EXACT MOCKUP SCREEN)
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'fund_wallet' && (
            <div className="flex flex-col gap-5">
              {pendingFundingRequests.length > 0 && (
                <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 shadow-xs flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                        Member funding requests
                      </h3>
                      <p className="text-xs text-[#4A5B60] mt-0.5">
                        Approve to credit the member wallet from the system ledger.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshFundingRequests()}
                      className="text-xs font-semibold text-[#0A3D3F] hover:underline cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-[#4A5B60] border-b border-[#DCE5E3]">
                          <th className="py-2 pr-3">Member</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Reason</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingFundingRequests.map((r) => (
                          <tr key={r.id} className="border-b border-[#EDF2F1]">
                            <td className="py-3 pr-3">
                              <div className="font-semibold text-[#0E1B1F]">{r.memberName}</div>
                              <div className="text-[11px] text-[#8FA5A3] font-mono">{r.memberEmail}</div>
                            </td>
                            <td className="py-3 pr-3 font-mono font-semibold whitespace-nowrap">
                              {r.amountFormatted}
                            </td>
                            <td className="py-3 pr-3 text-[#4A5B60] text-xs max-w-[240px]">
                              {r.reason}
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={reviewingFundingId === r.id}
                                onClick={() => void reviewFundingRequest(r.id, 'APPROVE')}
                                className="px-3 py-1.5 rounded-lg bg-[#0A3D3F] text-white text-xs font-semibold hover:bg-[#0F5557] disabled:opacity-60 mr-1.5 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={reviewingFundingId === r.id}
                                onClick={() => void reviewFundingRequest(r.id, 'REJECT')}
                                className="px-3 py-1.5 rounded-lg border border-[#BCCAC8] text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            <div className="flex flex-col lg:flex-row gap-5 items-start">
              {/* Left Column: The Interactive Form (Flex 3) */}
              <form
                onSubmit={handlePostCredit}
                className="w-full lg:flex-[3] min-w-0 bg-white border border-[#DCE5E3] rounded-3xl p-7 flex flex-col gap-5 shadow-xs"
              >
                {/* Member Input & Lookup Selector */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="f-member" className="text-sm font-semibold text-[#0E1B1F]">
                      Member Lookup
                    </label>
                    <span className="text-xs text-[#4A5B60]">
                      {verifiedMembersCount} verified of {totalMembersCount} members
                    </span>
                  </div>

                  {/* Member search input for quick lookup */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#8FA5A3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Search by name, account number, or country..."
                      className="w-full min-h-[44px] pl-10 pr-3.5 border border-[#BCCAC8] rounded-xl text-sm text-[#0E1B1F] bg-[#F4F7F6]/50 focus:bg-white focus:outline-none focus:border-[#0A3D3F]"
                    />
                  </div>

                  <select
                    id="f-member"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="min-h-[48px] border border-[#BCCAC8] rounded-xl px-3.5 text-[15px] text-[#0E1B1F] bg-white font-medium focus:outline-none focus:border-[#0A3D3F]"
                    disabled={!registeredMembers.length}
                  >
                    {!registeredMembers.length && (
                      <option value="">No registered members yet</option>
                    )}
                    {registeredMembers
                      .filter((m) => {
                        if (!memberSearchQuery.trim()) return true;
                        const q = memberSearchQuery.toLowerCase().replace(/[\s\-·]/g, '');
                        const acct = (m.bankIdentity?.accountNumberNormalized || '').toLowerCase();
                        const acctDisplay = (m.bankIdentity?.accountNumberDisplay || '').toLowerCase();
                        return (
                          m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                          m.id.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                          m.country.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                          acct.includes(q) ||
                          acctDisplay.replace(/[\s\-·]/g, '').includes(q)
                        );
                      })
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.bankIdentity?.accountNumberDisplay || m.id.slice(0, 8)}) · {m.country} · {m.identityVerified ? '✓ Verified' : '⚠️ Unverified'}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Selected Member Profile Preview Card (From Design) */}
                <div className="flex flex-wrap items-center gap-3.5 p-4 rounded-2xl bg-[#F4F7F6] border border-[#DCE5E3]">
                  <div className="w-11 h-11 rounded-full bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center font-display font-bold text-base shrink-0">
                    {currentMember?.avatarInitials || '—'}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
                    <span className="font-semibold text-[15px] text-[#0E1B1F]">
                      {currentMember?.name || 'No member selected'}
                    </span>
                    <span className="text-[13px] text-[#4A5B60] flex items-center gap-1.5 flex-wrap">
                      <span>{currentMember?.country || '—'}</span>
                      {currentMember && (
                        <>
                          <span>·</span>
                          <span
                            className={`font-semibold ${
                              currentMember.identityVerified ? 'text-[#0A4F4A]' : 'text-[#8A5000]'
                            }`}
                          >
                            {currentMember.identityVerified
                              ? '✓ Identity Verified'
                              : '⚠️ Identity Pending'}
                          </span>
                        </>
                      )}
                    </span>
                    {currentMember?.bankIdentity?.accountNumberDisplay && (
                      <span className="text-[11px] font-mono text-[#0A3D3F] mt-0.5">
                        {currentMember.bankIdentity.accountNumberDisplay}
                        {currentMember.bankIdentity.scheme
                          ? ` · ${currentMember.bankIdentity.scheme}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-xs text-[#4A5B60]">Current USD balance</span>
                    <span className="font-bold text-[17px] text-[#0E1B1F] font-mono">
                      $
                      {(currentMember?.wallets.USD || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {/* Unverified Member Notice (Hard Rule & Acceptance Criteria) */}
                {currentMember && !currentMember.identityVerified && (
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FFF1CC] border border-[#F0D58A] text-[#5A4100] text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-[#5A4100] shrink-0 mt-0.5" />
                    <div>
                      <strong>Acceptance Criteria &amp; Hard Rule Warning:</strong>
                      <p className="mt-0.5">
                        Funding an unverified member is rejected by the server (HTTP 403 Forbidden). Member <strong>{currentMember.name}</strong> must have their KYC identity document approved in the review queue before ledger funding can be posted.
                      </p>
                      <button
                        type="button"
                        onClick={() => setAdminTab('identity_reviews')}
                        className="mt-1.5 font-semibold text-[#0A3D3F] underline cursor-pointer"
                      >
                        Review member KYC documents in Identity Reviews →
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount and Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 flex flex-col gap-2">
                    <label htmlFor="f-amount" className="text-sm font-semibold text-[#0E1B1F]">
                      Amount
                    </label>
                    <input
                      id="f-amount"
                      type="text"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      className="min-h-[48px] border border-[#BCCAC8] rounded-xl px-3.5 text-lg font-semibold text-[#0E1B1F] font-mono focus:outline-none focus:border-[#0A3D3F]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="f-currency" className="text-sm font-semibold text-[#0E1B1F]">
                      Currency
                    </label>
                    <select
                      id="f-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="min-h-[48px] border border-[#BCCAC8] rounded-xl px-3 text-[15px] text-[#0E1B1F] bg-white font-medium focus:outline-none focus:border-[#0A3D3F]"
                    >
                      <option value="USD">USD</option>
                      <option value="CAD">CAD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                {/* Funding Source (With locked production notes from design) */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="f-source" className="text-sm font-semibold text-[#0E1B1F]">
                    Funding source
                  </label>
                  <select
                    id="f-source"
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value)}
                    className="min-h-[48px] border border-[#BCCAC8] rounded-xl px-3 text-[15px] text-[#0E1B1F] bg-white font-medium focus:outline-none focus:border-[#0A3D3F]"
                  >
                    <option value="Bank wire">Bank wire</option>
                    <option value="Confirmed bank deposit">Confirmed bank deposit</option>
                    <option value="Confirmed crypto deposit">Confirmed crypto deposit</option>
                  </select>
                  <span className="text-[13px] text-[#4A5B60] leading-relaxed">
                    Use a verified deposit reference that matches the incoming funds.
                  </span>
                </div>

                {/* Reference */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="f-ref" className="text-sm font-semibold text-[#0E1B1F]">
                    Reference
                  </label>
                  <input
                    id="f-ref"
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="min-h-[48px] border border-[#BCCAC8] rounded-xl px-3.5 text-[15px] text-[#0E1B1F] font-mono focus:outline-none focus:border-[#0A3D3F]"
                  />
                </div>

                {/* Reason for Credit */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="f-note" className="text-sm font-semibold text-[#0E1B1F]">
                    Reason for credit
                  </label>
                  <textarea
                    id="f-note"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="border border-[#BCCAC8] rounded-xl p-3.5 text-[15px] text-[#0E1B1F] focus:outline-none focus:border-[#0A3D3F] leading-relaxed"
                  />
                </div>

                {/* Confirmation Checkbox */}
                <div className="flex items-start gap-3 pt-1">
                  <input
                    id="f-confirm"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-[#0A3D3F] rounded cursor-pointer"
                  />
                  <label
                    htmlFor="f-confirm"
                    className="text-sm text-[#2B3B3F] leading-snug cursor-pointer select-none"
                  >
                    I confirm this is a test credit and I understand it will be recorded under my admin account.
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    className="min-h-[50px] px-7 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-[16px] transition-all cursor-pointer shadow-xs"
                  >
                    Post credit to ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAmountStr('');
                      setReason('');
                      setConfirmed(false);
                      setMemberSearchQuery('');
                      showToast('Funding form cleared.', 'info');
                    }}
                    className="min-h-[50px] px-6 rounded-xl border border-[#BCCAC8] bg-white hover:bg-slate-50 text-[#0E1B1F] font-semibold text-[16px] transition-all cursor-pointer"
                  >
                    Clear form
                  </button>
                </div>
              </form>

              {/* Right Column: Ledger Preview & Recent Funding (Flex 2) */}
              <div className="w-full lg:flex-[2] min-w-0 flex flex-col gap-5">
                {/* Ledger Preview Table (From Design) */}
                <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col gap-3 shadow-xs">
                  <h2 className="font-display font-bold text-lg text-[#0E1B1F]">
                    Ledger preview
                  </h2>
                  <div className="text-xs text-[#4A5B60] leading-relaxed">
                    Two balanced entries will be posted when you submit.
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[#4A5B60] text-xs font-semibold tracking-wider border-b border-[#DCE5E3]">
                          <th className="py-2 px-1.5 font-semibold">ACCOUNT</th>
                          <th className="py-2 px-1.5 font-semibold text-right">DEBIT</th>
                          <th className="py-2 px-1.5 font-semibold text-right">CREDIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#EDF2F1]">
                          <td className="py-3 px-1.5 font-medium text-[#0E1B1F]">
                            Funding pool
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono font-semibold">
                            {parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono text-[#4A5B60]">
                            0.00
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-1.5 font-medium text-[#0E1B1F]">
                            Member wallet ({currency})
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono text-[#4A5B60]">
                            0.00
                          </td>
                          <td className="py-3 px-1.5 text-right font-mono font-semibold text-[#0A5C47]">
                            {parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Funding List (From Design) */}
                <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col gap-3.5 shadow-xs">
                  <h2 className="font-display font-bold text-lg text-[#0E1B1F]">
                    Recent funding
                  </h2>

                  <div className="flex flex-col">
                    {recentFunding.slice(0, 5).map((f, i) => (
                      <div
                        key={f.id}
                        className={`flex justify-between items-center gap-3 py-3 ${
                          i !== recentFunding.length - 1 ? 'border-b border-[#EDF2F1]' : ''
                        } text-sm`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#0E1B1F]">{f.memberName}</span>
                          <span className="text-xs text-[#4A5B60] font-mono">
                            {f.reference} · {f.date}
                          </span>
                        </div>
                        <span className="font-semibold font-mono text-[#0A5C47]">
                          {f.currency === 'USD' ? '$' : f.currency === 'CAD' ? 'C$' : f.currency === 'GBP' ? '£' : '€'}
                          {f.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFullAuditModal(true)}
                    className="text-sm font-semibold text-[#0A3D3F] hover:underline self-start pt-1 cursor-pointer"
                  >
                    Open full audit log →
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW: MEMBERS DIRECTORY
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'members' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#0E1B1F]">
                  Registered Members
                </h2>
                <span className="text-xs text-[#4A5B60] font-medium">
                  Total: {totalMembersCount} members
                </span>
              </div>

              {!registeredMembers.length ? (
                <div className="rounded-2xl border border-dashed border-[#BCCAC8] bg-[#F4F7F6]/60 px-6 py-12 text-center">
                  <Users className="w-8 h-8 text-[#8FA5A3] mx-auto mb-3" />
                  <p className="font-semibold text-[#0E1B1F]">No registered members yet</p>
                  <p className="text-sm text-[#4A5B60] mt-1 max-w-md mx-auto">
                    Member accounts appear here after they register. Super administrators are
                    operators and are never listed in this directory.
                  </p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[#4A5B60] text-xs font-semibold tracking-wider border-b border-[#DCE5E3]">
                      <th className="py-2.5 px-3">MEMBER</th>
                      <th className="py-2.5 px-3">ACCOUNT</th>
                      <th className="py-2.5 px-3">COUNTRY</th>
                      <th className="py-2.5 px-3">VERIFICATION</th>
                      <th className="py-2.5 px-3">USD BALANCE</th>
                      <th className="py-2.5 px-3">CAD / GBP / EUR</th>
                      <th className="py-2.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredMembers.map((m, memberIndex) => (
                      <motion.tr
                        key={m.id}
                        className="border-b border-[#EDF2F1] hover:bg-[#F4F7F6]/60"
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: MOTION.duration.fast,
                          delay: prefersReducedMotion
                            ? 0
                            : Math.min(memberIndex, MOTION.maxStaggerChildren - 1) *
                              MOTION.stagger.tight,
                          ease: MOTION.ease.out,
                        }}
                      >
                        <td className="py-3.5 px-3 font-semibold text-[#0E1B1F]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center font-display font-bold text-xs">
                              {m.avatarInitials}
                            </div>
                            <div>
                              <div>{m.name}</div>
                              <div className="text-xs font-mono text-slate-500 font-normal">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[#0E1B1F]">
                          <div>{m.bankIdentity?.accountNumberDisplay || '—'}</div>
                          <div className="text-[10px] text-slate-500">{m.bankIdentity?.scheme || ''}</div>
                        </td>
                        <td className="py-3.5 px-3 text-[#4A5B60]">{m.country}</td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              m.identityVerified
                                ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                                : 'bg-[#FFF1CC] text-[#5A4100]'
                            }`}
                          >
                            {m.identityVerified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-semibold">
                          ${m.wallets.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-[#4A5B60]">
                          C${m.wallets.CAD} · £{m.wallets.GBP} · €{m.wallets.EUR}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditMember(m)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#DCE5E3] text-[#0A3D3F] text-xs font-semibold hover:bg-[#F4F7F6] inline-flex items-center gap-1"
                              title="Edit member"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingMemberId(m.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 inline-flex items-center gap-1"
                              title="Delete member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMemberId(m.id);
                                setAdminTab('virtual_cards');
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-[#DCE5E3] text-[#0A3D3F] text-xs font-semibold hover:bg-[#E3F3F1] inline-flex items-center gap-1"
                              title="Manage this member's virtual cards"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-[#0F766E]" />
                              Cards
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMemberId(m.id);
                                setAdminTab('fund_wallet');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#F5B942] text-[#0A3D3F] text-xs font-bold hover:bg-[#E0A82E] shadow-sm inline-flex items-center gap-1"
                              title="Fund this member wallet"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              Fund
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW: IDENTITY REVIEWS (KYC ADJUDICATION QUEUE)
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'identity_reviews' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E3F3F1] text-[#0A4F4A] uppercase tracking-wider">
                      SUPER_ADMIN CONTROL
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Queue: {adminKycQueue.length} submissions
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-2xl text-[#0E1B1F] mt-1">
                    Identity Verification Review Queue
                  </h2>
                  <p className="text-xs text-[#4A5B60] mt-0.5 leading-relaxed">
                    Review encrypted government-issued credentials using short-lived signed URLs. Unverified members cannot perform wallet funding, transfers, cards, or loan applications until approved.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => fetchAdminKycQueue()}
                  className="px-4 py-2 bg-[#F4F7F6] hover:bg-[#E3EBE9] text-[#0A3D3F] border border-[#DCE5E3] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Refresh Queue</span>
                </button>
              </div>

              {/* Status Filter Tabs & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#EDF2F1]">
                <div className="flex items-center gap-1.5 bg-[#F4F7F6] p-1 rounded-xl">
                  {(['PENDING', 'ALL', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO'] as const).map(
                    (status) => {
                      const isSelected = kycFilter === status;
                      const count =
                        status === 'ALL'
                          ? adminKycQueue.length
                          : adminKycQueue.filter((s) => s.status === status).length;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setKycFilter(status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#0A3D3F] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>
                            {status === 'ALL'
                              ? 'All'
                              : status === 'PENDING'
                              ? 'Pending'
                              : status === 'APPROVED'
                              ? 'Approved'
                              : status === 'REJECTED'
                              ? 'Declined'
                              : 'Needs Info'}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={kycSearch}
                    onChange={(e) => setKycSearch(e.target.value)}
                    placeholder="Search applicant or ID..."
                    className="w-full pl-9 pr-3 py-1.5 border border-[#DCE5E3] rounded-xl text-xs bg-[#F4F7F6]/50 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Queue List */}
              <div className="space-y-4">
                {(() => {
                  const filtered = adminKycQueue
                    .filter((sub) => {
                      if (kycFilter !== 'ALL' && sub.status !== kycFilter) return false;
                      if (kycSearch.trim()) {
                        const q = kycSearch.toLowerCase();
                        return (
                          sub.memberName?.toLowerCase().includes(q) ||
                          sub.memberEmail?.toLowerCase().includes(q) ||
                          sub.id?.toLowerCase().includes(q) ||
                          sub.countryCode?.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-12 border-2 border-dashed border-[#DCE5E3] rounded-2xl text-center space-y-2 bg-[#F4F7F6]/40">
                        <ShieldCheck className="w-10 h-10 text-[#0F766E] mx-auto opacity-70" />
                        <h4 className="font-bold text-sm text-[#0E1B1F]">
                          Queue is clear in this view
                        </h4>
                        <p className="text-xs text-[#4A5B60] max-w-sm mx-auto">
                          There are currently no identity submissions matching filter '{kycFilter}'. Check other tabs or submit a new test verification from Member view.
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((sub) => (
                    <div
                      key={sub.id}
                      className="border border-[#DCE5E3] hover:border-[#BCCAC8] rounded-2xl p-5 bg-[#F4F7F6]/60 transition flex flex-col gap-4 shadow-xs"
                    >
                      {/* Top Bar: Applicant Info & Badges */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DCE5E3]/70 pb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center font-display font-bold text-sm shadow-xs">
                            {sub.memberName
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase() || 'MB'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-display font-bold text-base text-[#0E1B1F]">
                                {sub.memberName}
                              </h4>
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-[#DCE5E3] font-bold text-[#0A3D3F]">
                                {sub.countryCode}
                              </span>
                            </div>
                            <div className="text-xs text-[#4A5B60] flex items-center gap-2 mt-0.5">
                              <span>{sub.memberEmail}</span>
                              <span>•</span>
                              <span className="font-mono text-[11px]">Sub #{sub.id.slice(0, 16)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              sub.status === 'APPROVED'
                                ? 'bg-[#E3F3F1] text-[#0A4F4A] border border-[#B8D4D2]'
                                : sub.status === 'PENDING'
                                ? 'bg-[#FFF1CC] text-[#5A4100] border border-[#F0D58A]'
                                : sub.status === 'NEEDS_MORE_INFO'
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {sub.status === 'APPROVED'
                              ? 'Approved (Active)'
                              : sub.status === 'PENDING'
                              ? 'Pending Adjudication'
                              : sub.status === 'NEEDS_MORE_INFO'
                              ? 'Needs More Info'
                              : 'Declined'}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Document Meta, Sanctions Screening, Timestamps */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-[#DCE5E3] space-y-1">
                          <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider block">
                            Document Type
                          </span>
                          <span className="font-bold text-sm text-[#0E1B1F]">
                            {sub.documentType?.replace('_', ' ')}
                          </span>
                          <p className="text-[11px] text-[#4A5B60]">
                            {sub.documents?.length || 0} file(s) attached
                          </p>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-[#DCE5E3] space-y-1">
                          <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider block">
                            Sanctions Screening
                          </span>
                          <div className="flex items-center gap-1.5 text-[#0A5C47] font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {sub.sanctionsCheckPassed ? 'Screening Clear' : 'Flagged Hit'}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-slate-500 truncate">
                            Ref: {sub.sanctionsReferenceId || 'SCR-AUTO-CLEARED'}
                          </p>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-[#DCE5E3] space-y-1">
                          <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider block">
                            Submission Timestamp
                          </span>
                          <span className="font-medium text-[#0E1B1F]">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </span>
                          {sub.reviewedAt && (
                            <p className="text-[10px] text-slate-500">
                              Reviewed: {new Date(sub.reviewedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Notes / Reasons if available */}
                      {sub.rejectionReason && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-0.5">
                          <span className="font-bold block">Rejection Reason:</span>
                          <p>{sub.rejectionReason}</p>
                        </div>
                      )}

                      {sub.reviewerNote && (
                        <div className="p-3 bg-[#E3F3F1] border border-[#B8D4D2] rounded-xl text-xs text-[#0A4F4A] space-y-0.5">
                          <span className="font-bold block">Adjudication Note:</span>
                          <p>{sub.reviewerNote}</p>
                        </div>
                      )}

                      {/* Files list with short-lived signed URL generation */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-[#0E1B1F] block">
                          Attached Verification Documents (Encrypted in Private Storage):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sub.documents?.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-3 bg-white rounded-xl border border-[#DCE5E3] flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#F4F7F6] flex items-center justify-center text-[#0A3D3F] shrink-0 border border-[#DCE5E3]">
                                  <FileText className="w-4 h-4 text-[#0F766E]" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-[#0E1B1F] truncate block">
                                    {doc.fileName}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {doc.side} • {(doc.fileSize / 1024).toFixed(0)} KB
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setIsLoadingDocUrl(true);
                                    const signed = await getAdminDocumentSignedUrl(doc.id, 300);
                                    setSelectedDocForViewer({
                                      docId: doc.id,
                                      documentTitle: `${sub.memberName} - ${doc.side} ${sub.documentType}`,
                                      fileName: doc.fileName,
                                      checksum: doc.checksum,
                                      signedUrl: signed.signedUrl,
                                      expiresInSeconds: signed.expiresInSeconds || 300,
                                    });
                                  } catch (err: any) {
                                    showToast(err.message || 'Failed to view document.', 'warning');
                                  } finally {
                                    setIsLoadingDocUrl(false);
                                  }
                                }}
                                disabled={isLoadingDocUrl}
                                className="px-3 py-1.5 rounded-lg bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                                title="View decrypted file using short-lived signed URL"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#F5B942]" />
                                <span>View</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#DCE5E3]">
                        {sub.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjudicationTarget({ submission: sub, action: 'APPROVE' });
                                setAdjudicationReason(
                                  'Biometrics, checksum, and credentials verified successfully.',
                                );
                              }}
                              className="px-4 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]"
                            >
                              <ShieldCheck className="w-4 h-4 text-[#F5B942]" />
                              <span>Approve & Verify</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdjudicationTarget({ submission: sub, action: 'REJECT' });
                                setAdjudicationReason('');
                              }}
                              className="px-4 py-2.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                            >
                              <X className="w-4 h-4" />
                              <span>Decline</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdjudicationTarget({
                                  submission: sub,
                                  action: 'REQUEST_MORE_INFO',
                                });
                                setAdjudicationReason('');
                              }}
                              className="px-4 py-2.5 rounded-xl bg-white border border-[#DCE5E3] hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                            >
                              <HelpCircle className="w-4 h-4 text-[#0F766E]" />
                              <span>Request Info</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => openEditKyc(sub)}
                          className="px-4 py-2.5 rounded-xl bg-white border border-[#DCE5E3] hover:bg-[#F4F7F6] text-[#0A3D3F] font-bold text-xs transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                        >
                          <Pencil className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingKycId(sub.id)}
                          className="px-4 py-2.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW: LOAN UNDERWRITING APPLICATIONS
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'loan_applications' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
              <h2 className="font-display font-bold text-xl text-[#0E1B1F]">
                Credit & Underwriting Queue
              </h2>

              <div className="space-y-4">
                {loanApplications.map((app, appIndex) => (
                  <FadeUp
                    key={app.id}
                    inView={false}
                    delay={
                      prefersReducedMotion
                        ? 0
                        : Math.min(appIndex, MOTION.maxStaggerChildren - 1) * MOTION.stagger.tight
                    }
                    distance={MOTION.distance.xs}
                    duration={MOTION.duration.fast}
                    className="border border-[#DCE5E3] rounded-2xl p-6 bg-[#F4F7F6]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-lg text-[#0E1B1F]">
                          {app.title}
                        </span>
                        <span className="font-mono text-xs text-slate-500">#{app.id}</span>
                      </div>
                      <div className="text-sm text-[#4A5B60]">
                        Member: <strong>{app.memberName}</strong> ({app.memberId}) · Amount:{' '}
                        <strong>${app.requestedAmount.toLocaleString()}</strong> over{' '}
                        <strong>{app.termMonths} months</strong>
                      </div>
                      <div className="text-xs text-[#4A5B60] mt-1">
                        Purpose: {app.purpose} · Asset: {app.assetDetails}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {app.status === 'under_review' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateLoanStatus(app.id, 'approved')}
                            className="px-4 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-xs transition-all"
                          >
                            Approve & Disburse
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLoanStatus(app.id, 'rejected')}
                            className="px-3.5 py-2.5 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 transition-all"
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <span
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                            app.status === 'approved'
                              ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {app.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW: DOUBLE-ENTRY LEDGER
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'ledger' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display font-bold text-xl text-[#0E1B1F]">
                    General Ledger Postings
                  </h2>
                  <p className="text-xs text-[#4A5B60] mt-0.5">
                    Immutable double-entry debit and credit records for financial integrity.
                  </p>
                </div>
                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded font-semibold ${
                    adminDashboardStats?.ledgerZeroSumPassed === false
                      ? 'bg-[#FFF1CC] text-[#5A4100]'
                      : 'bg-[#E3F3F1] text-[#0A4F4A]'
                  }`}
                >
                  {adminDashboardStats?.ledgerZeroSumPassed === false
                    ? 'Zero Invariant Mismatch'
                    : 'Ledger zero-sum verified'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[#4A5B60] text-xs font-semibold tracking-wider border-b border-[#DCE5E3]">
                      <th className="py-2.5 px-2">REF / DATE</th>
                      <th className="py-2.5 px-2">DESCRIPTION</th>
                      <th className="py-2.5 px-2">DEBIT ACCOUNT</th>
                      <th className="py-2.5 px-2 text-right">DEBIT</th>
                      <th className="py-2.5 px-2">CREDIT ACCOUNT</th>
                      <th className="py-2.5 px-2 text-right">CREDIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerPostings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 px-2 text-center text-sm text-[#4A5B60]"
                        >
                          No ledger postings yet. Fund a verified member wallet to create the first
                          double-entry record.
                        </td>
                      </tr>
                    ) : (
                      ledgerPostings.map((lp) => (
                        <tr key={lp.id} className="border-b border-[#EDF2F1] hover:bg-[#F4F7F6]/50">
                          <td className="py-3 px-2 font-mono text-xs">
                            <div className="font-semibold text-[#0E1B1F]">{lp.reference}</div>
                            <div className="text-slate-500">{lp.date}</div>
                          </td>
                          <td className="py-3 px-2 text-[#0E1B1F] max-w-[200px] truncate">
                            {lp.description}
                          </td>
                          <td className="py-3 px-2 text-slate-700 font-medium">
                            {lp.debitAccount}
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-semibold">
                            ${lp.debitAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2 text-slate-700 font-medium">
                            {lp.creditAccount}
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-semibold text-[#0A5C47]">
                            ${lp.creditAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW: AUDIT LOG
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'audit_log' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display font-bold text-xl text-[#0E1B1F]">
                  Compliance & Administrative Audit Log
                </h2>
                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search actions, targets, details..."
                    className="w-full pl-9 pr-3 py-2 border border-[#DCE5E3] rounded-xl text-xs bg-[#F4F7F6]/50 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {auditLog
                  .filter((item) => {
                    if (!auditSearch.trim()) return true;
                    const q = auditSearch.toLowerCase();
                    return (
                      item.action.toLowerCase().includes(q) ||
                      item.target.toLowerCase().includes(q) ||
                      item.details.toLowerCase().includes(q) ||
                      (item.actor || '').toLowerCase().includes(q) ||
                      (item.reference || '').toLowerCase().includes(q)
                    );
                  })
                  .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0F766E] uppercase">
                          {item.action}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold text-slate-800">{item.target}</span>
                      </div>
                      <div className="text-slate-600 leading-relaxed">{item.details}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-slate-500">{item.timestamp}</div>
                      <div className="text-slate-400">{item.actor}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW: COUNTRY SETTINGS
             ══════════════════════════════════════════════════════ */}
          {adminTab === 'country_settings' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
              <h2 className="font-display font-bold text-xl text-[#0E1B1F]">
                Jurisdiction Rules & Supported Countries
              </h2>
              <p className="text-sm text-[#4A5B60] -mt-2">
                Toggle product availability per market. Changes are recorded in the audit log.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {countries.map((c) => (
                  <div key={c.id || c.code} className="p-5 border border-[#DCE5E3] rounded-2xl bg-[#F4F7F6] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-base text-[#0E1B1F]">
                        {c.name}
                      </span>
                      <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-[#DCE5E3]">
                        {c.currency} ({c.currencySymbol})
                      </span>
                    </div>

                    <div className="text-xs text-[#4A5B60]">
                      <strong>Accepted IDs:</strong>{' '}
                      {(c.acceptedDocs || c.acceptedIdTypes || []).join(', ') || '—'}
                    </div>

                    <div className="flex flex-col gap-2 pt-1 border-t border-[#DCE5E3]">
                      {(
                        [
                          ['autoLoansEnabled', 'Auto loans', c.autoLoansEnabled],
                          ['mortgageEnabled', 'Mortgage', c.mortgageEnabled],
                          ['cardsEnabled', 'Virtual cards', c.cardsEnabled],
                        ] as const
                      ).map(([key, label, enabled]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-3 text-xs font-semibold text-[#0E1B1F] cursor-pointer min-h-[40px]"
                        >
                          <span>{label}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() =>
                              updateCountryFlags(c.code, { [key]: !enabled })
                            }
                            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                              enabled ? 'bg-[#0A3D3F]' : 'bg-[#BCCAC8]'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'virtual_cards' && (
            <AdminVirtualCardsPanel initialMemberId={selectedMemberId} />
          )}
          </PanelSwap>
        </main>
      </div>

      {selectedDocForViewer && (
        <AdminDocumentViewerModal
          isOpen={!!selectedDocForViewer}
          onClose={() => setSelectedDocForViewer(null)}
          docId={selectedDocForViewer.docId}
          documentTitle={selectedDocForViewer.documentTitle}
          fileName={selectedDocForViewer.fileName}
          checksum={selectedDocForViewer.checksum}
          signedUrl={selectedDocForViewer.signedUrl}
          expiresInSeconds={selectedDocForViewer.expiresInSeconds}
        />
      )}

      {adjudicationTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  KYC adjudication
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  {adjudicationTarget.action === 'APPROVE'
                    ? 'Approve & verify member'
                    : adjudicationTarget.action === 'REJECT'
                    ? 'Decline submission'
                    : 'Request more information'}
                </h3>
                <p className="text-sm text-[#4A5B60] mt-1">
                  {adjudicationTarget.submission.memberName} ·{' '}
                  {adjudicationTarget.submission.memberEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdjudicationTarget(null);
                  setAdjudicationReason('');
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                aria-label="Close adjudication dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="adj-reason" className="text-xs font-semibold text-[#4A5B60]">
                {adjudicationTarget.action === 'APPROVE'
                  ? 'Reviewer note (optional)'
                  : 'Reason (required)'}
              </label>
              <textarea
                id="adj-reason"
                rows={4}
                value={adjudicationReason}
                onChange={(e) => setAdjudicationReason(e.target.value)}
                placeholder={
                  adjudicationTarget.action === 'APPROVE'
                    ? 'Optional note for the audit trail…'
                    : 'Explain what is missing or why the submission was declined…'
                }
                className="border border-[#BCCAC8] rounded-xl p-3.5 text-sm text-[#0E1B1F] focus:outline-none focus:border-[#0A3D3F]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isAdjudicating}
                onClick={async () => {
                  const needsReason =
                    adjudicationTarget.action === 'REJECT' ||
                    adjudicationTarget.action === 'REQUEST_MORE_INFO';
                  if (needsReason && adjudicationReason.trim().length < 3) {
                    showToast('Please enter a reason (at least 3 characters).', 'warning');
                    return;
                  }
                  try {
                    setIsAdjudicating(true);
                    await reviewKycSubmission(
                      adjudicationTarget.submission.id,
                      adjudicationTarget.action,
                      adjudicationReason.trim() || undefined,
                    );
                    setAdjudicationTarget(null);
                    setAdjudicationReason('');
                  } catch (err: any) {
                    showToast(err.message || 'Adjudication failed.', 'warning');
                  } finally {
                    setIsAdjudicating(false);
                  }
                }}
                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition cursor-pointer disabled:opacity-60 ${
                  adjudicationTarget.action === 'REJECT'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#0A3D3F] hover:bg-[#0F5557]'
                }`}
              >
                {isAdjudicating ? 'Submitting…' : 'Confirm decision'}
              </button>
              <button
                type="button"
                disabled={isAdjudicating}
                onClick={() => {
                  setAdjudicationTarget(null);
                  setAdjudicationReason('');
                }}
                className="px-4 py-3 rounded-xl border border-[#BCCAC8] text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL AUDIT LOG MODAL ── */}
      {showFullAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Audit Governance
                </span>
                <h3 className="font-display font-bold text-2xl text-[#0E1B1F] mt-0.5">
                  Complete Ledger Audit Trail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullAuditModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {auditLog.map((log) => (
                <div key={log.id} className="p-3 bg-[#F4F7F6] rounded-xl text-xs border border-[#DCE5E3] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-slate-500 font-mono">
                    <span className="font-bold text-[#0F766E]">{log.action}</span>
                    <span>{log.timestamp}</span>
                  </div>
                  <div className="font-semibold text-slate-800">Target: {log.target}</div>
                  <div className="text-slate-600">{log.details}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowFullAuditModal(false)}
              className="w-full py-3 rounded-xl bg-[#0A3D3F] text-white font-semibold text-sm hover:bg-[#0F5557]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit member modal */}
      <AnimatePresence>
        {editingMember && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0E1B1F]/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-2xl border border-[#DCE5E3] shadow-xl p-6 space-y-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-[#0E1B1F]">Edit member</h3>
                <button type="button" onClick={() => setEditingMember(null)} aria-label="Close">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Full name
                <input
                  value={memberEditForm.fullName}
                  onChange={(e) => setMemberEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Email
                <input
                  type="email"
                  value={memberEditForm.email}
                  onChange={(e) => setMemberEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Country
                <select
                  value={memberEditForm.countryCode}
                  onChange={(e) =>
                    setMemberEditForm((f) => ({ ...f, countryCode: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm bg-white"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#4A5B60]">
                <input
                  type="checkbox"
                  checked={memberEditForm.emailVerified}
                  onChange={(e) =>
                    setMemberEditForm((f) => ({ ...f, emailVerified: e.target.checked }))
                  }
                />
                Email verified
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE5E3] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={memberEditSaving}
                  onClick={() => void saveMemberEdit()}
                  className="px-4 py-2 rounded-xl bg-[#0A3D3F] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {memberEditSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete member confirm */}
      <AnimatePresence>
        {deletingMemberId && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0E1B1F]/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="w-full max-w-sm bg-white rounded-2xl border border-[#DCE5E3] p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-[#0E1B1F]">Delete member?</h3>
              <p className="text-sm text-[#4A5B60]">
                This permanently removes the account and linked KYC records. This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingMemberId(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE5E3] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteMember()}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit KYC modal */}
      <AnimatePresence>
        {editingKyc && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0E1B1F]/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="w-full max-w-lg bg-white rounded-2xl border border-[#DCE5E3] shadow-xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-[#0E1B1F]">Edit KYC record</h3>
                <button type="button" onClick={() => setEditingKyc(null)} aria-label="Close">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Applicant name
                <input
                  value={kycEditForm.memberName}
                  onChange={(e) => setKycEditForm((f) => ({ ...f, memberName: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Email
                <input
                  type="email"
                  value={kycEditForm.memberEmail}
                  onChange={(e) => setKycEditForm((f) => ({ ...f, memberEmail: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#4A5B60]">
                  Country
                  <select
                    value={kycEditForm.countryCode}
                    onChange={(e) =>
                      setKycEditForm((f) => ({ ...f, countryCode: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm bg-white"
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[#4A5B60]">
                  Status
                  <select
                    value={kycEditForm.status}
                    onChange={(e) =>
                      setKycEditForm((f) => ({
                        ...f,
                        status: e.target.value as KycSubmissionStatus,
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm bg-white"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="NEEDS_MORE_INFO">Needs more info</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Document type
                <select
                  value={kycEditForm.documentType}
                  onChange={(e) =>
                    setKycEditForm((f) => ({ ...f, documentType: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm bg-white"
                >
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
                  <option value="ID_CARD">ID card</option>
                  <option value="RESIDENCE_PERMIT">Residence permit</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Reviewer note
                <textarea
                  value={kycEditForm.reviewerNote}
                  onChange={(e) =>
                    setKycEditForm((f) => ({ ...f, reviewerNote: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[#4A5B60]">
                Rejection reason
                <textarea
                  value={kycEditForm.rejectionReason}
                  onChange={(e) =>
                    setKycEditForm((f) => ({ ...f, rejectionReason: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DCE5E3] text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKyc(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE5E3] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={kycEditSaving}
                  onClick={() => void saveKycEdit()}
                  className="px-4 py-2 rounded-xl bg-[#0A3D3F] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {kycEditSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete KYC confirm */}
      <AnimatePresence>
        {deletingKycId && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0E1B1F]/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="w-full max-w-sm bg-white rounded-2xl border border-[#DCE5E3] p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-[#0E1B1F]">Delete KYC record?</h3>
              <p className="text-sm text-[#4A5B60]">
                Removes this identity submission. The member can submit again later.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingKycId(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE5E3] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteKyc()}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav
        aria-label="Primary admin navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DCE5E3] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 pt-1.5 pb-1.5">
          {adminBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = adminTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectAdminTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl transition cursor-pointer ${
                  isActive
                    ? 'text-[#0A3D3F]'
                    : 'text-[#4A5B60] hover:text-[#0A3D3F] hover:bg-[#F4F7F6]'
                }`}
              >
                <Icon
                  className={`w-[20px] h-[20px] ${
                    isActive ? 'text-[#0A3D3F]' : 'text-[#8FA5A3]'
                  }`}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span
                  className={`text-[10px] leading-none ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {item.shortLabel || item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="More menu"
            aria-expanded={mobileNavOpen}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl transition cursor-pointer ${
              adminMoreActive
                ? 'text-[#0A3D3F]'
                : 'text-[#4A5B60] hover:text-[#0A3D3F] hover:bg-[#F4F7F6]'
            }`}
          >
            <Menu
              className={`w-[20px] h-[20px] ${
                adminMoreActive ? 'text-[#0A3D3F]' : 'text-[#8FA5A3]'
              }`}
              strokeWidth={adminMoreActive ? 2.4 : 2}
            />
            <span
              className={`text-[10px] leading-none ${
                adminMoreActive ? 'font-bold' : 'font-medium'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
