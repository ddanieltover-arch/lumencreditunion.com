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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CardStatus, VirtualCardRecord, formatMoney } from '@lumenfield/shared';

type AdminCardRow = VirtualCardRecord & {
  memberName: string;
  memberEmail: string;
};

const STATUS_STYLES: Record<CardStatus, string> = {
  ACTIVE: 'bg-[#E3F3F1] text-[#0A4F4A]',
  FROZEN: 'bg-[#FFF1CC] text-[#5A4100]',
  SUSPENDED: 'bg-orange-50 text-orange-800',
  TERMINATED: 'bg-red-50 text-red-700',
};

export const AdminVirtualCardsPanel: React.FC = () => {
  const { authToken, showToast, fetchAdminDashboardStats } = useApp();
  const [cards, setCards] = useState<AdminCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CardStatus>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminCardRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDaily, setEditDaily] = useState('');
  const [editMonthly, setEditMonthly] = useState('');

  const [crediting, setCrediting] = useState<AdminCardRow | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const [deleting, setDeleting] = useState<AdminCardRow | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
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
  }, [cards, search, statusFilter]);

  const setStatus = async (card: AdminCardRow, status: CardStatus) => {
    if (!authToken) return;
    setBusyId(card.id);
    try {
      const res = await fetch(`/admin/cards/${card.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Status update failed.');
      showToast(`Card •••• ${card.lastFour} is now ${status.toLowerCase()}.`, 'success');
      await loadCards();
    } catch (err: any) {
      showToast(err.message || 'Status update failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!authToken || !editing) return;
    const daily = Math.round(parseFloat(editDaily || '0') * 100);
    const monthly = Math.round(parseFloat(editMonthly || '0') * 100);
    if (!editName.trim() || daily <= 0 || monthly <= 0 || daily > monthly) {
      showToast('Enter a valid name and limits (daily ≤ monthly).', 'warning');
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed.');
      showToast('Card details updated.', 'success');
      setEditing(null);
      await loadCards();
    } catch (err: any) {
      showToast(err.message || 'Update failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Credit failed.');
      showToast(
        `Credited ${data.amountFormatted || creditAmount} to ${crediting.memberName}'s ${crediting.currency} wallet.`,
        'success',
      );
      setCrediting(null);
      setCreditAmount('');
      setCreditReason('');
      await fetchAdminDashboardStats(authToken);
    } catch (err: any) {
      showToast(err.message || 'Credit failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!authToken || !deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/admin/cards/${deleting.id}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed.');
      showToast(`Deleted card •••• ${deleting.lastFour}.`, 'success');
      setDeleting(null);
      await loadCards();
    } catch (err: any) {
      showToast(err.message || 'Delete failed.', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-[#0E1B1F]">Member Virtual Cards</h2>
          <p className="text-xs text-[#4A5B60] mt-0.5">
            Freeze, suspend, edit limits, credit linked wallets, or delete issued cards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCards()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE5E3] text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] cursor-pointer min-h-[40px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, email, last four…"
            className="w-full pl-9 pr-3 py-2.5 border border-[#DCE5E3] rounded-xl text-xs bg-[#F4F7F6]/50 focus:bg-white outline-none"
          />
        </div>
        {(['ALL', 'ACTIVE', 'FROZEN', 'SUSPENDED', 'TERMINATED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              statusFilter === s
                ? 'bg-[#0A3D3F] text-white border-[#0A3D3F]'
                : 'bg-white text-[#4A5B60] border-[#DCE5E3] hover:bg-[#F4F7F6]'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[#DCE5E3] rounded-2xl">
          <CreditCard className="w-8 h-8 text-[#8FA5A3] mx-auto mb-2" />
          <div className="text-sm font-semibold text-[#0E1B1F]">No virtual cards found</div>
          <p className="text-xs text-[#4A5B60] mt-1">
            Cards appear here after members issue them from their dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((card) => {
            const busy = busyId === card.id;
            return (
              <div
                key={card.id}
                className="border border-[#DCE5E3] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 hover:bg-[#F4F7F6]/40 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold text-[#0E1B1F]">
                        {card.currency} · •••• {card.lastFour}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[card.status]}`}
                      >
                        {card.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#4A5B60] mt-1">
                      {card.memberName}
                      {card.memberEmail ? ` · ${card.memberEmail}` : ''}
                    </div>
                    <div className="text-[11px] text-[#8FA5A3] mt-0.5 font-mono">
                      {card.cardholderName} · Exp {card.expiryFormatted} · Daily{' '}
                      {formatMoney({
                        amountMinor: card.dailyLimitMinor,
                        currency: card.currency,
                      })}{' '}
                      / Monthly{' '}
                      {formatMoney({
                        amountMinor: card.monthlyLimitMinor,
                        currency: card.currency,
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {card.status !== 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(card, 'ACTIVE')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE5E3] bg-white text-xs font-semibold hover:bg-[#E3F3F1] cursor-pointer disabled:opacity-50"
                    >
                      <Unlock className="w-3.5 h-3.5 text-[#0F766E]" />
                      Unfreeze / Activate
                    </button>
                  )}
                  {card.status === 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(card, 'FROZEN')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE5E3] bg-white text-xs font-semibold hover:bg-[#FFF1CC] cursor-pointer disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Freeze
                    </button>
                  )}
                  {card.status !== 'SUSPENDED' && card.status !== 'TERMINATED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(card, 'SUSPENDED')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-200 bg-white text-xs font-semibold text-orange-800 hover:bg-orange-50 cursor-pointer disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Suspend
                    </button>
                  )}
                  {card.status !== 'TERMINATED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(card, 'TERMINATED')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Terminate
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(card);
                      setEditName(card.cardholderName);
                      setEditDaily((card.dailyLimitMinor / 100).toFixed(2));
                      setEditMonthly((card.monthlyLimitMinor / 100).toFixed(2));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE5E3] bg-white text-xs font-semibold hover:bg-[#F4F7F6] cursor-pointer disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCrediting(card);
                      setCreditAmount('');
                      setCreditReason(`Admin credit for card •••• ${card.lastFour}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0D58A] bg-[#FFF8E6] text-xs font-semibold text-[#5A4100] hover:bg-[#FFF1CC] cursor-pointer disabled:opacity-50"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    Credit wallet
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleting(card)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">Edit card · •••• {editing.lastFour}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="text-xs font-semibold text-[#4A5B60]">
              Cardholder name
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-[#4A5B60]">
                Daily limit ({editing.currency})
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editDaily}
                  onChange={(e) => setEditDaily(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none font-mono"
                />
              </label>
              <label className="text-xs font-semibold text-[#4A5B60]">
                Monthly limit ({editing.currency})
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editMonthly}
                  onChange={(e) => setEditMonthly(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none font-mono"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={busyId === editing.id}
              className="w-full min-h-[44px] rounded-xl bg-[#0A3D3F] text-white font-semibold text-sm hover:bg-[#0F5557] cursor-pointer disabled:opacity-50"
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Credit modal */}
      {crediting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">
                Credit {crediting.currency} wallet
              </h3>
              <button type="button" onClick={() => setCrediting(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#4A5B60]">
              Posts a ledger credit to <strong>{crediting.memberName}</strong>’s {crediting.currency}{' '}
              wallet (card •••• {crediting.lastFour}).
            </p>
            <label className="text-xs font-semibold text-[#4A5B60]">
              Amount ({crediting.currency})
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none font-mono"
                placeholder="100.00"
              />
            </label>
            <label className="text-xs font-semibold text-[#4A5B60]">
              Reason
              <input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-[#DCE5E3] rounded-xl text-sm outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void submitCredit()}
              disabled={busyId === crediting.id}
              className="w-full min-h-[44px] rounded-xl bg-[#F5B942] text-[#0E1B1F] font-semibold text-sm hover:bg-[#f0b033] cursor-pointer disabled:opacity-50"
            >
              Post credit
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-display font-bold text-lg text-red-800">Delete virtual card?</h3>
            <p className="text-sm text-[#4A5B60]">
              Permanently remove {deleting.currency} card •••• {deleting.lastFour} for{' '}
              {deleting.memberName}. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE5E3] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busyId === deleting.id}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                Delete card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
