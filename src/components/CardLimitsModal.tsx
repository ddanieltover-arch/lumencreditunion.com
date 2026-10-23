import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sliders, X, AlertCircle } from 'lucide-react';
import { formatMoney } from '@lumenfield/shared';

export const CardLimitsModal: React.FC = () => {
  const {
    isCardLimitsModalOpen,
    closeCardLimitsModal,
    selectedCardForLimits,
    updateCardLimits,
    showToast,
  } = useApp();

  const [dailyMajor, setDailyMajor] = useState<number>(1000);
  const [monthlyMajor, setMonthlyMajor] = useState<number>(5000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCardForLimits) {
      setDailyMajor(Math.round(selectedCardForLimits.dailyLimitMinor / 100));
      setMonthlyMajor(Math.round(selectedCardForLimits.monthlyLimitMinor / 100));
      setError(null);
    }
  }, [selectedCardForLimits]);

  if (!isCardLimitsModalOpen || !selectedCardForLimits) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (dailyMajor <= 0 || monthlyMajor <= 0) {
      setError('Spending limits must be positive amounts greater than 0.');
      return;
    }

    if (dailyMajor > monthlyMajor) {
      setError('Daily limit cannot exceed monthly limit.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCardLimits({
        cardId: selectedCardForLimits.id,
        dailyLimitMinor: Math.round(dailyMajor * 100),
        monthlyLimitMinor: Math.round(monthlyMajor * 100),
      });
      closeCardLimitsModal();
    } catch (err: any) {
      setError(err.message || 'Failed to update spending limits.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol =
    selectedCardForLimits.currency === 'USD'
      ? '$'
      : selectedCardForLimits.currency === 'CAD'
      ? 'C$'
      : selectedCardForLimits.currency === 'GBP'
      ? '£'
      : '€';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-limits-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E3F3F1] text-[#0A4F4A] border border-[#B8D4D2] flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-[#0F766E]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                Virtual Card •••• {selectedCardForLimits.lastFour}
              </span>
              <h3 id="card-limits-modal-title" className="font-display font-bold text-xl text-[#0E1B1F]">
                Configure Spending Limits
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCardLimitsModal}
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

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Card Info summary */}
          <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3] text-xs flex justify-between items-center text-[#4A5B60]">
            <span>Card Wallet Currency:</span>
            <strong className="text-[#0E1B1F] font-semibold">{selectedCardForLimits.currency}</strong>
          </div>

          {/* Daily Limit */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[#4A5B60]">
              <label htmlFor="daily-limit-input">Daily Spending Limit</label>
              <span className="font-mono text-[#0E1B1F] font-bold">
                {currencySymbol}
                {dailyMajor.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#4A5B60]">
                {currencySymbol}
              </span>
              <input
                id="daily-limit-input"
                type="number"
                min="10"
                max="50000"
                step="50"
                value={dailyMajor}
                onChange={(e) => setDailyMajor(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#BCCAC8] text-sm font-mono text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
                required
              />
            </div>
            <input
              type="range"
              min="100"
              max="10000"
              step="100"
              value={dailyMajor}
              onChange={(e) => setDailyMajor(Number(e.target.value))}
              className="w-full mt-1 accent-[#0A3D3F]"
            />
            <span className="text-[11px] text-[#4A5B60]">
              Spent today:{' '}
              {formatMoney({
                amountMinor: selectedCardForLimits.spentTodayMinor,
                currency: selectedCardForLimits.currency,
              })}
            </span>
          </div>

          {/* Monthly Limit */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[#4A5B60]">
              <label htmlFor="monthly-limit-input">Monthly Spending Limit</label>
              <span className="font-mono text-[#0E1B1F] font-bold">
                {currencySymbol}
                {monthlyMajor.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#4A5B60]">
                {currencySymbol}
              </span>
              <input
                id="monthly-limit-input"
                type="number"
                min="50"
                max="100000"
                step="100"
                value={monthlyMajor}
                onChange={(e) => setMonthlyMajor(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#BCCAC8] text-sm font-mono text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
                required
              />
            </div>
            <input
              type="range"
              min="500"
              max="50000"
              step="500"
              value={monthlyMajor}
              onChange={(e) => setMonthlyMajor(Number(e.target.value))}
              className="w-full mt-1 accent-[#0A3D3F]"
            />
            <span className="text-[11px] text-[#4A5B60]">
              Spent this month:{' '}
              {formatMoney({
                amountMinor: selectedCardForLimits.spentThisMonthMinor,
                currency: selectedCardForLimits.currency,
              })}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeCardLimitsModal}
              className="px-4 py-3 min-h-[44px] rounded-xl border border-[#CFDAD8] text-sm font-semibold text-[#0E1B1F] hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 min-h-[44px] rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] disabled:opacity-50 text-white text-sm font-semibold transition shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Saving Limits...' : 'Save Spending Limits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
