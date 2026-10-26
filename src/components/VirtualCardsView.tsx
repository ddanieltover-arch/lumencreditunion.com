import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard,
  Lock,
  Unlock,
  Sliders,
  Plus,
  Shield,
  Eye,
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
    toggleCardFreeze,
    openCardLimitsModal,
    openCreateCardModal,
    activeMember,
    cardSessionSecrets,
    showToast,
  } = useApp();

  const [selectedCurrency, setSelectedCurrency] = useState<CardCurrency>('USD');
  const [credentialsVisible, setCredentialsVisible] = useState(false);

  // Strictly cards for the selected wallet currency — never cross-currency fallbacks
  const cardsInCurrency = virtualCards.filter(
    (c) => String(c.currency || '').toUpperCase() === selectedCurrency,
  );

  // Full cards tab: only selected currency. Compact overview: any active/first card.
  const activeCard = compact
    ? virtualCards.find((c) => c.id === activeCardId) || virtualCards[0] || null
    : cardsInCurrency.find((c) => c.id === activeCardId) || cardsInCurrency[0] || null;

  const activeSecrets = activeCard ? cardSessionSecrets[activeCard.id] : undefined;

  useEffect(() => {
    setCredentialsVisible(false);
  }, [activeCard?.id]);

  useEffect(() => {
    if (compact) return;
    if (activeCard && activeCardId !== activeCard.id) {
      setActiveCardId(activeCard.id);
      return;
    }
    if (!activeCard && activeCardId) {
      const stillBelongs = virtualCards.some(
        (c) =>
          c.id === activeCardId &&
          String(c.currency || '').toUpperCase() === selectedCurrency,
      );
      if (!stillBelongs) setActiveCardId(null);
    }
  }, [compact, selectedCurrency, activeCard?.id, activeCardId, virtualCards]);

  const currencySymbol =
    selectedCurrency === 'USD' ? '$' : selectedCurrency === 'CAD' ? 'C$' : selectedCurrency === 'GBP' ? '£' : '€';

  const walletBalance = activeMember?.wallets[selectedCurrency] || 0;

  const cardStatusLabel = (status: string) => {
    if (status === 'FROZEN') return 'Frozen';
    if (status === 'SUSPENDED') return 'Suspended';
    if (status === 'TERMINATED') return 'Terminated';
    return 'Active';
  };

  const displayPan =
    credentialsVisible && activeSecrets ? activeSecrets.fullPan : activeCard?.maskedPan || '';
  const displayCvv =
    credentialsVisible && activeSecrets ? activeSecrets.cvv : '•••';

  const toggleCredentialsVisible = () => {
    if (!activeSecrets) {
      showToast(
        'Full card number and CVV are only available for cards issued in this browser session.',
        'info',
      );
      return;
    }
    setCredentialsVisible((v) => !v);
  };

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

        {/* Card Visual */}
        <div className="bg-gradient-to-br from-[#F5B942] to-[#E5A832] text-[#0E1B1F] rounded-[18px] p-5 flex flex-col justify-between h-[156px] shadow-sm relative overflow-hidden border border-[#DE9E22]">
          <div className="flex justify-between items-center font-display font-bold text-[15px]">
            <span>Lumenfield</span>
            <span className="text-[11px] font-bold bg-white/70 px-1.5 py-0.5 rounded">
              {activeCard.currency}
            </span>
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
        <div className="grid grid-cols-2 gap-2">
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
            const count = virtualCards.filter(
              (c) => String(c.currency || '').toUpperCase() === cur,
            ).length;
            const isSelected = selectedCurrency === cur;
            return (
              <button
                key={cur}
                type="button"
                onClick={() => {
                  setSelectedCurrency(cur);
                  const first = virtualCards.find(
                    (c) => String(c.currency || '').toUpperCase() === cur,
                  );
                  setActiveCardId(first ? first.id : null);
                }}
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

      {cardsInCurrency.length > 1 && (
        <div className="flex flex-wrap gap-2 -mt-2">
          {cardsInCurrency.map((card) => {
            const isActive = activeCard?.id === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveCardId(card.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer min-h-[40px] ${
                  isActive
                    ? 'bg-[#0A3D3F] text-white border-[#0A3D3F]'
                    : 'bg-white text-[#0E1B1F] border-[#DCE5E3] hover:bg-[#F4F7F6]'
                }`}
              >
                {card.maskedPan.slice(-9)} · {cardStatusLabel(card.status)}
              </button>
            );
          })}
        </div>
      )}

      {/* Card Visual + Details & Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-5">
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
                      : activeCard.status === 'SUSPENDED'
                        ? 'bg-orange-50 text-orange-800'
                        : activeCard.status === 'TERMINATED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-[#E3F3F1] text-[#0A4F4A]'
                  }`}
                >
                  {cardStatusLabel(activeCard.status)}
                </span>
              </div>

              {/* Card Surface */}
              <div className="bg-gradient-to-br from-[#F5B942] via-[#F0B033] to-[#D99A22] text-[#0E1B1F] rounded-2xl p-6 shadow-md flex flex-col justify-between h-[200px] relative overflow-hidden border border-[#D0901A]">
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-lg tracking-wide">Lumenfield</span>
                  <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded">
                    {activeCard.currency}
                  </span>
                </div>

                <div className="font-mono font-bold text-2xl tracking-[0.16em] py-1 select-all">
                  {displayPan}
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
                    <div className="font-mono text-sm tracking-wider">{displayCvv}</div>
                  </div>
                </div>
              </div>

              {/* Privacy notice + Show / Hide credentials */}
              <div className="p-3.5 rounded-xl bg-[#F4F7F6] border border-[#DCE5E3] text-xs text-[#4A5B60] flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#0E1B1F]">Strict Privacy:</strong> The full PAN and CVV are never
                    stored on Lumenfield servers. Use Show / Hide to reveal them for cards issued in this
                    browser session.
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#DCE5E3]">
                  <div className="text-xs font-medium text-[#0E1B1F]">
                    {credentialsVisible ? 'Credentials visible' : 'Credentials hidden'}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={credentialsVisible}
                    aria-label={
                      credentialsVisible ? 'Hide card number and CVV' : 'Show card number and CVV'
                    }
                    onClick={toggleCredentialsVisible}
                    className={`inline-flex items-center gap-2 min-h-[40px] pl-1.5 pr-3 rounded-full border transition cursor-pointer ${
                      credentialsVisible
                        ? 'bg-[#0A3D3F] border-[#0A3D3F] text-white'
                        : 'bg-white border-[#BCCAC8] text-[#0E1B1F] hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        credentialsVisible ? 'bg-[#F5B942]' : 'bg-[#DCE5E3]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          credentialsVisible ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                      {credentialsVisible ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Show
                        </>
                      )}
                    </span>
                  </button>
                </div>
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
              <div className="grid grid-cols-2 gap-2.5 pt-2">
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
      </div>
    </div>
  );
};
