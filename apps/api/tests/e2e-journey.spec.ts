import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiApp } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { KycService } from '../src/kyc/kyc.service';
import { AuditService } from '../src/audit/audit.service';
import { ConfigService } from '../src/config/config.service';
import { TransfersService } from '../src/transfers/transfers.service';
import { CardsService } from '../src/cards/cards.service';
import http from 'http';

describe('End-to-End User Journey: Register, Verify, Admin Funds Wallet, Member Transfers, Loan Application & Approval', () => {
  let app: ReturnType<typeof createApiApp>;
  let server: http.Server;
  let baseUrl: string;

  let configService: ConfigService;
  let auditService: AuditService;
  let authService: AuthService;
  let kycService: KycService;
  let ledgerService: LedgerService;
  let transfersService: TransfersService;
  let cardsService: CardsService;

  beforeEach(async () => {
    configService = ConfigService.getInstance();

    auditService = new AuditService();
    authService = new AuthService(auditService, configService);
    kycService = new KycService(undefined, undefined, auditService);
    ledgerService = new LedgerService(configService, auditService, kycService);
    transfersService = new TransfersService(ledgerService, authService, configService, auditService, kycService);
    cardsService = new CardsService(ledgerService, auditService, authService, kycService, configService);

    app = createApiApp(
      authService,
      ledgerService,
      kycService,
      auditService,
      transfersService,
      cardsService,
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('executes full regulatory lifecycle: register -> verify KYC -> admin funds -> member transfers -> apply loan -> admin approves', async () => {
    const timestamp = Date.now();
    const memberEmail = `e2e.applicant.${timestamp}@lumenfield.test`;
    const memberPassword = 'SecurePassword2026!#E2E';

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: REGISTER MEMBER
    // ─────────────────────────────────────────────────────────────────────────
    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Jordan V. Taylor',
        email: memberEmail,
        password: memberPassword,
        phone: '+1 415 555 0188',
        countryCode: 'US',
        dateOfBirth: '1992-05-14',
      }),
    });

    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json();
    expect(registerBody.user.id).toBeDefined();
    expect(registerBody.user.email).toBe(memberEmail);
    expect(registerBody.user.role).toBe('MEMBER');
    const newMemberId = registerBody.user.id;

    // Login as new member
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: memberEmail,
        password: memberPassword,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    const memberAccessToken = loginBody.accessToken;
    expect(memberAccessToken).toBeDefined();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: SUBMIT IDENTITY VERIFICATION (KYC)
    // Verify that prior to approval, wallet transfers or funding are blocked (403)
    // ─────────────────────────────────────────────────────────────────────────
    const blockedTransferRes = await fetch(`${baseUrl}/transfers/member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberAccessToken}`,
      },
      body: JSON.stringify({
        recipientQuery: 'amara.o@lumenfield.test',
        amountMinor: 5000,
        currency: 'USD',
        idempotencyKey: `blocked-tx-${timestamp}`,
      }),
    });
    // Expected 403 Forbidden because KYC is not yet approved
    expect(blockedTransferRes.status).toBe(403);

    // Member submits KYC documents
    const kycSubmitRes = await fetch(`${baseUrl}/kyc/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberAccessToken}`,
      },
      body: JSON.stringify({
        countryCode: 'US',
        documentType: 'PASSPORT',
        documents: [
          {
            fileName: 'us_passport_front.png',
            mimeType: 'image/png',
            fileBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            side: 'FRONT',
          },
        ],
      }),
    });
    expect(kycSubmitRes.status).toBe(201);
    const kycSubmission = await kycSubmitRes.json();
    expect(kycSubmission.status).toBe('PENDING');
    expect(kycSubmission.sanctionsCheckPassed).toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: SUPER ADMIN REVIEWS & APPROVES KYC
    // ─────────────────────────────────────────────────────────────────────────
    // Admin login with mandatory MFA
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@lumenfield.internal',
        password: 'LumenAdmin2026!#Secure',
      }),
    });
    expect(adminLoginRes.status).toBe(200);
    const adminLoginBody = await adminLoginRes.json();
    expect(adminLoginBody.requiresMfa).toBe(true);
    expect(adminLoginBody.mfaTicket).toBeDefined();

    const adminTotp = adminLoginBody.sandboxMfaHint?.totpCode;
    expect(adminTotp).toBeDefined();

    const adminMfaRes = await fetch(`${baseUrl}/auth/mfa-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaTicket: adminLoginBody.mfaTicket,
        totpCode: adminTotp,
      }),
    });
    expect(adminMfaRes.status).toBe(200);
    const adminMfaBody = await adminMfaRes.json();
    const adminToken = adminMfaBody.accessToken;
    expect(adminToken).toBeDefined();

    // Admin views queue
    const queueRes = await fetch(`${baseUrl}/admin/kyc/queue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(queueRes.status).toBe(200);
    const queue = await queueRes.json();
    const foundSubmission = queue.find((s: any) => s.id === kycSubmission.id);
    expect(foundSubmission).toBeDefined();

    // Admin approves submission
    const reviewRes = await fetch(`${baseUrl}/admin/kyc/submissions/${kycSubmission.id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: 'APPROVE',
        reason: 'Credentials and biometrics verified against US Passport repository.',
      }),
    });
    expect(reviewRes.status).toBe(200);
    const approvedKyc = await reviewRes.json();
    expect(approvedKyc.status).toBe('APPROVED');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: ADMIN FUNDS MEMBER'S WALLET (DOUBLE-ENTRY LEDGER CREDIT)
    // ─────────────────────────────────────────────────────────────────────────
    const fundingRes = await fetch(`${baseUrl}/admin/funding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        memberId: newMemberId,
        amountMinor: 500000, // $5,000.00 USD
        currency: 'USD',
        reason: 'Initial sandbox funding for member onboarding test',
        idempotencyKey: `fund-member-${timestamp}`,
      }),
    });
    expect(fundingRes.status).toBe(201);
    const fundingTx = await fundingRes.json();
    expect(fundingTx.source).toBe('TEST');
    expect(fundingTx.status).toBe('POSTED');

    // Check balances
    const balanceRes = await fetch(`${baseUrl}/wallet/balances`, {
      headers: { Authorization: `Bearer ${memberAccessToken}` },
    });
    expect(balanceRes.status).toBe(200);
    const balances = await balanceRes.json();
    const usdWallet = balances.find((b: any) => b.currency === 'USD');
    expect(usdWallet.balanceMinor).toBe(500000);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: MEMBER TRANSFERS FUNDS TO ANOTHER MEMBER
    // ─────────────────────────────────────────────────────────────────────────
    // Recipient lookup
    const lookupRes = await fetch(`${baseUrl}/transfers/lookup?query=amara.o@lumenfield.test`, {
      headers: { Authorization: `Bearer ${memberAccessToken}` },
    });
    expect(lookupRes.status).toBe(200);
    const recipient = await lookupRes.json();
    expect(recipient.id).toBeDefined();

    // Execute transfer
    const transferRes = await fetch(`${baseUrl}/transfers/member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberAccessToken}`,
      },
      body: JSON.stringify({
        recipientQuery: recipient.id,
        amountMinor: 25000, // $250.00 (under $500 MFA threshold)
        currency: 'USD',
        note: 'P2P test settlement between sandbox members',
        idempotencyKey: `p2p-tx-${timestamp}`,
      }),
    });
    expect(transferRes.status).toBe(201);
    const transferBody = await transferRes.json();
    expect(transferBody.transfer.status).toBe('COMPLETED');

    // Check sender balance decremented
    const updatedBalanceRes = await fetch(`${baseUrl}/wallet/balances`, {
      headers: { Authorization: `Bearer ${memberAccessToken}` },
    });
    const updatedBalances = await updatedBalanceRes.json();
    const updatedUsd = updatedBalances.find((b: any) => b.currency === 'USD');
    expect(updatedUsd.balanceMinor).toBe(475000); // $5,000 - $250 = $4,750

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: MEMBER APPLIES FOR A LOAN
    // ─────────────────────────────────────────────────────────────────────────
    const loanApplyRes = await fetch(`${baseUrl}/loans/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberAccessToken}`,
      },
      body: JSON.stringify({
        type: 'auto',
        amountMinor: 1800000, // $18,000.00
        currency: 'USD',
        termMonths: 48,
        purpose: '2024 Compact EV purchase',
        downPaymentMinor: 300000,
        assetDetails: 'VIN: 1HGCR2F83HA029141',
      }),
    });
    expect(loanApplyRes.status).toBe(200);
    const loanApplyBody = await loanApplyRes.json();
    expect(loanApplyBody.success).toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 7: SUPER ADMIN RECONCILES & AUDIT LOG VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    const reconcileRes = await fetch(`${baseUrl}/admin/ledger/reconcile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(reconcileRes.status).toBe(200);
    const reconcileReport = await reconcileRes.json();
    expect(reconcileReport.zeroSumCheckPassed).toBe(true);

    // Health check validation
    const healthRes = await fetch(`${baseUrl}/health`);
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.ledger.zeroSumInvariantPassed).toBe(true);
    expect(healthData.sandboxMode).toBe(true);

    // GDPR data export check
    const exportRes = await fetch(`${baseUrl}/auth/data-export`, {
      headers: { Authorization: `Bearer ${memberAccessToken}` },
    });
    expect(exportRes.status).toBe(200);
    const exportData = await exportRes.json();
    expect(exportData.subject.email).toBe(memberEmail);
    expect(exportData.identityVerification.status).toBe('APPROVED');
    expect(exportData.walletBalances.length).toBeGreaterThan(0);
  });
});
