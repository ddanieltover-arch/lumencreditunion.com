import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerService } from '../src/ledger/ledger.service';
import { ConfigService } from '../src/config/config.service';
import { AuditService } from '../src/audit/audit.service';
import { parseMajorToMinor, MoneyError } from '@lumenfield/shared';

describe('Double-Entry Ledger & Platform Rules', () => {
  let ledgerService: LedgerService;
  let configService: ConfigService;
  let auditService: AuditService;

  beforeEach(() => {
    configService = new ConfigService({
      SANDBOX_MODE: 'true',
      PRODUCTION_MODE: 'false',
      REQUIRE_SECOND_APPROVER: 'false',
    });
    auditService = new AuditService();
    ledgerService = new LedgerService(configService, auditService);
  });

  it('HARD RULE 2: forbids floating point amounts and enforces integer minor units', () => {
    expect(() => parseMajorToMinor('100.999')).toThrow(MoneyError);
    expect(() => parseMajorToMinor('invalid')).toThrow(MoneyError);

    const valid = parseMajorToMinor('150.25', 'USD');
    expect(valid.amountMinor).toBe(15025);
    expect(Number.isInteger(valid.amountMinor)).toBe(true);
  });

  it('HARD RULE 3: enforces double-entry invariant (sum of debits == sum of credits)', async () => {
    const unbalancedTx = {
      idempotencyKey: 'test-unbalanced-key-1',
      reference: 'TX-UNBALANCED-1',
      description: 'Attempt unbalanced entry',
      currency: 'USD' as const,
      source: 'TEST' as const,
      entries: [
        {
          accountId: '00000000-0000-0000-0000-000000000001',
          accountType: 'LIABILITY' as const,
          direction: 'DEBIT' as const,
          amountMinor: 10000, // $100.00
          currency: 'USD' as const,
        },
        {
          accountId: '00000000-0000-0000-0000-000000000002',
          accountType: 'ASSET' as const,
          direction: 'CREDIT' as const,
          amountMinor: 8000, // $80.00 -> out of balance!
          currency: 'USD' as const,
        },
      ],
    };

    await expect(
      ledgerService.postTransaction(
        unbalancedTx,
        '00000000-0000-0000-0000-000000000099',
        'SUPER_ADMIN',
        '127.0.0.1',
      ),
    ).rejects.toThrow(/out of balance/i);
  });

  it('HARD RULE 3 & 4: admin funding in sandbox mode creates source=TEST and records audit log', async () => {
    const tx = await ledgerService.adminFundMemberWallet(
      {
        memberId: '00000000-0000-0000-0000-000000000002',
        amountMinor: 25000, // $250.00
        currency: 'USD',
        reason: 'Sandbox initial credit test',
        idempotencyKey: 'idemp-test-fund-001',
      },
      '00000000-0000-0000-0000-000000000099',
      '127.0.0.1',
    );

    expect(tx.status).toBe('POSTED');
    expect(tx.source).toBe('TEST');
    expect(tx.entries).toHaveLength(2);
    expect(tx.entries[0].amountMinor).toBe(25000);
    expect(tx.entries[1].amountMinor).toBe(25000);

    const logs = await auditService.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('ADMIN_FUND_WALLET');
    expect(logs[0].actorRole).toBe('SUPER_ADMIN');
  });

  it('HARD RULE 3: idempotency returns original transaction without duplicate side-effects', async () => {
    const input = {
      memberId: '00000000-0000-0000-0000-000000000002',
      amountMinor: 5000,
      currency: 'USD' as const,
      reason: 'Idempotency test',
      idempotencyKey: 'idemp-duplicate-key-99',
    };

    const first = await ledgerService.adminFundMemberWallet(
      input,
      '00000000-0000-0000-0000-000000000099',
      '127.0.0.1',
    );
    const second = await ledgerService.adminFundMemberWallet(
      input,
      '00000000-0000-0000-0000-000000000099',
      '127.0.0.1',
    );

    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);

    const all = await ledgerService.getAllTransactions();
    expect(all.filter((t) => t.idempotencyKey === input.idempotencyKey)).toHaveLength(1);
  });

  it('HARD RULE 3: corrections are immutable reversing entries', async () => {
    const original = await ledgerService.adminFundMemberWallet(
      {
        memberId: '00000000-0000-0000-0000-000000000002',
        amountMinor: 10000,
        currency: 'USD',
        reason: 'Tx to reverse',
        idempotencyKey: 'idemp-to-reverse-01',
      },
      '00000000-0000-0000-0000-000000000099',
      '127.0.0.1',
    );

    const reversal = await ledgerService.reverseTransaction(
      original.id,
      'Administrative adjustment',
      '00000000-0000-0000-0000-000000000099',
      '127.0.0.1',
    );

    expect(reversal.source).toBe('REVERSAL');
    expect(reversal.entries).toHaveLength(2);
    expect(original.status).toBe('VOIDED');
  });

  it('HARD RULE 5: enforces second approver when REQUIRE_SECOND_APPROVER=true', async () => {
    const dualControlConfig = new ConfigService({
      SANDBOX_MODE: 'true',
      REQUIRE_SECOND_APPROVER: 'true',
    });
    const dualControlLedger = new LedgerService(dualControlConfig, auditService);

    const txWithoutSecondApprover = {
      idempotencyKey: 'test-no-approver',
      reference: 'TX-NO-APPROVER',
      description: 'Dual control test',
      currency: 'USD' as const,
      source: 'TEST' as const,
      entries: [
        {
          accountId: '00000000-0000-0000-0000-000000000001',
          accountType: 'LIABILITY' as const,
          direction: 'DEBIT' as const,
          amountMinor: 5000,
          currency: 'USD' as const,
        },
        {
          accountId: '00000000-0000-0000-0000-000000000002',
          accountType: 'ASSET' as const,
          direction: 'CREDIT' as const,
          amountMinor: 5000,
          currency: 'USD' as const,
        },
      ],
    };

    await expect(
      dualControlLedger.postTransaction(
        txWithoutSecondApprover,
        '00000000-0000-0000-0000-000000000099',
        'SUPER_ADMIN',
        '127.0.0.1',
      ),
    ).rejects.toThrow(/REQUIRE_SECOND_APPROVER is enabled/i);
  });

  it('ACCEPTANCE CRITERIA: Funding an unverified member is rejected', async () => {
    const mockKycService = {
      isMemberKycApproved: (id: string) => id === 'verified-member-uuid',
    } as any;

    const kycGuardedLedger = new LedgerService(configService, auditService, mockKycService);

    // 1. Attempt funding unverified member -> strictly rejected with 403
    await expect(
      kycGuardedLedger.adminFundMemberWallet(
        {
          memberId: 'unverified-member-uuid',
          amountMinor: 10000,
          currency: 'USD',
          reason: 'Test funding unverified member',
          idempotencyKey: 'idemp-unverified-fail-1',
        },
        '00000000-0000-0000-0000-000000000099',
        '127.0.0.1',
      ),
    ).rejects.toThrow(/Cannot fund unverified member/i);

    // 2. Approved member funding succeeds
    const tx = await kycGuardedLedger.adminFundMemberWallet(
      {
        memberId: 'verified-member-uuid',
        amountMinor: 10000,
        currency: 'USD',
        reason: 'Test funding verified member',
        idempotencyKey: 'idemp-verified-ok-1',
      },
      '00000000-0000-0000-0000-000000000099',
      '127.0.0.1',
    );

    expect(tx.status).toBe('POSTED');
    expect(tx.entries).toHaveLength(2);
  });

  it('ACCEPTANCE CRITERIA: Concurrent funding and spending tests never produce a negative or mismatched balance', async () => {
    const memberId = 'concurrent-member-001';
    const currency = 'USD';

    // 1. Initial credit of $100.00 (10,000 cents)
    await ledgerService.adminFundMemberWallet(
      {
        memberId,
        amountMinor: 10000,
        currency,
        reason: 'Initial capital for concurrency test',
        idempotencyKey: 'idemp-init-capital-1',
      },
      'admin-actor',
      '127.0.0.1',
    );

    let wallet = ledgerService.getOrCreateMemberWallet(memberId, currency);
    expect(wallet.cachedBalanceMinor).toBe(10000);

    // 2. Launch concurrent operations:
    // - 5 deposits of $20.00 each (+10,000 cents total)
    // - 8 spend attempts of $20.00 each (-16,000 cents total attempted)
    // - 2 overdraw spend attempts of $500.00 each (must fail cleanly)
    const operations: Promise<any>[] = [];

    // 5 deposits
    for (let i = 1; i <= 5; i++) {
      operations.push(
        ledgerService.adminFundMemberWallet(
          {
            memberId,
            amountMinor: 2000,
            currency,
            reason: `Concurrent deposit ${i}`,
            idempotencyKey: `idemp-concurrent-dep-${i}`,
          },
          'admin-actor',
          '127.0.0.1',
        ),
      );
    }

    // 8 spends of 2000 cents
    for (let i = 1; i <= 8; i++) {
      operations.push(
        ledgerService
          .transferOrSpend({
            fromMemberId: memberId,
            toAccountId: 'system-clearing-usd',
            amountMinor: 2000,
            currency,
            description: `Concurrent spend ${i}`,
            idempotencyKey: `idemp-concurrent-spd-${i}`,
            actorId: memberId,
            ipAddress: '127.0.0.1',
          })
          .catch((err) => ({ error: err.message })),
      );
    }

    // 2 massive overdraw attempts (50,000 cents each)
    for (let i = 1; i <= 2; i++) {
      operations.push(
        ledgerService
          .transferOrSpend({
            fromMemberId: memberId,
            toAccountId: 'system-clearing-usd',
            amountMinor: 50000,
            currency,
            description: `Overdraw attempt ${i}`,
            idempotencyKey: `idemp-concurrent-overdraw-${i}`,
            actorId: memberId,
            ipAddress: '127.0.0.1',
          })
          .catch((err) => ({ error: err.message })),
      );
    }

    await Promise.all(operations);

    // 3. Verify member wallet balance is NEVER negative
    wallet = ledgerService.getOrCreateMemberWallet(memberId, currency);
    expect(wallet.cachedBalanceMinor).toBeGreaterThanOrEqual(0);

    // 4. Verify reconciliation: cached balance matches sum of entries exactly
    const recon = ledgerService.reconcileBalances();
    expect(recon.isBalanced).toBe(true);
    expect(recon.discrepancies).toHaveLength(0);
  });

  it('ACCEPTANCE CRITERIA: Sum of all ledger entries per currency is always zero (Zero-Sum Invariant)', async () => {
    // Perform multiple transactions across all 4 currencies: USD, CAD, GBP, EUR
    const currencies: ('USD' | 'CAD' | 'GBP' | 'EUR')[] = ['USD', 'CAD', 'GBP', 'EUR'];

    for (const cur of currencies) {
      const memberA = `member-a-${cur.toLowerCase()}`;
      const memberB = `member-b-${cur.toLowerCase()}`;

      // Admin funding
      await ledgerService.adminFundMemberWallet(
        {
          memberId: memberA,
          amountMinor: 50000, // 500.00
          currency: cur,
          reason: `Funding ${cur}`,
          idempotencyKey: `fund-${cur}-zero-1`,
        },
        'admin-actor',
        '127.0.0.1',
      );

      // Peer transfer
      await ledgerService.transferOrSpend({
        fromMemberId: memberA,
        toMemberId: memberB,
        amountMinor: 15000,
        currency: cur,
        description: `Transfer in ${cur}`,
        idempotencyKey: `trf-${cur}-zero-2`,
        actorId: memberA,
        ipAddress: '127.0.0.1',
      });

      // Merchant spending
      await ledgerService.transferOrSpend({
        fromMemberId: memberB,
        toAccountId: `system-clearing-${cur.toLowerCase()}`,
        amountMinor: 5000,
        currency: cur,
        description: `Card purchase in ${cur}`,
        idempotencyKey: `spend-${cur}-zero-3`,
        actorId: memberB,
        ipAddress: '127.0.0.1',
      });
    }

    // Run full balance reconciliation and check zero-sum invariant
    const reconciliation = ledgerService.reconcileBalances();
    expect(reconciliation.isBalanced).toBe(true);
    expect(reconciliation.discrepancies).toHaveLength(0);

    for (const cur of currencies) {
      const stats = reconciliation.currencyZeroSum[cur];
      expect(stats).toBeDefined();
      expect(stats.totalDebitsMinor).toBe(stats.totalCreditsMinor);
      expect(stats.netMinor).toBe(0);
      expect(stats.isZeroSum).toBe(true);
    }
  });

  it('Member wallets created per currency on first use (USD, CAD, GBP, EUR)', () => {
    const memberId = 'multi-curr-member-999';

    const balances = ledgerService.getMemberBalances(memberId);
    expect(balances).toHaveLength(4);

    const currencies = balances.map((b) => b.currency);
    expect(currencies).toContain('USD');
    expect(currencies).toContain('CAD');
    expect(currencies).toContain('GBP');
    expect(currencies).toContain('EUR');

    for (const b of balances) {
      expect(b.balanceMinor).toBe(0);
      expect(b.accountType).toBe('MEMBER_WALLET');
    }
  });

  it('Wallet Statement export generates valid CSV and JSON statements', async () => {
    const memberId = 'statement-member-001';

    // Fund wallet
    await ledgerService.adminFundMemberWallet(
      {
        memberId,
        amountMinor: 15000,
        currency: 'USD',
        reason: 'Monthly stipend credit',
        idempotencyKey: 'idemp-stmt-fund-1',
      },
      'admin-actor',
      '127.0.0.1',
    );

    // Spend
    await ledgerService.transferOrSpend({
      fromMemberId: memberId,
      toAccountId: 'system-clearing-usd',
      amountMinor: 4500,
      currency: 'USD',
      description: 'Grocery store sandbox spend',
      idempotencyKey: 'idemp-stmt-spend-1',
      actorId: memberId,
      ipAddress: '127.0.0.1',
    });

    // 1. Export CSV
    const csv = ledgerService.exportStatementCsv(memberId);
    expect(csv).toContain('Date (UTC),Reference,Description,Direction');
    expect(csv).toContain('Monthly stipend credit');
    expect(csv).toContain('Grocery store sandbox spend');
    expect(csv).toContain('USD');

    // 2. Export PDF format
    const pdfData = ledgerService.exportStatementPdf(memberId);
    const parsed = JSON.parse(pdfData);
    expect(parsed.title).toContain('Lumenfield Sandbox Account Statement');
    expect(parsed.notice).toContain('Sandbox environment: all balances are test funds, not real money.');
    expect(parsed.activity.length).toBeGreaterThanOrEqual(2);
  });

  it('Production mode enforces depositReference and dual-approval pending flow', async () => {
    const prodConfig = new ConfigService({
      SANDBOX_MODE: 'false',
      PRODUCTION_MODE: 'true',
      REQUIRE_SECOND_APPROVER: 'true',
    });
    const prodLedger = new LedgerService(prodConfig, auditService);

    // 1. Rejects source=TEST in production mode
    await expect(
      prodLedger.postTransaction(
        {
          idempotencyKey: 'prod-test-reject',
          reference: 'TX-PROD-TEST',
          description: 'Attempt test in prod',
          currency: 'USD',
          source: 'TEST',
          entries: [
            {
              accountId: 'system-pool-usd',
              direction: 'DEBIT',
              amountMinor: 5000,
              currency: 'USD',
            },
            {
              accountId: 'wallet-prod-1-usd',
              direction: 'CREDIT',
              amountMinor: 5000,
              currency: 'USD',
            },
          ],
        },
        'admin-1',
        'SUPER_ADMIN',
        '127.0.0.1',
      ),
    ).rejects.toThrow(/source=TEST is forbidden when PRODUCTION_MODE is enabled/i);

    // 2. Rejects DEPOSIT without depositReference in production mode
    await expect(
      prodLedger.postTransaction(
        {
          idempotencyKey: 'prod-no-dep-ref',
          reference: 'TX-PROD-NO-REF',
          description: 'Attempt deposit without ref',
          currency: 'USD',
          source: 'DEPOSIT',
          entries: [
            {
              accountId: 'system-clearing-usd',
              direction: 'DEBIT',
              amountMinor: 5000,
              currency: 'USD',
            },
            {
              accountId: 'wallet-prod-1-usd',
              direction: 'CREDIT',
              amountMinor: 5000,
              currency: 'USD',
            },
          ],
        },
        'admin-1',
        'SUPER_ADMIN',
        '127.0.0.1',
      ),
    ).rejects.toThrow(/depositReference is required/i);

    // 3. With depositReference and REQUIRE_SECOND_APPROVER, enters PENDING_APPROVAL state
    const pendingTx = await prodLedger.postTransaction(
      {
        idempotencyKey: 'prod-pending-1',
        reference: 'TX-PROD-PENDING-1',
        description: 'Large institutional bank deposit',
        currency: 'USD',
        source: 'DEPOSIT',
        depositReference: 'WIRE-2026-CHASE-0099',
        entries: [
          {
            accountId: 'system-clearing-usd',
            direction: 'DEBIT',
            amountMinor: 500000,
            currency: 'USD',
          },
          {
            accountId: 'wallet-prod-1-usd',
            direction: 'CREDIT',
            amountMinor: 500000,
            currency: 'USD',
          },
        ],
      },
      'admin-1',
      'SUPER_ADMIN',
      '127.0.0.1',
    );

    expect(pendingTx.status).toBe('PENDING_APPROVAL');

    // Balances not updated while pending
    const walletBeforeApproval = prodLedger.getAccount('wallet-prod-1-usd');
    expect(walletBeforeApproval?.cachedBalanceMinor || 0).toBe(0);

    // 4. Second approver cannot be the same creator
    await expect(
      prodLedger.approvePendingTransaction(pendingTx.id, 'admin-1', '127.0.0.1'),
    ).rejects.toThrow(/transaction creator cannot be the second approver/i);

    // 5. Second approver (distinct admin) approves
    const approvedTx = await prodLedger.approvePendingTransaction(
      pendingTx.id,
      'admin-2',
      '127.0.0.1',
    );
    expect(approvedTx.status).toBe('POSTED');
    expect(approvedTx.secondApprovedById).toBe('admin-2');

    // Balances are now committed
    const walletAfterApproval = prodLedger.getAccount('wallet-prod-1-usd');
    expect(walletAfterApproval?.cachedBalanceMinor).toBe(500000);
  });
});

