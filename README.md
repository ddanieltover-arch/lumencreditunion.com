# Lumenfield Credit Union

[![CI Validation](https://github.com/lumenfield/platform/actions/workflows/ci.yml/badge.svg)](https://github.com/lumenfield/platform/actions)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-0A3D3F.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Security Headers](https://img.shields.io/badge/Security-A%2B%20CSP%20%26%20HSTS-0F766E.svg)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-F5B942.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)

Lumenfield Credit Union provides digital member banking for the USA, Canada, United Kingdom, and European Union — multi-currency wallets, transfers, virtual cards, and loans.

---

## 1. Executive Overview

Lumenfield provides a full-featured digital wallet, instant multi-currency accounts (USD, CAD, GBP, EUR), member-to-member transfers, virtual debit card issuance, auto and mortgage loan underwriting, and double-entry ledger administration.

### Platform Rules
1. **Integer Minor Units**: All monetary values are strictly represented as integers in minor units (e.g., cents, pence) accompanied by standard ISO-4217 currency codes. Floating point arithmetic is forbidden.
2. **Immutable Double-Entry Ledger**: Every balance adjustment creates balanced debit and credit entries in `ledger_transactions` and `ledger_entries`. Ledger rows cannot be updated or deleted; errors are corrected exclusively via explicit reversing entries.
3. **Strict Server-Side Roles Guard**: Rigid role separation between `MEMBER` and `SUPER_ADMIN`. Every administrative endpoint enforces server-side role validation, rejecting unprivileged requests with `HTTP 403 Forbidden`.
4. **Immutable Audit Trail**: Every administrative action writes an `audit_logs` record containing actor, action, target, before/after state snapshots, client IP address, and UTC timestamp.
5. **Private Document Storage**: Identity documents (KYC) are encrypted with AES-256-GCM and stored in private buckets. Documents are accessed exclusively via short-lived (5-minute) signed URLs by Super Administrators.
6. **Countries as Data**: Jurisdiction configuration (currency, KYC document rules, loan eligibility, and sanctions screening) is driven dynamically by the `countries` table. Sanctioned jurisdictions are strictly blocked.
7. **Internationalization Ready**: All user-facing copy is decoupled into centralized translation dictionaries (`apps/web/src/translations/`).

---

## 2. Progressive Web App (PWA) Features

Lumenfield is designed as a web-only Progressive Web App meeting Google Lighthouse standards:
- **Web App Manifest (`/public/manifest.json`)**: Configured with `id: "/"`, `start_url: "/"`, `display: "standalone"`, `theme_color: "#0A3D3F"`, and comprehensive high-resolution icons (192px, 512px, maskable with 15% safe padding, and iOS Safari PNG `apple-touch-icon.png`).
- **Service Worker (`/public/sw.js`)**:
  - Offline App Shell precaching for instant startup.
  - Friendly offline fallback page (`/public/offline.html`) with automatic reconnection handler.
  - Cache-first strategy for static font assets and stale-while-revalidate for application assets.
  - Full Web Push event listeners (`push` and `notificationclick`) routing directly to relevant transaction and decision views.
- **In-App Install Prompt (`PWAInstallButton`)**: Seamless installation flow on Android, Chromium, macOS, Windows, and guided instructions for iOS Safari.
- **Web Push Notifications**: Real-time push notifications for:
  - Outgoing and incoming member transfers.
  - Identity verification (KYC) approvals and rejection notices.
  - Loan underwriting decisions and disbursement alerts.
  - Dedicated interactive Push Notification test trigger panel in Member Settings.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend API**: Express & NestJS architecture, Zod validation pipes, rate limiters, security headers, CSRF middleware.
- **Ledger Engine**: Immutable double-entry general ledger with zero-sum invariant verification and self-healing reconciliation.
- **Security & Auth**: Argon2id password hashing, JWT access tokens (15m expiry) with refresh token rotation and replay revocation, TOTP Multi-Factor Authentication (RFC 6238), and emergency recovery codes.
- **Data & Privacy**: GDPR Article 15 / CCPA data subject access export (JSON download), GDPR Article 17 right-to-erasure account deletion flow with 30-day statutory holding period.

---

## 4. Getting Started & Development

### Installation & Run
```bash
# Install dependencies
pnpm install

# Run full-stack dev server (API + Vite frontend on port 3000)
npm run dev

# Run test suite & End-to-End user journeys
npm run test

# Type checking & linting
npm run typecheck
npm run lint

# Production build
npm run build
```

---

## 5. Pre-Production Transition Checklist

> **CRITICAL**: The following milestones MUST be formally completed and audited before `PRODUCTION_MODE=true` can be enabled or real monetary balances accepted:

1. **Banking Charter & Regulatory Licensing**:
   - Obtain formal Federal (OCC/Fed) or State banking charter, or Credit Union charter (NCUA).
   - In lieu of a direct charter, execute a binding BaaS agreement with a chartered sponsor bank (e.g., Evolve Bank & Trust, Cross River, or The Bancorp).
   - Secure Money Transmitter Licenses (MTL) across all 50 US states, FinCEN MSB registration, UK FCA Electronic Money Institution (EMI) authorization, and Canadian FINTRAC MSB registration.
2. **Partner Bank & Pass-Through Insurance**:
   - Establish For-Benefit-Of (FBO) depository accounts at the partner bank to hold client funds.
   - Configure FDIC / FSCS pass-through deposit insurance agreements.
3. **Production KYC/AML & Sanctions Screening**:
   - Connect an accredited identity verification vendor (e.g., Persona, Veriff, Alloy, or Socure).
   - Implement real-time OFAC, PEP, and EU/UK consolidated watchlist screening via automated webhooks.
   - Deploy automated liveness biometrics and document tamper detection.
4. **Real Payment Rails Integration**:
   - US Domestic: FedNow, RTP (The Clearing House), and Nacha Direct ACH debit/credit origination via bank sponsor.
   - International: Fedwire, SEPA Instant Credit Transfer (EU), Faster Payments / Bacs (UK), and Interac e-Transfer (Canada).
   - Card Issuing: Certified PCI-DSS Level 1 processor integration (e.g., Marqeta, Galileo, Stripe Issuing).
5. **Independent Legal & Compliance Review**:
   - Replace placeholder terms and draft privacy policies with agreements drafted by regulated financial services counsel.
   - Complete formal consumer lending disclosures (Truth in Lending Act / Regulation Z, Equal Credit Opportunity Act / Regulation B).
6. **Third-Party Security Audit & SOC 2 Certification**:
   - Conduct external black-box and white-box penetration testing by a CREST-accredited firm.
   - Obtain an independent SOC 2 Type II compliance audit report.
