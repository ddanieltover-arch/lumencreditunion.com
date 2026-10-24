import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Lock,
  Unlock,
  Ban,
  Pencil,
  Trash2,
  Coins,
  RefreshCw,
  Search,
  X,
  ShieldAlert,
  Plus,
  History,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Clock,
  ArrowUpRight,
  Shield,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CardCurrency,
  CardStatus,
  VirtualCardRecord,
  CardTransactionRecord,
  CardOneTimeSensitiveDetails,
  formatMoney,
} from '@lumenfield/shared';

type AdminCardRow = VirtualCardRecord & {
  memberName: string;
  memberEmail: string;
};

const STATUS_STYLES: Record<CardStatus, { badge: string; border: string; label: string }> = {
  ACTIVE: {
    badge: 'bg-[#E3F3F1] text-[#0A4F4A]',
    border: 'border-[#A3D9D2]',
    label: 'Active',
  },
  FROZEN: {
    badge: 'bg-[#FFF1CC] text-[#5A4100]',
    border: 'border-[#F5D480]',
    label: 'Frozen',
  },
  SUSPENDED: {
    badge: 'bg-orange-100 text-orange-900',
    border: 'border-orange-300',
    label: 'Suspended',
  },
  TERMINATED: {
    badge: 'bg-red-100 text-red-800',
    border: 'border-red-300',
    label: 'Terminated',
  },
};

const CURRENCY_SYMBOLS: Record<CardCurrency, string> = {
  USD: '$',
  CAD: 'C$',
  GBP: '£',
  EUR: '€',
};

interface AdminVirtualCardsPanelProps {
  initialMemberId?: string;
}

