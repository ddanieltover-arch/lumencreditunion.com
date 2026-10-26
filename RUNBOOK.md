# Lumenfield Platform Operational Runbook & Disaster Recovery

This runbook provides Standard Operating Procedures (SOPs), emergency incident responses, backup/restore procedures, and pre-production checklists for operations engineers managing the Lumenfield platform.

---

## 1. System Topology & Service Boundaries

| Component | Port / Interface | Technology | Purpose |
| :--- | :--- | :--- | :--- |
| **Web Client & PWA** | `http://localhost:3000` | React 19, Vite, Tailwind CSS | Progressive Web App client for members & admins. |
| **API Application** | `http://localhost:3000` (Unified) / `3001` (Dev API) | Express & NestJS architecture | REST APIs, authentication, guards, ledger posting. |
| **Database** | Neon Postgres (`DATABASE_URL`) | PostgreSQL via `pg` + runtime JSON stores | Shared local+live store for members, KYC, ledger, cards, funding, audit. |

### Shared Neon (local = live)

- Put the **same** Neon `DATABASE_URL` / `DATABASE_URL_UNPOOLED` in root `.env` and in Vercel → Project → Environment Variables.
- **Git push / Vercel deploy never migrates, truncates, or reseeds member data.** Only app upserts write to Neon. Manual migrations stay local (`packages/db` prisma migrate) and are not part of deploy.
- Snapshot stores (ledger/cards) refuse to overwrite a richer DB snapshot with an empty/smaller in-memory book after a cold start.
| **Private Document Storage** | `http://localhost:9000` (MinIO/S3) | S3-Compatible Object Store | Encrypted KYC passports and national ID documents. |
| **Job Queues & Session Cache**| `redis://localhost:6379` | Redis / BullMQ | Rate limiters, reconciliation jobs, task queues. |

---

## 2. Platform Safety Flags

Controlled via environment variables:

| Environment Variable | Allowed Values | Default | Safety Behavior |
| :--- | :--- | :--- | :--- |
| `SANDBOX_MODE` | `true`, `false` | `true` | When `true`, wallet credits are tagged `source=TEST`. Real payment rails are disabled. |
| `PRODUCTION_MODE` | `true`, `false` | `false` | When `false`, enforces strict sandbox constraints. Must remain `false` until bank charter & regulatory approval. |
| `REQUIRE_SECOND_APPROVER` | `true`, `false` | `false` | When `true`, all administrative funding and adjustments require dual-control approval by two distinct Super Admins. |

---

## 3. Routine Operations & Health Checks

### A. Health Monitoring
Query the unauthenticated health endpoint every 30 seconds:
```bash
curl -s http://localhost:3000/health | jq
```
Expected output:
```json
{
  "status": "ok",
  "service": "lumenfield-api",
  "uptimeSeconds": 1420,
  "sandboxMode": true,
  "productionMode": false,
  "ledger": {
    "zeroSumInvariantPassed": true,
    "totalTransactions": 48,
    "totalAccounts": 32
  }
}
```
**Alert Threshold**: If `zeroSumInvariantPassed` is `false`, trigger a **P0 Severity Alert** immediately.

### B. Daily Ledger Reconciliation Job
Super Administrators execute an automated balance reconciliation comparing cached balances against all cumulative entries:
```bash
curl -X POST http://localhost:3000/admin/ledger/reconcile \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" | jq
```
If any accounts exhibit discrepancy between running balance and cumulative entries, the system records an audit event and issues a discrepancy report.

---

## 4. Incident Response & Troubleshooting

### Scenario A: Zero-Sum Invariant Failure (Severity P0)
1. **Freeze Platform Ingress**: Set platform to maintenance mode or suspend new transfer mutations.
2. **Inspect Audit Trail**:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_TOKEN>" http://localhost:3000/admin/audit-logs | jq
   ```
3. **Identify Mismatched Transaction**: Run `POST /admin/ledger/reconcile`.
4. **Corrective Action**: Under no circumstances execute an SQL `UPDATE` or `DELETE` on `ledger_entries`. Post an offsetting reversal transaction via `POST /admin/ledger/reverse` with dual-approver sign-off.
5. **Post-Mortem**: Document root cause, affected accounts, and post-reconciliation verification in the compliance archive.

### Scenario B: Account Lockout Reset (Severity P3)
When a legitimate member is locked out after 5 failed login attempts:
1. Member is automatically unlocked after 15 minutes.
2. To expedite unlock for verified members in the sandbox:
   - Verify member identity through offline channel or KYC record.
   - Admin updates status or member requests password reset via `/auth/forgot-password`.

### Scenario C: Refresh Token Replay Alert (Severity P1)
When an audit log records `AUTH_SESSION_REVOKED` with `reason: "Replay Attack Detected"`:
1. The session family has been automatically invalidated by the auth service.
2. Check `ipAddress` and `deviceInfo` from the audit record.
3. Prompt member to reset credentials upon next login.

---

## 5. Backup, Restore & Disaster Recovery

### A. PostgreSQL Database Backup
Automated daily logical dump and streaming WAL replication:
```bash
# Full logical backup
pg_dump -U lumenfield_user -h localhost -F c -b -v -f "/backups/lumenfield_$(date +%Y%m%d_%H%M%S).dump" lumenfield_db

# Restore from dump
pg_restore -U lumenfield_user -h localhost -d lumenfield_db -v "/backups/lumenfield_20261022.dump"
```

### B. Point-in-Time Recovery (PITR)
- **Continuous Archiving**: WAL logs archived to encrypted remote bucket every 5 minutes.
- **RPO (Recovery Point Objective)**: ≤ 5 minutes.
- **RTO (Recovery Time Objective)**: ≤ 30 minutes.

### C. Private Document Storage (S3 / MinIO)
- Private KYC bucket `lumenfield-private-documents` is configured with cross-region bucket replication (CRR) and object versioning.
- Encryption: Server-side AES-256 (SSE-S3 or KMS).

---

## 6. Pre-Flight Deployment Checklist

Before promoting any release to staging or production:
- [ ] Ensure `SANDBOX_MODE=true` is set for all non-chartered environments.
- [ ] Confirm no claims of "FDIC", "NCUA", "chartered bank", or "licensed credit union" appear in code or UI copy.
- [ ] Verify test suite passes (`npm test`) with 100% passing tests.
- [ ] Verify TypeScript compiles with no errors (`npm run typecheck`).
- [ ] Confirm persistent sandbox banner displays on all routes.
- [ ] Validate `/public/manifest.json` and service worker `/public/sw.js` registration.
- [ ] Verify short-lived signed URLs for documents expire in ≤ 300 seconds.
- [ ] Run secret scanner to ensure no private keys or tokens are in repo.
