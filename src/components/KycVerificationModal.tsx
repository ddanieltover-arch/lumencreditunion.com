import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { KycDocumentType, SubmitKycInput } from '../types';
import {
  X,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Lock,
  Globe,
  FileCheck,
  Eye,
} from 'lucide-react';

interface FileUploadState {
  file: File | null;
  base64: string;
  previewUrl: string | null;
  error: string | null;
}

export const KycVerificationModal: React.FC = () => {
  const {
    isKycModalOpen,
    closeKycModal,
    activeMember,
    countries,
    submitKycVerification,
    showToast,
    kycSubmission,
  } = useApp();

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(
    activeMember.countryCode || 'US'
  );
  const [selectedDocType, setSelectedDocType] = useState<KycDocumentType>('PASSPORT');
  const [frontDoc, setFrontDoc] = useState<FileUploadState>({
    file: null,
    base64: '',
    previewUrl: null,
    error: null,
  });
  const [backDoc, setBackDoc] = useState<FileUploadState>({
    file: null,
    base64: '',
    previewUrl: null,
    error: null,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Sync country code when active member changes
  useEffect(() => {
    if (activeMember?.countryCode) {
      setSelectedCountryCode(activeMember.countryCode);
    }
  }, [activeMember]);

  if (!isKycModalOpen) return null;

  // Find country details from data-driven countries table
  const selectedCountry =
    countries.find((c) => c.code === selectedCountryCode.toUpperCase()) || countries[0];

  const isSanctioned = selectedCountry?.isSanctioned || false;

  // Determine accepted document types for chosen country
  const acceptedTypes: KycDocumentType[] = (selectedCountry?.acceptedIdTypes || [
    'PASSPORT',
    'DRIVERS_LICENSE',
    'ID_CARD',
    'RESIDENCE_PERMIT',
  ]) as KycDocumentType[];

  // Max 10 MB limit as specified in task requirements
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: 'front' | 'back'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      const err = `File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds 10 MB maximum limit.`;
      if (side === 'front') {
        setFrontDoc((prev) => ({ ...prev, error: err }));
      } else {
        setBackDoc((prev) => ({ ...prev, error: err }));
      }
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const err = 'Invalid file format. Please upload PDF, JPEG, PNG, or WEBP.';
      if (side === 'front') {
        setFrontDoc((prev) => ({ ...prev, error: err }));
      } else {
        setBackDoc((prev) => ({ ...prev, error: err }));
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null;

      if (side === 'front') {
        setFrontDoc({ file, base64, previewUrl, error: null });
      } else {
        setBackDoc({ file, base64, previewUrl, error: null });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSampleFill = (type: KycDocumentType) => {
    // Generate valid sample PDF base64 for fast sandbox verification testing
    const sampleBuffer = `%PDF-1.4\n1 0 obj\n<< /Title (${selectedCountry?.name || 'US'} ${type} Test Scan) /Author (Lumenfield Sandbox) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    const base64 = `data:application/pdf;base64,${btoa(sampleBuffer)}`;
    const sampleFile = new File([sampleBuffer], `${type.toLowerCase()}_sample_test_scan.pdf`, {
      type: 'application/pdf',
    });

    setFrontDoc({
      file: sampleFile,
      base64,
      previewUrl: null,
      error: null,
    });
    showToast(`Loaded clean sample test scan for ${type}.`, 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (isSanctioned) {
      setSubmissionError(
        `Sanctioned Jurisdiction: Identity verification is prohibited in '${selectedCountry?.name}' under economic sanctions compliance.`
      );
      return;
    }

    if (!frontDoc.file || !frontDoc.base64) {
      setSubmissionError('Please select a front/photo-page document file to upload.');
      return;
    }

    setIsSubmitting(true);

    try {
      const docsToUpload: SubmitKycInput['documents'] = [
        {
          fileName: frontDoc.file.name,
          mimeType: frontDoc.file.type as any,
          fileBase64: frontDoc.base64,
          side: 'FRONT',
        },
      ];

      if (backDoc.file && backDoc.base64) {
        docsToUpload.push({
          fileName: backDoc.file.name,
          mimeType: backDoc.file.type as any,
          fileBase64: backDoc.base64,
          side: 'BACK',
        });
      }

      await submitKycVerification({
        countryCode: selectedCountryCode.toUpperCase(),
        documentType: selectedDocType,
        documents: docsToUpload,
      });

      showToast(
        'Identity verification submitted! Stored in encrypted storage and awaiting administrator review.',
        'success'
      );
      closeKycModal();
    } catch (err: any) {
      setSubmissionError(err.message || 'Submission failed. Please check file format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5 my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#DCE5E3] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                Member Compliance
              </span>
              <h2 className="font-display font-bold text-xl text-[#0E1B1F]">
                Identity Verification (KYC)
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={closeKycModal}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Callout */}
        <div className="p-3.5 bg-[#F4F7F6] rounded-2xl border border-[#DCE5E3] text-xs text-[#4A5B60] flex items-start gap-3">
          <Lock className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Server-Side Encryption:</strong> Documents are AES-256-GCM encrypted and stored in a private bucket. Super Administrators access files solely through expiring short-lived signed URLs. Raw URLs and storage keys are never exposed.
          </p>
        </div>

        {submissionError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{submissionError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 1. Country Selection */}
          <div>
            <label className="text-xs font-bold text-[#0E1B1F] flex items-center justify-between mb-1.5">
              <span>1. Choose Country of Issuance</span>
              <span className="text-[#0F766E] font-normal text-[11px]">
                Data-driven country rules
              </span>
            </label>
            <div className="relative">
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setSelectedCountryCode(code);
                  const country = countries.find((c) => c.code === code);
                  if (country?.acceptedIdTypes?.[0]) {
                    setSelectedDocType(country.acceptedIdTypes[0] as KycDocumentType);
                  }
                }}
                className="w-full p-3 pl-3.5 pr-10 border border-[#BCCAC8] rounded-xl text-sm font-semibold bg-white text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F]/20 cursor-pointer"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code}) {c.isSanctioned ? '— [Sanctioned Jurisdiction]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Country Status & Accepted Document Types */}
            {isSanctioned ? (
              <div className="mt-2 p-2.5 bg-red-100/70 border border-red-300 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  <strong>Blocked Jurisdiction:</strong> {selectedCountry?.sanctionReason || 'Under international economic sanctions'}.
                </span>
              </div>
            ) : (
              <div className="mt-2 p-2.5 bg-[#E3F3F1] rounded-xl text-xs text-[#0A4F4A] flex flex-wrap items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                <span className="font-semibold">Accepted in {selectedCountry?.name}:</span>
                {acceptedTypes.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 bg-white border border-[#B8D4D2] rounded-md text-[11px] font-bold text-[#0A3D3F]"
                  >
                    {t.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 2. Document Type */}
          <div>
            <label className="text-xs font-bold text-[#0E1B1F] block mb-1.5">
              2. Document Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'PASSPORT' as KycDocumentType, label: 'Passport', icon: FileCheck },
                { type: 'DRIVERS_LICENSE' as KycDocumentType, label: 'Driver License', icon: FileText },
                { type: 'ID_CARD' as KycDocumentType, label: 'National ID Card', icon: FileText },
                { type: 'RESIDENCE_PERMIT' as KycDocumentType, label: 'Residence Permit', icon: FileCheck },
              ]
                .filter((item) => acceptedTypes.includes(item.type))
                .map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedDocType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setSelectedDocType(item.type)}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                        isSelected
                          ? 'border-[#0A3D3F] bg-[#0A3D3F]/5 text-[#0A3D3F] font-bold shadow-xs'
                          : 'border-[#DCE5E3] bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-[#0A3D3F]' : 'text-slate-400'}`} />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* 3. Front Document Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#0E1B1F]">
                3. Front / Bio Page File (PDF, JPG, PNG, WEBP · Max 10 MB)
              </label>
              <button
                type="button"
                onClick={() => handleSampleFill(selectedDocType)}
                className="text-[11px] text-[#0F766E] font-semibold hover:underline cursor-pointer"
              >
                + Fill Sample Sandbox Scan
              </button>
            </div>

            <label className="border-2 border-dashed border-[#BCCAC8] hover:border-[#0A3D3F] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-[#F4F7F6]/60 hover:bg-[#F4F7F6] transition cursor-pointer text-center relative min-h-[100px]">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, 'front')}
                className="sr-only"
              />
              {frontDoc.file ? (
                <div className="flex items-center gap-3 text-left w-full px-2">
                  <div className="w-9 h-9 rounded-xl bg-[#0A3D3F] text-white flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5 text-[#F5B942]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[#0E1B1F] truncate">
                      {frontDoc.file.name}
                    </div>
                    <div className="text-[11px] text-[#4A5B60]">
                      {(frontDoc.file.size / 1024).toFixed(0)} KB · {frontDoc.file.type || 'Document'} · Front Page Ready
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[#0A5C47] shrink-0" />
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-[#0F766E]" />
                  <span className="text-xs font-semibold text-slate-700">
                    Click or drop document front scan here
                  </span>
                  <span className="text-[11px] text-slate-500">
                    PDF, JPEG, PNG, or WEBP up to 10 MB
                  </span>
                </>
              )}
            </label>
            {frontDoc.error && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{frontDoc.error}</p>
            )}
          </div>

          {/* 4. Optional Back Document Upload */}
          <div>
            <label className="text-xs font-semibold text-[#4A5B60] block mb-1.5">
              4. Reverse Side (Optional: recommended for ID card or Driver License)
            </label>
            <label className="border border-dashed border-[#DCE5E3] hover:border-[#BCCAC8] rounded-2xl p-3 flex items-center justify-between gap-3 bg-[#F4F7F6]/40 hover:bg-[#F4F7F6] transition cursor-pointer">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, 'back')}
                className="sr-only"
              />
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">
                  {backDoc.file ? backDoc.file.name : 'Attach document back side (optional)'}
                </span>
              </div>
              {backDoc.file && (
                <span className="text-[11px] font-semibold text-[#0A5C47]">
                  {(backDoc.file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </label>
            {backDoc.error && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{backDoc.error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-[#DCE5E3]">
            <button
              type="submit"
              disabled={isSubmitting || isSanctioned || !frontDoc.file}
              className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm text-white transition flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[46px] ${
                isSubmitting || isSanctioned || !frontDoc.file
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-[#0A3D3F] hover:bg-[#072F30]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Encrypting & Uploading...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#F5B942]" />
                  <span>Submit for Administrator Review</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={closeKycModal}
              disabled={isSubmitting}
              className="px-5 py-3 rounded-xl border border-[#BCCAC8] text-xs font-semibold hover:bg-slate-50 cursor-pointer min-h-[46px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
