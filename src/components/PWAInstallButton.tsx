import React, { useState } from 'react';
import { Download, Smartphone, X, Bell } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { requestPushPermission, getPushPermissionState, sendWebPushNotification } from '../utils/pushNotifications';
import { useApp } from '../context/AppContext';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isPushRequested, setIsPushRequested] = useState(false);
  const { showToast } = useApp();

  const handleEnablePush = async () => {
    setIsPushRequested(true);
    const perm = await requestPushPermission();
    if (perm === 'granted') {
      showToast('Push Notifications Enabled: Real-time alerts active for transfers, KYC decisions, and loans.', 'success');
      // Send welcome test push notification
      await sendWebPushNotification({
        title: 'Lumenfield Sandbox Alerts Active',
        body: 'Web push notifications are now connected for test funds and account activity.',
        type: 'SYSTEM',
      });
    } else {
      showToast('Notification permission was denied in your browser settings.', 'warning');
    }
  };

  const currentPermission = typeof window !== 'undefined' ? getPushPermissionState() : 'default';

  return (
    <div className="flex items-center gap-1.5">
      {/* Push notification enable button if not granted */}
      {currentPermission !== 'granted' && (
        <button
          type="button"
          onClick={handleEnablePush}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0A3D3F] bg-white/80 hover:bg-white border border-[#DCE5E3] rounded-md transition shadow-2xs min-h-[32px] cursor-pointer"
          title="Enable push alerts for transfers, KYC decisions & loans"
          aria-label="Enable Push Notifications"
        >
          <Bell className="w-3.5 h-3.5 text-[#0F766E]" />
          <span className="hidden sm:inline">Push Alerts</span>
        </button>
      )}

      {/* Chromium / Android install prompt */}
      {isInstallable && !isInstalled && (
        <button
          onClick={install}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#F5B942] px-3 py-1 text-xs font-bold text-[#0E1B1F] shadow-xs hover:bg-[#F0D58A] active:scale-95 transition min-h-[32px] cursor-pointer"
          aria-label="Install Lumenfield App as PWA"
        >
          <Download className="w-3.5 h-3.5 text-[#0E1B1F]" />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari prompt */}
      {isIOS && !isInstalled && (
        <>
          <button
            onClick={() => setShowIOSGuide(true)}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE5E3] bg-white px-2.5 py-1 text-xs font-medium text-[#0A3D3F] hover:bg-[#F4F7F6] transition min-h-[32px] cursor-pointer"
            aria-label="Install Lumenfield on iOS Safari"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>

          {showIOSGuide && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-modal-title"
            >
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[#DCE5E3]">
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE5E3]">
                  <h3 id="ios-modal-title" className="text-base font-bold text-[#0E1B1F] font-display">
                    Install Lumenfield on iOS
                  </h3>
                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="rounded-full p-1 text-[#4A5B60] hover:bg-[#F4F7F6] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Close iOS install modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#4A5B60]">
                  1. Tap the <strong className="text-[#0E1B1F]">Share</strong> button (square with arrow) at the bottom of Safari.<br />
                  2. Scroll down and tap <strong className="text-[#0E1B1F]">Add to Home Screen</strong>.<br />
                  3. Tap <strong className="text-[#0E1B1F]">Add</strong> in the top-right corner to launch Lumenfield with offline support.
                </p>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  type="button"
                  className="mt-5 w-full rounded-lg bg-[#0A3D3F] py-2.5 text-xs font-semibold text-white hover:bg-[#072F30] min-h-[44px] cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
