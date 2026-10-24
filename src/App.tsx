import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './components/LandingPage';
import { ContactPage } from './components/ContactPage';
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
    authResetToken,
    openAuthModal,
    showToast,
    isSecurityModalOpen,
    securityModalTab,
    closeSecurityModal,
  } = useApp();

  // Live email deep-links: ?verifyEmail=… and ?resetToken=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verifyEmail');
    const resetToken = params.get('resetToken');

    const clearAuthParams = () => {
      params.delete('verifyEmail');
      params.delete('resetToken');
      const next = params.toString();
      const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', url);
    };

    if (verifyToken) {
      clearAuthParams();
      void (async () => {
        try {
          const res = await fetch('/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: verifyToken }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || 'Email verification failed.');
          }
          showToast('Email verified. You can sign in now.', 'success');
          openAuthModal('login');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Email verification failed.';
          showToast(message, 'warning');
          openAuthModal('login');
        }
      })();
      return;
    }

    if (resetToken) {
      clearAuthParams();
      openAuthModal('reset', resetToken);
    }
  }, [openAuthModal, showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F6]">
      <div className="flex-1 flex flex-col">
        {currentView === 'landing' && <LandingPage />}
        {currentView === 'contact' && <ContactPage />}
        {currentView === 'member' && <MemberDashboard />}
        {currentView === 'admin' && <AdminPortal />}
      </div>

      <ToastContainer />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        initialResetToken={authResetToken}
      />
      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={closeSecurityModal}
        initialTab={securityModalTab}
      />
      <KycVerificationModal />

      <OneTimeCredentialsModal />
      <CardLimitsModal />
      <SimulatePurchaseModal />
      <CreateCardModal />

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
