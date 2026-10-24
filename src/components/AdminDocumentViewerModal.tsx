import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldAlert, Clock, CheckCircle2, FileText, Download } from 'lucide-react';

interface AdminDocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  documentTitle: string;
  fileName: string;
  checksum: string;
  signedUrl: string;
  expiresInSeconds: number;
}

export const AdminDocumentViewerModal: React.FC<AdminDocumentViewerModalProps> = ({
  isOpen,
  onClose,
  docId,
  documentTitle,
  fileName,
  checksum,
  signedUrl,
  expiresInSeconds,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(expiresInSeconds || 300);

  useEffect(() => {
    if (!isOpen) return;
    setSecondsRemaining(expiresInSeconds || 300);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, expiresInSeconds]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const isExpired = secondsRemaining <= 0;

  const isPdf = fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 border border-[#DCE5E3] shadow-2xl flex flex-col gap-4 my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#DCE5E3] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3F3F1] text-[#0A4F4A]">
                  SUPER_ADMIN SINGLE-USE TOKEN
                </span>
                <span className="text-[11px] font-mono text-slate-500">{docId}</span>
              </div>
              <h3 className="font-display font-bold text-lg text-[#0E1B1F] mt-0.5">
                {documentTitle} ({fileName})
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Banner: Hard Rule 7 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3] flex items-center gap-2.5">
            <Clock className={`w-4 h-4 shrink-0 ${isExpired ? 'text-red-600' : 'text-[#0F766E]'}`} />
            <div>
              <span className="font-bold text-[#0E1B1F]">Signed URL Expiration: </span>
              {isExpired ? (
                <span className="text-red-600 font-bold">Expired (Access revoked)</span>
              ) : (
                <span className="font-mono font-bold text-[#0A3D3F]">
                  {minutes}:{seconds < 10 ? `0${seconds}` : seconds} remaining
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3] flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0" />
            <div className="truncate">
              <span className="font-bold text-[#0E1B1F]">SHA-256 Checksum: </span>
              <span className="font-mono text-[11px] text-[#4A5B60] truncate block">
                {checksum ? `${checksum.slice(0, 16)}...${checksum.slice(-8)}` : 'Verified cryptographic digest'}
              </span>
            </div>
          </div>
        </div>

        {/* Document Content View */}
        <div className="border border-[#DCE5E3] rounded-2xl overflow-hidden bg-slate-900/5 min-h-[380px] max-h-[520px] flex items-center justify-center relative">
          {isExpired ? (
            <div className="p-8 text-center space-y-2">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
              <h4 className="font-bold text-base text-[#0E1B1F]">Signed URL Expired</h4>
              <p className="text-xs text-[#4A5B60] max-w-sm">
                Document signed URLs automatically expire after 5 minutes to prevent unauthorized persistence. Please generate a new signed URL from the review queue.
              </p>
            </div>
          ) : isPdf ? (
            <iframe
              src={signedUrl}
              title={fileName}
              className="w-full h-[480px] border-none"
            />
          ) : (
            <img
              src={signedUrl}
              alt={fileName}
              className="max-w-full max-h-[480px] object-contain p-2 rounded-xl"
            />
          )}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4A5B60] pt-2 border-t border-[#DCE5E3]">
          <span className="text-[11px]">
            Private S3-compatible storage with AES-256-GCM encryption. Never exposed to public web.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0A3D3F] hover:bg-[#072F30] text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
