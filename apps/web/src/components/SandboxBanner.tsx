import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { t } from '../translations';

export const SandboxBanner: React.FC = () => {
  return (
    <aside
      aria-label="Sandbox Environment Notice"
      className="bg-[#FFF1CC] border-b border-[#F0D58A] text-[#5A4100] px-4 py-2.5 shadow-xs sticky top-0 z-50 transition-all select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs md:text-sm font-medium">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5B942] text-[#0E1B1F]">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <p className="tracking-tight">
            <span className="font-bold uppercase tracking-wider text-[11px] bg-[#0E1B1F] text-white px-2 py-0.5 rounded-sm mr-2 inline-flex items-center gap-1 font-mono">
              <ShieldAlert className="w-3 h-3 text-[#F5B942]" />
              {t('sandbox.badge')}
            </span>
            <span className="font-semibold text-[#0E1B1F]">
              {t('sandbox.bannerNotice')}
            </span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[#5A4100]/80">
          <span className="inline-block w-2 h-2 rounded-full bg-[#0F766E] animate-pulse" />
          <span>LEDGER ENGINE: DOUBLE-ENTRY SANDBOX</span>
        </div>
      </div>
    </aside>
  );
};
