import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LumenLogo } from './LumenLogo';
import { DrawerMotion } from '../motion';
import { PUBLIC_NAV_LINKS, SITE_CONTACT } from '../data/siteContact';
import { Menu, X } from 'lucide-react';

interface PublicChromeProps {
  children: React.ReactNode;
  /** When true, hash links go home first then scroll (used on /contact). */
  resolveHashesViaHome?: boolean;
}

export const PublicChrome: React.FC<PublicChromeProps> = ({
  children,
  resolveHashesViaHome = false,
}) => {
  const {
    currentUser,
    setCurrentView,
    openAuthModal,
    openTermsModal,
    openPrivacyModal,
    logoutUser,
  } = useApp();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileNavOpen]);

  const goHome = () => {
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    kind: 'hash' | 'route',
  ) => {
    if (kind === 'route') {
      e.preventDefault();
      setMobileNavOpen(false);
      setCurrentView('contact');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (resolveHashesViaHome) {
      e.preventDefault();
      setMobileNavOpen(false);
      setCurrentView('landing');
      window.setTimeout(() => {
        const id = href.replace('#', '');
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      setMobileNavOpen(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F4F7F6] text-[#0E1B1F] flex flex-col font-sans selection:bg-[#F5B942]/30 selection:text-[#0A3D3F]">
      <header className="w-full bg-[#0E1B1F]/95 text-white border-b border-white/10 sticky top-0 z-40 backdrop-blur-md supports-[backdrop-filter]:bg-[#0E1B1F]/90">
        <div className="hidden md:block">
          <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <button
              type="button"
              onClick={goHome}
              className="hover:opacity-90 transition-opacity cursor-pointer"
              aria-label="Lumenfield home"
            >
              <LumenLogo size={34} textColor="#FFFFFF" />
            </button>

            <nav
              aria-label="Public navigation"
              className="flex items-center gap-7 text-[15px] font-medium"
            >
              {PUBLIC_NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href, link.kind)}
                  className="text-[#D6E8E6] hover:text-white transition-colors py-2"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => void logoutUser()}
                  className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[10px] bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] transition-all font-semibold text-[15px] shadow-sm cursor-pointer"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[10px] border border-[#5E9A97] text-white hover:bg-[#0A3D3F] transition-all font-semibold text-[15px] cursor-pointer"
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[10px] bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] transition-all font-semibold text-[15px] shadow-sm cursor-pointer"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <div className="px-4 h-14 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goHome}
              className="hover:opacity-90 transition-opacity min-h-[44px] flex items-center cursor-pointer"
              aria-label="Lumenfield home"
            >
              <LumenLogo size={28} textColor="#FFFFFF" />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <DrawerMotion open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/10">
          <LumenLogo size={26} textColor="#FFFFFF" />
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-[#D6E8E6] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {PUBLIC_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href, link.kind)}
                  className="flex items-center min-h-[48px] px-4 rounded-xl text-[15px] font-medium text-[#D6E8E6] hover:text-white hover:bg-white/10 transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 border-t border-white/10 flex flex-col gap-2.5">
          {currentUser ? (
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                logoutUser();
              }}
              className="w-full inline-flex items-center justify-center min-h-[48px] px-5 rounded-xl bg-[#F5B942] text-[#0E1B1F] font-semibold text-[15px] cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  openAuthModal('register');
                }}
                className="w-full inline-flex items-center justify-center min-h-[48px] px-5 rounded-xl bg-[#F5B942] text-[#0E1B1F] font-semibold text-[15px] cursor-pointer"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  openAuthModal('login');
                }}
                className="w-full inline-flex items-center justify-center min-h-[48px] px-5 rounded-xl border border-[#5E9A97] text-white font-semibold text-[15px] cursor-pointer"
              >
                Log in
              </button>
            </>
          )}
        </div>
      </DrawerMotion>

      <div className="flex-1 flex flex-col">{children}</div>

      <footer className="mt-auto py-10 px-6 bg-[#0E1B1F] text-[#B9C7C6] border-t border-[#0A3D3F]">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
          <div className="flex flex-wrap justify-between items-center gap-6">
            <button
              type="button"
              onClick={goHome}
              className="hover:opacity-90 transition-opacity cursor-pointer"
              aria-label="Lumenfield home"
            >
              <LumenLogo size={28} textColor="#FFFFFF" />
            </button>

            <div className="flex flex-wrap items-center gap-6 text-sm">
              <a
                href={resolveHashesViaHome ? '/#services' : '#services'}
                onClick={(e) => handleNavClick(e, '#services', 'hash')}
                className="hover:text-white transition-colors"
              >
                Services
              </a>
              <a
                href={resolveHashesViaHome ? '/#security' : '#security'}
                onClick={(e) => handleNavClick(e, '#security', 'hash')}
                className="hover:text-white transition-colors"
              >
                Security
              </a>
              <button
                type="button"
                onClick={() => {
                  setCurrentView('contact');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={openPrivacyModal}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={openTermsModal}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-[13px] text-[#8FA5A3]">
            <p className="leading-relaxed max-w-3xl">
              {SITE_CONTACT.brandName} — digital member banking services for the USA, Canada, UK, and Europe.
            </p>
            <a
              href={`mailto:${SITE_CONTACT.supportEmail}`}
              className="hover:text-white transition-colors sm:text-right"
            >
              {SITE_CONTACT.supportEmail}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
