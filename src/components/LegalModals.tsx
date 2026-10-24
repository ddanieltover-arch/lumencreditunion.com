import React from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ModalMotion } from '../motion';

export const LegalModals: React.FC = () => {
  const {
    isTermsModalOpen,
    closeTermsModal,
    isPrivacyModalOpen,
    closePrivacyModal,
    exportPersonalData,
    requestAccountDeletion,
  } = useApp();

  return (
    <>
      {/* ── TERMS OF SERVICE MODAL ── */}
      <ModalMotion
        open={isTermsModalOpen}
        onClose={closeTermsModal}
        labelledBy="terms-title"
        panelClassName="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#DCE5E3] overflow-hidden"
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE5E3] bg-[#F4F7F6]">
              <div>
                <h2 id="terms-title" className="text-xl font-bold font-display text-[#0E1B1F]">
                  Lumenfield Credit Union Terms of Service
                </h2>
              </div>
              <button
                type="button"
                onClick={closeTermsModal}
                className="rounded-full p-2 text-[#4A5B60] hover:bg-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition"
                aria-label="Close Terms of Service modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm text-[#0E1B1F] leading-relaxed">
              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">1. Acceptance of Terms</h3>
                <p className="text-xs text-[#4A5B60]">
                  By accessing the Lumenfield Credit Union website or Progressive Web App (PWA), you agree to these Terms of Service and to use our digital banking services in accordance with applicable law and membership eligibility requirements.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">2. Double-Entry Ledger &amp; Transaction Records</h3>
                <p className="text-xs text-[#4A5B60]">
                  All transactions within Lumenfield are recorded in an immutable double-entry ledger. Entries are never deleted; corrections or rollbacks are executed solely as explicit reversing entries with dual-actor audit logs.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">3. Virtual Cards</h3>
                <p className="text-xs text-[#4A5B60]">
                  Virtual cards issued by Lumenfield may be used for eligible purchases subject to your spending limits. Full card numbers and CVVs are displayed once upon creation and are never stored in plaintext by the platform.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">4. Role-Based Access &amp; Security</h3>
                <p className="text-xs text-[#4A5B60]">
                  The platform enforces strict role-based authorization (MEMBER and SUPER_ADMIN). Super Administrator privileges are protected by mandatory multi-factor authentication (TOTP) and session rotation controls.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#DCE5E3] bg-[#F4F7F6] flex justify-end">
              <button
                type="button"
                onClick={closeTermsModal}
                className="px-6 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#072F30] text-white font-semibold text-sm transition min-h-[44px] cursor-pointer"
              >
                Close Terms
              </button>
            </div>
      </ModalMotion>

      {/* ── PRIVACY POLICY MODAL ── */}
      <ModalMotion
        open={isPrivacyModalOpen}
        onClose={closePrivacyModal}
        labelledBy="privacy-title"
        panelClassName="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#DCE5E3] overflow-hidden"
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE5E3] bg-[#F4F7F6]">
              <div>
                <h2 id="privacy-title" className="text-xl font-bold font-display text-[#0E1B1F]">
                  Lumenfield Privacy Policy &amp; Data Rights
                </h2>
              </div>
              <button
                type="button"
                onClick={closePrivacyModal}
                className="rounded-full p-2 text-[#4A5B60] hover:bg-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition"
                aria-label="Close Privacy Policy modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm text-[#0E1B1F] leading-relaxed">
              <div className="p-4 rounded-xl bg-[#F4F7F6] border border-[#DCE5E3]">
                <h3 className="font-bold text-[#0A3D3F] mb-1">GDPR &amp; CCPA Data Controller Notice</h3>
                <p className="text-xs text-[#4A5B60]">
                  Lumenfield Credit Union processes personal data to provide member banking services, identity verification, and regulatory compliance. We respect your statutory rights to access, export, and delete your personal information.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">1. Information We Collect</h3>
                <ul className="list-disc pl-5 text-xs text-[#4A5B60] space-y-1">
                  <li><strong>Account Profile:</strong> Name, email address, country of residence, and member ID.</li>
                  <li><strong>Security Credentials:</strong> Argon2id password hashes, TOTP secret tokens, session families.</li>
                  <li><strong>Identity Documents (KYC):</strong> AES-256 encrypted ID scans stored in private non-public storage.</li>
                  <li><strong>Audit Trails:</strong> IP address, user-agent, action timestamp, and ledger balance movements.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">2. Private Document Storage &amp; Encryption</h3>
                <p className="text-xs text-[#4A5B60]">
                  Identity documents uploaded during KYC verification are encrypted with server-side keys and stored in a private bucket. Documents can only be reviewed by authorized Super Administrators via short-lived signed URLs (15-minute expiration) and are never accessible via public URLs or to other members.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base text-[#0A3D3F] mb-1">3. Your Data Rights (GDPR Articles 15-22 &amp; CCPA)</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#F4F7F6] border border-[#DCE5E3]">
                    <div>
                      <span className="font-semibold text-xs block text-[#0E1B1F]">Right of Access &amp; Portability</span>
                      <span className="text-[11px] text-[#4A5B60]">Download a machine-readable JSON archive of all your personal data.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportPersonalData();
                        closePrivacyModal();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A3D3F] hover:bg-[#072F30] text-white text-xs font-semibold cursor-pointer transition min-h-[36px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Data</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#FDF2F2] border border-[#D9383A]/20">
                    <div>
                      <span className="font-semibold text-xs block text-[#D9383A]">Right to Erasure (Forget Me)</span>
                      <span className="text-[11px] text-[#4A5B60]">Request permanent purge of your identity records and deactivation.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const confirm = window.confirm(
                          'Are you sure you want to request permanent account deletion under GDPR/CCPA?'
                        );
                        if (confirm) {
                          requestAccountDeletion('Member exercised GDPR right to erasure');
                          closePrivacyModal();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D9383A] hover:bg-[#B32628] text-white text-xs font-semibold cursor-pointer transition min-h-[36px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Request Erasure</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#DCE5E3] bg-[#F4F7F6] flex justify-end">
              <button
                type="button"
                onClick={closePrivacyModal}
                className="px-6 py-2.5 rounded-xl bg-[#0A3D3F] hover:bg-[#072F30] text-white font-semibold text-sm transition min-h-[44px] cursor-pointer"
              >
                Close Privacy Policy
              </button>
            </div>
      </ModalMotion>
    </>
  );
};
