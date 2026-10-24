import React, { useState } from 'react';
import { Copy, Check, Building2 } from 'lucide-react';
import type { MemberBankIdentity } from '../types';

interface Props {
  identity: MemberBankIdentity | null | undefined;
  memberName?: string;
  compact?: boolean;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-[#EDF2F1] last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4A5B60]">
          {label}
        </div>
        <div className="font-mono text-sm text-[#0E1B1F] break-all mt-0.5">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 p-2 rounded-lg border border-[#DCE5E3] hover:bg-[#F4F7F6] text-[#0A3D3F] cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="w-4 h-4 text-[#0A5C47]" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function rowsForIdentity(identity: MemberBankIdentity): Array<{ label: string; value: string }> {
  const d = identity.details;
  const rows: Array<{ label: string; value: string }> = [];

  switch (identity.scheme) {
    case 'US_ABA':
      if (d.routingNumber) rows.push({ label: 'Routing number (ABA)', value: d.routingNumber });
      if (d.accountNumber) rows.push({ label: 'Account number', value: d.accountNumber });
      if (d.accountType) rows.push({ label: 'Account type', value: d.accountType });
      break;
    case 'CA_EFT':
      if (d.institutionNumber) rows.push({ label: 'Institution number', value: d.institutionNumber });
      if (d.transitNumber) rows.push({ label: 'Transit number', value: d.transitNumber });
      if (d.accountNumber) rows.push({ label: 'Account number', value: d.accountNumber });
      break;
    case 'GB_SORT':
      if (d.sortCode) rows.push({ label: 'Sort code', value: d.sortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3') });
      if (d.accountNumber) rows.push({ label: 'Account number', value: d.accountNumber });
      if (d.iban) rows.push({ label: 'IBAN', value: d.iban });
      if (d.bic) rows.push({ label: 'BIC', value: d.bic });
      break;
    case 'AU_BSB':
      if (d.bsb) rows.push({ label: 'BSB', value: d.bsb });
      if (d.accountNumber) rows.push({ label: 'Account number', value: d.accountNumber });
      break;
    case 'NZ_ACCOUNT':
      rows.push({ label: 'Account number', value: d.primary });
      break;
    case 'MX_CLABE':
      rows.push({ label: 'CLABE', value: d.clabe || d.primary });
      break;
    case 'IN_IFSC':
      if (d.ifsc) rows.push({ label: 'IFSC', value: d.ifsc });
      if (d.accountNumber) rows.push({ label: 'Account number', value: d.accountNumber });
      break;
    case 'JP_ZENGIN':
      if (d.bankCode) rows.push({ label: 'Bank code', value: d.bankCode });
      if (d.branchCode) rows.push({ label: 'Branch code', value: d.branchCode });
      if (d.accountNumber) rows.push({ label: 'Account number', value: d.accountNumber });
      break;
    case 'IBAN':
      rows.push({ label: 'IBAN', value: identity.accountNumberDisplay || d.primary });
      if (d.bic) rows.push({ label: 'BIC / SWIFT', value: d.bic });
      break;
    default:
      rows.push({ label: 'Account reference', value: identity.accountNumberDisplay || d.primary });
      break;
  }

  if (rows.length === 0) {
    rows.push({ label: 'Account', value: identity.accountNumberDisplay || d.primary });
  }
  return rows;
}

export const BankDepositDetails: React.FC<Props> = ({ identity, memberName, compact }) => {
  if (!identity) {
    return (
      <div className="bg-white border border-[#DCE5E3] rounded-3xl p-6 text-sm text-[#4A5B60]">
        Account deposit details will appear after registration completes.
      </div>
    );
  }

  const rows = rowsForIdentity(identity);

  return (
    <div
      className={`bg-white border border-[#DCE5E3] shadow-xs ${
        compact ? 'rounded-2xl p-5' : 'rounded-3xl p-7'
      } flex flex-col gap-4`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-[#0F766E]" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-[#0E1B1F]">Your account details</h3>
          <p className="text-sm text-[#4A5B60] mt-0.5">
            Country-format deposit credentials for {memberName || 'your'} Lumenfield wallet
            {identity.details.countryCode ? ` (${identity.details.countryCode})` : ''}.
            Sandbox non-routable — for platform identification and simulated deposits.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#DCE5E3] bg-[#F4F7F6]/60 px-4">
        {rows.map((row) => (
          <CopyRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="text-[11px] text-[#8FA5A3]">
        Scheme: <span className="font-mono font-semibold text-[#4A5B60]">{identity.scheme}</span>
        {' · '}
        Lookup ID:{' '}
        <span className="font-mono font-semibold text-[#4A5B60]">
          {identity.accountNumberDisplay}
        </span>
      </div>
    </div>
  );
};
