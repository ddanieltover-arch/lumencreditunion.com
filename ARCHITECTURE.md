# Lumenfield Architecture & Technical Specifications

This document outlines the system architecture, security invariants, double-entry ledger design, and compliance rules of the **Lumenfield Private Financial Sandbox & Lending Platform**.

---

## 1. System Overview & Monorepo Layout

Lumenfield is structured as a TypeScript monorepo with Turborepo orchestration:

```
├── apps/
│   ├── api/                     # Express & NestJS REST API with Zod validation
│   │   ├── src/
│   │   │   ├── audit/          # Compliance audit trail service
│   │   │   ├── auth/           # Argon2id, JWT rotation, TOTP MFA
│   │   │   ├── cards/          # Virtual card engine & limits enforcement
│   │   │   ├── common/         # Guards (Roles, KYC), pipes, middleware
│   │   │   ├── config/         # Environment & safety flag configuration
│   │   │   ├── countries/      # Jurisdiction and sanctions rules
│   │   │   ├── kyc/            # Private document storage & review queue
│   │   │   ├── ledger/         # Immutable double-entry ledger engine
│   │   │   ├── transfers/      # P2P, bank, and crypto transfer rails
│   │   │   └── main.ts         # API entrypoint
│   │   └── tests/              # Vitest comprehensive unit & e2e suites
│   └── web/                    # Next.js App Router & translations dictionary
├── packages/
│   ├── db/                     # Prisma schema, migrations & country seed data
│   └── shared/                 # Shared Zod validation schemas & Money types
├── public/                     # PWA assets (manifest, sw.js, offline.html, icons)
├── server.ts                   # Unified dev/production full-stack HTTP entrypoint
└── src/                        # React 19 Frontend SPA (PWA client application)
```

---

## 2. Immutable Double-Entry Ledger Design

### A. Fundamental Rules
1. **Integer Minor Units**: Monies are strictly stored as integer minor units (`amountMinor`: 1 USD = 100 cents, 1 GBP = 100 pence). Floating point numbers are strictly forbidden to eliminate IEEE 754 precision errors.
2. **Double-Entry Principle**: Every transaction generates at least two entries in `ledger_entries`:
   - A debit entry (`direction: DEBIT`)
   - A credit entry (`direction: CREDIT`)
3. **Zero-Sum Invariant**: For every currency, the sum of all debits minus credits across the entire platform must equal exactly zero at all times:
   $$\sum \text{Debits} - \sum \text{Credits} = 0$$
4. **Append-Only Immutability**: Ledger transactions and entries can never be modified or deleted (`UPDATE` and `DELETE` queries on ledger tables are prohibited at the database level).
5. **Reversal Pattern**: Corrections are recorded as new, separate reversing transactions referencing the original transaction ID with dual-operator audit logging.

### B. Account Types
| Account Type | Description |
| :--- | :--- |
| `MEMBER_WALLET` | Member's multi-currency balance (USD, CAD, GBP, EUR). |
| `SANDBOX_POOL` | Central sandbox liquidity reserve tagged with `source=TEST`. |
| `EXTERNAL_CLEARING` | In-flight transit account for ACH/SEPA/Wire clearing. |
| `LOAN_PRINCIPAL_POOL`| Asset account tracking disbursed loan principals. |
| `SYSTEM_FEES` | Fee income account. |

---

## 3. Authentication & Security Architecture

### A. Role-Based Access Control (RBAC)
Only two roles exist in the platform:
- `MEMBER`: Regular platform user. Access restricted to their own wallets, virtual cards, loans, transfers, and KYC submissions. Blocked from administrative endpoints.
- `SUPER_ADMIN`: Administrative staff. Mandatory Two-Factor Authentication. Access to KYC review queue, ledger reconciliation, audit logs, and wallet funding.

### B. Password Hashing (Argon2id)
Passwords are salted and hashed using Argon2id with high-memory parameters:
- Memory cost: 65,536 KB (64 MB)
- Time cost: 3 iterations
- Parallelism: 1 thread
- Minimum length: 12 characters (uppercase, lowercase, number, symbol required)

### C. JWT Access & Refresh Token Rotation
- **Access Tokens**: Short-lived (15 minutes), signed with HMAC-SHA256.
- **Refresh Tokens**: Long-lived (7 days), single-use rotation. Every refresh operation consumes the incoming token and issues a fresh token pair.
- **Replay Attack Defense**: If an already-consumed refresh token is presented, the system flags a session replay attack, invalidates the entire session family immediately, and writes a security audit event.

### D. Multi-Factor Authentication (TOTP MFA)
- Standard RFC 6238 time-based one-time passwords (6 digits, 30-second window, HMAC-SHA1).
- Mandatory for `SUPER_ADMIN` accounts.
- Emergency recovery codes (8 codes per user, single-use, hashed with Argon2id).

---

## 4. Private KYC Document Storage & Encryption

### A. Threat Model & Safeguards
- Member identity documents (passports, national ID cards, driver licenses) are high-risk PII assets.
- Documents are **never** stored in public buckets and **never** returned as public URLs.
- Document files are encrypted at rest using AES-256-GCM with unique initialization vectors (IV) and SHA-256 integrity checksums.
- Super Administrators view documents strictly through **short-lived signed URLs** expiring after 300 seconds (5 minutes).
- Once a member uploads a document, the member cannot retrieve the raw document file again.

---

## 5. Progressive Web App (PWA) Architecture

```
[Browser / PWA Client]
      │
      ├── Network Online? ──► [Express Full-stack Server (Port 3000)]
      │                               │
      │                               ├── REST APIs (/auth, /wallet, /transfers, /admin)
      │                               └── Vite Middleware (SPA Assets)
      │
      └── Network Offline? ──► [Service Worker (sw.js)]
                                      │
                                      ├── Precaching Cache (/index.html, /manifest.json)
                                      └── Offline Page Fallback (/offline.html)
```

- **App Shell Precache**: Serves shell assets instantly from CacheStorage.
- **Offline Fallback**: Uncached navigation requests route to `/offline.html` displaying a connection retry banner.
- **Web Push**: Standard `PushEvent` and `NotificationClick` listeners route user taps directly to the relevant wallet view.

---

## 6. Observability & Audit Trail

1. **Request Logger Middleware**: Logs every incoming HTTP method, URL, status code, response time (ms), and client IP.
2. **Audit Service (`audit_logs`)**: Captures actor ID, actor role, action name, target entity, before/after JSON snapshots, IP, and UTC timestamp.
3. **Health Check (`GET /health`)**:
   - Status (`ok`)
   - Sandbox & Production mode flags
   - Ledger zero-sum invariant verification status
   - Total transactions and accounts count
   - Process uptime and memory footprint (RSS and heap usage)
