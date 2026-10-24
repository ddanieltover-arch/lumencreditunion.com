import { describe, it, expect, beforeEach } from 'vitest';
import { TransfersService } from '../src/transfers/transfers.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { AuthService } from '../src/auth/auth.service';
import { ConfigService } from '../src/config/config.service';
import { AuditService } from '../src/audit/audit.service';
import { KycService } from '../src/kyc/kyc.service';
import { generateTotpCode } from '../src/auth/totp.util';
import { SandboxCryptoProvider } from '../src/transfers/crypto.provider';

describe('Transfers Platform & Acceptance Criteria', () => {
  let transfersService: TransfersService;
  let ledgerService: LedgerService;
  let authService: AuthService;
  let configService: ConfigService;
  let auditService: AuditService;
  let kycService: KycService;
  let cryptoProvider: SandboxCryptoProvider;

  const senderId = '00000000-0000-0000-0000-000000000003'; // Test Member (Sender)
  const recipientId = '00000000-0000-0000-0000-000000000002'; // Amara Okafor (Recipient, amara.o@lumenfield.test)

  beforeEach(async () => {
    configService = new ConfigService({
      SANDBOX_MODE: 'true',
      TRANSFER_DAILY_LIMIT_MINOR: '500000', // $5,000.00
      TRANSFER_TRANSACTION_LIMIT_MINOR: '200000', // $2,000.00
      TRANSFER_MFA_THRESHOLD_MINOR: '50000', // $500.00
      BENEFICIARY_COOLING_OFF_HOURS: '24',
      TRANSFER_VELOCITY_MAX_PER_HOUR: '5',
    });
    auditService = new AuditService();
    kycService = new KycService(undefined, undefined, auditService);
    ledgerService = new LedgerService(configService, auditService, kycService);
    authService = new AuthService(auditService, configService);
    cryptoProvider = new SandboxCryptoProvider();

    // Seed sender in authService with MFA secret
    (authService as any).users.set(senderId, {
      id: senderId,
      email: 'test.sender@lumenfield.test',
      passwordHash: 'dummy-hash',
      fullName: 'Test Member',
      phone: '+1 555 0100',
      countryCode: 'US',
      dateOfBirth: '1990-01-01',
      role: 'MEMBER',
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      mfaRecoveryCodes: ['REC-001', 'REC-002'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    transfersService = new TransfersService(
      ledgerService,
      authService,
      configService,
      auditService,
      kycService,
      cryptoProvider,
    );

    // Approve sender & recipient KYC and seed wallet funds ($1,000.00 = 100,000 cents)
    (kycService as any).memberKycStatus.set(senderId, 'APPROVED');
    (kycService as any).memberKycStatus.set(recipientId, 'APPROVED');

    await ledgerService.adminFundMemberWallet(
      {
        memberId: senderId,
        amountMinor: 100000, // $1,000.00 USD
        currency: 'USD',
        reason: 'Initial test funding for transfer tests',
        idempotencyKey: 'init-fund-sender-usd',
      },
      'admin-actor',
      '127.0.0.1',
    );
  });

  describe('ACCEPTANCE CRITERION: Atomic single ledger transaction', () => {
    it('member-to-member transfer posts a single balanced ledger transaction (sum of entries is zero)', async () => {
      const initialSenderBal = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;
      const initialRecipientBal = ledgerService.getOrCreateMemberWallet(recipientId, 'USD').cachedBalanceMinor;

      const transfer = await transfersService.initiateMemberTransfer(
        senderId,
        {
          recipientQuery: 'amara.o@lumenfield.test', // will look up demo recipient
          amountMinor: 15000, // $150.00 (below $500 MFA threshold)
          currency: 'USD',
          note: 'Dinner split',
          idempotencyKey: 'idemp-p2p-test-01',
        },
        '127.0.0.1',
      );

      expect(transfer.status).toBe('COMPLETED');
      expect(transfer.type).toBe('MEMBER_TO_MEMBER');
      expect(transfer.amountMinor).toBe(15000);
      expect(transfer.ledgerTransactionId).toBeDefined();

      // Check sender & recipient wallet balances
      const finalSenderBal = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;
      const finalRecipientBal = ledgerService.getOrCreateMemberWallet(recipientId, 'USD').cachedBalanceMinor;

      expect(finalSenderBal).toBe(initialSenderBal - 15000);
      expect(finalRecipientBal).toBe(initialRecipientBal + 15000);

      // Verify zero-sum invariant holds across system
      const recon = ledgerService.reconcileBalances();
      expect(recon.isBalanced).toBe(true);
      expect(recon.currencyZeroSum['USD'].netMinor).toBe(0);
    });

    it('replaying the same idempotencyKey does not double-transfer or double-debit', async () => {
      const input = {
        recipientQuery: 'amara.o@lumenfield.test',
        amountMinor: 5000,
        currency: 'USD' as const,
        note: 'Idempotency test',
        idempotencyKey: 'idemp-duplicate-transfer-test',
      };

      const first = await transfersService.initiateMemberTransfer(senderId, input, '127.0.0.1');
      const second = await transfersService.initiateMemberTransfer(senderId, input, '127.0.0.1');

      expect(second.id).toBe(first.id);
      expect(second.reference).toBe(first.reference);

      // Balance only debited once
      const senderBal = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;
      expect(senderBal).toBe(100000 - 5000);
    });
  });

  describe('ACCEPTANCE CRITERION: A member cannot send more than their available balance (including pending)', () => {
    it('rejects transfer when requested amount exceeds cached balance', async () => {
      await expect(
        transfersService.initiateMemberTransfer(
          senderId,
          {
            recipientQuery: 'amara.o@lumenfield.test',
            amountMinor: 250000, // $2,500.00 while balance is $1,000.00
            currency: 'USD',
            idempotencyKey: 'idemp-overdraw-test-1',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/exceeds maximum allowed|Insufficient available funds/i);
    });

    it('rejects transfer when pending bank transfers reduce available balance below required amount', async () => {
      // 1. Beneficiary setup
      const beneficiary = await transfersService.addBeneficiary(
        senderId,
        {
          name: 'US Bank Beneficiary',
          countryCode: 'US',
          currency: 'USD',
          details: {
            routingNumber: '021000021',
            accountNumber: '123456789',
            accountType: 'CHECKING',
          },
        },
        '127.0.0.1',
      );

      // 2. Initiate pending bank transfer of $700.00 (70,000 cents). Balance was $1,000.00.
      // Note: $700 exceeds $500 MFA threshold, so provide valid TOTP code
      const sender = authService.getUserById(senderId)!;
      const validTotp = generateTotpCode(sender.mfaSecret!);

      const bankTx = await transfersService.initiateBankTransfer(
        senderId,
        {
          beneficiaryId: beneficiary.id,
          amountMinor: 70000, // $700.00
          currency: 'USD',
          note: 'Bank wire payout',
          idempotencyKey: 'idemp-pending-bank-1',
          totpCode: validTotp,
        },
        '127.0.0.1',
      );

      expect(bankTx.status).toMatch(/PENDING|PROCESSING/);

      // Remaining available funds is now $300.00 (30,000 cents)
      const available = transfersService.getAvailableBalanceMinor(senderId, 'USD');
      expect(available).toBe(30000);

      // 3. Attempt to send $400.00 (40,000 cents) -> MUST BE REJECTED!
      await expect(
        transfersService.initiateMemberTransfer(
          senderId,
          {
            recipientQuery: 'amara.o@lumenfield.test',
            amountMinor: 40000, // $400.00 > $300.00 available!
            currency: 'USD',
            idempotencyKey: 'idemp-exceed-pending-test',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Insufficient available funds/i);
    });
  });

  describe('ACCEPTANCE CRITERION: Limits and MFA step-up are enforced on the server', () => {
    it('enforces per-transaction limit from config (rejects transfer > $2,000.00)', async () => {
      await expect(
        transfersService.initiateMemberTransfer(
          senderId,
          {
            recipientQuery: 'amara.o@lumenfield.test',
            amountMinor: 200001, // 1 cent over $2,000.00 limit
            currency: 'USD',
            idempotencyKey: 'idemp-single-limit-test',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Per-transaction limit exceeded/i);
    });

    it('enforces MFA step-up above threshold ($500.00 / 50,000 minor units)', async () => {
      // 1. Attempt transfer >= $500 without TOTP code -> rejected with 403
      await expect(
        transfersService.initiateMemberTransfer(
          senderId,
          {
            recipientQuery: 'amara.o@lumenfield.test',
            amountMinor: 60000, // $600.00
            currency: 'USD',
            idempotencyKey: 'idemp-mfa-missing',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Two-factor authentication \(MFA\) step-up is strictly required/i);

      // 2. Attempt transfer with invalid TOTP code -> rejected with 401
      await expect(
        transfersService.initiateMemberTransfer(
          senderId,
          {
            recipientQuery: 'amara.o@lumenfield.test',
            amountMinor: 60000,
            currency: 'USD',
            idempotencyKey: 'idemp-mfa-invalid',
            totpCode: '000000',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Invalid two-factor authentication code/i);

      // 3. With valid TOTP code generated from user secret -> succeeds!
      const sender = authService.getUserById(senderId)!;
      const validTotp = generateTotpCode(sender.mfaSecret!);

      const tx = await transfersService.initiateMemberTransfer(
        senderId,
        {
          recipientQuery: 'amara.o@lumenfield.test',
          amountMinor: 60000,
          currency: 'USD',
          idempotencyKey: 'idemp-mfa-success',
          totpCode: validTotp,
        },
        '127.0.0.1',
      );

      expect(tx.status).toBe('COMPLETED');
      expect(tx.amountMinor).toBe(60000);
    });
  });

  describe('Bank Transfers & Failure Reversals (ACCEPTANCE CRITERIA)', () => {
    it('validates beneficiary details per country (US ABA, CA Transit, UK Sort Code, EU IBAN)', async () => {
      // US invalid routing (not 9 digits)
      await expect(
        transfersService.addBeneficiary(
          senderId,
          {
            name: 'US Ben',
            countryCode: 'US',
            currency: 'USD',
            details: { routingNumber: '123', accountNumber: '12345678' },
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow();

      // CA invalid institution/transit
      await expect(
        transfersService.addBeneficiary(
          senderId,
          {
            name: 'CA Ben',
            countryCode: 'CA',
            currency: 'CAD',
            details: { institutionNumber: '12', transitNumber: '123', accountNumber: '1234567' },
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow();

      // UK valid sort code and account
      const gbBen = await transfersService.addBeneficiary(
        senderId,
        {
          name: 'London Landlord',
          countryCode: 'GB',
          currency: 'GBP',
          details: { sortCode: '20-00-00', accountNumber: '12345678' },
        },
        '127.0.0.1',
      );
      expect(gbBen.id).toBeDefined();
      expect(gbBen.countryCode).toBe('GB');

      // EU valid IBAN
      const euBen = await transfersService.addBeneficiary(
        senderId,
        {
          name: 'Berlin Consultant',
          countryCode: 'DE',
          currency: 'EUR',
          details: { iban: 'DE89370400440532013000' },
        },
        '127.0.0.1',
      );
      expect(euBen.id).toBeDefined();
    });

    it('failed bank transfer posts an immutable reversing entry, restoring member wallet balance', async () => {
      const beneficiary = await transfersService.addBeneficiary(
        senderId,
        {
          name: 'Failing Beneficiary Bank',
          countryCode: 'US',
          currency: 'USD',
          details: { routingNumber: '021000021', accountNumber: '99999999' },
        },
        '127.0.0.1',
      );

      const balBefore = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;

      // Initiate bank transfer configured to simulate failure
      const transfer = await transfersService.initiateBankTransfer(
        senderId,
        {
          beneficiaryId: beneficiary.id,
          amountMinor: 10000, // $100.00
          currency: 'USD',
          idempotencyKey: 'idemp-sim-fail-1',
          simulateFailure: true,
        },
        '127.0.0.1',
      );

      expect(transfer.status).toBe('FAILED');
      expect(transfer.failureReason).toBeDefined();
      expect(transfer.reversalLedgerTransactionId).toBeDefined();

      // Member balance was initially debited and then restored via reversal entry!
      const balAfter = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;
      expect(balAfter).toBe(balBefore);

      // Zero-sum invariant strictly maintained
      const recon = ledgerService.reconcileBalances();
      expect(recon.isBalanced).toBe(true);
      expect(recon.currencyZeroSum['USD'].netMinor).toBe(0);
    });
  });

  describe('Crypto Transfers (Simulated Sandbox)', () => {
    it('generates sandbox deposit addresses clearly marked as simulated testnets', async () => {
      const btcAddress = await transfersService.getCryptoDepositAddress('BTC', senderId);
      expect(btcAddress.isSimulated).toBe(true);
      expect(btcAddress.address).toMatch(/^tb1q/);
      expect(btcAddress.warningNotice).toContain('Crypto deposit address');
      expect(btcAddress.qrCodeDataUrl).toMatch(/^data:image\/png;base64/);

      const ethAddress = await transfersService.getCryptoDepositAddress('USDC_SEPOLIA', senderId);
      expect(ethAddress.address).toMatch(/^0x/);
      expect(ethAddress.networkDetails.protocol).toContain('Sepolia');
    });

    it('simulates crypto deposit and credits member wallet atomically', async () => {
      const balBefore = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;

      const simDep = await transfersService.simulateCryptoDeposit(
        senderId,
        'USDC_SEPOLIA',
        25000, // $250.00
        'USD',
        '127.0.0.1',
      );

      expect(simDep.status).toBe('COMPLETED');
      expect(simDep.type).toBe('CRYPTO_DEPOSIT');

      const balAfter = ledgerService.getOrCreateMemberWallet(senderId, 'USD').cachedBalanceMinor;
      expect(balAfter).toBe(balBefore + 25000);
    });
  });

  describe('Fraud Basics & Audit Trail', () => {
    it('flags transfers to beneficiaries created within the 24-hour cooling-off window', async () => {
      const newBen = await transfersService.addBeneficiary(
        senderId,
        {
          name: 'Brand New Beneficiary',
          countryCode: 'US',
          currency: 'USD',
          details: { routingNumber: '021000021', accountNumber: '111222333' },
        },
        '127.0.0.1',
      );

      expect(newBen.isCoolingOff).toBe(true);

      const tx = await transfersService.initiateBankTransfer(
        senderId,
        {
          beneficiaryId: newBen.id,
          amountMinor: 5000,
          currency: 'USD',
          idempotencyKey: 'idemp-cooling-off-test',
        },
        '127.0.0.1',
      );

      expect(tx.isFlagged).toBe(true);
      expect(tx.fraudFlags).toContain('NEW_BENEFICIARY_COOLING_OFF');

      // Visible in flagged transfers queue for SUPER_ADMIN
      const flagged = transfersService.getFlaggedTransfers();
      expect(flagged.some((t) => t.id === tx.id)).toBe(true);
    });

    it('generates printable/PDF receipt with sandbox notice and ledger transaction reference', async () => {
      const tx = await transfersService.initiateMemberTransfer(
        senderId,
        {
          recipientQuery: 'amara.o@lumenfield.test',
          amountMinor: 8500, // $85.00
          currency: 'USD',
          note: 'Coffee and project review',
          idempotencyKey: 'idemp-receipt-test-1',
        },
        '127.0.0.1',
      );

      const html = transfersService.generateReceiptHtml(tx.id, senderId);
      expect(html).toContain('Lumenfield Transfer Receipt');
      expect(html).toContain('Lumenfield Credit Union');
      expect(html).toContain(tx.reference);
      expect(html).toContain(tx.receiptNumber);
      expect(html).toContain('$85.00');
    });
  });
});
