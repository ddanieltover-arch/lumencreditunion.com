import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ModalMotion } from '../motion';
import { ShieldAlert, Copy, Check, Eye, AlertTriangle, X } from 'lucide-react';

export const OneTimeCredentialsModal: React.FC = () => {
  const { oneTimeCredentials, setOneTimeCredentials, showToast } = useApp();
  const [copiedPan, setCopiedPan] = useState(false);
  const [copiedCvv, setCopiedCvv] = useState(false);

  const handleCopyPan = () => {
    if (!oneTimeCredentials) return;
    navigator.clipboard.writeText(oneTimeCredentials.fullPan.replace(/\s+/g, ''));
    setCopiedPan(true);
    showToast('Card number copied to clipboard', 'info');
    setTimeout(() => setCopiedPan(false), 2000);
  };

  const handleCopyCvv = () => {
    if (!oneTimeCredentials) return;
    navigator.clipboard.writeText(oneTimeCredentials.cvv);
    setCopiedCvv(true);
    showToast('CVV copied to clipboard', 'info');
    setTimeout(() => setCopiedCvv(false), 2000);
  };

  const handleClose = () => {
    setOneTimeCredentials(null);
  };

  return (
    <ModalMotion
      open={!!oneTimeCredentials}
      onClose={handleClose}
      labelledBy="one-time-creds-title"
      panelClassName="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5"
      overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      {oneTimeCredentials && (
      <>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF1CC] text-[#5A4100] border border-[#F0D58A] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#B45309]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                Virtual Card Issued · Sandbox
              </span>
              <h3 id="one-time-creds-title" className="font-display font-bold text-xl text-[#0E1B1F]">
                One-Time Security Credentials
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Critical Notice */}
        <div className="p-4 rounded-2xl bg-[#FFF1CC] border border-[#F0D58A] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div className="text-xs text-[#5A4100] leading-relaxed">
            <strong className="block font-semibold mb-0.5">Important Security Warning:</strong>
            {oneTimeCredentials.warningNotice ||
              'Save these credentials now. For your security, the full card number and CVV are never stored in Lumenfield and cannot be retrieved again.'}
          </div>
        </div>

        {/* Visual Card Display */}
        <div className="bg-gradient-to-br from-[#F5B942] to-[#E5A832] text-[#0E1B1F] rounded-2xl p-5 sm:p-6 shadow-md flex flex-col justify-between h-[190px] relative overflow-hidden border border-[#DE9E22]">
          <div className="flex justify-between items-center">
            <span className="font-display font-bold text-base tracking-wide">Lumenfield</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase bg-[#0E1B1F] text-[#F5B942] px-2 py-0.5 rounded">
                NON-ROUTABLE TEST
              </span>
            </div>
          </div>

          <div className="font-mono font-bold text-xl sm:text-2xl tracking-[0.16em] py-1 select-all">
            {oneTimeCredentials.fullPan}
          </div>

          <div className="flex justify-between items-end text-xs font-semibold">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#0E1B1F]/60">Valid Thru</div>
              <div className="font-mono text-sm">{oneTimeCredentials.expiry}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#0E1B1F]/60">CVV Code</div>
              <div className="font-mono text-sm tracking-wider">{oneTimeCredentials.cvv}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#0E1B1F]/60">Type</div>
              <div>Sandbox Visa</div>
            </div>
          </div>
        </div>

        {/* Detail Fields with Copy Actions */}
        <div className="space-y-3 text-sm">
          <div className="p-3.5 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs text-[#4A5B60] block">Full Test PAN (Card Number)</span>
              <span className="font-mono font-bold text-sm text-[#0E1B1F] truncate block">
                {oneTimeCredentials.fullPan}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPan}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#BCCAC8] hover:bg-slate-50 text-xs font-semibold text-[#0E1B1F] transition cursor-pointer shrink-0 min-h-[36px]"
            >
              {copiedPan ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#0F766E]" />}
              <span>{copiedPan ? 'Copied' : 'Copy PAN'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
              <span className="text-xs text-[#4A5B60] block">Expiration Date</span>
              <span className="font-mono font-bold text-sm text-[#0E1B1F] block mt-0.5">
                {oneTimeCredentials.expiry}
              </span>
            </div>

            <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#4A5B60] block">Security CVV</span>
                <span className="font-mono font-bold text-sm text-[#0E1B1F] block mt-0.5">
                  {oneTimeCredentials.cvv}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCvv}
                className="p-1.5 rounded-lg bg-white border border-[#BCCAC8] hover:bg-slate-50 text-xs font-semibold text-[#0E1B1F] transition cursor-pointer"
                title="Copy CVV"
              >
                {copiedCvv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#0F766E]" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer acknowledge */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="w-full min-h-[44px] rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <span>I have saved my card credentials</span>
          </button>
          <p className="text-[11px] text-center text-[#4A5B60] mt-2">
            After closing, only masked digits (•••• {oneTimeCredentials.fullPan.slice(-4)}) will be displayed.
          </p>
        </div>
      </>
      )}
    </ModalMotion>
  );
};