export const AdminVirtualCardsPanel: React.FC<AdminVirtualCardsPanelProps> = ({
  initialMemberId,
}) => {
  const { authToken, showToast, fetchAdminDashboardStats, members } = useApp();
  const [cards, setCards] = useState<AdminCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<string>(initialMemberId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CardStatus>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | CardCurrency>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit Modal State
  const [editing, setEditing] = useState<AdminCardRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDaily, setEditDaily] = useState('');
  const [editMonthly, setEditMonthly] = useState('');
  const [editStatus, setEditStatus] = useState<CardStatus>('ACTIVE');
  const [editReason, setEditReason] = useState('');
  const [editResetSpentToday, setEditResetSpentToday] = useState(false);
  const [editResetSpentThisMonth, setEditResetSpentThisMonth] = useState(false);

  // Credit Modal State
  const [crediting, setCrediting] = useState<AdminCardRow | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditReference, setCreditReference] = useState('');

  // Delete Modal State
  const [deleting, setDeleting] = useState<AdminCardRow | null>(null);

  // Status Change Dialog (with reason)
  const [statusModal, setStatusModal] = useState<{
    card: AdminCardRow;
    targetStatus: CardStatus;
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Transactions Modal State
  const [transactionsModal, setTransactionsModal] = useState<{
    card: AdminCardRow;
    transactions: CardTransactionRecord[];
    loading: boolean;
  } | null>(null);

  // Issue Card Modal State
  const [issuing, setIssuing] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newCurrency, setNewCurrency] = useState<CardCurrency>('USD');
  const [newCardholderName, setNewCardholderName] = useState('');
  const [newDailyLimit, setNewDailyLimit] = useState('1000.00');
  const [newMonthlyLimit, setNewMonthlyLimit] = useState('5000.00');
  const [issuingBusy, setIssuingBusy] = useState(false);

  // One-Time Credentials Modal State
  const [oneTimeModal, setOneTimeModal] = useState<{
    card: VirtualCardRecord;
    credentials: CardOneTimeSensitiveDetails;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync initialMemberId prop
  useEffect(() => {
    if (initialMemberId) {
      setMemberFilter(initialMemberId);
    }
  }, [initialMemberId]);

  const loadCards = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('/admin/cards', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load cards.');
      setCards(Array.isArray(data.cards) ? data.cards : []);
    } catch (err: any) {
      showToast(err.message || 'Could not load virtual cards.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [authToken, showToast]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  // Registered members for issue dropdown & member filter
  const eligibleMembers = useMemo(() => {
    return members.filter(
      (m) =>
        m.id !== '00000000-0000-0000-0000-000000000001' &&
        !m.email.toLowerCase().includes('admin'),
    );
  }, [members]);

  // Counts by status
  const counts = useMemo(() => {
    return {
      ALL: cards.length,
      ACTIVE: cards.filter((c) => c.status === 'ACTIVE').length,
      FROZEN: cards.filter((c) => c.status === 'FROZEN').length,
      SUSPENDED: cards.filter((c) => c.status === 'SUSPENDED').length,
      TERMINATED: cards.filter((c) => c.status === 'TERMINATED').length,
    };
  }, [cards]);

  // Filtered cards list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (currencyFilter !== 'ALL' && c.currency !== currencyFilter) return false;
      if (memberFilter !== 'ALL' && c.memberId !== memberFilter) return false;
      if (!q) return true;
      return (
        c.memberName.toLowerCase().includes(q) ||
        c.memberEmail.toLowerCase().includes(q) ||
        c.lastFour.includes(q) ||
        c.cardholderName.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [cards, search, statusFilter, currencyFilter, memberFilter]);

  // Status Change API Call
  const executeStatusChange = async (card: AdminCardRow, status: CardStatus, reason?: string) => {
    if (!authToken) return;
    setBusyId(card.id);
    try {
      const res = await fetch(`/admin/cards/${card.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status, reason: reason?.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Status update failed.');
      showToast(
        `Card •••• ${card.lastFour} (${card.currency}) is now ${status.toLowerCase()}.`,
        'success',
      );
      setStatusModal(null);
      setStatusReason('');
      await Promise.all([loadCards(), fetchAdminDashboardStats(authToken)]);
    } catch (err: any) {
      showToast(err.message || 'Status update failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  // Edit Card API Call
  const saveEdit = async () => {
    if (!authToken || !editing) return;
    const daily = Math.round(parseFloat(editDaily || '0') * 100);
    const monthly = Math.round(parseFloat(editMonthly || '0') * 100);

    if (!editName.trim()) {
      showToast('Please enter a valid cardholder name.', 'warning');
      return;
    }
    if (daily <= 0 || monthly <= 0) {
      showToast('Spending limits must be positive numbers.', 'warning');
      return;
    }
    if (daily > monthly) {
      showToast('Daily limit cannot exceed monthly limit.', 'warning');
      return;
    }

    setBusyId(editing.id);
    try {
      const res = await fetch(`/admin/cards/${editing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          cardholderName: editName.trim(),
          dailyLimitMinor: daily,
          monthlyLimitMinor: monthly,
          status: editStatus,
          reason: editReason.trim() || undefined,
          resetSpentToday: editResetSpentToday,
          resetSpentThisMonth: editResetSpentThisMonth,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Card update failed.');
      showToast(`Card •••• ${editing.lastFour} details updated.`, 'success');
      setEditing(null);
      await Promise.all([loadCards(), fetchAdminDashboardStats(authToken)]);
    } catch (err: any) {
      showToast(err.message || 'Card update failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  // Credit Card Wallet API Call
  const submitCredit = async () => {
    if (!authToken || !crediting) return;
    const amountMinor = Math.round(parseFloat(creditAmount || '0') * 100);
    if (amountMinor <= 0) {
      showToast('Enter a credit amount greater than zero.', 'warning');
      return;
    }
    setBusyId(crediting.id);
    try {
      const res = await fetch(`/admin/cards/${crediting.id}/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amountMinor,
          reason: creditReason.trim() || undefined,
          reference: creditReference.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Wallet credit failed.');
      showToast(
        `Credited ${data.amountFormatted || formatMoney({ amountMinor, currency: crediting.currency })} to ${crediting.memberName}'s ${crediting.currency} wallet.`,
        'success',
      );
      setCrediting(null);
      setCreditAmount('');
      setCreditReason('');
      setCreditReference('');
      await Promise.all([loadCards(), fetchAdminDashboardStats(authToken)]);
    } catch (err: any) {
      showToast(err.message || 'Wallet credit failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  // Delete Card API Call
  const confirmDelete = async () => {
    if (!authToken || !deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/admin/cards/${deleting.id}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Card deletion failed.');
      showToast(
        `Virtual card •••• ${deleting.lastFour} (${deleting.currency}) deleted.`,
        'success',
      );
      setDeleting(null);
      await Promise.all([loadCards(), fetchAdminDashboardStats(authToken)]);
    } catch (err: any) {
      showToast(err.message || 'Card deletion failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  // View Card Transactions API Call
  const viewTransactions = async (card: AdminCardRow) => {
    if (!authToken) return;
    setTransactionsModal({ card, transactions: [], loading: true });
    try {
      const res = await fetch(`/admin/cards/${card.id}/transactions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load card transactions.');
      setTransactionsModal({
        card,
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        loading: false,
      });
    } catch (err: any) {
      showToast(err.message || 'Could not load transactions.', 'warning');
      setTransactionsModal(null);
    }
  };

  // Issue Card API Call
  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    if (!newMemberId) {
      showToast('Select a member to issue this card to.', 'warning');
      return;
    }
    const dailyMinor = Math.round(parseFloat(newDailyLimit || '0') * 100);
    const monthlyMinor = Math.round(parseFloat(newMonthlyLimit || '0') * 100);

    if (dailyMinor <= 0 || monthlyMinor <= 0) {
      showToast('Spending limits must be positive amounts.', 'warning');
      return;
    }
    if (dailyMinor > monthlyMinor) {
      showToast('Daily limit cannot exceed monthly limit.', 'warning');
      return;
    }

    setIssuingBusy(true);
    try {
      const res = await fetch('/admin/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          memberId: newMemberId,
          currency: newCurrency,
          cardholderName: newCardholderName.trim() || undefined,
          dailyLimitMinor: dailyMinor,
          monthlyLimitMinor: monthlyMinor,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Card issuance failed.');

      showToast(
        `Successfully issued ${newCurrency} card •••• ${data.card.lastFour} for member.`,
        'success',
      );
      setIssuing(false);

      if (data.oneTimeCredentials) {
        setOneTimeModal({
          card: data.card,
          credentials: data.oneTimeCredentials,
        });
      }

      await Promise.all([loadCards(), fetchAdminDashboardStats(authToken)]);
    } catch (err: any) {
      showToast(err.message || 'Card issuance failed.', 'warning');
    } finally {
      setIssuingBusy(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col gap-6">
      {/* ── Top Header & Stats ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display font-bold text-xl sm:text-2xl text-[#0E1B1F]">
              Member Virtual Cards
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E3F3F1] text-[#0A4F4A] text-xs font-bold font-mono">
              {cards.length} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#4A5B60] mt-1">
            Super admin controls: credit wallets, edit daily/monthly limits, freeze, unfreeze,
            suspend, inspect purchase transactions, or revoke cards.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (eligibleMembers.length > 0) {
                setNewMemberId(eligibleMembers[0].id);
                setNewCardholderName(eligibleMembers[0].name);
              }
              setNewCurrency('USD');
              setNewDailyLimit('1000.00');
              setNewMonthlyLimit('5000.00');
              setIssuing(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-bold shadow-xs cursor-pointer min-h-[42px]"
          >
            <Plus className="w-4 h-4 text-[#F5B942]" />
            <span>Issue New Card</span>
          </button>

          <button
            type="button"
            onClick={() => void loadCards()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer min-h-[42px]"
            title="Refresh card directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Quick KPI Badges ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ['ACTIVE', 'Active', 'bg-[#E3F3F1]', 'text-[#0A4F4A]', CheckCircle2],
            ['FROZEN', 'Frozen', 'bg-[#FFF1CC]', 'text-[#5A4100]', Lock],
            ['SUSPENDED', 'Suspended', 'bg-orange-100', 'text-orange-800', Ban],
            ['TERMINATED', 'Terminated', 'bg-red-100', 'text-red-800', ShieldAlert],
          ] as const
        ).map(([key, label, bg, text, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(statusFilter === key ? 'ALL' : key)}
            className={`p-3.5 rounded-2xl border transition text-left cursor-pointer flex items-center justify-between ${
              statusFilter === key
                ? 'border-[#0A3D3F] bg-[#F4F7F6]'
                : 'border-[#DCE5E3] bg-white hover:bg-[#F4F7F6]/50'
            }`}
          >
            <div>
              <div className="text-xs font-semibold text-[#4A5B60]">{label}</div>
              <div className="text-xl font-display font-bold text-[#0E1B1F] mt-0.5">
                {counts[key]}
              </div>
            </div>
            <div className={`w-8 h-8 rounded-xl ${bg} ${text} flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>

      {/* ── Search, Member & Currency Filters ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member name, email, PAN, cardholder, ID…"
            className="w-full pl-9 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-xs bg-[#F4F7F6]/40 focus:bg-white focus:border-[#0A3D3F] outline-none"
          />
        </div>

        {/* Member Selector Filter */}
        <div className="w-full md:w-56">
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-xs bg-white text-[#0E1B1F] font-medium outline-none focus:border-[#0A3D3F]"
          >
            <option value="ALL">All Members ({cards.length} cards)</option>
            {eligibleMembers.map((m) => {
              const memberCardCount = cards.filter((c) => c.memberId === m.id).length;
              return (
                <option key={m.id} value={m.id}>
                  {m.name} ({memberCardCount} card{memberCardCount === 1 ? '' : 's'})
                </option>
              );
            })}
          </select>
        </div>

        {/* Currency Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'USD', 'CAD', 'GBP', 'EUR'] as const).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => setCurrencyFilter(curr)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                currencyFilter === curr
                  ? 'bg-[#0A3D3F] text-white border border-[#0A3D3F]'
                  : 'bg-white text-[#4A5B60] border border-[#DCE5E3] hover:bg-[#F4F7F6]'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>
      </div>

      {/* ── Virtual Cards List ── */}
      {filtered.length === 0 ? (
        <div className="py-14 text-center border-2 border-dashed border-[#DCE5E3] rounded-3xl bg-[#F4F7F6]/40 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#DCE5E3] flex items-center justify-center text-[#8FA5A3] shadow-xs">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-bold text-[#0E1B1F]">No Virtual Cards Found</div>
            <p className="text-xs text-[#4A5B60] mt-1 max-w-sm mx-auto">
              {search || memberFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No cards matched your current filters. Try resetting search criteria.'
                : 'No virtual cards have been issued yet. Click "Issue New Card" above to create one for any member.'}
            </p>
          </div>
          {(search || memberFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setMemberFilter('ALL');
                setStatusFilter('ALL');
                setCurrencyFilter('ALL');
              }}
              className="mt-1 px-4 py-2 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0A3D3F] hover:bg-white cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((card) => {
            const busy = busyId === card.id;
            const style = STATUS_STYLES[card.status];
            const sym = CURRENCY_SYMBOLS[card.currency];

            const dailyPercent = Math.min(
              100,
              Math.round((card.spentTodayMinor / (card.dailyLimitMinor || 1)) * 100),
            );
            const monthlyPercent = Math.min(
              100,
              Math.round((card.spentThisMonthMinor / (card.monthlyLimitMinor || 1)) * 100),
            );

            return (
              <div
                key={card.id}
                className="border border-[#DCE5E3] hover:border-[#A3D9D2] rounded-3xl p-5 bg-white shadow-xs flex flex-col justify-between gap-4 transition-all"
              >
                {/* ── Card Header & Mockup ── */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  {/* Virtual Card Graphic */}
                  <div
                    className={`w-full sm:w-56 h-32 rounded-2xl p-3.5 text-white flex flex-col justify-between shadow-sm relative overflow-hidden shrink-0 border ${
                      card.status === 'FROZEN'
                        ? 'bg-gradient-to-br from-amber-700 via-amber-800 to-yellow-900 border-amber-600/50'
                        : card.status === 'SUSPENDED'
                          ? 'bg-gradient-to-br from-orange-800 via-stone-800 to-stone-900 border-orange-600/50'
                          : card.status === 'TERMINATED'
                            ? 'bg-gradient-to-br from-red-950 via-zinc-900 to-black border-red-900/50 opacity-75'
                            : 'bg-gradient-to-br from-[#0A3D3F] via-[#0F5557] to-[#146B6B] border-[#0A3D3F]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="tracking-wide">LUMENFIELD</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px]">
                        {card.currency}
                      </span>
                    </div>

                    <div className="font-mono text-base tracking-[0.14em] font-bold text-center drop-shadow-xs">
                      {card.maskedPan}
                    </div>

                    <div className="flex items-end justify-between text-[10px] text-white/90 font-mono">
                      <div className="truncate max-w-[130px] font-sans font-medium uppercase text-[10px] tracking-wider">
                        {card.cardholderName}
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-white/70 block">EXP</span>
                        {card.expiryFormatted}
                      </div>
                    </div>
                  </div>

                  {/* Card Meta & Member Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${style.badge} ${style.border}`}
                      >
                        {style.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        •••• {card.lastFour}
                      </span>
                    </div>

                    <div className="mt-1">
                      <div className="font-bold text-sm text-[#0E1B1F] truncate">
                        {card.memberName}
                      </div>
                      <div className="text-xs font-mono text-[#4A5B60] truncate">
                        {card.memberEmail}
                      </div>
                    </div>

                    <div className="text-[11px] text-[#4A5B60] mt-1 flex flex-col gap-0.5">
                      <div className="flex justify-between">
                        <span>Daily Limit:</span>
                        <span className="font-mono font-semibold text-[#0E1B1F]">
                          {formatMoney({
                            amountMinor: card.dailyLimitMinor,
                            currency: card.currency,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Limit:</span>
                        <span className="font-mono font-semibold text-[#0E1B1F]">
                          {formatMoney({
                            amountMinor: card.monthlyLimitMinor,
                            currency: card.currency,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Spending Progress Bars ── */}
                <div className="bg-[#F4F7F6]/60 rounded-2xl p-3 border border-[#DCE5E3] flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#4A5B60] font-medium">Spent Today</span>
                      <span className="font-mono text-[#0E1B1F] font-semibold">
                        {formatMoney({
                          amountMinor: card.spentTodayMinor,
                          currency: card.currency,
                        })}{' '}
                        / {sym}
                        {(card.dailyLimitMinor / 100).toFixed(0)} ({dailyPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#DCE5E3] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dailyPercent >= 90
                            ? 'bg-red-500'
                            : dailyPercent >= 70
                              ? 'bg-amber-500'
                              : 'bg-[#0F766E]'
                        }`}
                        style={{ width: `${dailyPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#4A5B60] font-medium">Spent This Month</span>
                      <span className="font-mono text-[#0E1B1F] font-semibold">
                        {formatMoney({
                          amountMinor: card.spentThisMonthMinor,
                          currency: card.currency,
                        })}{' '}
                        / {sym}
                        {(card.monthlyLimitMinor / 100).toFixed(0)} ({monthlyPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#DCE5E3] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          monthlyPercent >= 90
                            ? 'bg-red-500'
                            : monthlyPercent >= 70
                              ? 'bg-amber-500'
                              : 'bg-[#0F766E]'
                        }`}
                        style={{ width: `${monthlyPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Action Toolbar ── */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EDF2F1]">
                  {/* Freeze / Unfreeze Action */}
                  {card.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setStatusModal({
                          card,
                          targetStatus: 'FROZEN',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-[#FFF8E6] text-xs font-semibold text-[#5A4100] hover:bg-[#FFF1CC] cursor-pointer disabled:opacity-50"
                      title="Freeze card"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Freeze</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setStatusModal({
                          card,
                          targetStatus: 'ACTIVE',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#A3D9D2] bg-[#E3F3F1] text-xs font-semibold text-[#0A4F4A] hover:bg-[#cceed9] cursor-pointer disabled:opacity-50"
                      title="Activate / Unfreeze card"
                    >
                      <Unlock className="w-3.5 h-3.5 text-[#0F766E]" />
                      <span>Unfreeze</span>
                    </button>
                  )}

                  {/* Suspend Action */}
                  {card.status !== 'SUSPENDED' && card.status !== 'TERMINATED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setStatusModal({
                          card,
                          targetStatus: 'SUSPENDED',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-orange-200 bg-white text-xs font-semibold text-orange-800 hover:bg-orange-50 cursor-pointer disabled:opacity-50"
                      title="Suspend card"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Suspend</span>
                    </button>
                  )}

                  {/* Terminate Action */}
                  {card.status !== 'TERMINATED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setStatusModal({
                          card,
                          targetStatus: 'TERMINATED',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                      title="Permanently terminate card"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Terminate</span>
                    </button>
                  )}

                  {/* Credit Linked Wallet */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCrediting(card);
                      setCreditAmount('250.00');
                      setCreditReason(`Admin credit for virtual card •••• ${card.lastFour}`);
                      setCreditReference(`CR-CARD-${card.lastFour}-${Date.now().toString(36).toUpperCase()}`);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#F0D58A] bg-[#FFF8E6] text-xs font-bold text-[#5A4100] hover:bg-[#FFF1CC] cursor-pointer disabled:opacity-50"
                    title="Credit member wallet linked to this card"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#D4981E]" />
                    <span>Credit</span>
                  </button>

                  {/* View Transactions */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void viewTransactions(card)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#DCE5E3] bg-white text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer disabled:opacity-50"
                    title="View card purchase history"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Transactions</span>
                  </button>

                  {/* Edit Card */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(card);
                      setEditName(card.cardholderName);
                      setEditDaily((card.dailyLimitMinor / 100).toFixed(2));
                      setEditMonthly((card.monthlyLimitMinor / 100).toFixed(2));
                      setEditStatus(card.status);
                      setEditReason('');
                      setEditResetSpentToday(false);
                      setEditResetSpentThisMonth(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#DCE5E3] bg-white text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer disabled:opacity-50"
                    title="Edit limits and cardholder name"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit</span>
                  </button>

                  {/* Delete Card */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleting(card)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50 ml-auto"
                    title="Permanently delete card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 1: STATUS CHANGE (FREEZE / UNFREEZE / SUSPEND / TERMINATE)
         ══════════════════════════════════════════════════════════════ */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 border border-[#DCE5E3]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Card Lifecycle Action
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  Set status to {statusModal.targetStatus.toLowerCase()}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#4A5B60]">
              You are changing virtual card •••• {statusModal.card.lastFour} (
              {statusModal.card.currency}) for <strong>{statusModal.card.memberName}</strong> from{' '}
              <span className="font-semibold">{statusModal.card.status}</span> to{' '}
              <span className="font-semibold text-[#0E1B1F]">{statusModal.targetStatus}</span>.
              {statusModal.targetStatus === 'FROZEN' &&
                ' Purchases will be declined immediately until unfrozen.'}
              {statusModal.targetStatus === 'SUSPENDED' &&
                ' Card is temporarily suspended for security/compliance review.'}
              {statusModal.targetStatus === 'TERMINATED' &&
                ' Card is permanently closed. This action cannot be reverted.'}
            </p>

            <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
              <span>Reason for status change (optional)</span>
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g., Requested by member, Suspicious activity, Verified okay"
                className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none focus:border-[#0A3D3F]"
              />
            </label>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === statusModal.card.id}
                onClick={() =>
                  void executeStatusChange(
                    statusModal.card,
                    statusModal.targetStatus,
                    statusReason,
                  )
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 text-white ${
                  statusModal.targetStatus === 'ACTIVE'
                    ? 'bg-[#0A3D3F] hover:bg-[#0F5557]'
                    : statusModal.targetStatus === 'FROZEN'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : statusModal.targetStatus === 'SUSPENDED'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm {statusModal.targetStatus}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 2: EDIT CARD DETAILS & LIMITS & SPENDING RESETS
         ══════════════════════════════════════════════════════════════ */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 border border-[#DCE5E3]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Modify Card Parameters
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  Edit Card · •••• {editing.lastFour}
                </h3>
                <p className="text-xs text-[#4A5B60] mt-0.5">
                  Member: {editing.memberName} ({editing.currency})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                <span>Cardholder Name</span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none focus:border-[#0A3D3F]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Daily Limit ({editing.currency})</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                      {CURRENCY_SYMBOLS[editing.currency]}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={editDaily}
                      onChange={(e) => setEditDaily(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm font-mono outline-none focus:border-[#0A3D3F]"
                    />
                  </div>
                </label>

                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Monthly Limit ({editing.currency})</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                      {CURRENCY_SYMBOLS[editing.currency]}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={editMonthly}
                      onChange={(e) => setEditMonthly(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm font-mono outline-none focus:border-[#0A3D3F]"
                    />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Status</span>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CardStatus)}
                    className="w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-xs bg-white outline-none focus:border-[#0A3D3F] font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE (Normal spending)</option>
                    <option value="FROZEN">FROZEN (Temporarily locked)</option>
                    <option value="SUSPENDED">SUSPENDED (Risk investigation)</option>
                    <option value="TERMINATED">TERMINATED (Closed)</option>
                  </select>
                </label>

                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Reason for edit</span>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g., Requested limit increase"
                    className="w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-xs outline-none focus:border-[#0A3D3F]"
                  />
                </label>
              </div>

              {/* Reset Spending Controls */}
              <div className="bg-[#F4F7F6] p-3.5 rounded-2xl border border-[#DCE5E3] flex flex-col gap-2">
                <span className="text-xs font-bold text-[#0E1B1F]">
                  Spending Counters Maintenance
                </span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#4A5B60] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editResetSpentToday}
                      onChange={(e) => setEditResetSpentToday(e.target.checked)}
                      className="rounded text-[#0A3D3F] focus:ring-0"
                    />
                    <span>
                      Reset Spent Today (currently{' '}
                      <strong>
                        {formatMoney({
                          amountMinor: editing.spentTodayMinor,
                          currency: editing.currency,
                        })}
                      </strong>
                      )
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[#4A5B60] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editResetSpentThisMonth}
                      onChange={(e) => setEditResetSpentThisMonth(e.target.checked)}
                      className="rounded text-[#0A3D3F] focus:ring-0"
                    />
                    <span>
                      Reset Spent Month (currently{' '}
                      <strong>
                        {formatMoney({
                          amountMinor: editing.spentThisMonthMinor,
                          currency: editing.currency,
                        })}
                      </strong>
                      )
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === editing.id}
                onClick={() => void saveEdit()}
                className="px-5 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 3: CREDIT CARD WALLET (DOUBLE-ENTRY POSTING)
         ══════════════════════════════════════════════════════════════ */}
      {crediting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 border border-[#DCE5E3]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4981E]">
                  Ledger Wallet Funding
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  Credit {crediting.currency} Wallet
                </h3>
                <p className="text-xs text-[#4A5B60] mt-0.5">
                  Member: {crediting.memberName} (Card •••• {crediting.lastFour})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCrediting(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#4A5B60]">
              Posts an immediate, balanced double-entry credit to{' '}
              <strong>{crediting.memberName}</strong>’s {crediting.currency} wallet. Virtual cards
              draw directly from this wallet during purchase authorization.
            </p>

            <div className="flex flex-col gap-3.5">
              <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                <span>Credit Amount ({crediting.currency})</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">
                    {CURRENCY_SYMBOLS[crediting.currency]}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full pl-8 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-base font-mono font-bold text-[#0E1B1F] outline-none focus:border-[#D4981E]"
                  />
                </div>
              </label>

              <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                <span>Reason / Memo</span>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="e.g., Virtual card funding"
                  className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none focus:border-[#D4981E]"
                />
              </label>

              <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                <span>Ledger Reference (optional)</span>
                <input
                  type="text"
                  value={creditReference}
                  onChange={(e) => setCreditReference(e.target.value)}
                  placeholder="e.g., CR-CARD-..."
                  className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm font-mono outline-none focus:border-[#D4981E]"
                />
              </label>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setCrediting(null)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === crediting.id}
                onClick={() => void submitCredit()}
                className="px-5 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#E0A82E] text-[#0A3D3F] text-xs font-bold cursor-pointer disabled:opacity-50 shadow-sm"
              >
                Post Credit to Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 4: DELETE CARD CONFIRMATION
         ══════════════════════════════════════════════════════════════ */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-4 border border-red-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-display font-bold text-xl text-red-900">
              Delete virtual card permanently?
            </h3>

            <p className="text-xs sm:text-sm text-[#4A5B60]">
              You are about to permanently delete {deleting.currency} virtual card ending in{' '}
              <strong>•••• {deleting.lastFour}</strong> belonging to{' '}
              <strong>{deleting.memberName}</strong>.
            </p>
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-200">
              This card will be removed from runtime memory, database persistence, and the member’s
              wallet view. This action cannot be undone.
            </p>

            <div className="flex gap-2.5 justify-end pt-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleting.id}
                onClick={() => void confirmDelete()}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 5: CARD TRANSACTION HISTORY
         ══════════════════════════════════════════════════════════════ */}
      {transactionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 border border-[#DCE5E3] max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Audit & Purchase Log
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  Card •••• {transactionsModal.card.lastFour} Activity
                </h3>
                <p className="text-xs text-[#4A5B60] mt-0.5">
                  {transactionsModal.card.memberName} · {transactionsModal.card.currency} · Total{' '}
                  {transactionsModal.transactions.length} transaction
                  {transactionsModal.transactions.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransactionsModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {transactionsModal.loading ? (
                <div className="py-12 text-center text-xs text-[#4A5B60] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0F766E]" />
                  Loading transactions…
                </div>
              ) : transactionsModal.transactions.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-[#DCE5E3] rounded-2xl bg-[#F4F7F6]/40">
                  <History className="w-8 h-8 text-[#8FA5A3] mx-auto mb-2" />
                  <div className="text-sm font-bold text-[#0E1B1F]">No Transactions Yet</div>
                  <p className="text-xs text-[#4A5B60] mt-1">
                    Purchases simulated by members or dev tools will appear here.
                  </p>
                </div>
              ) : (
                transactionsModal.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl border border-[#DCE5E3] bg-[#F4F7F6]/30 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#0E1B1F]">{tx.merchantName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tx.status === 'APPROVED'
                              ? 'bg-[#E3F3F1] text-[#0A4F4A]'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#4A5B60] mt-0.5">
                        {tx.merchantCategory} · {new Date(tx.createdAt).toLocaleString()}
                      </div>
                      {tx.declineReason && (
                        <div className="text-[11px] text-red-600 font-medium mt-1">
                          Reason: {tx.declineReason}
                        </div>
                      )}
                      {tx.ledgerTransactionId && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Ledger TX: {tx.ledgerTransactionId}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono font-bold text-sm ${
                          tx.status === 'APPROVED' ? 'text-[#0E1B1F]' : 'text-slate-400 line-through'
                        }`}
                      >
                        {formatMoney({ amountMinor: tx.amountMinor, currency: tx.currency })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#EDF2F1] flex justify-end">
              <button
                type="button"
                onClick={() => setTransactionsModal(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 6: ISSUE VIRTUAL CARD FOR MEMBER
         ══════════════════════════════════════════════════════════════ */}
      {issuing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleIssueCard}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 border border-[#DCE5E3]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Admin Card Issuance
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  Issue Virtual Card
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIssuing(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                <span>Select Member</span>
                <select
                  value={newMemberId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewMemberId(id);
                    const found = eligibleMembers.find((m) => m.id === id);
                    if (found) setNewCardholderName(found.name);
                  }}
                  className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm bg-white outline-none focus:border-[#0A3D3F] font-medium"
                >
                  {eligibleMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Card Currency</span>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as CardCurrency)}
                    className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm bg-white outline-none focus:border-[#0A3D3F] font-bold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </label>

                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Cardholder Name</span>
                  <input
                    type="text"
                    value={newCardholderName}
                    onChange={(e) => setNewCardholderName(e.target.value)}
                    placeholder="Full legal name"
                    className="w-full px-3.5 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none focus:border-[#0A3D3F]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Daily Limit ({newCurrency})</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                      {CURRENCY_SYMBOLS[newCurrency]}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={newDailyLimit}
                      onChange={(e) => setNewDailyLimit(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm font-mono outline-none focus:border-[#0A3D3F]"
                    />
                  </div>
                </label>

                <label className="text-xs font-semibold text-[#4A5B60] flex flex-col gap-1">
                  <span>Monthly Limit ({newCurrency})</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                      {CURRENCY_SYMBOLS[newCurrency]}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={newMonthlyLimit}
                      onChange={(e) => setNewMonthlyLimit(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm font-mono outline-none focus:border-[#0A3D3F]"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIssuing(false)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={issuingBusy}
                className="px-5 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {issuingBusy ? 'Generating Card…' : 'Issue Card'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 7: ONE-TIME SENSITIVE CREDENTIALS (SECURITY HARD RULE)
         ══════════════════════════════════════════════════════════════ */}
      {oneTimeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-5 border border-[#A3D9D2]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Card Successfully Issued
                </span>
                <h3 className="font-display font-bold text-xl text-[#0E1B1F] mt-0.5">
                  One-Time Sensitive Credentials
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOneTimeModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{oneTimeModal.credentials.warningNotice}</span>
            </div>

            <div className="bg-[#F4F7F6] rounded-2xl p-4 border border-[#DCE5E3] flex flex-col gap-3 font-mono text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">FULL CARD NUMBER</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-base font-bold text-[#0E1B1F]">
                    {oneTimeModal.credentials.fullPan}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(oneTimeModal.credentials.fullPan, 'pan')
                    }
                    className="p-1.5 rounded-lg border border-[#DCE5E3] bg-white hover:bg-slate-50 cursor-pointer"
                  >
                    {copiedKey === 'pan' ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#DCE5E3]">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">CVV (TEST)</span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-base font-bold text-[#0E1B1F]">
                      {oneTimeModal.credentials.cvv}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(oneTimeModal.credentials.cvv, 'cvv')}
                      className="p-1.5 rounded-lg border border-[#DCE5E3] bg-white hover:bg-slate-50 cursor-pointer"
                    >
                      {copiedKey === 'cvv' ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">EXPIRY</span>
                  <span className="text-base font-bold text-[#0E1B1F] block mt-1">
                    {oneTimeModal.credentials.expiry}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOneTimeModal(null)}
              className="w-full py-3 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-bold cursor-pointer"
            >
              I Have Securely Saved These Credentials
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
