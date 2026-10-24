import {
  PostLedgerTransactionInput,
  PostLedgerTransactionSchema,
  AdminFundWalletInput,
  AdminFundWalletSchema,
  WalletTransactionQuery,
  WalletTransactionQuerySchema,
  assertValidMinorUnits,
  formatMoney,
  parseMajorToMinor,
  TransactionSource,
  AccountType,
  SupportedCurrency,
} from '@lumenfield/shared';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import type { KycService } from '../kyc/kyc.service';
import type { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';

export interface AccountRecord {
  id: string;
  memberId: string | null;
  accountType: AccountType;
  currency: SupportedCurrency;
  name: string;
  cachedBalanceMinor: number;
  allowNegative: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntryRecord {
  id: string;
  transactionId: string;
  accountId: string;
  accountType: AccountType;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  currency: SupportedCurrency;
  createdAt: string;
}

export interface LedgerTransactionRecord {
  id: string;
  transactionType: string;
  reference: string;
  idempotencyKey: string;
  description: string;
  currency: string;
  source: TransactionSource;
  status: 'POSTED' | 'VOIDED' | 'PENDING_APPROVAL';
  depositReference?: string;
  metadata?: Record<string, any>;
  createdById: string;
  secondApprovedById?: string;
  createdAt: string;
  entries: LedgerEntryRecord[];
}

export interface WalletBalanceSummary {
  accountId: string;
  currency: SupportedCurrency;
  currencySymbol: string;
  balanceMinor: number;
  balanceFormatted: string;
  accountType: AccountType;
  updatedAt: string;
}

export class LedgerService {
  private accounts = new Map<string, AccountRecord>();
  private memberWallets = new Map<string, string>(); // key: `${memberId}:${currency}` -> accountId
  private transactions: LedgerTransactionRecord[] = [];
  private idempotencyStore = new Map<string, LedgerTransactionRecord>();

  constructor(
    private readonly configService: ConfigService = ConfigService.getInstance(),
    private readonly auditService: AuditService = new AuditService(),
    public readonly kycService?: KycService,
    private readonly authService?: AuthService,
    private readonly emailService: EmailService = EmailService.getInstance(),
  ) {
    this.initSystemAccounts();
  }

  /**
   * Initialize standard System Accounts per enabled currency (USD, CAD, GBP, EUR)
   */
  private initSystemAccounts(): void {
    const currencies: SupportedCurrency[] = ['USD', 'CAD', 'GBP', 'EUR'];
    const now = new Date().toISOString();

    for (const cur of currencies) {
      // 1. Sandbox Funding Pool (Source for admin sandbox credits)
      const poolId = `system-pool-${cur.toLowerCase()}`;
      this.accounts.set(poolId, {
        id: poolId,
        memberId: null,
        accountType: 'SANDBOX_FUNDING_POOL',
        currency: cur,
        name: `Sandbox ${cur} Funding Pool`,
        cachedBalanceMinor: 0,
        allowNegative: true, // Funding pools draw down into negative / represent issued test liabilities
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Platform Fee Account
      const feeId = `system-fee-${cur.toLowerCase()}`;
      this.accounts.set(feeId, {
        id: feeId,
        memberId: null,
        accountType: 'FEE',
        currency: cur,
        name: `Lumenfield Platform ${cur} Fee Account`,
        cachedBalanceMinor: 0,
        allowNegative: false,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });

      // 3. External Clearing Account (For external bank & wire settlements)
      const clearingId = `system-clearing-${cur.toLowerCase()}`;
      this.accounts.set(clearingId, {
        id: clearingId,
        memberId: null,
        accountType: 'EXTERNAL_CLEARING',
        currency: cur,
        name: `External ${cur} Clearing Account`,
        cachedBalanceMinor: 0,
        allowNegative: true,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });

      // 4. Loan Receivable Account (Principal receivable asset)
      const loanId = `system-loan-${cur.toLowerCase()}`;
      this.accounts.set(loanId, {
        id: loanId,
        memberId: null,
        accountType: 'LOAN_RECEIVABLE',
        currency: cur,
        name: `Loan Principal ${cur} Receivable`,
        cachedBalanceMinor: 0,
        allowNegative: false,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Legacy test alias: '00000000-0000-0000-0000-000000000001' maps to system USD pool
    const legacyPoolId = '00000000-0000-0000-0000-000000000001';
    this.accounts.set(legacyPoolId, {
      id: legacyPoolId,
      memberId: null,
      accountType: 'SANDBOX_FUNDING_POOL',
      currency: 'USD',
      name: 'System Reserve Liability Account (Legacy USD)',
      cachedBalanceMinor: 0,
      allowNegative: true,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Helper to retrieve or create a member's currency wallet on first use.
   * Member wallets are created per currency on first use (USD, CAD, GBP, EUR).
   */
  getOrCreateMemberWallet(
    memberId: string,
    currency: SupportedCurrency,
    memberName?: string,
  ): AccountRecord {
    const key = `${memberId}:${currency}`;
    const existingId = this.memberWallets.get(key);
    if (existingId && this.accounts.has(existingId)) {
      return this.accounts.get(existingId)!;
    }

    // If memberId is itself an existing account ID
    if (this.accounts.has(memberId)) {
      const acc = this.accounts.get(memberId)!;
      if (acc.currency === currency) {
        this.memberWallets.set(key, acc.id);
        return acc;
      }
    }

    const now = new Date().toISOString();
    const accountId = memberId.startsWith('wallet-')
      ? memberId
      : `wallet-${memberId.replace(/[^a-zA-Z0-9_-]/g, '')}-${currency.toLowerCase()}`;

    const wallet: AccountRecord = {
      id: accountId,
      memberId: memberId.startsWith('wallet-') ? null : memberId,
      accountType: 'MEMBER_WALLET',
      currency,
      name: memberName ? `${memberName} (${currency} Wallet)` : `Member Wallet (${currency})`,
      cachedBalanceMinor: 0,
      allowNegative: false, // Member wallets strictly forbid negative balances!
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(accountId, wallet);
    this.memberWallets.set(key, accountId);
    if (memberId !== accountId) {
      this.accounts.set(memberId, wallet);
    }
    return wallet;
  }

  /**
   * Retrieve an account by ID, or create a member wallet if the ID is a member ID.
   */
  private resolveAccount(accountId: string, currency: SupportedCurrency): AccountRecord {
    if (this.accounts.has(accountId)) {
      return this.accounts.get(accountId)!;
    }
    // Check if accountId is formatted as a member ID (e.g. UUID or LF-XXXXXX)
    return this.getOrCreateMemberWallet(accountId, currency);
  }

  /**
   * Posts an immutable double-entry transaction atomically.
   * Enforces:
   * 1. Idempotency key (returns existing transaction if previously posted)
   * 2. Integer minor units only (no floats)
   * 3. Balanced debits and credits: sum(DEBIT) == sum(CREDIT)
   * 4. Multi-currency protection (entries must match tx currency)
   * 5. Strict prevention of negative balances on accounts with allowNegative=false
   * 6. Dual approval if REQUIRE_SECOND_APPROVER=true or PRODUCTION_MODE=true
   */
  async postTransaction(
    input: PostLedgerTransactionInput,
    actorId: string,
    actorRole: 'SUPER_ADMIN' | 'MEMBER',
    ipAddress: string,
  ): Promise<LedgerTransactionRecord> {
    // 1. Idempotency Check (Replay Attack / Duplicate Prevention)
    if (this.idempotencyStore.has(input.idempotencyKey)) {
      return this.idempotencyStore.get(input.idempotencyKey)!;
    }

    // 2. Validate input schema
    const validated = PostLedgerTransactionSchema.parse(input);

    // 3. Dual-control & production checks
    let isPendingApproval = false;
    if (this.configService.requireSecondApprover && !validated.secondApprovedByUserId) {
      if (this.configService.isProduction) {
        isPendingApproval = true;
      } else {
        throw new Error('REQUIRE_SECOND_APPROVER is enabled: a second approver user ID is mandatory.');
      }
    }

    if (this.configService.isProduction) {
      if (validated.source === 'TEST') {
        throw new Error('source=TEST is forbidden when PRODUCTION_MODE is enabled.');
      }
      if ((validated.source === 'DEPOSIT' || validated.source === 'BANK') && !validated.depositReference) {
        throw new Error('depositReference is required for source=DEPOSIT/BANK in PRODUCTION_MODE.');
      }
    }

    // 4. Verify each amount is a strict integer minor unit
    for (const entry of validated.entries) {
      assertValidMinorUnits(entry.amountMinor);
    }

    // 5. Pre-validate account prospective balances to forbid negative member balances
    const prospectiveDeltas = new Map<string, number>();

    for (const entry of validated.entries) {
      const account = this.resolveAccount(entry.accountId, entry.currency as SupportedCurrency);

      // In double-entry wallet accounting:
      // CREDIT to a member wallet increases balance (funding, payment received)
      // DEBIT to a member wallet decreases balance (spending, withdrawal)
      let delta = 0;
      if (account.accountType === 'MEMBER_WALLET' || account.accountType === 'ASSET') {
        delta = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
      } else {
        // Liability / Funding Pool: DEBIT decreases the pool
        delta = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
      }

      const currentAccum = prospectiveDeltas.get(account.id) ?? 0;
      prospectiveDeltas.set(account.id, currentAccum + delta);
    }

    // Ensure no non-negative account falls below 0
    if (!isPendingApproval) {
      for (const [accId, delta] of prospectiveDeltas.entries()) {
        const account = this.accounts.get(accId);
        if (account && !account.allowNegative) {
          const projected = account.cachedBalanceMinor + delta;
          if (projected < 0) {
            const err: any = new Error(
              `Insufficient funds: account "${account.name}" balance cannot become negative (${projected} minor units).`,
            );
            err.statusCode = 400;
            throw err;
          }
        }
      }
    }

    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: LedgerTransactionRecord = {
      id: txId,
      transactionType: validated.transactionType || 'GENERAL',
      reference: validated.reference,
      idempotencyKey: validated.idempotencyKey,
      description: validated.description,
      currency: validated.currency,
      source: validated.source,
      status: isPendingApproval ? 'PENDING_APPROVAL' : 'POSTED',
      depositReference: validated.depositReference,
      metadata: validated.metadata,
      createdById: actorId,
      secondApprovedById: validated.secondApprovedByUserId,
      createdAt: now,
      entries: validated.entries.map((e) => {
        const account = this.resolveAccount(e.accountId, e.currency as SupportedCurrency);
        return {
          id: crypto.randomUUID(),
          transactionId: txId,
          accountId: account.id,
          accountType: account.accountType,
          direction: e.direction,
          amountMinor: e.amountMinor,
          currency: e.currency as SupportedCurrency,
          createdAt: now,
        };
      }),
    };

    // Store transaction (immutable)
    this.transactions.push(record);
    this.idempotencyStore.set(validated.idempotencyKey, record);

    // Atomically apply balance updates if not pending approval
    if (!isPendingApproval) {
      for (const [accId, delta] of prospectiveDeltas.entries()) {
        const account = this.accounts.get(accId);
        if (account) {
          account.cachedBalanceMinor += delta;
          account.updatedAt = now;
        }
      }
    }

    // Record audit log
    await this.auditService.record({
      actorId,
      actorRole,
      action: isPendingApproval ? 'ADMIN_CREATE_PENDING_TRANSACTION' : 'ADMIN_FUND_WALLET',
      targetType: 'LEDGER_TRANSACTION',
      targetId: record.id,
      beforeState: null,
      afterState: {
        reference: record.reference,
        amountMinor: validated.entries[0]?.amountMinor,
        currency: record.currency,
        source: record.source,
        status: record.status,
      },
      ipAddress,
    });

    return record;
  }

  /**
   * Admin funding method.
   * In sandbox mode, debits SANDBOX_FUNDING_POOL and credits member wallet with source=TEST.
   * When PRODUCTION_MODE is true, requires a deposit reference and dual approver if enabled.
   * REJECTS funding if member is not verified (HARD RULE).
   */
  async adminFundMemberWallet(
    input: AdminFundWalletInput,
    adminId: string,
    ipAddress: string,
  ): Promise<LedgerTransactionRecord> {
    const validated = AdminFundWalletSchema.parse(input);

    // 1. HARD RULE: Reject funding unverified members
    if (this.kycService && !this.kycService.isMemberKycApproved(validated.memberId)) {
      const err: any = new Error(
        `Cannot fund unverified member ${validated.memberId}. Member identity verification (KYC) must be APPROVED.`,
      );
      err.statusCode = 403;
      throw err;
    }

    // 2. Normalize minor units
    let amountMinor = validated.amountMinor;
    if (amountMinor === undefined && validated.amount !== undefined) {
      amountMinor = parseMajorToMinor(validated.amount.toString(), validated.currency).amountMinor;
    }
    if (!amountMinor || amountMinor <= 0) {
      const err: any = new Error('Funding amount must be greater than zero.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Idempotency Key
    const idempotencyKey =
      validated.idempotencyKey || `idemp-fund-${validated.memberId}-${Date.now()}`;

    // Return existing if replayed
    if (this.idempotencyStore.has(idempotencyKey)) {
      return this.idempotencyStore.get(idempotencyKey)!;
    }

    // 4. Source & Reference
    const isSandbox = this.configService.isSandbox;
    const source: TransactionSource = isSandbox
      ? 'TEST'
      : (validated.source as TransactionSource) || 'DEPOSIT';
    const reference =
      validated.reference || `TX-FND-${Date.now().toString(36).toUpperCase()}`;

    // 5. System Pool and Member Wallet
    const systemPool =
      this.accounts.get(`system-pool-${validated.currency.toLowerCase()}`) ||
      this.accounts.get('00000000-0000-0000-0000-000000000001')!;
    const memberWallet = this.getOrCreateMemberWallet(
      validated.memberId,
      validated.currency,
    );

    const prevBalance = memberWallet.cachedBalanceMinor;

    const tx = await this.postTransaction(
      {
        idempotencyKey,
        reference,
        transactionType: 'FUNDING',
        description: `Admin Wallet Funding: ${validated.reason}`,
        currency: validated.currency,
        source,
        depositReference: validated.depositReference,
        metadata: {
          reason: validated.reason,
          memberId: validated.memberId,
          fundingSource: isSandbox ? 'Test credit (sandbox)' : validated.source || 'Bank Deposit',
          sandboxMode: isSandbox,
        },
        entries: [
          {
            accountId: systemPool.id,
            accountType: 'SANDBOX_FUNDING_POOL',
            direction: 'DEBIT',
            amountMinor,
            currency: validated.currency,
          },
          {
            accountId: memberWallet.id,
            accountType: 'MEMBER_WALLET',
            direction: 'CREDIT',
            amountMinor,
            currency: validated.currency,
          },
        ],
      },
      adminId,
      'SUPER_ADMIN',
      ipAddress,
    );

    const amountFormatted = formatMoney({
      amountMinor,
      currency: validated.currency,
    });
    const member = this.authService?.getUserById(validated.memberId);

    if (tx.status === 'PENDING_APPROVAL') {
      void this.emailService.sendAdminDualApprovalPendingEmail({
        amountFormatted,
        reference: tx.reference,
        memberId: validated.memberId,
        transactionId: tx.id,
      });
    } else if (member?.email) {
      void this.emailService.sendWalletFundedEmail(member.email, member.fullName, {
        amountFormatted,
        currency: validated.currency,
        reference: tx.reference,
        reason: validated.reason,
      });
    }

    return tx;
  }

  /**
   * Approve a pending transaction (HARD RULE 5: Dual-Control Approval)
   */
  async approvePendingTransaction(
    transactionId: string,
    approverId: string,
    ipAddress: string,
  ): Promise<LedgerTransactionRecord> {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) {
      const err: any = new Error(`Transaction ${transactionId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (tx.status !== 'PENDING_APPROVAL') {
      const err: any = new Error(`Transaction is not pending approval (status: ${tx.status})`);
      err.statusCode = 400;
      throw err;
    }

    if (tx.createdById === approverId) {
      const err: any = new Error('Dual-control violation: transaction creator cannot be the second approver.');
      err.statusCode = 403;
      throw err;
    }

    // Apply prospective balance deltas
    for (const entry of tx.entries) {
      const account = this.accounts.get(entry.accountId);
      if (account) {
        let delta = 0;
        if (account.accountType === 'MEMBER_WALLET' || account.accountType === 'ASSET') {
          delta = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
        } else {
          delta = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
        }
        account.cachedBalanceMinor += delta;
        account.updatedAt = new Date().toISOString();
      }
    }

    tx.status = 'POSTED';
    tx.secondApprovedById = approverId;

    await this.auditService.record({
      actorId: approverId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_APPROVE_TRANSACTION',
      targetType: 'LEDGER_TRANSACTION',
      targetId: tx.id,
      beforeState: { status: 'PENDING_APPROVAL' },
      afterState: { status: 'POSTED', approverId },
      ipAddress,
    });

    const memberId = tx.metadata?.memberId as string | undefined;
    const creditEntry = tx.entries.find(
      (e) => e.accountType === 'MEMBER_WALLET' && e.direction === 'CREDIT',
    );
    if (memberId && creditEntry) {
      const member = this.authService?.getUserById(memberId);
      if (member?.email) {
        const amountFormatted = formatMoney({
          amountMinor: creditEntry.amountMinor,
          currency: creditEntry.currency,
        });
        void this.emailService.sendDualApprovalPostedEmail(member.email, member.fullName, {
          amountFormatted,
          reference: tx.reference,
        });
        void this.emailService.sendWalletFundedEmail(member.email, member.fullName, {
          amountFormatted,
          currency: creditEntry.currency,
          reference: tx.reference,
          reason: (tx.metadata?.reason as string) || tx.description,
        });
      }
    }

    return tx;
  }

  /**
   * Reverse transaction: Entries are immutable, so corrections create
   * a brand new reversing transaction with opposite debit/credit directions.
   */
  async reverseTransaction(
    originalTransactionId: string,
    reason: string,
    actorId: string,
    ipAddress: string,
  ): Promise<LedgerTransactionRecord> {
    const original = this.transactions.find((t) => t.id === originalTransactionId);
    if (!original) {
      throw new Error(`Transaction ${originalTransactionId} not found`);
    }

    if (original.status === 'VOIDED') {
      throw new Error(`Transaction ${originalTransactionId} has already been reversed`);
    }

    const reversingEntries = original.entries.map((e) => ({
      accountId: e.accountId,
      accountType: e.accountType,
      direction: (e.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
      amountMinor: e.amountMinor,
      currency: e.currency as SupportedCurrency,
    }));

    original.status = 'VOIDED';

    const reversal = await this.postTransaction(
      {
        idempotencyKey: `REV-${original.idempotencyKey}-${Date.now()}`,
        reference: `REV-${original.reference}`,
        transactionType: 'REVERSAL',
        description: `Correction Reversal: ${reason} (Original: ${original.reference})`,
        currency: original.currency as SupportedCurrency,
        source: 'REVERSAL',
        metadata: {
          originalTransactionId: original.id,
          reason,
        },
        entries: reversingEntries,
      },
      actorId,
      'SUPER_ADMIN',
      ipAddress,
    );

    return reversal;
  }

  /**
   * Member spending / transfer method:
   * Moves funds from sender member wallet to recipient member wallet or external clearing.
   * Atomically verifies that sender's wallet never goes below zero.
   */
  async transferOrSpend(params: {
    fromMemberId: string;
    toMemberId?: string;
    toAccountId?: string;
    amountMinor: number;
    currency: SupportedCurrency;
    description: string;
    idempotencyKey: string;
    source?: TransactionSource;
    actorId: string;
    ipAddress: string;
  }): Promise<LedgerTransactionRecord> {
    const {
      fromMemberId,
      toMemberId,
      toAccountId,
      amountMinor,
      currency,
      description,
      idempotencyKey,
      source = 'TRANSFER',
      actorId,
      ipAddress,
    } = params;

    assertValidMinorUnits(amountMinor);

    const fromWallet = this.getOrCreateMemberWallet(fromMemberId, currency);
    const destAccount = toMemberId
      ? this.getOrCreateMemberWallet(toMemberId, currency)
      : toAccountId
      ? this.resolveAccount(toAccountId, currency)
      : this.accounts.get(`system-clearing-${currency.toLowerCase()}`)!;

    const reference = `TX-TRF-${Date.now().toString(36).toUpperCase()}`;

    return this.postTransaction(
      {
        idempotencyKey,
        reference,
        transactionType: 'TRANSFER',
        description,
        currency,
        source,
        entries: [
          {
            accountId: fromWallet.id,
            accountType: 'MEMBER_WALLET',
            direction: 'DEBIT', // Outflow from sender
            amountMinor,
            currency,
          },
          {
            accountId: destAccount.id,
            accountType: destAccount.accountType,
            direction: 'CREDIT', // Inflow to recipient
            amountMinor,
            currency,
          },
        ],
      },
      actorId,
      'MEMBER',
      ipAddress,
    );
  }

  /**
   * Wallet Balances for Member across enabled currencies (USD, CAD, GBP, EUR)
   */
  getMemberBalances(memberId: string): WalletBalanceSummary[] {
    const currencies: SupportedCurrency[] = ['USD', 'CAD', 'GBP', 'EUR'];
    const summaries: WalletBalanceSummary[] = [];

    const symbols: Record<SupportedCurrency, string> = {
      USD: '$',
      CAD: 'CA$',
      GBP: '£',
      EUR: '€',
    };

    for (const cur of currencies) {
      const wallet = this.getOrCreateMemberWallet(memberId, cur);
      summaries.push({
        accountId: wallet.id,
        currency: cur,
        currencySymbol: symbols[cur],
        balanceMinor: wallet.cachedBalanceMinor,
        balanceFormatted: formatMoney({ amountMinor: wallet.cachedBalanceMinor, currency: cur }),
        accountType: wallet.accountType,
        updatedAt: wallet.updatedAt,
      });
    }

    return summaries;
  }

  /**
   * Get single currency balance in minor units for a member
   */
  getMemberBalance(memberId: string, currency: SupportedCurrency): number {
    const wallet = this.getOrCreateMemberWallet(memberId, currency);
    return wallet.cachedBalanceMinor;
  }

  /**
   * Wallet Transaction History with Pagination & Filtering
   */
  getMemberTransactions(
    memberId: string,
    query: WalletTransactionQuery,
  ): {
    data: Array<{
      id: string;
      transactionId: string;
      reference: string;
      description: string;
      direction: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      amountFormatted: string;
      currency: string;
      currencySymbol: string;
      source: string;
      status: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const validated = WalletTransactionQuerySchema.parse(query);
    const symbols: Record<string, string> = { USD: '$', CAD: 'CA$', GBP: '£', EUR: '€' };

    // Find all accounts owned by this member
    const memberAccountIds = new Set<string>();
    for (const acc of this.accounts.values()) {
      if (acc.memberId === memberId || acc.id === memberId) {
        memberAccountIds.add(acc.id);
      }
    }

    // Flatten all entries for this member
    let entriesWithTx: Array<{
      id: string;
      transactionId: string;
      reference: string;
      description: string;
      direction: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      amountFormatted: string;
      currency: string;
      currencySymbol: string;
      source: string;
      status: string;
      createdAt: string;
    }> = [];

    for (const tx of this.transactions) {
      for (const entry of tx.entries) {
        if (memberAccountIds.has(entry.accountId)) {
          entriesWithTx.push({
            id: entry.id,
            transactionId: tx.id,
            reference: tx.reference,
            description: tx.description,
            direction: entry.direction,
            amountMinor: entry.amountMinor,
            amountFormatted: formatMoney({
              amountMinor: entry.amountMinor,
              currency: entry.currency as SupportedCurrency,
            }),
            currency: entry.currency,
            currencySymbol: symbols[entry.currency] || '$',
            source: tx.source,
            status: tx.status,
            createdAt: entry.createdAt,
          });
        }
      }
    }

    // Filter by currency
    if (validated.currency) {
      entriesWithTx = entriesWithTx.filter((e) => e.currency === validated.currency);
    }

    // Filter by direction
    if (validated.direction && validated.direction !== 'ALL') {
      entriesWithTx = entriesWithTx.filter((e) => e.direction === validated.direction);
    }

    // Filter by source
    if (validated.source) {
      entriesWithTx = entriesWithTx.filter((e) => e.source === validated.source);
    }

    // Filter by search
    if (validated.search) {
      const q = validated.search.toLowerCase();
      entriesWithTx = entriesWithTx.filter(
        (e) =>
          e.reference.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q),
      );
    }

    // Filter by date range
    if (validated.startDate) {
      entriesWithTx = entriesWithTx.filter((e) => e.createdAt >= validated.startDate!);
    }
    if (validated.endDate) {
      entriesWithTx = entriesWithTx.filter((e) => e.createdAt <= validated.endDate!);
    }

    // Sort descending by date
    entriesWithTx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = entriesWithTx.length;
    const page = validated.page;
    const limit = validated.limit;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = entriesWithTx.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Export Member Statement in CSV format
   */
  exportStatementCsv(memberId: string, currency?: string): string {
    const transactions = this.getMemberTransactions(memberId, {
      page: 1,
      limit: 1000,
      currency: currency as any,
    });

    const headers = [
      'Date (UTC)',
      'Reference',
      'Description',
      'Direction',
      'Amount (Minor Units)',
      'Amount (Formatted)',
      'Currency',
      'Source',
      'Status',
    ];

    const rows = transactions.data.map((tx) => [
      `"${tx.createdAt}"`,
      `"${tx.reference}"`,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${tx.direction}"`,
      tx.amountMinor,
      `"${tx.amountFormatted}"`,
      `"${tx.currency}"`,
      `"${tx.source}"`,
      `"${tx.status}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export Member Statement formatted document
   */
  exportStatementPdf(memberId: string, currency?: string): string {
    const balances = this.getMemberBalances(memberId);
    const transactions = this.getMemberTransactions(memberId, {
      page: 1,
      limit: 100,
      currency: currency as any,
    });

    return JSON.stringify({
      title: 'Lumenfield Credit Union Account Statement',
      notice: 'Lumenfield Credit Union — official member account statement.',
      memberId,
      currency: currency || 'ALL',
      generatedAt: new Date().toISOString(),
      balances: balances.map((b) => ({
        currency: b.currency,
        balanceMinor: b.balanceMinor,
        balanceFormatted: b.balanceFormatted,
      })),
      activity: transactions.data,
    });
  }

  /**
   * Export Member Statement in printable HTML/PDF format
   */
  exportStatementHtml(memberId: string, currency?: string): string {
    const balances = this.getMemberBalances(memberId);
    const transactions = this.getMemberTransactions(memberId, {
      page: 1,
      limit: 100,
      currency: currency as any,
    });
    const now = new Date().toUTCString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lumenfield Account Statement</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0E1B1F; margin: 40px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0A3D3F; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 700; color: #0A3D3F; }
    .meta { font-size: 13px; color: #4A5B60; text-align: right; }
    h2 { font-size: 16px; color: #0A3D3F; margin-top: 24px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #F4F7F6; color: #4A5B60; text-align: left; padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #DCE5E3; }
    td { padding: 10px 12px; border-bottom: 1px solid #EDF2F1; }
    .text-right { text-align: right; }
    .credit { color: #0A5C47; font-weight: 600; }
    .debit { color: #0E1B1F; font-weight: 600; }
    .footer { font-size: 11px; color: #8FA5A3; margin-top: 40px; text-align: center; border-top: 1px solid #DCE5E3; padding-top: 16px; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Lumenfield Credit Union</div>
      <div style="font-size: 14px; color: #4A5B60; margin-top: 4px;">Member Account Statement</div>
      <div style="font-size: 12px; color: #8FA5A3; margin-top: 2px;">Member ID: <strong>${memberId}</strong></div>
    </div>
    <div class="meta">
      <div><strong>Statement Date:</strong> ${now}</div>
      <div><strong>Currency Scope:</strong> ${currency || 'All Enabled Currencies'}</div>
      <div><strong>Status:</strong> Verified Member</div>
    </div>
  </div>

  <h2>Account Balances Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Currency</th>
        <th>Account Type</th>
        <th class="text-right">Balance (Minor Units)</th>
        <th class="text-right">Balance (Formatted)</th>
      </tr>
    </thead>
    <tbody>
      ${balances
        .map(
          (b) => `<tr>
        <td><strong>${b.currency}</strong></td>
        <td>Member Wallet</td>
        <td class="text-right" style="font-family: monospace;">${b.balanceMinor}</td>
        <td class="text-right" style="font-weight: 600;">${b.balanceFormatted}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2>Ledger Activity & Transactions</h2>
  <table>
    <thead>
      <tr>
        <th>Date (UTC)</th>
        <th>Reference</th>
        <th>Description</th>
        <th>Source</th>
        <th>Direction</th>
        <th class="text-right">Amount</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${
        transactions.data.length === 0
          ? '<tr><td colspan="7" style="text-align: center; color: #8FA5A3;">No transaction entries recorded for this period.</td></tr>'
          : transactions.data
              .map(
                (tx) => `<tr>
        <td style="font-family: monospace; font-size: 11px;">${tx.createdAt.substring(0, 19).replace('T', ' ')}</td>
        <td style="font-family: monospace; font-weight: 600;">${tx.reference}</td>
        <td>${tx.description}</td>
        <td><span style="font-size: 11px; background: #E3F3F1; color: #0A4F4A; padding: 2px 6px; rounded: 4px;">${tx.source}</span></td>
        <td><strong>${tx.direction}</strong></td>
        <td class="text-right ${tx.direction === 'CREDIT' ? 'credit' : 'debit'}">${tx.direction === 'CREDIT' ? '+' : '-'}${tx.currencySymbol}${Math.abs(tx.amountMinor / 100).toFixed(2)}</td>
        <td>${tx.status}</td>
      </tr>`,
              )
              .join('')
      }
    </tbody>
  </table>

  <div class="footer">
    Lumenfield Credit Union — Member account statement. www.lumenfieldcu.com
  </div>
</body>
</html>`;
  }

  /**
   * Balances Reconciliation Job:
   * Compares cached balances against derived sum of ledger entries.
   * Verifies the fundamental double-entry invariant:
   * Sum of all ledger entries per currency is ALWAYS zero!
   */
  reconcileBalances(): {
    isBalanced: boolean;
    zeroSumCheckPassed: boolean;
    totalAccounts: number;
    reconciledAccounts: number;
    discrepancies: Array<{
      accountId: string;
      accountName: string;
      currency: string;
      cachedBalanceMinor: number;
      derivedBalanceMinor: number;
      differenceMinor: number;
    }>;
    currencyZeroSum: Record<
      string,
      {
        currency: string;
        totalDebitsMinor: number;
        totalCreditsMinor: number;
        netMinor: number;
        isZeroSum: boolean;
      }
    >;
  } {
    const discrepancies: Array<{
      accountId: string;
      accountName: string;
      currency: string;
      cachedBalanceMinor: number;
      derivedBalanceMinor: number;
      differenceMinor: number;
    }> = [];

    // 1. Calculate per-account balance from entries
    const derivedBalances = new Map<string, number>();

    for (const tx of this.transactions) {
      if (tx.status === 'PENDING_APPROVAL') continue; // Only skip unapproved pending transactions

      for (const entry of tx.entries) {
        const current = derivedBalances.get(entry.accountId) ?? 0;
        const account = this.accounts.get(entry.accountId);

        let delta = 0;
        if (account?.accountType === 'MEMBER_WALLET' || account?.accountType === 'ASSET') {
          delta = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
        } else {
          delta = entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
        }

        derivedBalances.set(entry.accountId, current + delta);
      }
    }

    // 2. Compare cached balance against derived balance
    let reconciledCount = 0;
    for (const account of this.accounts.values()) {
      const derived = derivedBalances.get(account.id) ?? 0;
      if (account.cachedBalanceMinor !== derived) {
        discrepancies.push({
          accountId: account.id,
          accountName: account.name,
          currency: account.currency,
          cachedBalanceMinor: account.cachedBalanceMinor,
          derivedBalanceMinor: derived,
          differenceMinor: account.cachedBalanceMinor - derived,
        });
      } else {
        reconciledCount++;
      }
    }

    // 3. System-wide Double-Entry Zero-Sum Check:
    // In double entry, across all posted entries for each currency,
    // totalDebits - totalCredits MUST strictly equal 0!
    const currencyTotals: Record<
      string,
      { totalDebits: number; totalCredits: number }
    > = {};

    for (const tx of this.transactions) {
      if (tx.status === 'PENDING_APPROVAL') continue;

      for (const entry of tx.entries) {
        if (!currencyTotals[entry.currency]) {
          currencyTotals[entry.currency] = { totalDebits: 0, totalCredits: 0 };
        }
        if (entry.direction === 'DEBIT') {
          currencyTotals[entry.currency].totalDebits += entry.amountMinor;
        } else {
          currencyTotals[entry.currency].totalCredits += entry.amountMinor;
        }
      }
    }

    const currencyZeroSum: Record<
      string,
      {
        currency: string;
        totalDebitsMinor: number;
        totalCreditsMinor: number;
        netMinor: number;
        isZeroSum: boolean;
      }
    > = {};

    let allZeroSum = true;
    for (const [cur, totals] of Object.entries(currencyTotals)) {
      const net = totals.totalDebits - totals.totalCredits;
      const isZero = net === 0;
      if (!isZero) allZeroSum = false;

      currencyZeroSum[cur] = {
        currency: cur,
        totalDebitsMinor: totals.totalDebits,
        totalCreditsMinor: totals.totalCredits,
        netMinor: net,
        isZeroSum: isZero,
      };
    }

    return {
      isBalanced: discrepancies.length === 0 && allZeroSum,
      zeroSumCheckPassed: allZeroSum,
      totalAccounts: this.accounts.size,
      reconciledAccounts: reconciledCount,
      discrepancies,
      currencyZeroSum,
    };
  }

  async getAllTransactions(): Promise<LedgerTransactionRecord[]> {
    return this.transactions;
  }

  getAccount(accountId: string): AccountRecord | undefined {
    return this.accounts.get(accountId);
  }

  getAllAccounts(): AccountRecord[] {
    return Array.from(this.accounts.values());
  }
}
