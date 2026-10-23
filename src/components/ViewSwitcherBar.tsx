import React from 'react';
import { useApp } from '../context/AppContext';
import { RotateCcw } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export const ViewSwitcherBar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    resetDemoData,
    setAdminTab,
    setMemberTab,
    currentUser,
    openAuthModal,
    openSecurityModal,
    logoutUser,
  } = useApp();

  return (
    <div className="w-full bg-[#FFF1CC] text-[#5A4100] text-xs font-medium border-b border-[#F0D58A] px-4 py-2 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Notice strictly adhering to HARD RULE 1 */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F5B942] border border-[#5A4100]/30 shrink-0 animate-pulse" />
          <span className="font-bold text-[#0E1B1F]">
            Sandbox environment: all balances are test funds, not real money.
          </span>
        </div>

        {/* View Switcher Controls & Auth Triggers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-[#5A4100]/10 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setCurrentView('landing')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'landing'
                  ? 'bg-[#0A3D3F] text-[#FFFFFF] shadow-xs'
                  : 'text-[#5A4100] hover:bg-[#5A4100]/15'
              }`}
            >
              Landing Page
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('member');
                setMemberTab('overview');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'member'
                  ? 'bg-[#0A3D3F] text-[#FFFFFF] shadow-xs'
                  : 'text-[#5A4100] hover:bg-[#5A4100]/15'
              }`}
            >
              Member Dashboard
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('admin');
                setAdminTab('fund_wallet');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-[#0A3D3F] text-[#FFFFFF] shadow-xs'
                  : 'text-[#5A4100] hover:bg-[#5A4100]/15'
              }`}
            >
              Admin: Fund a Wallet
            </button>
          </div>

          {/* Authentication & Security Controls */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#F0D58A]">
              <span className="font-semibold text-[#0E1B1F] hidden md:inline text-[11px]">
                {currentUser.fullName} ({currentUser.role})
              </span>
              <button
                type="button"
                onClick={openSecurityModal}
                className="px-2.5 py-1 bg-[#0A3D3F] text-white hover:bg-[#072F30] rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1"
                title="Manage 2FA, password, and active devices"
              >
                <span>Security & MFA</span>
              </button>
              <button
                type="button"
                onClick={logoutUser}
                className="px-2 py-1 bg-white/60 hover:bg-white text-[#5A4100] border border-[#F0D58A] rounded-md text-xs font-medium transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#F0D58A]">
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="px-2.5 py-1 bg-[#0A3D3F] text-white hover:bg-[#072F30] rounded-md text-xs font-bold transition cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="px-2.5 py-1 bg-[#F5B942] text-[#0E1B1F] hover:bg-[#F0D58A] rounded-md text-xs font-bold transition cursor-pointer"
              >
                Register
              </button>
            </div>
          )}

          <div className="pl-1.5 border-l border-[#F0D58A] flex items-center">
            <PWAInstallButton />
          </div>

          <button
            type="button"
            onClick={resetDemoData}
            title="Reset sandbox data to original design state"
            aria-label="Reset sandbox demo data"
            className="p-1 rounded-md text-[#5A4100] hover:bg-[#5A4100]/20 transition-colors ml-1 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
