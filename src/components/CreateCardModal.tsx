import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CreditCard, X, ShieldAlert, AlertCircle, Plus } from 'lucide-react';
import { CardCurrency } from '@lumenfield/shared';

export const CreateCardModal: React.FC = () => {
  const {
    isCreateCardModalOpen,
    closeCreateCardModal,
    createVirtualCard,
    activeMember,
    virtualCards,
    showToast,
  } = useApp();

  const [currency, setCurrency] = useState<CardCurrency>('USD');
  const [cardholderName, setCardholderName] = useState(activeMember.name || 'Amara Okafor');
  const [dailyLimitMajor, setDailyLimitMajor] = useState<number>(1000);
  const [monthlyLimitMajor, setMonthlyLimitMajor] = useState<number>(5000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCreateCardModalOpen) return null;

  const currencySymbol =
    currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : currency === 'GBP' ? '£' : '€';

  const existingCardForCurrency = virtualCards.find((c) => c.currency === currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (dailyLimitMajor <= 0 || monthlyLimitMajor <= 0) {
      setError('Spending limits must be positive amounts greater than 0.');
      return;
    }

    if (dailyLimitMajor > monthlyLimitMajor) {
      setError('Daily limit cannot exceed monthly limit.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createVirtualCard({
        currency,
        cardholderName: cardholderName.trim(),
        dailyLimitMinor: Math.round(dailyLimitMajor * 100),
        monthlyLimitMinor: Math.round(monthlyLimitMajor * 100),
      });
      closeCreateCardModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create virtual card.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-card-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0A3D3F] text-white flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-[#F5B942]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                Multi-Currency Wallet
              </span>
              <h3 id="create-card-modal-title" className="font-display font-bold text-xl text-[#0E1B1F]">
                Issue Virtual Card
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCreateCardModal}
            aria-label="Close modal"
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Security Alert: One-time credentials */}
        <div className="p-3.5 rounded-2xl bg-[#FFF1CC] border border-[#F0D58A] flex items-start gap-2.5 text-xs text-[#5A4100]">
          <ShieldAlert className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
          <span>
            <strong>Single-View Security Notice:</strong> The fake test PAN (card number) and CVV will be
            displayed <em>only once</em> immediately following creation. They will never be returned by the
            API again.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Currency Wallet Selector */}
          <div>
            <label className="text-xs font-semibold text-[#4A5B60] block mb-1.5">
              Select Wallet Currency
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['USD', 'CAD', 'GBP', 'EUR'] as CardCurrency[]).map((cur) => {
                const hasCard = virtualCards.some((c) => c.currency === cur);
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`py-2 px-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center ${
                      currency === cur
                        ? 'border-[#0A3D3F] bg-[#E3F3F1] text-[#0A3D3F] font-bold shadow-xs'
                        : 'border-[#DCE5E3] bg-[#F4F7F6] text-[#4A5B60] hover:bg-white'
                    }`}
                  >
                    <span className="text-xs">{cur}</span>
                    {hasCard && (
                      <span className="text-[9px] text-[#0F766E] font-medium mt-0.5">Has Card</span>
                    )}
                  </button>
                );
              })}
            </div>
            {existingCardForCurrency && (
              <span className="text-[11px] text-[#B45309] mt-1 block">
                Note: You already have a {currency} card (•••• {existingCardForCurrency.lastFour}). You may create an additional card for specialized budgeting.
              </span>
            )}
          </div>

          {/* Cardholder Name */}
          <div>
            <label htmlFor="cardholder-name" className="text-xs font-semibold text-[#4A5B60] block mb-1">
              Cardholder Name
            </label>
            <input
              id="cardholder-name"
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="e.g. Amara Okafor"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#BCCAC8] text-sm text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E]"
              required
            />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-daily-limit" className="text-xs font-semibold text-[#4A5B60] block mb-1">
                Daily Limit ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#4A5B60]">
                  {currencySymbol}
                </span>
                <input
                  id="create-daily-limit"
                  type="number"
                  min="50"
                  max="20000"
                  step="50"
                  value={dailyLimitMajor}
                  onChange={(e) => setDailyLimitMajor(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#BCCAC8] text-sm font-mono text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E]"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="create-monthly-limit" className="text-xs font-semibold text-[#4A5B60] block mb-1">
                Monthly Limit ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#4A5B60]">
                  {currencySymbol}
                </span>
                <input
                  id="create-monthly-limit"
                  type="number"
                  min="100"
                  max="50000"
                  step="100"
                  value={monthlyLimitMajor}
                  onChange={(e) => setMonthlyLimitMajor(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#BCCAC8] text-sm font-mono text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeCreateCardModal}
              className="px-4 py-3 min-h-[44px] rounded-xl border border-[#CFDAD8] text-sm font-semibold text-[#0E1B1F] hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 min-h-[44px] rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] disabled:opacity-50 text-white text-sm font-semibold transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Generating Card...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-[#F5B942]" />
                  <span>Issue {currency} Card</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
