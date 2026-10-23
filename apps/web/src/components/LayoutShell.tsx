import React from 'react';
import { SandboxBanner } from './SandboxBanner';
import { PWAInstallButton } from './PWAInstallButton';
import { t } from '../translations';
import { ShieldCheck, UserCheck, LayoutDashboard, Globe2 } from 'lucide-react';

interface LayoutShellProps {
  children: React.ReactNode;
  currentView?: 'landing' | 'member' | 'admin';
  onViewChange?: (view: 'landing' | 'member' | 'admin') => void;
  activeMemberName?: string;
  enabledCountriesCount?: number;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({
  children,
  currentView = 'landing',
  onViewChange,
  activeMemberName,
  enabledCountriesCount = 9,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F6] text-[#0E1B1F] font-sans antialiased selection:bg-[#F5B942] selection:text-[#0E1B1F]">
      {/* 1. HARD RULE 1: Persistent Sandbox Banner on EVERY page */}
      <SandboxBanner />

      {/* 2. Top Header Navigation */}
      <header className="bg-[#0A3D3F] border-b border-[#072F30] text-white shadow-md sticky top-[41px] z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onViewChange?.('landing')}
                className="flex items-center gap-3 group text-left min-h-[44px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F5B942] rounded-lg px-1.5"
                aria-label="Lumenfield Home"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F766E] to-[#0A3D3F] border border-[#F5B942]/30 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                  <span className="font-display font-extrabold text-[#F5B942] text-xl tracking-tighter">L</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg text-white tracking-tight">Lumenfield</span>
                    <span className="text-[10px] uppercase font-mono tracking-wider bg-[#072F30] text-[#F5B942] px-2 py-0.5 rounded-full border border-[#F5B942]/20 font-bold">
                      SANDBOX
                    </span>
                  </div>
                  <p className="text-[11px] text-[#DCE5E3]/80 font-medium">Digital Wallet & Lending Testbed</p>
                </div>
              </button>
            </div>

            {/* View Switchers (Landing, Member, Admin) */}
            <nav className="flex items-center gap-2 sm:gap-3" aria-label="Portal Navigation">
              <button
                type="button"
                onClick={() => onViewChange?.('landing')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold rounded-lg transition min-h-[44px] cursor-pointer ${
                  currentView === 'landing'
                    ? 'bg-white/15 text-[#F5B942] border border-[#F5B942]/30'
                    : 'text-[#DCE5E3] hover:bg-white/10 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.landing')}</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange?.('member')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold rounded-lg transition min-h-[44px] cursor-pointer ${
                  currentView === 'member'
                    ? 'bg-white/15 text-[#F5B942] border border-[#F5B942]/30'
                    : 'text-[#DCE5E3] hover:bg-white/10 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>{t('nav.memberPortal')}</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange?.('admin')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold rounded-lg transition min-h-[44px] cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-[#F5B942] text-[#0E1B1F] shadow-sm font-bold'
                    : 'bg-[#072F30] text-[#DCE5E3] border border-[#0F766E] hover:text-white hover:border-[#F5B942]/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-inherit" />
                <span>{t('nav.adminPortal')}</span>
              </button>

              {/* PWA Install Button */}
              <div className="hidden lg:block ml-2 pl-2 border-l border-white/20">
                <PWAInstallButton />
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Subheader / Status Strip */}
      <div className="bg-[#072F30] text-[#DCE5E3] text-xs py-1.5 px-4 border-b border-[#0A3D3F]">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-[#F5B942]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#107E54]" />
              Double-Entry Ledger Online
            </span>
            <span className="text-[#8FA5A3] hidden md:inline">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#DCE5E3]">
              <Globe2 className="w-3.5 h-3.5 text-[#0F766E]" />
              {enabledCountriesCount} Jurisdictions Enabled (US, CA, UK, EU)
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            {activeMemberName && (
              <span className="text-[#DCE5E3]">
                Active Member: <strong className="text-white">{activeMemberName}</strong>
              </span>
            )}
            <span className="bg-[#0A3D3F] text-[#F0D58A] px-2 py-0.5 rounded-sm font-mono text-[10px]">
              SOURCE=TEST
            </span>
          </div>
        </div>
      </div>

      {/* Main View Port */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Universal Footer */}
      <footer className="bg-[#0E1B1F] border-t border-[#0A3D3F] text-[#8FA5A3] py-8 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white">Lumenfield Financial Sandbox</p>
            <p className="mt-1 text-[11px] max-w-xl text-[#8FA5A3]">
              Private testbed for multi-currency wallets, virtual debit cards, and simulated loan underwriting.
              All funds and balances are fictitious sandbox units. Lumenfield is not a chartered bank or insured depository institution.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-[#DCE5E3]">Countries Data Table: ISO-3166 & ISO-4217</span>
            <span className="font-mono text-[#F5B942]">v0.1.0-alpha</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
