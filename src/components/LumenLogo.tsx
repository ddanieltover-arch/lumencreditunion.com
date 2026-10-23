import React from 'react';

interface LumenLogoProps {
  size?: number;
  textColor?: string;
  showText?: boolean;
  adminBadge?: boolean;
  className?: string;
}

export const LumenLogo: React.FC<LumenLogoProps> = ({
  size = 32,
  textColor = '#FFFFFF',
  showText = true,
  adminBadge = false,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* SVG Emblem from design */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="15" fill="#F5B942" />
        <path
          d="M6 22 C 11 12, 21 12, 26 22"
          stroke="#0A3D3F"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="13" r="3" fill="#0A3D3F" />
      </svg>

      {showText && (
        <span
          className="font-display font-bold tracking-tight select-none flex items-center gap-2"
          style={{ color: textColor, fontSize: size * 0.68 }}
        >
          Lumenfield
          {adminBadge && (
            <span className="text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-[#F5B942] text-[#0E1B1F] font-bold">
              ADMIN
            </span>
          )}
        </span>
      )}
    </div>
  );
};
