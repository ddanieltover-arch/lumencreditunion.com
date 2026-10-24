import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LumenLogo } from './LumenLogo';
import { Currency, MemberTab, Transaction } from '../types';
import { resolveHomeCurrency, currencySymbol } from '@lumenfield/shared';
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
  CircleDollarSign,
  ArrowUpFromLine,
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
  LogOut,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { VirtualCardsView } from './VirtualCardsView';
import { PWAInstallButton } from './PWAInstallButton';
import { BankDepositDetails } from './BankDepositDetails';
import {
  PanelSwap,
  FadeUp,
  CountUp,
  AnimatePresence,
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

const MEMBER_NAV_ITEMS: Array<{
  id: MemberTab;
  label: string;
  icon: LucideIcon;
  accent?: string;
  featured?: boolean;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  {
    id: 'funding',
    label: 'Funding',
    icon: CircleDollarSign,
    accent: 'text-[#F5B942]',
    featured: true,
  },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
  { id: 'loans', label: 'Loans', icon: Landmark },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'documents', label: 'Documents', icon: FileCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** Primary mobile bottom-nav destinations (keep to 4 + More). Funding is featured. */
const MEMBER_BOTTOM_TABS: MemberTab[] = ['overview', 'wallet', 'funding', 'cards'];

export const MemberDashboard: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const navIndicatorTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: MOTION.duration.base, ease: MOTION.ease.out };
  const drawerTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: MOTION.duration.base, ease: MOTION.ease.out };
  const {

    memberTab,
    setMemberTab,
    activeMember,
    transactions,
    loanApplications,
    sendTransfer,
    submitLoanApplication,
    uploadKYC,
    convertCurrency,
    showToast,
    openSecurityModal,
    currentUser,
    logoutUser,
    downloadStatement,
    exportPersonalData,
    requestAccountDeletion,
    openTermsModal,
    openPrivacyModal,
    submitKycVerification,
    kycStatus,
    kycSubmission,
    fetchKycStatus,
    fetchMemberWalletActivity,
    countries,
    authToken,
  } = useApp();

  const countryMeta = countries.find(
    (c) => c.code.toUpperCase() === (activeMember?.countryCode || '').toUpperCase(),
  );
  const homeCurrency = resolveHomeCurrency(
    activeMember?.countryCode || currentUser?.countryCode,
    countryMeta?.currency,
  ) as Currency;
  const homeSymbol = currencySymbol(homeCurrency);
  const otherCurrencies = (['USD', 'CAD', 'GBP', 'EUR'] as Currency[]).filter(
    (c) => c !== homeCurrency,
  );

  useEffect(() => {
    if (currentUser?.role === 'MEMBER' || (currentUser && currentUser.role !== 'SUPER_ADMIN')) {
      void fetchKycStatus();
      void fetchMemberWalletActivity();
    }
  }, [currentUser?.id, authToken]);

  // Keep transfer/swap defaults aligned with the member's signup-country currency
  useEffect(() => {
    if (!activeMember) return;
    setSendCurrency(homeCurrency);
    setWithdrawCurrency(homeCurrency);
    setFundingCurrency(homeCurrency);
    setSwapFrom(homeCurrency);
    setSwapTo(otherCurrencies[0] || 'USD');
  }, [homeCurrency, activeMember?.id]);

  if (!activeMember || !currentUser) {
    return null;
  }

  const readJsonSafe = async (res: Response): Promise<any> => {
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

  const refreshFundingRequests = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/wallet/funding-requests', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await readJsonSafe(res);
      if (!res.ok) return;
      setFundingRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      /* ignore list refresh errors */
    }
  };

  useEffect(() => {
    if (memberTab === 'funding') {
      void refreshFundingRequests();
    }
  }, [memberTab, authToken]);

  const handleSubmitFundingRequest = async () => {
    if (!activeMember.identityVerified && kycStatus !== 'APPROVED') {
      setMemberTab('documents');
      showToast('Complete identity verification before requesting funding.', 'info');
      return;
    }
    const amt = parseFloat(fundingAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter a valid funding amount.', 'warning');
      return;
    }
    if (fundingReason.trim().length < 5) {
      showToast('Please describe why you need funding (at least 5 characters).', 'warning');
      return;
    }
    if (!authToken) {
      showToast('Sign in again to submit a funding request.', 'warning');
      return;
    }
    try {
      setFundingSubmitting(true);
      const res = await fetch('/wallet/funding-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          amount: fundingAmount.trim(),
          currency: fundingCurrency,
          reason: fundingReason.trim(),
          sourceHint: fundingSourceHint,
        }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.message || 'Could not submit funding request.');
      }
      setFundingAmount('');
      setFundingReason('');
      showToast(
        `Funding request for ${data.amountFormatted || `${fundingCurrency} ${fundingAmount}`} submitted. An administrator will review it.`,
        'success',
      );
      await refreshFundingRequests();
    } catch (err: any) {
      showToast(err.message || 'Funding request failed.', 'warning');
    } finally {
      setFundingSubmitting(false);
    }
  };

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

  // Wallet activity filtering & pagination
  const [walletTxPage, setWalletTxPage] = useState<number>(1);
  const [walletTxLimit, setWalletTxLimit] = useState<number>(6);
  const [walletTxCurrency, setWalletTxCurrency] = useState<string>('ALL');
  const [walletTxDirection, setWalletTxDirection] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [walletTxSource, setWalletTxSource] = useState<string>('ALL');
  const [walletTxSearch, setWalletTxSearch] = useState<string>('');

  // Modal states
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawCurrency, setWithdrawCurrency] = useState<Currency>('USD');
  const [withdrawDestination, setWithdrawDestination] = useState<string>('ACH · Routing 021000021 · ••9401');
  const [showLoanModal, setShowLoanModal] = useState<boolean>(false);
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

  // Funding request form
  const [fundingAmount, setFundingAmount] = useState<string>('');
  const [fundingCurrency, setFundingCurrency] = useState<Currency>('USD');
  const [fundingReason, setFundingReason] = useState<string>('');
  const [fundingSourceHint, setFundingSourceHint] = useState<
    'BANK_TRANSFER' | 'WIRE' | 'CARD' | 'OTHER'
  >('BANK_TRANSFER');
  const [fundingSubmitting, setFundingSubmitting] = useState(false);
  const [fundingRequests, setFundingRequests] = useState<
    Array<{
      id: string;
      amountFormatted: string;
      currency: string;
      reason: string;
      status: string;
      createdAt: string;
      reviewerNote?: string | null;
    }>
  >([]);

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
  const [kycFrontFile, setKycFrontFile] = useState<File | null>(null);
  const [kycBackFile, setKycBackFile] = useState<File | null>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const kycNeedsBothSides =
    kycType === 'drivers_license' || kycType === 'id_card' || kycType === 'residence_permit';

  // External bank / rails form
  const [bankRail, setBankRail] = useState<'ACH' | 'SEPA' | 'FASTER' | 'USDC'>('ACH');
  const [bankAmount, setBankAmount] = useState('');
  const [bankDestination, setBankDestination] = useState('');

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
    if (!quickTo.trim()) {
      showToast('Enter a recipient name or member ID.', 'warning');
      return;
    }
    const res = sendTransfer({
      recipient: quickTo.trim(),
      amount: amt,
      currency: 'USD',
    });
    if (res.success) {
      setQuickTo('');
      setQuickAmount('');
    } else {
      showToast(res.message, 'warning');
    }
  };

  const handleModalSend = () => {
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid transfer amount.', 'warning');
      return;
    }
    if (!sendRecipient.trim()) {
      showToast('Enter a recipient name or member ID.', 'warning');
      return;
    }
    const res = sendTransfer({
      recipient: sendRecipient.trim(),
      amount: amt,
      currency: sendCurrency,
    });
    if (res.success) {
      setShowSendModal(false);
      setSendRecipient('');
      setSendAmount('');
    } else {
      showToast(res.message, 'warning');
    }
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter a valid withdrawal amount.', 'warning');
      return;
    }
    if (!withdrawDestination.trim()) {
      showToast('Choose or enter a withdrawal destination.', 'warning');
      return;
    }
    const res = sendTransfer({
      recipient: `Withdraw → ${withdrawDestination.trim()}`,
      amount: amt,
      currency: withdrawCurrency,
    });
    if (res.success) {
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } else {
      showToast(res.message, 'warning');
    }
  };

  const handleSwap = () => {
    const amt = parseFloat(swapAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter valid swap amount.', 'warning');
      return;
    }
    if (swapFrom === swapTo) {
      showToast('Choose two different currencies to swap.', 'warning');
      return;
    }
    const res = convertCurrency(swapFrom, swapTo, amt);
    if (!res.success) {
      showToast(res.message, 'warning');
    }
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

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });

  const resolveKycMime = (file: File) =>
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    file.type === 'application/pdf'
      ? file.type
      : null;

  const handleUploadKYC = async () => {
    if (!kycFrontFile) {
      showToast(
        kycNeedsBothSides
          ? 'Upload the front of your document.'
          : 'Select a document file to upload.',
        'warning',
      );
      return;
    }
    if (kycNeedsBothSides && !kycBackFile) {
      showToast('Upload the back of your document.', 'warning');
      return;
    }
    if (!kycDocName.trim()) {
      showToast('Enter a document title.', 'warning');
      return;
    }

    const typeMap = {
      passport: 'PASSPORT',
      id_card: 'ID_CARD',
      residence_permit: 'RESIDENCE_PERMIT',
      drivers_license: 'DRIVERS_LICENSE',
    } as const;

    const frontMime = resolveKycMime(kycFrontFile);
    if (!frontMime) {
      showToast('Upload a JPG, PNG, WebP, or PDF file.', 'warning');
      return;
    }
    const backMime = kycBackFile ? resolveKycMime(kycBackFile) : null;
    if (kycBackFile && !backMime) {
      showToast('Back side must be JPG, PNG, WebP, or PDF.', 'warning');
      return;
    }

    try {
      setIsSubmittingKyc(true);
      const frontBase64 = await readFileAsDataUrl(kycFrontFile);
      const documents: Array<{
        fileName: string;
        mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
        fileBase64: string;
        side: 'FRONT' | 'BACK';
      }> = [
        {
          fileName: kycFrontFile.name || `${kycDocName.replace(/\s+/g, '_')}_front.pdf`,
          mimeType: frontMime,
          fileBase64: frontBase64,
          side: 'FRONT',
        },
      ];

      if (kycBackFile && backMime) {
        const backBase64 = await readFileAsDataUrl(kycBackFile);
        documents.push({
          fileName: kycBackFile.name || `${kycDocName.replace(/\s+/g, '_')}_back.pdf`,
          mimeType: backMime,
          fileBase64: backBase64,
          side: 'BACK',
        });
      }

      await submitKycVerification({
        countryCode: (activeMember.countryCode || 'US').slice(0, 2).toUpperCase(),
        documentType: typeMap[kycType],
        documents,
      });

      setShowDocUploadModal(false);
      setKycFrontFile(null);
      setKycBackFile(null);
      showToast('Identity document submitted for admin review.', 'success');
    } catch (err: any) {
      // Fall back to local queue if API is unavailable so the UI still responds
      const fileName = kycFrontFile.name || `${kycType}_${activeMember.id.toLowerCase()}.pdf`;
      uploadKYC(kycType, kycDocName.trim(), fileName);
      setShowDocUploadModal(false);
      setKycFrontFile(null);
      setKycBackFile(null);
      if (err?.message) {
        showToast(`${err.message} Saved locally for review.`, 'warning');
      }
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const handleExternalRailTransfer = () => {
    const amt = parseFloat(bankAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter a valid amount for the external transfer.', 'warning');
      return;
    }
    if (!bankDestination.trim()) {
      showToast('Enter a destination account, IBAN, or wallet address.', 'warning');
      return;
    }
    const recipient = `${bankRail}: ${bankDestination.trim()}`;
    const res = sendTransfer({
      recipient,
      amount: amt,
      currency: bankRail === 'SEPA' ? 'EUR' : bankRail === 'FASTER' ? 'GBP' : 'USD',
    });
    if (res.success) {
      setBankAmount('');
      setBankDestination('');
    } else {
      showToast(res.message, 'warning');
    }
  };

  const activeLoanApp =
    loanApplications.find((l) => l.id === selectedLoanAppId) ||
    loanApplications[0] ||
    null;

  const activeNavLabel =
    MEMBER_NAV_ITEMS.find((item) => item.id === memberTab)?.label || 'Overview';
  const memberBottomItems = MEMBER_NAV_ITEMS.filter((item) =>
    MEMBER_BOTTOM_TABS.includes(item.id),
  );
  const memberMoreActive = !MEMBER_BOTTOM_TABS.includes(memberTab);

  const selectMemberTab = (tab: MemberTab) => {
    setMemberTab(tab);
    setMobileNavOpen(false);
  };

  const renderMemberNavButtons = (layoutId: string) =>
    MEMBER_NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const isActive = memberTab === item.id;
      const isFeatured = Boolean(item.featured);
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => selectMemberTab(item.id)}
          className={`relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-left transition-colors duration-200 cursor-pointer ${
            isActive
              ? isFeatured
                ? 'text-[#0A3D3F] font-bold'
                : 'text-white font-semibold'
              : isFeatured
                ? 'text-[#F5B942] font-semibold hover:bg-[#F5B942]/15'
                : 'text-[#C9DEDC] hover:bg-[#0F5557]/40 hover:text-white'
          }`}
        >
          {isActive && (
            <motion.span
              layoutId={layoutId}
              className={`absolute inset-0 rounded-[10px] ${
                isFeatured ? 'bg-[#F5B942]' : 'bg-[#0F5557]'
              }`}
              transition={navIndicatorTransition}
            />
          )}
          {!isActive && isFeatured && (
            <span className="absolute inset-0 rounded-[10px] border border-[#F5B942]/45 bg-[#F5B942]/10" />
          )}
          <Icon
            className={`relative z-10 w-4 h-4 shrink-0 ${
              isActive && isFeatured ? 'text-[#0A3D3F]' : item.accent || ''
            }`}
          />
          <span className="relative z-10">{item.label}</span>
          {isFeatured && !isActive && (
            <span className="relative z-10 ml-auto text-[9px] font-bold uppercase tracking-wider text-[#F5B942]/90">
              New
            </span>
          )}
        </button>
      );
    });

  const memberProfileCard = (
    <div className="p-3.5 rounded-xl bg-[#0F5557] text-[13px] leading-snug text-[#C9DEDC] flex flex-col gap-1.5 border border-[#2D7A77]/50">
      <div className="flex items-center justify-between text-xs">
        <span>Signed in as</span>
        <span className="font-mono text-[10px] bg-[#0A3D3F] px-1.5 py-0.5 rounded text-[#F5B942] max-w-[140px] truncate" title={activeMember.bankIdentity?.accountNumberDisplay || activeMember.id}>
          {activeMember.bankIdentity?.accountNumberDisplay || activeMember.id.slice(0, 8)}
        </span>
      </div>
      <div className="font-semibold text-white text-sm">
        {currentUser?.fullName || activeMember.name}
      </div>
      <div className="text-[11px] text-[#8FA5A3] truncate">
        {currentUser?.email || activeMember.email}
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-[#F4F7F6] text-[#0E1B1F] flex flex-col font-sans">
      {/* ── MOBILE TOP BAR ── */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0A3D3F] text-white border-b border-[#072F30]">
        <div className="flex items-center gap-2.5 px-4 min-h-[52px]">
          <LumenLogo size={26} textColor="#FFFFFF" />
          <div className="min-w-0">
            <div className="text-[10px] font-mono font-bold tracking-[0.12em] text-[#8FA5A3] uppercase leading-none">
              Member
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
          <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Member menu">
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
              className="absolute inset-y-0 left-0 w-[min(100%,300px)] bg-[#0A3D3F] text-white shadow-2xl flex flex-col border-r border-[#072F30]"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={drawerTransition}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
                <LumenLogo size={28} textColor="#FFFFFF" />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close member menu"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav
                aria-label="Member navigation"
                className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1.5 text-[15px] font-medium"
              >
                {renderMemberNavButtons('member-nav-active-mobile')}
              </nav>

              <div className="px-3 pb-5 pt-2 border-t border-white/10 flex flex-col gap-3">
                {memberProfileCard}
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    void logoutUser();
                  }}
                  className="w-full flex items-center gap-2.5 text-xs font-semibold text-[#C9DEDC] hover:text-white hover:bg-[#0F5557]/60 p-2.5 rounded-xl border border-white/10 transition cursor-pointer min-h-[44px]"
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
        <aside className="hidden md:flex w-[260px] shrink-0 bg-[#0A3D3F] text-white p-7 md:py-7 md:px-5 flex-col justify-between gap-7 border-r border-[#072F30]">
          <div className="flex flex-col gap-7">
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

            <nav aria-label="Member navigation" className="flex flex-col gap-1.5 text-[15px] font-medium">
              {renderMemberNavButtons('member-nav-active')}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            {memberProfileCard}
            <button
              type="button"
              onClick={() => void logoutUser()}
              className="w-full flex items-center gap-2.5 text-xs font-semibold text-[#C9DEDC] hover:text-white hover:bg-[#0F5557]/60 p-2.5 rounded-xl border border-white/10 transition cursor-pointer min-h-[44px]"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT WORKSPACE ── */}
        <main className="flex-1 min-w-0 p-5 sm:p-8 pb-24 md:pb-8 flex flex-col gap-7 max-w-[1280px]">
          {/* Header Bar */}
          <PanelSwap panelKey={`hdr-${memberTab}`} className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#0E1B1F] tracking-[-0.01em]">
                {memberTab === 'overview' && `Good morning, ${activeMember.name}`}
                {memberTab === 'wallet' && 'Multi-Currency Wallet'}
                {memberTab === 'transfers' && 'Move & Transfer Money'}
                {memberTab === 'funding' && 'Request Funding'}
                {memberTab === 'loans' && 'Loans & Financing'}
                {memberTab === 'cards' && 'Virtual Cards'}
                {memberTab === 'documents' && 'Identity & Verification Documents'}
                {memberTab === 'settings' && 'Account Settings'}
              </h1>
              <span className="text-[15px] text-[#4A5B60]">
                {memberTab === 'overview' && 'Here is where your wallet stands today.'}
                {memberTab === 'wallet' && 'Manage your fiat balances and exchange between currencies.'}
                {memberTab === 'transfers' && 'Send instant P2P payments, initiate bank withdrawals, or view transfer rails.'}
                {memberTab === 'funding' && 'Ask Lumenfield to credit your wallet after a verified deposit or sandbox test credit.'}
                {memberTab === 'loans' && 'Auto and mortgage loans with fixed terms and transparent payment schedules.'}
                {memberTab === 'cards' && 'Virtual debit cards with instant freeze protection and custom limits.'}
                {memberTab === 'documents' && 'Secure repository for government-issued ID review.'}
                {memberTab === 'settings' && 'Security, profile, and account configuration.'}
              </span>
            </div>

            {/* Identity Status Pill (From Design) */}
            <div className="flex items-center gap-2">
              {activeMember.identityVerified || kycStatus === 'APPROVED' ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E3F3F1] text-[#0A4F4A] text-xs font-semibold border border-[#B8D4D2]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Identity verified</span>
                </div>
              ) : kycStatus === 'PENDING' || kycStatus === 'NEEDS_MORE_INFO' ? (
                <button
                  type="button"
                  onClick={() => setMemberTab('documents')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFF1CC] text-[#5A4100] text-xs font-semibold border border-[#F0D58A] hover:bg-[#FFE9A8] transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {kycStatus === 'NEEDS_MORE_INFO'
                      ? 'More info required — view documents'
                      : 'Verification under review'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMemberTab('documents')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFF1CC] text-[#5A4100] text-xs font-semibold border border-[#F0D58A] hover:bg-[#FFE9A8] transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Verification pending — upload ID</span>
                </button>
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
                        {homeCurrency} wallet
                      </span>
                    </div>
                    <CountUp
                      value={activeMember.wallets[homeCurrency] || 0}
                      prefix={homeSymbol}
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
                        if (!activeMember.identityVerified && kycStatus !== 'APPROVED') {
                          setMemberTab('documents');
                          showToast(
                            'Complete identity verification before withdrawing funds.',
                            'info',
                          );
                          return;
                        }
                        setWithdrawAmount('');
                        setWithdrawCurrency(homeCurrency);
                        setShowWithdrawModal(true);
                      }}
                      className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl border border-[#5E9A97] text-white hover:bg-white/10 font-semibold text-sm transition-all cursor-pointer"
                    >
                      <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5" />
                      Withdraw
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!activeMember.identityVerified && kycStatus !== 'APPROVED') {
                          setMemberTab('documents');
                          showToast(
                            'Complete identity verification first. An administrator can then credit your wallet.',
                            'info',
                          );
                          return;
                        }
                        setMemberTab('funding');
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
                    {otherCurrencies.map((curr) => (
                      <div key={curr} className="flex flex-col gap-0.5">
                        <span className="text-xs text-[#B8D4D2] font-semibold">{curr}</span>
                        <span className="font-bold text-base sm:text-lg text-white font-mono">
                          {currencySymbol(curr)}
                          {(activeMember.wallets[curr] || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
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
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-10 px-2 text-center text-sm text-[#4A5B60]"
                            >
                              No recent activity yet. Credits and transfers will appear here once
                              posted to your wallet.
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((tx, txIndex) => {
                            const isCredit = tx.amount > 0;
                            const rowDelay =
                              Math.min(txIndex, MOTION.maxStaggerChildren - 1) *
                              MOTION.stagger.tight;
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
                          })
                        )}
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
                        placeholder="Name, email, or account number"
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
              <BankDepositDetails
                identity={activeMember.bankIdentity}
                memberName={activeMember.name}
              />

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
                      placeholder="e.g. name, email, or account number"
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

              {/* External Bank & Clearing Rails */}
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

                <div className="flex flex-wrap gap-2">
                  {(['ACH', 'SEPA', 'FASTER', 'USDC'] as const).map((rail) => (
                    <button
                      key={rail}
                      type="button"
                      onClick={() => setBankRail(rail)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer min-h-[40px] ${
                        bankRail === rail
                          ? 'bg-[#0A3D3F] text-white border-[#0A3D3F]'
                          : 'bg-[#F4F7F6] text-[#0E1B1F] border-[#DCE5E3] hover:bg-[#E3F3F1]'
                      }`}
                    >
                      {rail === 'FASTER' ? 'Faster Payments' : rail}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#4A5B60]">
                      Destination ({bankRail === 'USDC' ? 'wallet address' : 'account / IBAN'})
                    </label>
                    <input
                      type="text"
                      value={bankDestination}
                      onChange={(e) => setBankDestination(e.target.value)}
                      placeholder={
                        bankRail === 'USDC'
                          ? '0x…'
                          : bankRail === 'SEPA'
                          ? 'IBAN'
                          : 'Account number'
                      }
                      className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#4A5B60]">Amount</label>
                    <input
                      type="number"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExternalRailTransfer}
                  className="py-3.5 px-4 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm transition-all cursor-pointer"
                >
                  Initiate {bankRail === 'FASTER' ? 'Faster Payments' : bankRail} transfer
                </button>

                <div className="p-4 bg-[#FFF1CC] rounded-xl border border-[#F0D58A] text-xs text-[#5A4100] leading-relaxed">
                  Debits your wallet balance and records the outbound rail transfer in activity history.
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB: FUNDING REQUESTS
             ══════════════════════════════════════════════════════ */}
          {memberTab === 'funding' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-5">
                <div>
                  <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                    Request wallet funding
                  </h3>
                  <p className="text-sm text-[#4A5B60] mt-1">
                    Submit a request for Lumenfield to credit your wallet. An administrator reviews
                    and posts the credit after verifying your deposit (or sandbox test credit).
                  </p>
                </div>

                {(!activeMember.identityVerified && kycStatus !== 'APPROVED') && (
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FFF1CC] border border-[#F0D58A] text-[#5A4100] text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      Identity verification is required before funding requests are accepted.{' '}
                      <button
                        type="button"
                        onClick={() => setMemberTab('documents')}
                        className="font-semibold underline cursor-pointer"
                      >
                        Upload documents →
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#4A5B60]">Amount</label>
                    <input
                      type="number"
                      value={fundingAmount}
                      onChange={(e) => setFundingAmount(e.target.value)}
                      placeholder="0.00"
                      className="min-h-[48px] p-3 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#4A5B60]">Currency</label>
                    <select
                      value={fundingCurrency}
                      onChange={(e) => setFundingCurrency(e.target.value as Currency)}
                      className="min-h-[48px] p-3 border border-[#BCCAC8] rounded-xl text-sm bg-white font-semibold"
                    >
                      <option value="USD">USD</option>
                      <option value="CAD">CAD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#4A5B60]">Funding source</label>
                  <select
                    value={fundingSourceHint}
                    onChange={(e) =>
                      setFundingSourceHint(
                        e.target.value as 'BANK_TRANSFER' | 'WIRE' | 'CARD' | 'OTHER',
                      )
                    }
                    className="min-h-[48px] p-3 border border-[#BCCAC8] rounded-xl text-sm bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank transfer / ACH / SEPA</option>
                    <option value="WIRE">Wire transfer</option>
                    <option value="CARD">Card deposit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#4A5B60]">
                    Reason / deposit reference notes
                  </label>
                  <textarea
                    value={fundingReason}
                    onChange={(e) => setFundingReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Incoming wire from Chase · Ref WIRE-48219 · Personal savings transfer"
                    className="p-3 border border-[#BCCAC8] rounded-xl text-sm resize-y min-h-[96px]"
                  />
                </div>

                <button
                  type="button"
                  disabled={fundingSubmitting}
                  onClick={() => void handleSubmitFundingRequest()}
                  className="self-start min-h-[48px] px-6 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm disabled:opacity-60 cursor-pointer inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {fundingSubmitting ? 'Submitting…' : 'Submit funding request'}
                </button>
              </div>

              <div className="bg-white border border-[#DCE5E3] rounded-3xl p-7 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display font-bold text-xl text-[#0E1B1F]">Your requests</h3>
                  <button
                    type="button"
                    onClick={() => void refreshFundingRequests()}
                    className="text-xs font-semibold text-[#0A3D3F] hover:underline cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
                {fundingRequests.length === 0 ? (
                  <p className="text-sm text-[#4A5B60]">No funding requests yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-[#4A5B60] border-b border-[#DCE5E3]">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundingRequests.map((r) => (
                          <tr key={r.id} className="border-b border-[#EDF2F1]">
                            <td className="py-3 pr-3 text-xs text-[#4A5B60] whitespace-nowrap">
                              {new Date(r.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 pr-3 font-mono font-semibold">
                              {r.amountFormatted}
                            </td>
                            <td className="py-3 pr-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  r.status === 'APPROVED'
                                    ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                                    : r.status === 'REJECTED'
                                      ? 'bg-red-50 text-red-700'
                                      : 'bg-[#FFF1CC] text-[#5A4100]'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="py-3 text-[#4A5B60]">
                              <div>{r.reason}</div>
                              {r.reviewerNote && (
                                <div className="text-[11px] mt-0.5 text-[#8FA5A3]">
                                  Admin: {r.reviewerNote}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                    Identity Documents (KYC)
                  </h3>
                  <p className="text-sm text-[#4A5B60] mt-0.5">
                    {kycStatus === 'APPROVED' || activeMember.identityVerified
                      ? 'Your identity has been verified. Wallet, transfers, cards, and loans are unlocked.'
                      : kycStatus === 'PENDING'
                      ? 'Your documents are with compliance for review. You will be notified when a decision is made.'
                      : 'Government-issued credentials for identity verification and anti-fraud compliance.'}
                  </p>
                </div>
                {kycStatus !== 'APPROVED' && !activeMember.identityVerified && (
                  <button
                    type="button"
                    onClick={() => setShowDocUploadModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D3F] text-white text-xs font-semibold hover:bg-[#0F5557]"
                  >
                    <Upload className="w-4 h-4" />
                    {kycStatus === 'PENDING' || kycStatus === 'NEEDS_MORE_INFO'
                      ? 'Upload updated document'
                      : 'Upload Document'}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {activeMember.documents.length === 0 && !kycSubmission && (
                  <div className="p-8 border-2 border-dashed border-[#DCE5E3] rounded-2xl text-center text-sm text-[#4A5B60]">
                    No identity documents on file yet.
                  </div>
                )}
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
                    onClick={() => openSecurityModal('mfa')}
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
                    onClick={() => openSecurityModal('sessions')}
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
                    onClick={() => openSecurityModal('password')}
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
                  <span
                    className="text-xs font-mono font-semibold text-[#0E1B1F] text-right max-w-[220px] break-all"
                    title={activeMember.bankIdentity?.accountNumberDisplay || activeMember.id}
                  >
                    {activeMember.bankIdentity?.accountNumberDisplay || activeMember.id}
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
                          const sent = await notifyTransferExecuted(
                            `Amara O. (${activeMember.bankIdentity?.accountNumberDisplay || 'account'})`,
                            '$250.00',
                          );
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
                  placeholder="e.g. name, email, or account number"
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

      {/* 2. WITHDRAW MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Cash out
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  Withdraw to bank
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Withdraw modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#4A5B60]">Destination account</label>
                <select
                  aria-label="Withdrawal destination"
                  value={withdrawDestination}
                  onChange={(e) => setWithdrawDestination(e.target.value)}
                  className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm bg-white"
                >
                  <option value="ACH · Routing 021000021 · ••9401">
                    ACH · Routing 021000021 · ••9401
                  </option>
                  <option value="SEPA · IBAN ••4821">SEPA · IBAN ••4821</option>
                  <option value="Faster Payments · ••1190">Faster Payments · ••1190</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#4A5B60]">Amount</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#4A5B60]">Currency</label>
                  <select
                    aria-label="Withdrawal currency"
                    value={withdrawCurrency}
                    onChange={(e) => setWithdrawCurrency(e.target.value as Currency)}
                    className="w-full mt-1 p-3 border border-[#BCCAC8] rounded-xl text-sm font-semibold bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-[#4A5B60]">
                Available:{' '}
                <strong>
                  {withdrawCurrency === 'USD'
                    ? '$'
                    : withdrawCurrency === 'CAD'
                    ? 'C$'
                    : withdrawCurrency === 'GBP'
                    ? '£'
                    : '€'}
                  {activeMember.wallets[withdrawCurrency].toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleWithdraw}
                  className="flex-1 py-3 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm cursor-pointer"
                >
                  Confirm withdrawal
                </button>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-3 rounded-xl border border-[#BCCAC8] text-sm font-semibold hover:bg-slate-50 cursor-pointer"
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
                    const val = e.target.value as typeof kycType;
                    setKycType(val);
                    setKycBackFile(null);
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

              <div>
                <label className="text-xs font-semibold text-[#4A5B60] block mb-1.5">
                  {kycNeedsBothSides ? 'Front side' : 'Document scan'}
                </label>
                <label className="border-2 border-dashed border-[#BCCAC8] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#F4F7F6] text-center cursor-pointer hover:border-[#0A3D3F] transition">
                  <Upload className="w-6 h-6 text-[#0F766E]" />
                  <span className="text-xs font-semibold text-slate-700">
                    {kycFrontFile
                      ? kycFrontFile.name
                      : kycNeedsBothSides
                        ? 'Upload front of document (PDF, JPG, PNG)'
                        : 'Select document scan (PDF, JPG, PNG)'}
                  </span>
                  <span className="text-[11px] text-slate-500">Max size 25MB · Encrypted at rest</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 25 * 1024 * 1024) {
                        showToast('File must be 25MB or smaller.', 'warning');
                        return;
                      }
                      setKycFrontFile(file);
                    }}
                  />
                </label>
              </div>

              {kycNeedsBothSides && (
                <div>
                  <label className="text-xs font-semibold text-[#4A5B60] block mb-1.5">
                    Back side
                  </label>
                  <label className="border-2 border-dashed border-[#BCCAC8] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#F4F7F6] text-center cursor-pointer hover:border-[#0A3D3F] transition">
                    <Upload className="w-6 h-6 text-[#0F766E]" />
                    <span className="text-xs font-semibold text-slate-700">
                      {kycBackFile
                        ? kycBackFile.name
                        : 'Upload back of document (PDF, JPG, PNG)'}
                    </span>
                    <span className="text-[11px] text-slate-500">Max size 25MB · Encrypted at rest</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file && file.size > 25 * 1024 * 1024) {
                          showToast('File must be 25MB or smaller.', 'warning');
                          return;
                        }
                        setKycBackFile(file);
                      }}
                    />
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingKyc}
                  onClick={() => void handleUploadKYC()}
                  className="flex-1 py-3 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingKyc ? 'Submitting…' : 'Submit for Verification'}
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

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav
        aria-label="Primary member navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DCE5E3] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 pt-1.5 pb-1.5">
          {memberBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = memberTab === item.id;
            const isFeatured = Boolean(item.featured);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectMemberTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl transition cursor-pointer ${
                  isFeatured
                    ? isActive
                      ? 'text-[#0A3D3F] bg-[#F5B942] shadow-sm'
                      : 'text-[#8A5A00] bg-[#FFF1CC] hover:bg-[#F5B942]/80'
                    : isActive
                      ? 'text-[#0A3D3F]'
                      : 'text-[#4A5B60] hover:text-[#0A3D3F] hover:bg-[#F4F7F6]'
                }`}
              >
                {isFeatured && !isActive && (
                  <span className="absolute -top-0.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F5B942] ring-2 ring-white" />
                )}
                <Icon
                  className={`w-[20px] h-[20px] ${
                    isFeatured
                      ? isActive
                        ? 'text-[#0A3D3F]'
                        : 'text-[#B8860B]'
                      : isActive
                        ? 'text-[#0A3D3F]'
                        : 'text-[#8FA5A3]'
                  }`}
                  strokeWidth={isActive || isFeatured ? 2.4 : 2}
                />
                <span
                  className={`text-[10px] leading-none ${
                    isFeatured || isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {item.label}
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
              memberMoreActive
                ? 'text-[#0A3D3F]'
                : 'text-[#4A5B60] hover:text-[#0A3D3F] hover:bg-[#F4F7F6]'
            }`}
          >
            <Menu
              className={`w-[20px] h-[20px] ${
                memberMoreActive ? 'text-[#0A3D3F]' : 'text-[#8FA5A3]'
              }`}
              strokeWidth={memberMoreActive ? 2.4 : 2}
            />
            <span
              className={`text-[10px] leading-none ${
                memberMoreActive ? 'font-bold' : 'font-medium'
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
