import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard,
  Lock,
  Unlock,
  Sliders,
  ShoppingCart,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Clock,
  ArrowUpRight,
  EyeOff,
} from 'lucide-react';
import { CardCurrency, formatMoney } from '@lumenfield/shared';

interface VirtualCardsViewProps {
  compact?: boolean;
}

export const VirtualCardsView: React.FC<VirtualCardsViewProps> = ({ compact = false }) => {
  const {
    virtualCards,
    activeCardId,
    setActiveCardId,
    fetchCards,
    toggleCardFreeze,
    openCardLimitsModal,
    openSimulatePurchaseModal,
    openCreateCardModal,
    fetchCardTransactions,
    cardTransactions,
    activeMember,
  } = useApp();

  const [selectedCurrency, setSelectedCurrency] = useState<CardCurrency>('USD');
  const [loadingTx, setLoadingTx] = useState(false);

  // Cards for the selected currency wallet
  const cardsInCurrency = virtualCards.filter((c) => c.currency === selectedCurrency);
  // Current active card
  const activeCard =
    virtualCards.find((c) => c.id === activeCardId && c.currency === selectedCurrency) ||
    cardsInCurrency[0] ||
    virtualCards[0] ||
    null;

  useEffect(() => {
    if (activeCard) {
      setLoadingTx(true);
      fetchCardTransactions(activeCard.id).finally(() => setLoadingTx(false));
    }
  }, [activeCard?.id]);

  const currencySymbol =
    selectedCurrency === 'USD' ? '$' : selectedCurrency === 'CAD' ? 'C$' : selectedCurrency === 'GBP' ? '£' : '€';

  const walletBalance = activeMember.wallets[selectedCurrency] || 0;

  // Render compact widget for Dashboard Overview
  if (compact) {
    if (!activeCard) {
      return (
        <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col justify-between gap-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-[#0E1B1F]">Virtual card</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E3F3F1] text-[#0A4F4A]">
              Virtual
            </span>
          </div>

          <div className="p-6 rounded-2xl border-2 border-dashed border-[#CFDAD8] flex flex-col items-center justify-center text-center gap-3">
            <CreditCard className="w-10 h-10 text-[#0F766E]" />
            <div>
              <div className="font-bold text-sm text-[#0E1B1F]">No Virtual Card Found</div>
              <div className="text-xs text-[#4A5B60] mt-0.5">
                Issue a virtual card linked to your wallet in seconds.
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateCardModal}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Card</span>
            </button>
          </div>
        </div>
      );
    }

    const isFrozen = activeCard.status === 'FROZEN';

    return (
      <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 flex flex-col justify-between gap-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-lg text-[#0E1B1F]">Virtual card</h2>
            <span className="text-xs font-bold text-[#0F766E] bg-[#E3F3F1] px-2 py-0.5 rounded-full">
              {activeCard.currency}
            </span>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              isFrozen ? 'bg-[#FFF1CC] text-[#5A4100]' : 'bg-[#E3F3F1] text-[#0A4F4A]'
            }`}
          >
            {isFrozen ? 'Frozen' : 'Active'}
          </span>
        </div>

        {/* Card Visual (Matches Dashboard Reference Component) */}
        <div
          onClick={() => openSimulatePurchaseModal(activeCard)}
          title="Make a card purchase"
          className="bg-gradient-to-br from-[#F5B942] to-[#E5A832] text-[#0E1B1F] rounded-[18px] p-5 flex flex-col justify-between h-[156px] shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer border border-[#DE9E22]"
        >
          <div className="flex justify-between items-center font-display font-bold text-[15px]">
            <span>Lumenfield</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase bg-[#0E1B1F] text-[#F5B942] px-1.5 py-0.5 rounded">
                TEST
              </span>
            </div>
          </div>

          <div className="font-mono font-semibold text-lg tracking-[0.14em]">
            {activeCard.maskedPan}
          </div>

          <div className="flex justify-between text-xs font-semibold">
            <span>{activeCard.cardholderName}</span>
            <span className="font-mono">{activeCard.expiryFormatted}</span>
          </div>
        </div>

        {/* Card Spending Tracker */}
        <div className="space-y-1.5 text-xs text-[#4A5B60]">
          <div className="flex justify-between">
            <span>Daily limit ({currencySymbol}{Math.round(activeCard.dailyLimitMinor / 100)})</span>
            <span className="font-mono font-semibold text-[#0E1B1F]">
              {formatMoney({ amountMinor: activeCard.spentTodayMinor, currency: activeCard.currency })} spent
            </span>
          </div>
          <div className="h-1.5 bg-[#E3EBE9] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                activeCard.spentTodayMinor >= activeCard.dailyLimitMinor ? 'bg-red-500' : 'bg-[#0F766E]'
              }`}
              style={{
                width: `${Math.min(100, (activeCard.spentTodayMinor / activeCard.dailyLimitMinor) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Card Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => toggleCardFreeze(activeCard.id)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-[#CFDAD8] bg-white hover:bg-slate-50 text-[#0E1B1F] font-semibold text-xs transition-all cursor-pointer"
          >
            {isFrozen ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>Unfreeze</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-[#4A5B60]" />
                <span>Freeze</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => openCardLimitsModal(activeCard)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-[#CFDAD8] bg-white hover:bg-slate-50 text-[#0E1B1F] font-semibold text-xs transition-all cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#4A5B60]" />
            <span>Limits</span>
          </button>

          <button
            type="button"
            onClick={() => openSimulatePurchaseModal(activeCard)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] font-bold text-xs transition-all cursor-pointer shadow-2xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Purchase</span>
          </button>
        </div>
      </div>
    );
  }

  // Full Page / Tab Experience
  return (
    <div className="flex flex-col gap-6">
      {/* Wallet Currency Selector Bar */}
      <div className="bg-white border border-[#DCE5E3] rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['USD', 'CAD', 'GBP', 'EUR'] as CardCurrency[]).map((cur) => {
            const count = virtualCards.filter((c) => c.currency === cur).length;
            const isSelected = selectedCurrency === cur;
            return (
              <button
                key={cur}
                type="button"
                onClick={() => setSelectedCurrency(cur)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#0A3D3F] text-white shadow-xs'
                    : 'bg-[#F4F7F6] text-[#4A5B60] hover:bg-[#E3F3F1] hover:text-[#0A3D3F]'
                }`}
              >
                <span>{cur} Wallet</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-white text-[#0A3D3F]' : 'bg-[#DCE5E3] text-[#0E1B1F]'
                    }`}
                  >
                    {count} card{count > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={openCreateCardModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#F5B942]" />
          <span>Issue New Card ({selectedCurrency})</span>
        </button>
      </div>

      {/* Main Grid: Card Visual + Details & Limits (Left) & Recent Transactions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col (5 cols): Visual Card & Management */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {activeCard ? (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                    {activeCard.currency} Virtual Card
                  </h3>
                  <span className="text-xs text-[#4A5B60]">Token: {activeCard.cardToken.slice(0, 16)}...</span>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    activeCard.status === 'FROZEN'
                      ? 'bg-[#FFF1CC] text-[#5A4100]'
                      : 'bg-[#E3F3F1] text-[#0A4F4A]'
                  }`}
                >
                  {activeCard.status === 'FROZEN' ? 'Frozen' : 'Active'}
                </span>
              </div>

              {/* Card Surface */}
              <div className="bg-gradient-to-br from-[#F5B942] via-[#F0B033] to-[#D99A22] text-[#0E1B1F] rounded-2xl p-6 shadow-md flex flex-col justify-between h-[200px] relative overflow-hidden border border-[#D0901A]">
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-lg tracking-wide">Lumenfield</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase font-bold bg-[#0E1B1F] text-[#F5B942] px-2 py-0.5 rounded">
                      TEST
                    </span>
                    <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded">
                      {activeCard.currency}
                    </span>
                  </div>
                </div>

                <div className="font-mono font-bold text-2xl tracking-[0.16em] py-1 select-all">
                  {activeCard.maskedPan}
                </div>

                <div className="flex justify-between items-end text-xs font-semibold">
                  <div>
                    <div className="text-[10px] uppercase text-[#0E1B1F]/60">Cardholder</div>
                    <div className="font-medium text-sm">{activeCard.cardholderName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[#0E1B1F]/60">Valid Thru</div>
                    <div className="font-mono text-sm">{activeCard.expiryFormatted}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[#0E1B1F]/60">Security CVV</div>
                    <div className="font-mono text-sm">•••</div>
                  </div>
                </div>
              </div>

              {/* Status and Single View Notice */}
              <div className="p-3.5 rounded-xl bg-[#F4F7F6] border border-[#DCE5E3] text-xs text-[#4A5B60] flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Privacy:</strong> The full PAN and CVV are never stored in Lumenfield and were
                  displayed only once on creation. Purchases are authorized through tokenized rails.
                </span>
              </div>

              {/* Limits Summary Progress */}
              <div className="space-y-4">
                <div className="space-y-1.5 text-xs text-[#4A5B60]">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#0E1B1F]">Daily Spending Limit</span>
                    <span className="font-mono">
                      {formatMoney({ amountMinor: activeCard.spentTodayMinor, currency: activeCard.currency })} /{' '}
                      {formatMoney({ amountMinor: activeCard.dailyLimitMinor, currency: activeCard.currency })}
                    </span>
                  </div>
                  <div className="h-2 bg-[#E3EBE9] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        activeCard.spentTodayMinor >= activeCard.dailyLimitMinor ? 'bg-red-500' : 'bg-[#0F766E]'
                      }`}
                      style={{
                        width: `${Math.min(100, (activeCard.spentTodayMinor / activeCard.dailyLimitMinor) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-[#4A5B60]">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#0E1B1F]">Monthly Spending Limit</span>
                    <span className="font-mono">
                      {formatMoney({ amountMinor: activeCard.spentThisMonthMinor, currency: activeCard.currency })} /{' '}
                      {formatMoney({ amountMinor: activeCard.monthlyLimitMinor, currency: activeCard.currency })}
                    </span>
                  </div>
                  <div className="h-2 bg-[#E3EBE9] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        activeCard.spentThisMonthMinor >= activeCard.monthlyLimitMinor
                          ? 'bg-red-500'
                          : 'bg-[#0F766E]'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (activeCard.spentThisMonthMinor / activeCard.monthlyLimitMinor) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => toggleCardFreeze(activeCard.id)}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-[#CFDAD8] bg-white hover:bg-slate-50 text-[#0E1B1F] font-semibold text-xs transition cursor-pointer"
                >
                  {activeCard.status === 'FROZEN' ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-[#0F766E]" />
                      <span>Unfreeze</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#4A5B60]" />
                      <span>Freeze Card</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openCardLimitsModal(activeCard)}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-[#CFDAD8] bg-white hover:bg-slate-50 text-[#0E1B1F] font-semibold text-xs transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#4A5B60]" />
                  <span>Set Limits</span>
                </button>

                <button
                  type="button"
                  onClick={() => openSimulatePurchaseModal(activeCard)}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] font-bold text-xs transition cursor-pointer shadow-xs"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Purchase</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#DCE5E3] rounded-3xl p-8 shadow-xs flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-3xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center">
                <CreditCard className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                  No {selectedCurrency} Virtual Card
                </h3>
                <p className="text-xs text-[#4A5B60] mt-1 max-w-sm">
                  You can issue a dedicated virtual card for your {selectedCurrency} wallet balance (
                  {currencySymbol}
                  {walletBalance.toFixed(2)} available).
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateCardModal}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white text-xs font-semibold cursor-pointer shadow-xs min-h-[44px]"
              >
                <Plus className="w-4 h-4 text-[#F5B942]" />
                <span>Issue {selectedCurrency} Card</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Col (7 cols): Card Recent Purchases */}
        <div className="lg:col-span-7 bg-white border border-[#DCE5E3] rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                Card Purchase Activity
              </h3>
              <p className="text-xs text-[#4A5B60] mt-0.5">
                Point-of-sale and e-commerce authorizations posted to the double-entry ledger.
              </p>
            </div>

            {activeCard && (
              <button
                type="button"
                onClick={() => activeCard && fetchCardTransactions(activeCard.id)}
                disabled={loadingTx}
                className="p-2 rounded-xl border border-[#CFDAD8] text-[#4A5B60] hover:bg-slate-50 transition cursor-pointer"
                title="Refresh transactions"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTx ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Transactions List */}
          {activeCard && cardTransactions && cardTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[#4A5B60] text-xs font-semibold tracking-wider border-b border-[#DCE5E3]">
                    <th className="py-2.5 px-2">MERCHANT</th>
                    <th className="py-2.5 px-2">TIME (UTC)</th>
                    <th className="py-2.5 px-2">STATUS</th>
                    <th className="py-2.5 px-2 text-right">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {cardTransactions.map((tx) => {
                    const isApproved = tx.status === 'APPROVED';
                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-[#EDF2F1] hover:bg-[#F4F7F6]/60 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div className="font-medium text-[#0E1B1F] flex items-center gap-1.5">
                            <span>{tx.merchantName}</span>
                          </div>
                          <div className="text-[11px] text-[#4A5B60] flex items-center gap-2">
                            <span>{tx.merchantCategory}</span>
                            {tx.ledgerTransactionId && (
                              <span className="font-mono text-[10px] text-[#0F766E]">
                                Ref: {tx.ledgerTransactionId.slice(0, 12)}...
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-xs font-mono text-[#4A5B60]">
                          {new Date(tx.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isApproved ? 'bg-[#E3F3F1] text-[#0A4F4A]' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {isApproved ? 'Approved' : 'Declined'}
                          </span>
                          {!isApproved && tx.declineReason && (
                            <div className="text-[11px] text-red-600 mt-0.5 max-w-[200px] leading-tight">
                              {tx.declineReason}
                            </div>
                          )}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-semibold font-mono ${
                            isApproved ? 'text-[#0E1B1F]' : 'text-slate-400 line-through'
                          }`}
                        >
                          -{formatMoney({ amountMinor: tx.amountMinor, currency: tx.currency })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-[#DCE5E3] rounded-2xl">
              <Clock className="w-8 h-8 text-[#8FA5A3]" />
              <div className="text-sm font-semibold text-[#0E1B1F]">No purchases recorded yet</div>
              <p className="text-xs text-[#4A5B60] max-w-sm">
                Use the <strong>Purchase</strong> button to execute merchant debits and verify
                server-side limits and ledger balance debits.
              </p>
              {activeCard && (
                <button
                  type="button"
                  onClick={() => openSimulatePurchaseModal(activeCard)}
                  className="mt-1 px-4 py-2 rounded-xl bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Make First Purchase
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
