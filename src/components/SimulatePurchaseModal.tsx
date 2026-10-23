import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard,
  ShoppingCart,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { formatMoney, parseMajorToMinor } from '@lumenfield/shared';

interface Preset {
  merchantName: string;
  category: string;
  amount: number;
}

const PRESETS: Preset[] = [
  { merchantName: 'Metro Coffee House', category: 'DINING', amount: 4.5 },
  { merchantName: 'Local Grocery Market', category: 'GROCERY', amount: 65.0 },
  { merchantName: 'Apex Cloud Hosting', category: 'SOFTWARE_SERVICES', amount: 45.0 },
  { merchantName: 'Electronics Superstore', category: 'RETAIL', amount: 1200.0 },
];

export const SimulatePurchaseModal: React.FC = () => {
  const {
    isSimulatePurchaseModalOpen,
    closeSimulatePurchaseModal,
    selectedCardForSimulation,
    virtualCards,
    simulateCardPurchase,
    showToast,
  } = useApp();

  const card = selectedCardForSimulation || virtualCards[0];

  const [merchantName, setMerchantName] = useState('Metro Coffee House');
  const [merchantCategory, setMerchantCategory] = useState('DINING');
  const [amountStr, setAmountStr] = useState('4.50');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    status: 'APPROVED' | 'DECLINED';
    message: string;
    authCode?: string;
    ledgerTxId?: string;
    declineReason?: string;
  } | null>(null);

  if (!isSimulatePurchaseModalOpen || !card) return null;

  const currencySymbol =
    card.currency === 'USD' ? '$' : card.currency === 'CAD' ? 'C$' : card.currency === 'GBP' ? '£' : '€';

  const handleApplyPreset = (preset: Preset) => {
    setMerchantName(preset.merchantName);
    setMerchantCategory(preset.category);
    setAmountStr(preset.amount.toFixed(2));
    setSimulationResult(null);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulationResult(null);

    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid purchase amount greater than 0.', 'warning');
      return;
    }

    const amountMinor = Math.round(amountNum * 100);
    setIsSubmitting(true);

    try {
      const res = await simulateCardPurchase({
        cardId: card.id,
        amountMinor,
        merchantName: merchantName.trim(),
        merchantCategory,
        currency: card.currency,
      });

      setSimulationResult({
        status: 'APPROVED',
        message: 'Transaction Approved by Sandbox Network',
        authCode: `AUTH_${Math.floor(100000 + Math.random() * 900000)}`,
        ledgerTxId: res.ledgerTransaction?.id || 'LEDG-CARD-TX',
      });
    } catch (err: any) {
      setSimulationResult({
        status: 'DECLINED',
        message: 'Transaction Declined by Lumenfield Rules Engine',
        declineReason: err.message || 'Declined',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFrozen = card.status === 'FROZEN';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulate-card-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF1CC] text-[#5A4100] border border-[#F0D58A] flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-[#B45309]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                Dev-Only Simulation Endpoint
              </span>
              <h3 id="simulate-card-modal-title" className="font-display font-bold text-xl text-[#0E1B1F]">
                Simulate Card Purchase
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSimulatePurchaseModal}
            aria-label="Close modal"
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Card Pill */}
        <div className="p-3.5 bg-[#F4F7F6] rounded-2xl border border-[#DCE5E3] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-[#0F766E]" />
            <div>
              <div className="font-semibold text-sm text-[#0E1B1F]">
                Virtual Card •••• {card.lastFour} ({card.currency})
              </div>
              <div className="text-xs text-[#4A5B60]">
                Daily: {formatMoney({ amountMinor: card.dailyLimitMinor, currency: card.currency })} ·
                Monthly: {formatMoney({ amountMinor: card.monthlyLimitMinor, currency: card.currency })}
              </div>
            </div>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isFrozen ? 'bg-[#FFF1CC] text-[#5A4100]' : 'bg-[#E3F3F1] text-[#0A4F4A]'
            }`}
          >
            {isFrozen ? 'Frozen' : 'Active'}
          </span>
        </div>

        {/* Frozen Warning banner if applicable */}
        {isFrozen && (
          <div className="p-3.5 rounded-xl bg-[#FFF1CC] border border-[#F0D58A] text-[#5A4100] text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#B45309] shrink-0" />
            <span>
              <strong>Card is currently Frozen:</strong> Any simulated purchase will be declined server-side.
            </span>
          </div>
        )}

        {/* Quick Presets */}
        <div>
          <span className="text-xs font-semibold text-[#4A5B60] block mb-2">
            Quick Simulation Presets:
          </span>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="text-left p-2.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] hover:bg-white hover:border-[#0F766E] transition text-xs cursor-pointer flex flex-col"
              >
                <span className="font-semibold text-[#0E1B1F] truncate">{p.merchantName}</span>
                <span className="font-mono text-[#0F766E] font-bold">
                  {currencySymbol}
                  {p.amount.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Purchase Form */}
        <form onSubmit={handleSimulate} className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="sim-merchant" className="text-xs font-semibold text-[#4A5B60] block mb-1">
              Merchant Name
            </label>
            <input
              id="sim-merchant"
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g. Apex Cloud Hosting, Apple Store"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#BCCAC8] text-sm text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sim-amount" className="text-xs font-semibold text-[#4A5B60] block mb-1">
                Amount ({card.currency})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#4A5B60]">
                  {currencySymbol}
                </span>
                <input
                  id="sim-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-[#BCCAC8] text-sm font-mono text-[#0E1B1F] focus:outline-hidden focus:border-[#0F766E]"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="sim-category" className="text-xs font-semibold text-[#4A5B60] block mb-1">
                Merchant Category
              </label>
              <select
                id="sim-category"
                value={merchantCategory}
                onChange={(e) => setMerchantCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#BCCAC8] text-sm text-[#0E1B1F] bg-white focus:outline-hidden focus:border-[#0F766E]"
              >
                <option value="DINING">Dining & Food</option>
                <option value="GROCERY">Grocery & Supermarket</option>
                <option value="SOFTWARE_SERVICES">Cloud & SaaS</option>
                <option value="RETAIL">Retail & Shopping</option>
                <option value="TRAVEL">Travel & Transport</option>
                <option value="LUXURY">Luxury Goods</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-xl bg-[#F5B942] hover:bg-[#f0b033] disabled:opacity-50 text-[#0E1B1F] font-semibold text-sm transition shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <span>Authorizing Purchase...</span>
            ) : (
              <>
                <span>Simulate Purchase ({currencySymbol}{amountStr})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Result Callout */}
        {simulationResult && (
          <div
            className={`p-4 rounded-2xl border text-sm flex flex-col gap-2 animate-in fade-in ${
              simulationResult.status === 'APPROVED'
                ? 'bg-[#E3F3F1] border-[#B8D4D2] text-[#0A4F4A]'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {simulationResult.status === 'APPROVED' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Transaction Authorized (Approved)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>Transaction Declined</span>
                </>
              )}
            </div>

            {simulationResult.status === 'APPROVED' ? (
              <div className="text-xs space-y-1 text-[#0E1B1F]">
                <div>
                  <strong>Merchant:</strong> {merchantName} ({merchantCategory})
                </div>
                <div>
                  <strong>Amount Debited:</strong> {currencySymbol}
                  {parseFloat(amountStr).toFixed(2)} {card.currency}
                </div>
                <div className="font-mono text-[11px] text-[#4A5B60]">
                  Ledger Tx: {simulationResult.ledgerTxId}
                </div>
              </div>
            ) : (
              <div className="text-xs text-red-800">
                <strong>Decline Reason:</strong> {simulationResult.declineReason}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
