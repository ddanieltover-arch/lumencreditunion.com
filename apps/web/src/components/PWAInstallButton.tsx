import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { t } from '../translations';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-[#F5B942] px-3.5 py-2 text-xs md:text-sm font-semibold text-[#0E1B1F] shadow-xs hover:bg-[#F0D58A] active:scale-95 transition min-h-[44px] min-w-[44px] cursor-pointer"
        aria-label="Install Lumenfield App"
      >
        <Download className="w-4 h-4 text-[#0E1B1F]" />
        <span>{t('nav.installApp')}</span>
      </button>
    );
  }

  // iOS Safari prompt (WebKit beforeinstallprompt fallback)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE5E3] bg-white px-3 py-1.5 text-xs font-medium text-[#0A3D3F] hover:bg-[#F4F7F6] transition min-h-[44px] cursor-pointer"
          aria-label="Install app instructions on iOS Safari"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>iOS Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[#DCE5E3]">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE5E3]">
                <h3 className="text-base font-bold text-[#0E1B1F] font-display">Install Lumenfield on iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-full p-1 text-[#4A5B60] hover:bg-[#F4F7F6] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#4A5B60]">
                1. Tap the <strong className="text-[#0E1B1F]">Share</strong> button (square with arrow) at the bottom of Safari.<br />
                2. Scroll down and tap <strong className="text-[#0E1B1F]">Add to Home Screen</strong>.<br />
                3. Tap <strong className="text-[#0E1B1F]">Add</strong> in the top-right corner.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                type="button"
                className="mt-5 w-full rounded-lg bg-[#0A3D3F] py-2.5 text-xs font-semibold text-white hover:bg-[#072F30] min-h-[44px] cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
