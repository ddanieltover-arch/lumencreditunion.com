import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LumenLogo } from './LumenLogo';
import { Currency, Transaction } from '../types';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Landmark,
  CreditCard,
  FileCheck,
  Settings,
  Send,
  Download,
  Car,
  Lock,
  Unlock,
  Sliders,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  Plus,
  RefreshCw,
  Home,
  Shield,
  FileText,
  Upload,
  Search,
  Filter,
  ChevronLeft,
  Printer,
  Bell,
  Trash2,
  DownloadCloud,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { VirtualCardsView } from './VirtualCardsView';
import { PWAInstallButton } from './PWAInstallButton';
import {
  PanelSwap,
  FadeUp,
  CountUp,
  motion,
  MOTION,
  usePrefersReducedMotion,
} from '../motion';
import {
  requestPushPermission,
  getPushPermissionState,
  notifyTransferExecuted,
  notifyKycDecision,
  notifyLoanDecision,
} from '../utils/pushNotifications';

export const MemberDashboard: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const navIndicatorTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: MOTION.duration.base, ease: MOTION.ease.out };
  const {

    memberTab,
    setMemberTab,
    setCurrentView,
    setAdminTab,
    activeMember,
    transactions,
    loanApplications,
    sendTransfer,
    toggleCardFreeze,
    updateCardLimits,
    submitLoanApplication,
    uploadKYC,
    convertCurrency,
    showToast,
    openSecurityModal,
    currentUser,
    downloadStatement,
    exportPersonalData,
    requestAccountDeletion,
    openTermsModal,
    openPrivacyModal,
  } = useApp();

  // Wallet activity filtering & pagination
  const [walletTxPage, setWalletTxPage] = useState<number>(1);
  const [walletTxLimit, setWalletTxLimit] = useState<number>(6);
  const [walletTxCurrency, setWalletTxCurrency] = useState<string>('ALL');
  const [walletTxDirection, setWalletTxDirection] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [walletTxSource, setWalletTxSource] = useState<string>('ALL');
  const [walletTxSearch, setWalletTxSearch] = useState<string>('');

  // Modal states
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [showLoanModal, setShowLoanModal] = useState<boolean>(false);
  const [showCardLimitsModal, setShowCardLimitsModal] = useState<boolean>(false);
  const [showCardDetailsModal, setShowCardDetailsModal] = useState<boolean>(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedLoanAppId, setSelectedLoanAppId] = useState<string | null>(null);
  const [showDeletionConfirmModal, setShowDeletionConfirmModal] = useState<boolean>(false);
  const [deletionReason, setDeletionReason] = useState<string>('Moving to another platform');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(getPushPermissionState());

  // Quick transfer form state
  const [quickTo, setQuickTo] = useState<string>('');
  const [quickAmount, setQuickAmount] = useState<string>('');

  // Send Money Modal form state
  const [sendRecipient, setSendRecipient] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [sendCurrency, setSendCurrency] = useState<Currency>('USD');

  // Convert/Swap state
  const [swapFrom, setSwapFrom] = useState<Currency>('USD');
  const [swapTo, setSwapTo] = useState<Currency>('CAD');
  const [swapAmount, setSwapAmount] = useState<string>('500');

  // Card limits modal state
  const [tempDailyLimit, setTempDailyLimit] = useState<number>(activeMember.virtualCard.dailyLimit);
  const [tempMonthlyLimit, setTempMonthlyLimit] = useState<number>(activeMember.virtualCard.monthlyLimit);
  const [cardRevealed, setCardRevealed] = useState<boolean>(false);

  // Loan Application Form State
  const [loanType, setLoanType] = useState<'auto' | 'mortgage'>('auto');
  const [loanAmount, setLoanAmount] = useState<number>(18000);
  const [loanTerm, setLoanTerm] = useState<number>(48);
  const [loanPurpose, setLoanPurpose] = useState<string>('2024 Electric Compact Sedan purchase');
  const [loanAssetDetails, setLoanAssetDetails] = useState<string>('VIN: 1HGCR2F83HA029141 · 18,200 miles');
  const [loanDownPayment, setLoanDownPayment] = useState<number>(3500);

  // KYC Upload form state
  const [kycType, setKycType] = useState<'passport' | 'id_card' | 'residence_permit' | 'drivers_license'>('passport');
  const [kycDocName, setKycDocName] = useState<string>('US Passport (Verified Scan)');

  // Transaction filter
  const [txFilter, setTxFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [txSearch, setTxSearch] = useState<string>('');

  const filteredTransactions = transactions.filter((t) => {
    if (txFilter === 'completed' && t.status !== 'Completed') return false;
    if (txFilter === 'pending' && t.status !== 'Pending') return false;
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.counterparty && t.counterparty.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const walletFilteredTransactions = transactions.filter((t) => {
    if (walletTxCurrency !== 'ALL' && t.currency !== walletTxCurrency) return false;
    if (walletTxDirection === 'CREDIT' && t.amount <= 0) return false;
    if (walletTxDirection === 'DEBIT' && t.amount >= 0) return false;
    if (walletTxSource !== 'ALL') {
      const src = (t.type || t.category || '').toUpperCase();
      if (!src.includes(walletTxSource.toUpperCase())) return false;
    }
    if (walletTxSearch.trim()) {
      const q = walletTxSearch.toLowerCase();
      const match =
        t.description.toLowerCase().includes(q) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.counterparty && t.counterparty.toLowerCase().includes(q)) ||
        t.currency.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const walletTotalPages = Math.ceil(walletFilteredTransactions.length / walletTxLimit) || 1;
  const paginatedWalletTransactions = walletFilteredTransactions.slice(
    (walletTxPage - 1) * walletTxLimit,
    walletTxPage * walletTxLimit
  );

  const handleQuickTransfer = () => {
    const amt = parseFloat(quickAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid transfer amount.', 'warning');
      return;
    }
    const res = sendTransfer({
      recipient: quickTo || 'Amara O. (LF-000089)',
      amount: amt,
      currency: 'USD',
    });
    if (res.success) {
      setQuickTo('');
      setQuickAmount('');
    }
  };

  const handleModalSend = () => {
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid transfer amount.', 'warning');
      return;
    }
    const res = sendTransfer({
      recipient: sendRecipient,
      amount: amt,
      currency: sendCurrency,
    });
    if (res.success) {
      setShowSendModal(false);
      setSendRecipient('');
      setSendAmount('');
    }
  };

  const handleSwap = () => {
    const amt = parseFloat(swapAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter valid swap amount.', 'warning');
      return;
    }
    convertCurrency(swapFrom, swapTo, amt);
  };

  const handleSaveCardLimits = () => {
    updateCardLimits(tempDailyLimit, tempMonthlyLimit);
    setShowCardLimitsModal(false);
  };

  const handleSubmitLoan = () => {
    submitLoanApplication({
      type: loanType,
      amount: loanAmount,
      termMonths: loanTerm,
      purpose: loanPurpose,
      assetDetails: loanAssetDetails,
      downPayment: loanDownPayment,
    });
    setShowLoanModal(false);
  };

  const handleUploadKYC = () => {
    const fileName = `${kycType}_${activeMember.id.toLowerCase()}_sample.pdf`;
    uploadKYC(kycType, kycDocName, fileName);
    setShowDocUploadModal(false);
  };

  const activeLoanApp =
    loanApplications.find((l) => l.id === selectedLoanAppId) ||
    loanApplications[0] ||
    null;

  return (
    <div className="w-full min-h-screen bg-[#F4F7F6] text-[#0E1B1F] flex flex-col font-sans">
      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* ── SIDEBAR NAVIGATION (FROM DESIGN) ── */}
        <aside className="w-full md:w-[260px] shrink-0 bg-[#0A3D3F] text-white p-7 md:py-7 md:px-5 flex flex-col justify-between gap-7 border-r border-[#072F30]">
          <div className="flex flex-col gap-7">
            {/* Logo */}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMemberTab('overview');
              }}
              className="inline-flex items-center gap-2.5 text-white font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity"
            >
              <LumenLogo size={30} textColor="#FFFFFF" />
            </a>

            {/* Member Nav Links */}
            <nav aria-label="Member navigation" className="flex flex-col gap-1.5 text-[15px] font-medium">
              <button
                type="button"
                onClick={() => setMemberTab('overview')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'overview'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'overview' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <LayoutDashboard className="relative z-10 w-4 h-4 shrink-0 text-[#F5B942]" />
                <span className="relative z-10">Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberTab('wallet')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'wallet'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'wallet' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <Wallet className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">Wallet</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberTab('transfers')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'transfers'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'transfers' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <ArrowLeftRight className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">Transfers</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberTab('loans')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'loans'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'loans' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <Landmark className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">Loans</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberTab('cards')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'cards'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'cards' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <CreditCard className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberTab('documents')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'documents'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'documents' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <FileCheck className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">Documents</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberTab('settings')}
                className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
                  memberTab === 'settings'
                    ? 'text-white font-semibold'
                    : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
                }`}
              >
                {memberTab === 'settings' && (
                  <motion.span
                    layoutId="member-nav-active"
                    className="absolute inset-0 rounded-[10px] bg-[#0F5557]"
                    transition={navIndicatorTransition}
                  />
                )}
                <Settings className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">Settings</span>
              </button>
            </nav>
          </div>

          {/* Member Profile Bottom Box */}
          <div className="flex flex-col gap-3">
            <div className="p-3.5 rounded-xl bg-[#0F5557] text-[13px] leading-snug text-[#C9DEDC] flex flex-col gap-1.5 border border-[#2D7A77]/50">
              <div className="flex items-center justify-between text-xs">
                <span>Signed in as</span>
                <span className="font-mono text-[10px] bg-[#0A3D3F] px-1.5 py-0.5 rounded text-[#F5B942]">
                  {activeMember.id.slice(0, 8)}
                </span>
              </div>
              <div className="font-semibold text-white text-sm">
                {currentUser?.fullName || activeMember.name}
              </div>
              <div className="text-[11px] text-[#8FA5A3] truncate">
                {currentUser?.email || activeMember.email}
              </div>
            </div>

            {/* Quick Link to Admin & Home */}
            <div className="flex items-center justify-between px-1 text-xs text-[#8FA5A3]">
              <button
                type="button"
                onClick={() => setCurrentView('landing')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                ← Back to Home
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('admin');
                  setAdminTab('fund_wallet');
                }}
                className="text-[#F5B942] hover:underline font-semibold cursor-pointer"
              >
                Admin Console
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT WORKSPACE ── */}
        <main className="flex-1 min-w-0 p-6 sm:p-8 flex flex-col gap-7 max-w-[1280px]">
          {/* Header Bar */}
          <PanelSwap panelKey={`hdr-${memberTab}`} className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#0E1B1F] tracking-[-0.01em]">
                {memberTab === 'overview' && `Good morning, ${activeMember.name}`}
                {memberTab === 'wallet' && 'Multi-Currency Wallet'}
                {memberTab === 'transfers' && 'Move & Transfer Money'}
                {memberTab === 'loans' && 'Loans & Financing'}
                {memberTab === 'cards' && 'Virtual Cards'}
                {memberTab === 'documents' && 'Identity & Verification Documents'}
                {memberTab === 'settings' && 'Account Settings'}
              </h1>
              <span className="text-[15px] text-[#4A5B60]">
                {memberTab === 'overview' && 'Here is where your wallet stands today.'}
                {memberTab === 'wallet' && 'Manage your fiat balances and exchange between currencies.'}
                {memberTab === 'transfers' && 'Send instant P2P payments, initiate bank withdrawals, or view transfer rails.'}
                {memberTab === 'loans' && 'Auto and mortgage loans with fixed terms and transparent payment schedules.'}
                {memberTab === 'cards' && 'Virtual debit cards with instant freeze protection and custom limits.'}
                {memberTab === 'documents' && 'Secure repository for government-issued ID review.'}
                {memberTab === 'settings' && 'Security, profile, and account configuration.'}
              </span>
            </div>

            {/* Identity Status Pill (From Design) */}
            <div className="flex items-center gap-2">
              {activeMember.identityVerified ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E3F3F1] text-[#0A4F4A] text-xs font-semibold border border-[#B8D4D2]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Identity verified</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFF1CC] text-[#5A4100] text-xs font-semibold border border-[#F0D58A]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Verification pending</span>
                </div>
              )}
            </div>
          </PanelSwap>

          <PanelSwap panelKey={memberTab} className="flex flex-col gap-7">
          {/* ══════════════════════════════════════════════════════
              TAB: OVERVIEW (THE EXACT MOCKUP SCREEN)
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'overview' && (
            <div className="flex flex-col gap-7">
              {/* Top Row: Total Balance Card + Virtual Card Widget */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Total Balance Card (Flex 2/3) */}
                <div className="lg:col-span-8 bg-[#0A3D3F] text-white rounded-3xl p-7 flex flex-col justify-between gap-6 shadow-sm border border-[#0F5557]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#D6E8E6] tracking-wide">
                      <span>Total balance</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-[#0F5557] text-[#F5D78E] text-[11px] font-mono">
                        USD wallet
                      </span>
                    </div>
                    <CountUp
                      value={activeMember.wallets.USD}
                      prefix="$"
                      delay={0.08}
                      duration={0.85}
                      className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight tabular-nums"
                    />
                  </div>

                  {/* Balance Action Buttons (From Design) */}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowSendModal(true)}
                      className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] font-semibold text-sm transition-all shadow-xs cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Send money
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('admin');
                        setAdminTab('fund_wallet');
                      }}
                      className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl border border-[#5E9A97] text-white hover:bg-white/10 font-semibold text-sm transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Request funding
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLoanModal(true)}
                      className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl border border-[#5E9A97] text-white hover:bg-white/10 font-semibold text-sm transition-all cursor-pointer"
                    >
                      <Car className="w-3.5 h-3.5 mr-1.5" />
                      Apply for a loan
                    </button>
                  </div>

                  {/* Other Currency Wallets Strip */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#2D7A77]/50 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-[#B8D4D2] font-semibold">CAD</span>
                      <span className="font-bold text-base sm:text-lg text-white font-mono">
                        C${activeMember.wallets.CAD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-[#B8D4D2] font-semibold">GBP</span>
                      <span className="font-bold text-base sm:text-lg text-white font-mono">
                        £{activeMember.wallets.GBP.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-[#B8D4D2] font-semibold">EUR</span>
                      <span className="font-bold text-base sm:text-lg text-white font-mono">
                        €{activeMember.wallets.EUR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Virtual Card Widget (Flex 1/3) */}
                <div className="lg:col-span-4 flex flex-col">
                  <VirtualCardsView compact={true} />
                </div>
              </div>

              {/* Bottom Row: Recent Activity Table (Left) + Auto Loan & Quick Transfer (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Recent Activity Table (Col span 7/8) */}
                <div className="lg:col-span-8 bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col gap-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display font-bold text-lg text-[#0E1B1F]">
                      Recent activity
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#F4F7F6] p-0.5 rounded-lg text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setTxFilter('all')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            txFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-xs font-semibold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxFilter('completed')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            txFilter === 'completed'
                              ? 'bg-white text-slate-900 shadow-xs font-semibold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Completed
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxFilter('pending')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            txFilter === 'pending'
                              ? 'bg-white text-slate-900 shadow-xs font-semibold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Pending
                        </button>
                      </div>

                      {/* Download Statement Action */}
                      <button
                        type="button"
                        onClick={() => downloadStatement('csv')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BCCAC8] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0E1B1F] transition cursor-pointer"
                        title="Download CSV statement"
                      >
                        <Download className="w-3.5 h-3.5 text-[#0F766E]" />
                        <span>Statement</span>
                      </button>
                    </div>
                  </div>

                  {/* Activity Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[#4A5B60] text-xs font-semibold tracking-wider border-b border-[#DCE5E3]">
                          <th className="py-2.5 px-2">DESCRIPTION</th>
                          <th className="py-2.5 px-2">DATE</th>
                          <th className="py-2.5 px-2">STATUS</th>
                          <th className="py-2.5 px-2 text-right">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((tx, txIndex) => {
                          const isCredit = tx.amount > 0;
                          const rowDelay =
                            Math.min(txIndex, MOTION.maxStaggerChildren - 1) * MOTION.stagger.tight;
                          return (
                            <motion.tr
                              key={tx.id}
                              onClick={() => setSelectedTx(tx)}
                              className="border-b border-[#EDF2F1] hover:bg-[#F4F7F6]/80 transition-colors cursor-pointer group"
                              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: MOTION.duration.fast,
                                delay: prefersReducedMotion ? 0 : rowDelay,
                                ease: MOTION.ease.out,
                              }}
                            >
                              <td className="py-3.5 px-2 font-medium text-[#0E1B1F]">
                                <div className="flex items-center gap-2">
                                  <span>{tx.description}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-2 text-[#4A5B60] text-xs font-mono">
                                {tx.date}
                              </td>
                              <td className="py-3.5 px-2">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    tx.status === 'Completed'
                                      ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                                      : 'bg-[#FFF1CC] text-[#5A4100]'
                                  }`}
                                >
                                  {tx.status}
                                </span>
                              </td>
                              <td
                                className={`py-3.5 px-2 text-right font-semibold font-mono ${
                                  isCredit ? 'text-[#0A5C47]' : 'text-[#0E1B1F]'
                                }`}
                              >
                                {isCredit ? '+' : ''}$
                                {Math.abs(tx.amount).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Stack: Auto Loan Card + Quick Transfer Card */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                  {/* Auto Loan Application Card (From Design) */}
                  <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display font-bold text-lg text-[#0E1B1F]">
                        {activeLoanApp ? activeLoanApp.title : 'Loan application'}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FFF1CC] text-[#5A4100] text-xs font-semibold">
                        {activeLoanApp ? (activeLoanApp.status === 'under_review' ? 'Under review' : activeLoanApp.status) : 'None'}
                      </span>
                    </div>

                    <p className="text-sm text-[#4A5B60] leading-relaxed">
                      {activeLoanApp
                        ? `Requested $${activeLoanApp.requestedAmount.toLocaleString()} over ${activeLoanApp.termMonths} months. An administrator is reviewing your documents.`
                        : 'No active applications in queue.'}
                    </p>

                    {/* Progress Bar (From Design) */}
                    <div className="h-2 rounded-full bg-[#E3EBE9] overflow-hidden my-1">
                      <div className="w-3/5 h-full bg-[#0F766E] rounded-full transition-all" />
                    </div>

                    <div className="flex justify-between text-xs text-[#4A5B60] font-medium">
                      <span className="text-[#0F766E] font-semibold">Submitted</span>
                      <span className="text-[#0F766E] font-semibold">Review</span>
                      <span>Decision</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (activeLoanApp) setSelectedLoanAppId(activeLoanApp.id);
                        else setShowLoanModal(true);
                      }}
                      className="text-sm font-semibold text-[#0A3D3F] hover:text-[#0F766E] self-start py-1 cursor-pointer transition-colors"
                    >
                      {activeLoanApp ? 'View application details →' : 'Apply for a loan →'}
                    </button>
                  </div>

                  {/* Quick Transfer Card (From Design) */}
                  <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col gap-3.5 shadow-xs">
                    <h2 className="font-display font-bold text-lg text-[#0E1B1F]">
                      Quick transfer
                    </h2>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="qt-to" className="text-xs font-semibold text-[#4A5B60]">
                        Send to member
                      </label>
                      <input
                        id="qt-to"
                        type="text"
                        value={quickTo}
                        onChange={(e) => setQuickTo(e.target.value)}
                        placeholder="Name or Lumenfield ID"
                        className="min-h-[46px] border border-[#BCCAC8] rounded-xl px-3.5 text-sm text-[#0E1B1F] bg-white focus:outline-none focus:border-[#0A3D3F]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="qt-amt" className="text-xs font-semibold text-[#4A5B60]">
                        Amount (USD)
                      </label>
                      <input
                        id="qt-amt"
                        type="number"
                        step="any"
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        placeholder="0.00"
                        className="min-h-[46px] border border-[#BCCAC8] rounded-xl px-3.5 text-sm text-[#0E1B1F] bg-white font-mono focus:outline-none focus:border-[#0A3D3F]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleQuickTransfer}
                      className="min-h-[48px] rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm transition-all cursor-pointer shadow-xs mt-1"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: WALLET (MULTI-CURRENCY & SWAP)
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'wallet' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['USD', 'CAD', 'GBP', 'EUR'] as Currency[]).map((curr) => {
                  const bal = activeMember.wallets[curr] || 0;
                  const symbol = curr === 'USD' ? '$' : curr === 'CAD' ? 'C$' : curr === 'GBP' ? '£' : '€';
                  return (
                    <div
                      key={curr}
                      className="bg-white border border-[#DCE5E3] rounded-2xl p-6 flex flex-col justify-between gap-4 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#0F766E] bg-[#E3F3F1] px-2.5 py-1 rounded-md">
                          {curr}
                        </span>
                        <span className="text-xs text-[#4A5B60]">Available balance</span>
                      </div>
                      <div className="font-display font-bold text-3xl text-[#0E1B1F]">
                        {symbol}{bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSwapFrom(curr);
                          setMemberTab('transfers');
                        }}
                        className="text-xs font-semibold text-[#0A3D3F] hover:underline self-start cursor-pointer"
                      >
                        Manage & transfer →
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Currency Swap / FX Simulator */}
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                      Currency exchange
                    </h3>
                    <p className="text-sm text-[#4A5B60] mt-1">
                      Instantly swap balances between currencies at live market rates.
                    </p>
                  </div>
                  <RefreshCw className="w-5 h-5 text-[#0F766E]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#4A5B60]">Convert From</label>
                    <div className="flex gap-2">
                      <select
                        aria-label="Convert from currency"
                        value={swapFrom}
                        onChange={(e) => setSwapFrom(e.target.value as Currency)}
                        className="p-3 border border-[#BCCAC8] rounded-xl text-sm font-semibold bg-white"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="CAD">CAD (C$)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                      <input
                        type="number"
                        aria-label="Amount to convert"
                        value={swapAmount}
                        onChange={(e) => setSwapAmount(e.target.value)}
                        placeholder="Amount"
                        className="flex-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#4A5B60]">Convert To</label>
                    <select
                      aria-label="Convert to currency"
                      value={swapTo}
                      onChange={(e) => setSwapTo(e.target.value as Currency)}
                      className="p-3 border border-[#BCCAC8] rounded-xl text-sm font-semibold bg-white"
                    >
                      <option value="CAD">CAD (C$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwap}
                    className="p-3.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm transition-all cursor-pointer text-center"
                  >
                    Execute Swap
                  </button>
                </div>
              </div>

              {/* Wallet Ledger Activity & Transaction History Table */}
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                {/* Header with Title & Statement Download Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                      Wallet Activity &amp; Ledger Transactions
                    </h3>
                    <p className="text-sm text-[#4A5B60] mt-0.5">
                      Double-entry entries across all enabled currency wallets with immutable references.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => downloadStatement('csv', walletTxCurrency)}
                      className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#BCCAC8] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0E1B1F] transition cursor-pointer shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-[#0F766E]" />
                      <span>Download Statement (CSV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadStatement('pdf', walletTxCurrency)}
                      className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#0A3D3F] hover:bg-[#072F30] text-xs font-semibold text-white transition cursor-pointer shadow-xs"
                    >
                      <Printer className="w-4 h-4 text-[#F5B942]" />
                      <span>Print / PDF Statement</span>
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 p-4 bg-[#F4F7F6] rounded-2xl border border-[#DCE5E3]">
                  {/* Search */}
                  <div className="lg:col-span-4 relative">
                    <Search className="w-4 h-4 text-[#8FA5A3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={walletTxSearch}
                      onChange={(e) => {
                        setWalletTxSearch(e.target.value);
                        setWalletTxPage(1);
                      }}
                      placeholder="Search description, reference, counterparty..."
                      className="w-full min-h-[44px] pl-10 pr-3 border border-[#BCCAC8] rounded-xl text-xs bg-white text-[#0E1B1F] focus:outline-none focus:border-[#0A3D3F]"
                    />
                  </div>

                  {/* Currency Filter */}
                  <div className="lg:col-span-2">
                    <select
                      aria-label="Filter by currency"
                      value={walletTxCurrency}
                      onChange={(e) => {
                        setWalletTxCurrency(e.target.value);
                        setWalletTxPage(1);
                      }}
                      className="w-full min-h-[44px] px-3 border border-[#BCCAC8] rounded-xl text-xs bg-white text-[#0E1B1F] font-semibold focus:outline-none focus:border-[#0A3D3F]"
                    >
                      <option value="ALL">All Currencies</option>
                      <option value="USD">USD ($)</option>
                      <option value="CAD">CAD (C$)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  {/* Direction Filter */}
                  <div className="lg:col-span-2">
                    <select
                      aria-label="Filter by direction"
                      value={walletTxDirection}
                      onChange={(e) => {
                        setWalletTxDirection(e.target.value as any);
                        setWalletTxPage(1);
                      }}
                      className="w-full min-h-[44px] px-3 border border-[#BCCAC8] rounded-xl text-xs bg-white text-[#0E1B1F] font-semibold focus:outline-none focus:border-[#0A3D3F]"
                    >
                      <option value="ALL">All Directions</option>
                      <option value="CREDIT">Credits / Inflow (+)</option>
                      <option value="DEBIT">Debits / Outflow (-)</option>
                    </select>
                  </div>

                  {/* Source Rail Filter */}
                  <div className="lg:col-span-2">
                    <select
                      aria-label="Filter by source rail"
                      value={walletTxSource}
                      onChange={(e) => {
                        setWalletTxSource(e.target.value);
                        setWalletTxPage(1);
                      }}
                      className="w-full min-h-[44px] px-3 border border-[#BCCAC8] rounded-xl text-xs bg-white text-[#0E1B1F] font-semibold focus:outline-none focus:border-[#0A3D3F]"
                    >
                      <option value="ALL">All Source Rails</option>
                      <option value="ADMIN_CREDIT">Admin credit</option>
                      <option value="TRANSFER">TRANSFER (P2P)</option>
                      <option value="CARD">CARD (Purchase)</option>
                      <option value="LOAN">LOAN (Disbursement)</option>
                    </select>
                  </div>

                  {/* Page limit selector */}
                  <div className="lg:col-span-2">
                    <select
                      aria-label="Items per page"
                      value={walletTxLimit}
                      onChange={(e) => {
                        setWalletTxLimit(Number(e.target.value));
                        setWalletTxPage(1);
                      }}
                      className="w-full min-h-[44px] px-3 border border-[#BCCAC8] rounded-xl text-xs bg-white text-[#0E1B1F] font-medium focus:outline-none focus:border-[#0A3D3F]"
                    >
                      <option value={6}>6 per page</option>
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-[#4A5B60] text-xs font-semibold tracking-wider border-b border-[#DCE5E3]">
                        <th className="py-3 px-3">DATE</th>
                        <th className="py-3 px-3">REFERENCE</th>
                        <th className="py-3 px-3">DESCRIPTION</th>
                        <th className="py-3 px-3">SOURCE RAIL</th>
                        <th className="py-3 px-3">DIRECTION</th>
                        <th className="py-3 px-3 text-right">AMOUNT</th>
                        <th className="py-3 px-3 text-center">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedWalletTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[#4A5B60] text-sm">
                            No ledger transactions match your current filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedWalletTransactions.map((tx) => {
                          const isCredit = tx.amount > 0;
                          const symbol =
                            tx.currency === 'USD' ? '$' : tx.currency === 'CAD' ? 'C$' : tx.currency === 'GBP' ? '£' : '€';
                          return (
                            <tr
                              key={tx.id}
                              onClick={() => setSelectedTx(tx)}
                              className="border-b border-[#EDF2F1] hover:bg-[#F4F7F6]/80 transition-colors cursor-pointer group"
                            >
                              <td className="py-3.5 px-3 text-xs text-[#4A5B60] font-mono whitespace-nowrap">
                                {tx.date}
                              </td>
                              <td className="py-3.5 px-3 text-xs font-mono font-semibold text-[#0A3D3F] whitespace-nowrap">
                                {tx.reference || tx.id}
                              </td>
                              <td className="py-3.5 px-3 font-medium text-[#0E1B1F]">
                                <div>{tx.description}</div>
                                {tx.counterparty && (
                                  <div className="text-[11px] text-[#4A5B60]">
                                    Counterparty: {tx.counterparty}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#E3F3F1] text-[#0A4F4A]">
                                  {(tx.type || 'TRANSFER').toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span
                                  className={`text-xs font-semibold ${
                                    isCredit ? 'text-[#0A5C47]' : 'text-[#0E1B1F]'
                                  }`}
                                >
                                  {isCredit ? 'CREDIT' : 'DEBIT'}
                                </span>
                              </td>
                              <td
                                className={`py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                                  isCredit ? 'text-[#0A5C47]' : 'text-[#0E1B1F]'
                                }`}
                              >
                                {isCredit ? '+' : '-'}{symbol}
                                {Math.abs(tx.amount).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    tx.status === 'Completed'
                                      ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                                      : 'bg-[#FFF1CC] text-[#5A4100]'
                                  }`}
                                >
                                  {tx.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DCE5E3]">
                  <div className="text-xs text-[#4A5B60]">
                    Showing{' '}
                    <strong>
                      {walletFilteredTransactions.length === 0
                        ? 0
                        : (walletTxPage - 1) * walletTxLimit + 1}
                    </strong>{' '}
                    to{' '}
                    <strong>
                      {Math.min(walletTxPage * walletTxLimit, walletFilteredTransactions.length)}
                    </strong>{' '}
                    of <strong>{walletFilteredTransactions.length}</strong> transactions
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={walletTxPage <= 1}
                      onClick={() => setWalletTxPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 min-h-[38px] px-3 rounded-lg border border-[#BCCAC8] bg-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <span className="text-xs font-semibold px-2 text-[#0E1B1F]">
                      Page {walletTxPage} of {walletTotalPages}
                    </span>

                    <button
                      type="button"
                      disabled={walletTxPage >= walletTotalPages}
                      onClick={() => setWalletTxPage((p) => Math.min(walletTotalPages, p + 1))}
                      className="inline-flex items-center gap-1 min-h-[38px] px-3 rounded-lg border border-[#BCCAC8] bg-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: TRANSFERS
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'transfers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Send to Member */}
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#E3F3F1] flex items-center justify-center text-[#0A3D3F]">
                    <Send className="w-5 h-5 text-[#0F766E]" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                      Member to Member Transfer
                    </h3>
                    <p className="text-xs text-[#4A5B60]">Instant settlement within Lumenfield</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#4A5B60]">Recipient</label>
                    <input
                      type="text"
                      value={sendRecipient}
                      onChange={(e) => setSendRecipient(e.target.value)}
                      placeholder="e.g. Amara O. or LF-000089"
                      className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[#4A5B60]">Amount</label>
                      <input
                        type="number"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4A5B60]">Currency</label>
                      <select
                        aria-label="Select currency for transfer"
                        value={sendCurrency}
                        onChange={(e) => setSendCurrency(e.target.value as Currency)}
                        className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-semibold bg-white"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="CAD">CAD (C$)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleModalSend}
                    className="mt-2 py-3.5 px-4 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm transition-all"
                  >
                    Confirm & Send Transfer
                  </button>
                </div>
              </div>

              {/* External Bank & Rails Simulator */}
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF1CC] flex items-center justify-center text-[#5A4100]">
                    <Landmark className="w-5 h-5 text-[#5A4100]" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                      External Bank & Clearing Rails
                    </h3>
                    <p className="text-xs text-[#4A5B60]">ACH, SEPA, Faster Payments & Crypto</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="p-3.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#0E1B1F]">ACH Direct Deposit / Debit</div>
                      <div className="text-xs text-[#4A5B60]">Routing: 021000021 · Account: ••9401</div>
                    </div>
                    <span className="text-xs font-semibold text-[#0F766E] bg-[#E3F3F1] px-2 py-0.5 rounded">
                      Linked
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#0E1B1F]">USDC Rail</div>
                      <div className="text-xs text-[#4A5B60]">Crypto settlement</div>
                    </div>
                    <span className="text-xs font-semibold text-[#0F766E] bg-[#E3F3F1] px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[#FFF1CC] rounded-xl border border-[#F0D58A] text-xs text-[#5A4100] leading-relaxed">
                  External clearing rails settle through partner accounts when configured.
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: LOANS
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'loans' && (
            <div className="flex flex-col gap-6">
              {/* Active Applications list */}
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                      Active Loan Applications
                    </h3>
                    <p className="text-sm text-[#4A5B60] mt-0.5">
                      Track credit review decisions, terms, and repayment schedules.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLoanModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D3F] text-white text-xs font-semibold hover:bg-[#0F5557]"
                  >
                    <Plus className="w-4 h-4" />
                    New Application
                  </button>
                </div>

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
                      className="border border-[#DCE5E3] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#F4F7F6]/50"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-base text-[#0E1B1F]">
                            {app.title}
                          </span>
                          <span className="font-mono text-xs text-slate-500">#{app.id}</span>
                        </div>
                        <div className="text-sm text-[#4A5B60]">
                          Requested: <strong>${app.requestedAmount.toLocaleString()}</strong> over{' '}
                          <strong>{app.termMonths} months</strong> · Est. Payment:{' '}
                          <strong>${app.estimatedMonthlyPayment}/mo</strong> ({app.interestRateApr}% APR)
                        </div>
                        <div className="text-xs text-[#4A5B60] mt-1">{app.purpose}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            app.status === 'approved'
                              ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                              : app.status === 'under_review'
                              ? 'bg-[#FFF1CC] text-[#5A4100]'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {app.status === 'under_review' ? 'Under Review' : app.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedLoanAppId(app.id)}
                          className="px-3.5 py-1.5 rounded-lg border border-[#BCCAC8] text-xs font-semibold hover:bg-white"
                        >
                          View Schedule
                        </button>
                      </div>
                    </FadeUp>
                  ))}
                </div>
              </div>

              {/* Loan Amortization Simulator */}
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                  Loan Repayment Calculator
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-[#4A5B60]">
                      Loan Amount: ${loanAmount.toLocaleString()}
                    </label>
                    <input
                      type="range"
                      min="5000"
                      max="150000"
                      step="1000"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      className="accent-[#0A3D3F]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-[#4A5B60]">
                      Duration: {loanTerm} Months ({loanTerm / 12} Years)
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="84"
                      step="12"
                      value={loanTerm}
                      onChange={(e) => setLoanTerm(Number(e.target.value))}
                      className="accent-[#0A3D3F]"
                    />
                  </div>

                  <div className="p-4 bg-[#E3F3F1] rounded-xl flex flex-col justify-center">
                    <span className="text-xs text-[#0F766E] font-semibold">Estimated Monthly</span>
                    <span className="font-display font-bold text-2xl text-[#0A3D3F]">
                      $
                      {(
                        (loanAmount * ((5.4 / 100 / 12) * Math.pow(1 + 5.4 / 100 / 12, loanTerm))) /
                        (Math.pow(1 + 5.4 / 100 / 12, loanTerm) - 1)
                      ).toFixed(2)}
                      <span className="text-xs font-normal text-[#4A5B60]">/mo</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: CARDS
             ══════════════════════════════════════════════════════ */}
          {/* ══════════════════════════════════════════════════════
              TAB: CARDS (MULTI-CURRENCY VIRTUAL CARDS)
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'cards' && (
            <VirtualCardsView compact={false} />
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: DOCUMENTS (KYC UPLOAD & VERIFICATION)
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'documents' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                    Identity Documents (KYC)
                  </h3>
                  <p className="text-sm text-[#4A5B60] mt-0.5">
                    Government-issued credentials for identity verification and anti-fraud compliance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDocUploadModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D3F] text-white text-xs font-semibold hover:bg-[#0F5557]"
                >
                  <Upload className="w-4 h-4" />
                  Upload Document
                </button>
              </div>

              <div className="space-y-3">
                {activeMember.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#DCE5E3] flex items-center justify-center text-[#0A3D3F]">
                        <FileText className="w-5 h-5 text-[#0F766E]" />
                      </div>
                      <div>
                        <div className="font-semibold text-[#0E1B1F]">{doc.documentName}</div>
                        <div className="text-xs text-[#4A5B60]">
                          File: {doc.fileName} · Submitted: {doc.submittedAt}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          doc.status === 'approved'
                            ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                            : doc.status === 'pending'
                            ? 'bg-[#FFF1CC] text-[#5A4100]'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {doc.status === 'approved' ? 'Verified' : doc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: SETTINGS
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'settings' && (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-6 max-w-2xl">
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Security & Profile Settings
              </h3>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between p-4 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                  <div>
                    <div className="font-semibold text-[#0E1B1F]">Two-Factor Authentication (TOTP MFA)</div>
                    <div className="text-xs text-[#4A5B60]">Authenticator app enrollment with QR code and emergency recovery codes</div>
                  </div>
                  <button
                    type="button"
                    onClick={openSecurityModal}
                    className="text-xs font-bold text-[#0A3D3F] bg-white border border-[#DCE5E3] hover:bg-[#E3F3F1] px-3.5 py-2 rounded-xl transition min-h-[44px] cursor-pointer"
                  >
                    Manage 2FA
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                  <div>
                    <div className="font-semibold text-[#0E1B1F]">Active Sessions & Devices</div>
                    <div className="text-xs text-[#4A5B60]">Inspect authorized devices and revoke stale or unfamiliar sessions</div>
                  </div>
                  <button
                    type="button"
                    onClick={openSecurityModal}
                    className="text-xs font-bold text-[#0A3D3F] bg-white border border-[#DCE5E3] hover:bg-[#E3F3F1] px-3.5 py-2 rounded-xl transition min-h-[44px] cursor-pointer"
                  >
                    Device List
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                  <div>
                    <div className="font-semibold text-[#0E1B1F]">Password & Security Credentials</div>
                    <div className="text-xs text-[#4A5B60]">Argon2id password hashing with automatic replay revocation</div>
                  </div>
                  <button
                    type="button"
                    onClick={openSecurityModal}
                    className="text-xs font-bold text-[#0A3D3F] bg-white border border-[#DCE5E3] hover:bg-[#E3F3F1] px-3.5 py-2 rounded-xl transition min-h-[44px] cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                  <div>
                    <div className="font-semibold text-[#0E1B1F]">Account Jurisdiction & Role</div>
                    <div className="text-xs text-[#4A5B60]">
                      {activeMember.country} ({activeMember.countryCode}) • Role: {currentUser?.role || 'MEMBER'}
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#0E1B1F]">
                    {activeMember.id}
                  </span>
                </div>

                {/* ── WEB PUSH NOTIFICATIONS (PWA) ── */}
                <div className="p-5 bg-white rounded-2xl border border-[#DCE5E3] shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E3F3F1] flex items-center justify-center text-[#0A3D3F]">
                        <Bell className="w-5 h-5 text-[#0F766E]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#0E1B1F]">PWA Web Push Notifications</h4>
                        <p className="text-xs text-[#4A5B60]">
                          Instant system alerts for member transfers, identity verification decisions, and loan approvals.
                        </p>
                      </div>
                    </div>
                    <PWAInstallButton />
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        pushPermission === 'granted'
                          ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                          : pushPermission === 'denied'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-[#FFF1CC] text-[#5A4100]'
                      }`}
                    >
                      {pushPermission === 'granted' ? '✓ Enabled' : pushPermission === 'denied' ? 'Blocked' : 'Default (Prompt)'}
                    </span>
                  </div>

                  {pushPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const perm = await requestPushPermission();
                        setPushPermission(perm);
                        if (perm === 'granted') {
                          showToast('Push notifications successfully enabled!', 'success');
                          notifyTransferExecuted('System', '$0.00 (Test Handshake)').catch(() => {});
                        } else {
                          showToast('Notification permission was not granted by browser.', 'warning');
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold text-xs rounded-xl shadow-xs transition min-h-[44px] cursor-pointer"
                    >
                      Enable Web Push Notifications
                    </button>
                  )}

                  {/* Test notification trigger buttons */}
                  <div className="space-y-1.5 pt-2 border-t border-[#EDF2F1]">
                    <span className="text-[11px] font-bold text-[#4A5B60] uppercase tracking-wider block">
                      Push notification samples:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const sent = await notifyTransferExecuted('Amara O. (LF-000089)', '$250.00');
                          showToast(sent ? 'Dispatched Transfer Push Notification' : 'Notification permission required', sent ? 'info' : 'warning');
                        }}
                        className="p-2.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] hover:bg-[#E3F3F1] text-xs font-semibold text-[#0E1B1F] transition text-left cursor-pointer min-h-[44px]"
                      >
                        ⚡ Transfer Alert
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const sent = await notifyKycDecision('APPROVED');
                          showToast(sent ? 'Dispatched KYC Decision Push Notification' : 'Notification permission required', sent ? 'info' : 'warning');
                        }}
                        className="p-2.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] hover:bg-[#E3F3F1] text-xs font-semibold text-[#0E1B1F] transition text-left cursor-pointer min-h-[44px]"
                      >
                        ✓ KYC Decision
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const sent = await notifyLoanDecision('APPROVED', '$18,000.00');
                          showToast(sent ? 'Dispatched Loan Approved Push Notification' : 'Notification permission required', sent ? 'info' : 'warning');
                        }}
                        className="p-2.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] hover:bg-[#E3F3F1] text-xs font-semibold text-[#0E1B1F] transition text-left cursor-pointer min-h-[44px]"
                      >
                        🏦 Loan Funded Alert
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── DATA PRIVACY & GDPR / CCPA ── */}
                <div className="p-5 bg-white rounded-2xl border border-[#DCE5E3] shadow-xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF1CC] flex items-center justify-center text-[#5A4100]">
                      <Shield className="w-5 h-5 text-[#5A4100]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0E1B1F]">Data Rights & Privacy (GDPR / CCPA)</h4>
                      <p className="text-xs text-[#4A5B60]">
                        Exercise your statutory data subject access rights or request irreversible account erasure.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Data Export Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await exportPersonalData();
                        } catch (err: any) {
                          showToast(err.message || 'Export failed.', 'warning');
                        }
                      }}
                      className="flex items-center justify-between p-3.5 bg-[#F4F7F6] hover:bg-[#E3F3F1] border border-[#DCE5E3] rounded-xl text-xs font-bold text-[#0A3D3F] transition cursor-pointer min-h-[44px]"
                    >
                      <div className="flex items-center gap-2">
                        <DownloadCloud className="w-4 h-4 text-[#0F766E]" />
                        <span>Export My Data (JSON)</span>
                      </div>
                      <span className="text-[10px] text-[#4A5B60] uppercase">GDPR Art. 15</span>
                    </button>

                    {/* Account Deletion Button */}
                    <button
                      type="button"
                      onClick={() => setShowDeletionConfirmModal(true)}
                      className="flex items-center justify-between p-3.5 bg-red-50/60 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 transition cursor-pointer min-h-[44px]"
                    >
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-600" />
                        <span>Request Account Deletion</span>
                      </div>
                      <span className="text-[10px] text-red-600 uppercase">GDPR Art. 17</span>
                    </button>
                  </div>

                  {/* Legal Terms & Privacy Policy view triggers */}
                  <div className="pt-3 border-t border-[#EDF2F1] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-[11px] text-[#4A5B60]">
                      Regulatory status: <strong className="text-[#0E1B1F]">Member platform</strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={openTermsModal}
                        className="text-xs font-bold text-[#0A3D3F] hover:underline cursor-pointer"
                      >
                        Terms of Service
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={openPrivacyModal}
                        className="text-xs font-bold text-[#0A3D3F] hover:underline cursor-pointer"
                      >
                        Privacy Policy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </PanelSwap>
        </main>
      </div>

      {/* ── MODALS ── */}

      {/* 1. SEND MONEY MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">Send Money</h3>
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Send Money modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">Recipient</label>
                <input
                  type="text"
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  placeholder="e.g. Amara O. or LF-000089"
                  className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#4A5B60]">Amount</label>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#4A5B60]">Currency</label>
                  <select
                    aria-label="Select currency"
                    value={sendCurrency}
                    onChange={(e) => setSendCurrency(e.target.value as Currency)}
                    className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-semibold bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#F4F7F6] rounded-xl text-xs text-[#4A5B60]">
                Available {sendCurrency}:{' '}
                <strong>
                  {sendCurrency === 'USD' ? '$' : sendCurrency === 'CAD' ? 'C$' : sendCurrency === 'GBP' ? '£' : '€'}
                  {activeMember.wallets[sendCurrency].toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleModalSend}
                  className="flex-1 py-3 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm"
                >
                  Send Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-3 rounded-xl border border-[#BCCAC8] text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CARD LIMITS MODAL */}
      {showCardLimitsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Configure Spending Limits
              </h3>
              <button
                type="button"
                onClick={() => setShowCardLimitsModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Spending Limits modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">
                  Daily Spending Limit (${tempDailyLimit})
                </label>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="250"
                  value={tempDailyLimit}
                  onChange={(e) => setTempDailyLimit(Number(e.target.value))}
                  className="w-full mt-2 accent-[#0A3D3F]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">
                  Monthly Spending Limit (${tempMonthlyLimit})
                </label>
                <input
                  type="range"
                  min="2000"
                  max="50000"
                  step="1000"
                  value={tempMonthlyLimit}
                  onChange={(e) => setTempMonthlyLimit(Number(e.target.value))}
                  className="w-full mt-2 accent-[#0A3D3F]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveCardLimits}
                  className="flex-1 py-3 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm"
                >
                  Save Limits
                </button>
                <button
                  type="button"
                  onClick={() => setShowCardLimitsModal(false)}
                  className="px-4 py-3 rounded-xl border border-[#BCCAC8] text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LOAN APPLICATION MODAL */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Credit Program
                </span>
                <h3 className="font-display font-bold text-2xl text-[#0E1B1F] mt-0.5">
                  Apply for a Loan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Loan Application modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4F7F6] rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setLoanType('auto');
                    setLoanPurpose('2024 Vehicle purchase');
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold ${
                    loanType === 'auto' ? 'bg-[#0A3D3F] text-white' : 'text-slate-600'
                  }`}
                >
                  Auto Loan (5.4% APR)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoanType('mortgage');
                    setLoanPurpose('Residential real estate purchase');
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold ${
                    loanType === 'mortgage' ? 'bg-[#0A3D3F] text-white' : 'text-slate-600'
                  }`}
                >
                  Mortgage (6.2% APR)
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">
                  Requested Loan Amount: ${loanAmount.toLocaleString()}
                </label>
                <input
                  type="range"
                  min={loanType === 'auto' ? 5000 : 50000}
                  max={loanType === 'auto' ? 75000 : 500000}
                  step={loanType === 'auto' ? 1000 : 5000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full mt-1 accent-[#0A3D3F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#4A5B60]">Term (Months)</label>
                  <select
                    aria-label="Loan term in months"
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 border border-[#BCCAC8] rounded-xl text-sm bg-white"
                  >
                    {loanType === 'auto' ? (
                      <>
                        <option value="24">24 months (2 yrs)</option>
                        <option value="36">36 months (3 yrs)</option>
                        <option value="48">48 months (4 yrs)</option>
                        <option value="60">60 months (5 yrs)</option>
                        <option value="72">72 months (6 yrs)</option>
                      </>
                    ) : (
                      <>
                        <option value="120">120 months (10 yrs)</option>
                        <option value="180">180 months (15 yrs)</option>
                        <option value="240">240 months (20 yrs)</option>
                        <option value="360">360 months (30 yrs)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#4A5B60]">Down Payment ($)</label>
                  <input
                    type="number"
                    value={loanDownPayment}
                    onChange={(e) => setLoanDownPayment(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">Purpose & Description</label>
                <input
                  type="text"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-[#BCCAC8] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">Asset / VIN / Property Details</label>
                <input
                  type="text"
                  value={loanAssetDetails}
                  onChange={(e) => setLoanAssetDetails(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSubmitLoan}
                  className="flex-1 py-3.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm cursor-pointer"
                >
                  Submit Application
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-3.5 rounded-xl border border-[#BCCAC8] text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TRANSACTION DETAILS RECEIPT MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Transaction Receipt
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  {selectedTx.description}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3] flex items-center justify-between">
              <span className="text-xs text-[#4A5B60]">Amount</span>
              <span
                className={`font-display font-bold text-2xl font-mono ${
                  selectedTx.amount > 0 ? 'text-[#0A5C47]' : 'text-[#0E1B1F]'
                }`}
              >
                {selectedTx.amount > 0 ? '+' : ''}$
                {Math.abs(selectedTx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4A5B60]">Reference</span>
                <span className="font-mono font-semibold">{selectedTx.reference || 'REF-N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4A5B60]">Date</span>
                <span>{selectedTx.date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4A5B60]">Status</span>
                <span className="font-semibold text-[#0F766E]">{selectedTx.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4A5B60]">Counterparty</span>
                <span>{selectedTx.counterparty || 'Lumenfield System'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4A5B60]">Category</span>
                <span>{selectedTx.category || 'General'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="w-full py-3 rounded-xl bg-[#0A3D3F] text-white font-semibold text-sm hover:bg-[#0F5557]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 5. LOAN APPLICATION DETAIL MODAL */}
      {selectedLoanAppId && activeLoanApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Loan Review #{activeLoanApp.id}
                </span>
                <h3 className="font-display font-bold text-2xl text-[#0E1B1F] mt-0.5">
                  {activeLoanApp.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLoanAppId(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Loan Review modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                <div className="text-xs text-[#4A5B60]">Principal Requested</div>
                <div className="font-bold text-lg text-[#0E1B1F]">
                  ${activeLoanApp.requestedAmount.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-[#E3F3F1] rounded-xl border border-[#B8D4D2]">
                <div className="text-xs text-[#0F766E]">Est. Monthly Payment</div>
                <div className="font-bold text-lg text-[#0A3D3F]">
                  ${activeLoanApp.estimatedMonthlyPayment}/mo
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-[#4A5B60]">
              <div><strong>Term:</strong> {activeLoanApp.termMonths} Months ({activeLoanApp.termMonths / 12} Years)</div>
              <div><strong>Interest Rate:</strong> {activeLoanApp.interestRateApr}% Fixed APR</div>
              <div><strong>Purpose:</strong> {activeLoanApp.purpose}</div>
              <div><strong>Asset:</strong> {activeLoanApp.assetDetails}</div>
              <div><strong>Down Payment:</strong> ${activeLoanApp.downPayment?.toLocaleString()}</div>
            </div>

            <div className="p-3.5 bg-[#FFF1CC] rounded-xl text-xs text-[#5A4100] border border-[#F0D58A]">
              Under active underwriting review. An administrator will notify you when a decision is ready.
            </div>

            <button
              type="button"
              onClick={() => setSelectedLoanAppId(null)}
              className="w-full py-3 rounded-xl bg-[#0A3D3F] text-white font-semibold text-sm hover:bg-[#0F5557]"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* 6. KYC DOCUMENT UPLOAD MODAL */}
      {showDocUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Upload Verification Document
              </h3>
              <button
                type="button"
                onClick={() => setShowDocUploadModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Document Upload modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">Document Type</label>
                <select
                  aria-label="Select KYC document type"
                  value={kycType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setKycType(val);
                    setKycDocName(
                      val === 'passport'
                        ? 'Passport'
                        : val === 'drivers_license'
                        ? 'Driver License'
                        : val === 'residence_permit'
                        ? 'Residence Permit'
                        : 'National ID Card'
                    );
                  }}
                  className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm bg-white"
                >
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver’s License</option>
                  <option value="id_card">National ID Card</option>
                  <option value="residence_permit">Residence Permit</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">Label / Document Title</label>
                <input
                  type="text"
                  value={kycDocName}
                  onChange={(e) => setKycDocName(e.target.value)}
                  className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm"
                />
              </div>

              <div className="border-2 border-dashed border-[#BCCAC8] rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-[#F4F7F6] text-center">
                <Upload className="w-7 h-7 text-[#0F766E]" />
                <span className="text-xs font-semibold text-slate-700">
                  Select document scan (PDF, JPG, PNG)
                </span>
                <span className="text-[11px] text-slate-500">Max size 25MB · Encrypted at rest</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleUploadKYC}
                  className="flex-1 py-3 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm"
                >
                  Submit for Verification
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocUploadModal(false)}
                  className="px-4 py-3 rounded-xl border border-[#BCCAC8] text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. GDPR / CCPA ACCOUNT DELETION CONFIRMATION MODAL */}
      {showDeletionConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-red-200 shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-red-700">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block">
                    GDPR Article 17 / CCPA
                  </span>
                  <h3 id="delete-account-title" className="font-display font-bold text-xl text-[#0E1B1F]">
                    Delete Lumenfield Account?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeletionConfirmModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close delete modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-red-50/70 rounded-xl border border-red-200 text-xs text-red-800 space-y-2 leading-relaxed">
              <strong className="font-bold block">Irreversible Erasure Notice:</strong>
              <p>
                Requesting account deletion will immediately suspend your profile and initiate a 30-day statutory holding period. During this time, any remaining balances will be liquidated and virtual cards terminated.
              </p>
              <p className="text-[11px] text-red-700">
                Ledger audit records are preserved in immutable pseudonymized form solely for regulatory AML/KYC audit requirements.
              </p>
            </div>

            <div>
              <label htmlFor="deletion-reason" className="text-xs font-semibold text-[#4A5B60] block mb-1">
                Reason for leaving (optional):
              </label>
              <select
                id="deletion-reason"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                className="w-full p-3 border border-[#BCCAC8] rounded-xl text-sm bg-white font-medium"
              >
                <option value="Moving to another platform">Moving to another financial platform</option>
                <option value="No longer need this account">No longer need this account</option>
                <option value="Privacy concerns">Privacy / Data concerns</option>
                <option value="Other reason">Other reason</option>
              </select>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={async () => {
                  try {
                    setIsDeletingAccount(true);
                    const res = await requestAccountDeletion(deletionReason);
                    setShowDeletionConfirmModal(false);
                    if (res.success) {
                      showToast('Account deletion request submitted. Session terminated.', 'info');
                    } else if (res.error) {
                      showToast(res.error, 'warning');
                    }
                  } catch (err: any) {
                    showToast(err.message || 'Deletion request failed.', 'warning');
                  } finally {
                    setIsDeletingAccount(false);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition cursor-pointer min-h-[44px]"
              >
                {isDeletingAccount ? 'Processing...' : 'Confirm Account Deletion'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeletionConfirmModal(false)}
                className="px-4 py-3 rounded-xl border border-[#BCCAC8] text-xs font-bold text-[#0E1B1F] hover:bg-slate-50 transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
