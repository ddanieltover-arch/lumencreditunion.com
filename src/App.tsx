import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ViewSwitcherBar } from './components/ViewSwitcherBar';
import { LandingPage } from './components/LandingPage';
import { MemberDashboard } from './components/MemberDashboard';
import { AdminPortal } from './components/AdminPortal';
import { ToastContainer } from './components/ToastContainer';
import { AuthModal } from './components/AuthModal';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { KycVerificationModal } from './components/KycVerificationModal';
import { OneTimeCredentialsModal } from './components/OneTimeCredentialsModal';
import { CardLimitsModal } from './components/CardLimitsModal';
import { SimulatePurchaseModal } from './components/SimulatePurchaseModal';
import { CreateCardModal } from './components/CreateCardModal';
import { LegalModals } from './components/LegalModals';

const MainAppContent: React.FC = () => {
  const {
    currentView,
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    isSecurityModalOpen,
    closeSecurityModal,
  } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F6]">
      {/* Sandbox banner & View switcher */}
      <ViewSwitcherBar />

      {/* Main active view from design mockup */}
      <div className="flex-1 flex flex-col">
        {currentView === 'landing' && <LandingPage />}
        {currentView === 'member' && <MemberDashboard />}
        {currentView === 'admin' && <AdminPortal />}
      </div>

      {/* Live notification toasts */}
      <ToastContainer />

      {/* Authentication and Security Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={closeSecurityModal}
      />
      <KycVerificationModal />

      {/* Virtual Card Experience Modals */}
      <OneTimeCredentialsModal />
      <CardLimitsModal />
      <SimulatePurchaseModal />
      <CreateCardModal />

      {/* Terms, Privacy, GDPR Data Export & Account Deletion Modals */}
      <LegalModals />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
