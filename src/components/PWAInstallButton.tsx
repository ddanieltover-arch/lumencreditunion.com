import React, { useState } from 'react';
import { Download, Smartphone, X, Bell } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { requestPushPermission, getPushPermissionState, sendWebPushNotification } from '../utils/pushNotifications';
import { useApp } from '../context/AppContext';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isPushRequested, setIsPushRequested] = useState(false);
  const { showToast } = useApp();

  const handleEnablePush = async () => {
    setIsPushRequested(true);
    const perm = await requestPushPermission();
    if (perm === 'granted') {
      showToast('Push Notifications Enabled: Real-time alerts active for transfers, KYC decisions, and loans.', 'success');
      await sendWebPushNotification({
        title: 'Lumenfield Alerts Active',
        body: 'Web push notifications are now connected for account activity.',
        type: 'SYSTEM',
      });
    } else {
      showToast('Notification permission was denied in your browser settings.', 'warning');
    }
  };

  const handleConfirmInstall = async () => {
    if (isIOS) {
      return;
    }
    const ok = await install();
    if (ok) {
      showToast('Lumenfield was added to your device.', 'success');
      setShowInstallModal(false);
    } else if (!isInstallable) {
      showToast('Install is not available in this browser yet. Try Chrome or Edge on desktop/Android.', 'info');
    }
  };

  const currentPermission = typeof window !== 'undefined' ? getPushPermissionState() : 'default';
  const canShowInstall = !isInstalled && (isInstallable || isIOS);

  if (!canShowInstall && currentPermission === 'granted') {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {currentPermission !== 'granted' && (
        <button
          type="button"
          onClick={handleEnablePush}
          disabled={isPushRequested && currentPermission === 'denied'}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0A3D3F] bg-white/80 hover:bg-white border border-[#DCE5E3] rounded-md transition shadow-2xs min-h-[32px] cursor-pointer"
          title="Enable push alerts for transfers, KYC decisions & loans"
          aria-label="Enable Push Notifications"
        >
          <Bell className="w-3.5 h-3.5 text-[#0F766E]" />
          <span className="hidden sm:inline">Push Alerts</span>
        </button>
      )}

      {canShowInstall && (
        <button
          onClick={() => setShowInstallModal(true)}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#F5B942] px-3 py-1 text-xs font-bold text-[#0E1B1F] shadow-xs hover:bg-[#F0D58A] active:scale-95 transition min-h-[32px] cursor-pointer"
          aria-label="Install Lumenfield App as PWA"
        >
          {isIOS ? <Smartphone className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5 text-[#0E1B1F]" />}
          <span>Install App</span>
        </button>
      )}

      {showInstallModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-modal-title"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[#DCE5E3]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5E3]">
              <h3 id="install-modal-title" className="text-base font-bold text-[#0E1B1F] font-display">
                {isIOS ? 'Install Lumenfield on iOS' : 'Install Lumenfield App'}
              </h3>
              <button
                onClick={() => setShowInstallModal(false)}
                className="rounded-full p-1 text-[#4A5B60] hover:bg-[#F4F7F6] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                aria-label="Close install modal"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <p className="mt-3 text-xs leading-relaxed text-[#4A5B60]">
                1. Tap the <strong className="text-[#0E1B1F]">Share</strong> button (square with arrow) at the bottom of Safari.<br />
                2. Scroll down and tap <strong className="text-[#0E1B1F]">Add to Home Screen</strong>.<br />
                3. Tap <strong className="text-[#0E1B1F]">Add</strong> in the top-right corner to launch Lumenfield with offline support.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-[#4A5B60]">
                Install Lumenfield as an app for faster access, offline shell support, and push alerts for transfers, KYC decisions, and loans.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              {!isIOS && (
                <button
                  onClick={handleConfirmInstall}
                  type="button"
                  className="w-full rounded-lg bg-[#0A3D3F] py-2.5 text-xs font-semibold text-white hover:bg-[#072F30] min-h-[44px] cursor-pointer"
                >
                  {isInstallable ? 'Install now' : 'Install unavailable'}
                </button>
              )}
              <button
                onClick={() => setShowInstallModal(false)}
                type="button"
                className="w-full rounded-lg border border-[#DCE5E3] py-2.5 text-xs font-semibold text-[#0E1B1F] hover:bg-[#F4F7F6] min-h-[44px] cursor-pointer"
              >
                {isIOS ? 'Got it' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
