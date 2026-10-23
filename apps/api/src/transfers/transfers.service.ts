import crypto from 'crypto';
import {
  AddBeneficiaryInput,
  MemberTransferInput,
  BankTransferInput,
  CryptoTransferInput,
  CryptoNetwork,
  SupportedCurrency,
  TransferType,
  TransferStatus,
  formatMoney,
  assertValidMinorUnits,
} from '@lumenfield/shared';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuthService } from '../auth/auth.service';
import type { KycService } from '../kyc/kyc.service';
import { verifyTotpCode } from '../auth/totp.util';
import { CryptoProvider, SandboxCryptoProvider } from './crypto.provider';

export interface BeneficiaryRecord {
  id: string;
  memberId: string;
  name: string;
  countryCode: string;
  currency: SupportedCurrency;
  details: Record<string, any>;
  isCoolingOff: boolean;
  coolingOffExpiresAt: string;
  createdAt: string;
}

export interface TransferRecord {
  id: string;
  reference: string;
  senderMemberId: string;
  recipientMemberId?: string;
  recipientName?: string;
  beneficiaryId?: string;
  beneficiaryDetails?: Record<string, any>;
  cryptoNetwork?: CryptoNetwork;
  destinationAddress?: string;
  txHash?: string;
  type: TransferType;
  amountMinor: number;
  amountFormatted: string;
  currency: SupportedCurrency;
  status: TransferStatus;
  note?: string;
  ledgerTransactionId?: string;
  reversalLedgerTransactionId?: string;
  idempotencyKey: string;
  isFlagged: boolean;
  fraudFlags: string[];
  failureReason?: string;
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferNotification {
  id: string;
  memberId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  transferId?: string;
  createdAt: string;
  read: boolean;
}

export class TransfersService {
  private beneficiaries = new Map<string, BeneficiaryRecord>();
  private transfers = new Map<string, TransferRecord>();
  private idempotencyStore = new Map<string, TransferRecord>();
  private notifications = new Map<string, TransferNotification[]>(); // memberId -> notifications
  public readonly cryptoProvider: CryptoProvider;

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService = ConfigService.getInstance(),
    private readonly auditService: AuditService = new AuditService(),
    public readonly kycService?: KycService,
    cryptoProviderOverride?: CryptoProvider,
  ) {
    this.cryptoProvider = cryptoProviderOverride || new SandboxCryptoProvider();
    this.seedDemoBeneficiaries();
  }

  private seedDemoBeneficiaries() {
    const demoMemberId = '00000000-0000-0000-0000-000000000002'; // Amara Okafor
    const matureDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48 hours ago (past cooling off)

    const benUS: BeneficiaryRecord = {
      id: 'ben-us-chase-001',
      memberId: demoMemberId,
      name: 'Amara Okafor (Chase Personal)',
      countryCode: 'US',
      currency: 'USD',
      details: {
        routingNumber: '021000021', // Chase NY ABA
        accountNumber: '987654321',
        accountType: 'CHECKING',
      },
      isCoolingOff: false,
      coolingOffExpiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      createdAt: matureDate,
    };

    const benUK: BeneficiaryRecord = {
      id: 'ben-uk-barclays-002',
      memberId: demoMemberId,
      name: 'British Overseas Tech Ltd',
      countryCode: 'GB',
      currency: 'GBP',
      details: {
        sortCode: '20-00-00',
        accountNumber: '83928172',
      },
      isCoolingOff: false,
      coolingOffExpiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      createdAt: matureDate,
    };

    this.beneficiaries.set(benUS.id, benUS);
    this.beneficiaries.set(benUK.id, benUK);
  }

  private validateBeneficiaryDetails(countryCode: string, details: Record<string, any>): void {
    if (!details || typeof details !== 'object') {
      const err: any = new Error('Beneficiary bank account details are required.');
      err.statusCode = 400;
      throw err;
    }

    const cc = countryCode.toUpperCase();
    if (cc === 'US') {
      const routing = String(details.routingNumber || '').trim();
      const account = String(details.accountNumber || '').trim();
      if (!/^\d{9}$/.test(routing)) {
        const err: any = new Error('US routing number (ABA) must be exactly 9 digits.');
        err.statusCode = 400;
        throw err;
      }
      if (!/^\d{4,17}$/.test(account)) {
        const err: any = new Error('US account number must be between 4 and 17 digits.');
        err.statusCode = 400;
        throw err;
      }
    } else if (cc === 'CA') {
      const inst = String(details.institutionNumber || '').trim();
      const transit = String(details.transitNumber || '').trim();
      const account = String(details.accountNumber || '').trim();
      if (!/^\d{3}$/.test(inst)) {
        const err: any = new Error('Canadian institution number must be exactly 3 digits.');
        err.statusCode = 400;
        throw err;
      }
      if (!/^\d{5}$/.test(transit)) {
        const err: any = new Error('Canadian transit number must be exactly 5 digits.');
        err.statusCode = 400;
        throw err;
      }
      if (!/^\d{5,12}$/.test(account)) {
        const err: any = new Error('Canadian account number must be between 5 and 12 digits.');
        err.statusCode = 400;
        throw err;
      }
    } else if (cc === 'GB') {
      const sort = String(details.sortCode || '').replace(/-/g, '').trim();
      const account = String(details.accountNumber || '').trim();
      if (!/^\d{6}$/.test(sort)) {
        const err: any = new Error('UK sort code must be 6 digits (e.g. 20-00-00 or 200000).');
        err.statusCode = 400;
        throw err;
      }
      if (!/^\d{8}$/.test(account)) {
        const err: any = new Error('UK bank account number must be exactly 8 digits.');
        err.statusCode = 400;
        throw err;
      }
    } else {
      // EU / SEPA or other IBAN jurisdictions (DE, FR, ES, IT, NL, etc.)
      const iban = String(details.iban || '').replace(/\s+/g, '').toUpperCase();
      if (!iban || !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
        const err: any = new Error(`Invalid IBAN format for beneficiary in country ${countryCode}.`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // BENEFICIARY MANAGEMENT
  // ---------------------------------------------------------------------------
  async addBeneficiary(memberId: string, input: AddBeneficiaryInput, ipAddress: string): Promise<BeneficiaryRecord> {
    this.validateBeneficiaryDetails(input.countryCode, input.details);

    const coolingHours = this.configService.beneficiaryCoolingOffHours;
    const now = new Date();
    const coolingOffExpiresAt = new Date(now.getTime() + coolingHours * 3600 * 1000).toISOString();

    const beneficiaryId = `ben-${input.countryCode.toLowerCase()}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const record: BeneficiaryRecord = {
      id: beneficiaryId,
      memberId,
      name: input.name,
      countryCode: input.countryCode,
      currency: input.currency,
      details: input.details,
      isCoolingOff: true,
      coolingOffExpiresAt,
      createdAt: now.toISOString(),
    };

    this.beneficiaries.set(beneficiaryId, record);

    await this.auditService.record({
      actorId: memberId,
      actorRole: 'MEMBER',
      action: 'ADD_BENEFICIARY',
      targetType: 'BENEFICIARY',
      targetId: beneficiaryId,
      beforeState: null,
      afterState: {
        name: record.name,
        countryCode: record.countryCode,
        currency: record.currency,
        coolingOffExpiresAt,
      },
      ipAddress,
    });

    this.addNotification({
      memberId,
      title: 'New Beneficiary Added',
      message: `${record.name} (${record.countryCode}) added. 24-hour security cooling-off period active.`,
      type: 'info',
    });

    return record;
  }

  getBeneficiaries(memberId: string): BeneficiaryRecord[] {
    const now = Date.now();
    const list: BeneficiaryRecord[] = [];
    for (const b of this.beneficiaries.values()) {
      if (b.memberId === memberId) {
        const isStillCooling = new Date(b.coolingOffExpiresAt).getTime() > now;
        list.push({
          ...b,
          isCoolingOff: isStillCooling,
        });
      }
    }
    return list;
  }

  getBeneficiary(memberId: string, beneficiaryId: string): BeneficiaryRecord | undefined {
    const b = this.beneficiaries.get(beneficiaryId);
    if (!b || b.memberId !== memberId) return undefined;
    const isStillCooling = new Date(b.coolingOffExpiresAt).getTime() > Date.now();
    return {
      ...b,
      isCoolingOff: isStillCooling,
    };
  }

  // ---------------------------------------------------------------------------
  // RECIPIENT LOOKUP
  // ---------------------------------------------------------------------------
  async lookupRecipient(query: string) {
    const cleanQuery = query.trim().toLowerCase();
    const user = this.authService.getUserById(cleanQuery) ||
      Array.from((this.authService as any).users.values()).find(
        (u: any) =>
          u.email.toLowerCase() === cleanQuery ||
          u.id.toLowerCase() === cleanQuery ||
          (u.memberId && u.memberId.toLowerCase() === cleanQuery),
      );

    if (!user) {
      // Check seeded members
      const demoRecipient = cleanQuery.includes('amara')
        ? { id: '00000000-0000-0000-0000-000000000002', name: 'Amara Okafor', email: 'amara.o@lumenfield.test', country: 'US', verified: true }
        : cleanQuery.includes('lf-000089') || cleanQuery.includes('kwame')
        ? { id: 'LF-000089', name: 'Kwame Mensah', email: 'kwame.m@lumenfield.test', country: 'CA', verified: true }
        : cleanQuery.includes('elena') || cleanQuery.includes('lf-000104')
        ? { id: 'LF-000104', name: 'Elena Rostova', email: 'elena.r@lumenfield.test', country: 'GB', verified: true }
        : null;

      if (!demoRecipient) {
        return null;
      }

      return {
        id: demoRecipient.id,
        recipientId: demoRecipient.id,
        name: demoRecipient.name,
        maskedEmail: demoRecipient.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        country: demoRecipient.country,
        identityVerified: demoRecipient.verified,
        lumenfieldTag: demoRecipient.id.startsWith('LF-') ? demoRecipient.id : `LF-${demoRecipient.id.slice(-6).toUpperCase()}`,
      };
    }

    return {
      id: (user as any).id,
      recipientId: (user as any).id,
      name: (user as any).fullName,
      maskedEmail: (user as any).email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      country: (user as any).countryCode,
      identityVerified:
        (user as any).id === '00000000-0000-0000-0000-000000000002' ||
        (this.kycService?.isMemberKycApproved((user as any).id) ?? true),
      lumenfieldTag: `LF-${(user as any).id.slice(-6).toUpperCase()}`,
    };
  }

  // ---------------------------------------------------------------------------
  // AVAILABLE BALANCE CALCULATION (INCLUDING PENDING OUTFLOWS)
  // Acceptance Criterion: A member cannot send more than their available balance,
  // including pending items.
  // ---------------------------------------------------------------------------
  getPendingOutflowMinor(memberId: string, currency: SupportedCurrency): number {
    let pending = 0;
    for (const t of this.transfers.values()) {
      if (
        t.senderMemberId === memberId &&
        t.currency === currency &&
        (t.status === 'PENDING' || t.status === 'PROCESSING') &&
        !t.ledgerTransactionId
      ) {
        pending += t.amountMinor;
      }
    }
    return pending;
  }

  getAvailableBalanceMinor(memberId: string, currency: SupportedCurrency): number {
    const wallet = this.ledgerService.getOrCreateMemberWallet(memberId, currency);
    const pendingOutflow = this.getPendingOutflowMinor(memberId, currency);
    return Math.max(0, wallet.cachedBalanceMinor - pendingOutflow);
  }

  // ---------------------------------------------------------------------------
  // LIMITS, FRAUD VELOCITY & MFA STEP-UP VALIDATION
  // Acceptance Criterion: Limits and MFA step-up are enforced on the server.
  // ---------------------------------------------------------------------------
  private async validateTransferControls(params: {
    senderUserId: string;
    amountMinor: number;
    currency: SupportedCurrency;
    totpCode?: string;
  }): Promise<{ isFlagged: boolean; fraudFlags: string[] }> {
    const { senderUserId, amountMinor, currency, totpCode } = params;
    assertValidMinorUnits(amountMinor);

    // 1. Per-transaction limit
    const singleLimit = this.configService.transferTransactionLimitMinor;
    if (amountMinor > singleLimit) {
      const err: any = new Error(
        `Per-transaction limit exceeded: transfer amount (${formatMoney({ amountMinor, currency })}) exceeds maximum allowed of ${formatMoney({ amountMinor: singleLimit, currency })}.`,
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Daily limit (last 24 hours cumulative)
    const dailyLimit = this.configService.transferDailyLimitMinor;
    const oneDayAgo = Date.now() - 24 * 3600 * 1000;
    let dailyCumulative = 0;
    for (const t of this.transfers.values()) {
      if (
        t.senderMemberId === senderUserId &&
        t.currency === currency &&
        t.status !== 'FAILED' &&
        new Date(t.createdAt).getTime() >= oneDayAgo
      ) {
        dailyCumulative += t.amountMinor;
      }
    }

    if (dailyCumulative + amountMinor > dailyLimit) {
      const err: any = new Error(
        `Daily transfer limit exceeded: total daily outflow (${formatMoney({ amountMinor: dailyCumulative + amountMinor, currency })}) would exceed 24-hour limit of ${formatMoney({ amountMinor: dailyLimit, currency })}.`,
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. MFA Step-Up enforcement
    const mfaThreshold = this.configService.transferMfaThresholdMinor;
    if (amountMinor >= mfaThreshold) {
      if (!totpCode || totpCode.trim().length !== 6) {
        const err: any = new Error(
          `Two-factor authentication (MFA) step-up is strictly required for transfers of ${formatMoney({ amountMinor: mfaThreshold, currency })} or greater. Please provide a 6-digit TOTP code.`,
        );
        err.statusCode = 403;
        err.requiresMfa = true;
        err.thresholdMinor = mfaThreshold;
        throw err;
      }

      // Verify the TOTP code against sender's record
      const sender = this.authService.getUserById(senderUserId);
      if (sender && sender.mfaSecret) {
        const isValid = verifyTotpCode(totpCode, sender.mfaSecret);
        if (!isValid) {
          const err: any = new Error('Invalid two-factor authentication code for transfer step-up.');
          err.statusCode = 401;
          throw err;
        }
      }
    }

    // 4. Fraud velocity check (e.g. max transfers per hour)
    const fraudFlags: string[] = [];
    const oneHourAgo = Date.now() - 3600 * 1000;
    let transfersInLastHour = 0;
    for (const t of this.transfers.values()) {
      if (t.senderMemberId === senderUserId && new Date(t.createdAt).getTime() >= oneHourAgo) {
        transfersInLastHour++;
      }
    }

    if (transfersInLastHour >= this.configService.transferVelocityMaxPerHour) {
      fraudFlags.push('HIGH_VELOCITY');
    }

    return {
      isFlagged: fraudFlags.length > 0,
      fraudFlags,
    };
  }

  // ---------------------------------------------------------------------------
  // MEMBER-TO-MEMBER TRANSFER
  // ---------------------------------------------------------------------------
  async initiateMemberTransfer(
    senderUserId: string,
    input: MemberTransferInput,
    ipAddress: string,
  ): Promise<TransferRecord> {
    // 1. Idempotency Check
    if (this.idempotencyStore.has(input.idempotencyKey)) {
      return this.idempotencyStore.get(input.idempotencyKey)!;
    }

    // 2. Resolve Recipient
    const recipientLookup = await this.lookupRecipient(input.recipientQuery);
    if (!recipientLookup) {
      const err: any = new Error(`Recipient "${input.recipientQuery}" not found on Lumenfield platform.`);
      err.statusCode = 404;
      throw err;
    }

    if (recipientLookup.recipientId === senderUserId) {
      const err: any = new Error('Cannot transfer funds to yourself.');
      err.statusCode = 400;
      throw err;
    }

    // Check KYC of recipient
    if (!recipientLookup.identityVerified) {
      const err: any = new Error('Recipient identity verification is pending. Both sender and recipient must be verified.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Limits, Daily Cap, Velocity & MFA Step-Up Verification
    const fraudCheck = await this.validateTransferControls({
      senderUserId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      totpCode: input.totpCode,
    });

    // 4. Available Balance Check (Acceptance Criterion: Cannot send more than available balance including pending)
    const availableMinor = this.getAvailableBalanceMinor(senderUserId, input.currency);
    if (input.amountMinor > availableMinor) {
      const err: any = new Error(
        `Insufficient available funds: your available balance is ${formatMoney({ amountMinor: availableMinor, currency: input.currency })}, which is less than requested transfer of ${formatMoney({ amountMinor: input.amountMinor, currency: input.currency })}.`,
      );
      err.statusCode = 400;
      throw err;
    }

    // 5. Post atomic single balanced ledger transaction
    const reference = `TX-P2P-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const ledgerTx = await this.ledgerService.transferOrSpend({
      fromMemberId: senderUserId,
      toMemberId: recipientLookup.recipientId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      description: input.note || `Member transfer to ${recipientLookup.name}`,
      idempotencyKey: input.idempotencyKey,
      source: 'TRANSFER',
      actorId: senderUserId,
      ipAddress,
    });

    const now = new Date().toISOString();
    const transferId = `trf-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const record: TransferRecord = {
      id: transferId,
      reference,
      senderMemberId: senderUserId,
      recipientMemberId: recipientLookup.recipientId,
      recipientName: recipientLookup.name,
      type: 'MEMBER_TO_MEMBER',
      amountMinor: input.amountMinor,
      amountFormatted: formatMoney({ amountMinor: input.amountMinor, currency: input.currency }),
      currency: input.currency,
      status: 'COMPLETED',
      note: input.note,
      ledgerTransactionId: ledgerTx.id,
      idempotencyKey: input.idempotencyKey,
      isFlagged: fraudCheck.isFlagged,
      fraudFlags: fraudCheck.fraudFlags,
      receiptNumber,
      createdAt: now,
      updatedAt: now,
    };

    this.transfers.set(transferId, record);
    this.idempotencyStore.set(input.idempotencyKey, record);

    // In-app notifications
    this.addNotification({
      memberId: senderUserId,
      title: 'Transfer Sent',
      message: `You sent ${record.amountFormatted} to ${recipientLookup.name} (${reference}).`,
      type: 'success',
      transferId,
    });

    this.addNotification({
      memberId: recipientLookup.recipientId,
      title: 'Funds Received',
      message: `You received ${record.amountFormatted} from a sandbox member (${reference}).`,
      type: 'success',
      transferId,
    });

    await this.auditService.record({
      actorId: senderUserId,
      actorRole: 'MEMBER',
      action: 'MEMBER_TRANSFER_POSTED',
      targetType: 'TRANSFER',
      targetId: transferId,
      beforeState: null,
      afterState: {
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency,
        recipientId: recipientLookup.recipientId,
        isFlagged: record.isFlagged,
      },
      ipAddress,
    });

    return record;
  }

  // ---------------------------------------------------------------------------
  // BANK TRANSFER (SIMULATED OUTFLOW TO EXTERNAL_CLEARING)
  // Acceptance Criteria:
  // - Every transfer is one atomic ledger transaction (or a reversing pair on failure).
  // - A member cannot send more than their available balance, including pending items.
  // ---------------------------------------------------------------------------
  async initiateBankTransfer(
    memberId: string,
    input: BankTransferInput,
    ipAddress: string,
  ): Promise<TransferRecord> {
    if (this.idempotencyStore.has(input.idempotencyKey)) {
      return this.idempotencyStore.get(input.idempotencyKey)!;
    }

    const beneficiary = this.getBeneficiary(memberId, input.beneficiaryId);
    if (!beneficiary) {
      const err: any = new Error('Beneficiary not found or does not belong to member.');
      err.statusCode = 404;
      throw err;
    }

    // 1. Controls & limits
    const fraudCheck = await this.validateTransferControls({
      senderUserId: memberId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      totpCode: input.totpCode,
    });

    // Check cooling-off period flag
    if (beneficiary.isCoolingOff) {
      fraudCheck.isFlagged = true;
      fraudCheck.fraudFlags.push('NEW_BENEFICIARY_COOLING_OFF');
    }

    // 2. Available balance check (including pending outflows)
    const availableMinor = this.getAvailableBalanceMinor(memberId, input.currency);
    if (input.amountMinor > availableMinor) {
      const err: any = new Error(
        `Insufficient available funds: your available balance is ${formatMoney({ amountMinor: availableMinor, currency: input.currency })}, which is less than requested bank payout of ${formatMoney({ amountMinor: input.amountMinor, currency: input.currency })}.`,
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. Atomically post double-entry ledger transaction:
    // Outflow from member wallet to EXTERNAL_CLEARING
    const reference = `TX-BNK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const ledgerTx = await this.ledgerService.transferOrSpend({
      fromMemberId: memberId,
      toAccountId: `system-clearing-${input.currency.toLowerCase()}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
      description: input.note || `Simulated bank payout to ${beneficiary.name}`,
      idempotencyKey: input.idempotencyKey,
      source: 'BANK',
      actorId: memberId,
      ipAddress,
    });

    const now = new Date().toISOString();
    const transferId = `trf-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const receiptNumber = `RCP-BNK-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const record: TransferRecord = {
      id: transferId,
      reference,
      senderMemberId: memberId,
      beneficiaryId: beneficiary.id,
      beneficiaryDetails: beneficiary.details,
      recipientName: beneficiary.name,
      type: 'BANK_PAYOUT',
      amountMinor: input.amountMinor,
      amountFormatted: formatMoney({ amountMinor: input.amountMinor, currency: input.currency }),
      currency: input.currency,
      status: 'PENDING',
      note: input.note,
      ledgerTransactionId: ledgerTx.id,
      idempotencyKey: input.idempotencyKey,
      isFlagged: fraudCheck.isFlagged,
      fraudFlags: fraudCheck.fraudFlags,
      receiptNumber,
      createdAt: now,
      updatedAt: now,
    };

    this.transfers.set(transferId, record);
    this.idempotencyStore.set(input.idempotencyKey, record);

    this.addNotification({
      memberId,
      title: 'Bank Transfer Initiated',
      message: `Bank transfer of ${record.amountFormatted} to ${beneficiary.name} is now PENDING clearing.`,
      type: 'info',
      transferId,
    });

    await this.auditService.record({
      actorId: memberId,
      actorRole: 'MEMBER',
      action: 'BANK_TRANSFER_INITIATED',
      targetType: 'TRANSFER',
      targetId: transferId,
      beforeState: null,
      afterState: {
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency,
        beneficiaryId: beneficiary.id,
        isFlagged: record.isFlagged,
      },
      ipAddress,
    });

    // 4. Background Job Simulation
    // If simulateFailure is requested, we simulate a failed clearing and post the reversing entry!
    if (input.simulateFailure) {
      await this.processTransferState(transferId, 'FAILED', 'Beneficiary account closed or invalid routing (Simulated).', ipAddress);
    } else {
      // Advance to PROCESSING and COMPLETED
      record.status = 'PROCESSING';
      setTimeout(() => {
        if (this.transfers.has(transferId) && this.transfers.get(transferId)!.status === 'PROCESSING') {
          this.transfers.get(transferId)!.status = 'COMPLETED';
          this.transfers.get(transferId)!.updatedAt = new Date().toISOString();
          this.addNotification({
            memberId,
            title: 'Bank Transfer Cleared',
            message: `Bank transfer ${reference} (${record.amountFormatted}) has completed external clearing.`,
            type: 'success',
            transferId,
          });
        }
      }, 100);
    }

    return record;
  }

  // ---------------------------------------------------------------------------
  // PROCESS STATE & REVERSAL FOR FAILED TRANSFERS
  // Acceptance Criterion: Every transfer is one atomic ledger transaction
  // (or a reversing pair on failure).
  // ---------------------------------------------------------------------------
  async processTransferState(
    transferId: string,
    newStatus: TransferStatus,
    reason?: string,
    ipAddress = '127.0.0.1',
  ): Promise<TransferRecord> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new Error(`Transfer ${transferId} not found.`);

    if (transfer.status === 'COMPLETED' && newStatus === 'FAILED') {
      throw new Error('Completed transfer cannot be marked failed.');
    }

    const previousStatus = transfer.status;
    transfer.status = newStatus;
    transfer.updatedAt = new Date().toISOString();

    // If transitioning to FAILED: post an immutable reversing ledger transaction!
    if (newStatus === 'FAILED' && transfer.ledgerTransactionId) {
      transfer.failureReason = reason || 'Simulated clearing rejection';

      const reversalTx = await this.ledgerService.reverseTransaction(
        transfer.ledgerTransactionId,
        `Bank Clearing Failure: ${transfer.failureReason}`,
        transfer.senderMemberId,
        ipAddress,
      );
      transfer.reversalLedgerTransactionId = reversalTx.id;

      this.addNotification({
        memberId: transfer.senderMemberId,
        title: 'Bank Transfer Failed & Refunded',
        message: `Transfer ${transfer.reference} failed (${transfer.failureReason}). ${transfer.amountFormatted} has been credited back to your wallet.`,
        type: 'error',
        transferId,
      });

      await this.auditService.record({
        actorId: 'SYSTEM',
        actorRole: 'SUPER_ADMIN',
        action: 'TRANSFER_FAILED_REVERSAL_POSTED',
        targetType: 'TRANSFER',
        targetId: transfer.id,
        beforeState: { status: previousStatus },
        afterState: {
          status: 'FAILED',
          reversalLedgerTransactionId: reversalTx.id,
          reason: transfer.failureReason,
        },
        ipAddress,
      });
    } else if (newStatus === 'COMPLETED') {
      this.addNotification({
        memberId: transfer.senderMemberId,
        title: 'Transfer Completed',
        message: `Transfer ${transfer.reference} completed successfully.`,
        type: 'success',
        transferId,
      });
    }

    return transfer;
  }

  // ---------------------------------------------------------------------------
  // CRYPTO TRANSFERS (SIMULATED - NO REAL CUSTODY)
  // ---------------------------------------------------------------------------
  async getCryptoDepositAddress(network: CryptoNetwork, memberId: string) {
    return this.cryptoProvider.generateDepositAddress(network, memberId);
  }

  async simulateCryptoDeposit(
    memberId: string,
    network: CryptoNetwork,
    amountMinor: number,
    currency: SupportedCurrency,
    ipAddress: string,
  ): Promise<TransferRecord> {
    assertValidMinorUnits(amountMinor);
    const sim = await this.cryptoProvider.simulateDeposit({
      network,
      memberId,
      amountMinor,
      currency,
    });

    // Credit member wallet from EXTERNAL_CLEARING with source=CRYPTO
    const reference = `TX-CRY-DEP-${Date.now().toString(36).toUpperCase()}`;
    const ledgerTx = await this.ledgerService.postTransaction(
      {
        idempotencyKey: `idemp-cry-dep-${sim.txHash}`,
        reference,
        transactionType: 'CRYPTO_DEPOSIT',
        description: `Simulated ${network} Deposit (${sim.txHash.slice(0, 10)}...)`,
        currency,
        source: 'CRYPTO',
        metadata: {
          network,
          txHash: sim.txHash,
          confirmations: sim.confirmations,
          isSimulated: true,
        },
        entries: [
          {
            accountId: `system-clearing-${currency.toLowerCase()}`,
            accountType: 'EXTERNAL_CLEARING',
            direction: 'DEBIT',
            amountMinor,
            currency,
          },
          {
            accountId: this.ledgerService.getOrCreateMemberWallet(memberId, currency).id,
            accountType: 'MEMBER_WALLET',
            direction: 'CREDIT',
            amountMinor,
            currency,
          },
        ],
      },
      memberId,
      'MEMBER',
      ipAddress,
    );

    const now = new Date().toISOString();
    const transferId = `trf-cry-${Date.now()}`;
    const record: TransferRecord = {
      id: transferId,
      reference,
      senderMemberId: 'EXTERNAL_CRYPTO_NETWORK',
      recipientMemberId: memberId,
      cryptoNetwork: network,
      txHash: sim.txHash,
      type: 'CRYPTO_DEPOSIT',
      amountMinor,
      amountFormatted: formatMoney({ amountMinor, currency }),
      currency,
      status: 'COMPLETED',
      note: `Simulated ${network} blockchain credit (12 confirmations)`,
      ledgerTransactionId: ledgerTx.id,
      idempotencyKey: `idemp-cry-dep-${sim.txHash}`,
      isFlagged: false,
      fraudFlags: [],
      receiptNumber: `RCP-CRY-${Date.now().toString().slice(-6)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.transfers.set(transferId, record);

    this.addNotification({
      memberId,
      title: 'Crypto Deposit Credited',
      message: `Simulated deposit of ${record.amountFormatted} via ${network} testnet has been credited to your wallet.`,
      type: 'success',
      transferId,
    });

    return record;
  }

  async initiateCryptoWithdrawal(
    memberId: string,
    input: CryptoTransferInput,
    ipAddress: string,
  ): Promise<TransferRecord> {
    if (this.idempotencyStore.has(input.idempotencyKey)) {
      return this.idempotencyStore.get(input.idempotencyKey)!;
    }

    const fraudCheck = await this.validateTransferControls({
      senderUserId: memberId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      totpCode: input.totpCode,
    });

    const available = this.getAvailableBalanceMinor(memberId, input.currency);
    if (input.amountMinor > available) {
      const err: any = new Error(
        `Insufficient available funds: available balance is ${formatMoney({ amountMinor: available, currency: input.currency })}, less than ${formatMoney({ amountMinor: input.amountMinor, currency: input.currency })}.`,
      );
      err.statusCode = 400;
      throw err;
    }

    const sim = await this.cryptoProvider.simulateWithdrawal({
      network: input.network,
      destinationAddress: input.destinationAddress,
      amountMinor: input.amountMinor,
      currency: input.currency,
    });

    const reference = `TX-CRY-WD-${Date.now().toString(36).toUpperCase()}`;
    const ledgerTx = await this.ledgerService.postTransaction(
      {
        idempotencyKey: input.idempotencyKey,
        reference,
        transactionType: 'CRYPTO_WITHDRAWAL',
        description: `Simulated ${input.network} Outflow to ${input.destinationAddress.slice(0, 10)}...`,
        currency: input.currency,
        source: 'CRYPTO',
        metadata: {
          network: input.network,
          destinationAddress: input.destinationAddress,
          txHash: sim.txHash,
          isSimulated: true,
        },
        entries: [
          {
            accountId: this.ledgerService.getOrCreateMemberWallet(memberId, input.currency).id,
            accountType: 'MEMBER_WALLET',
            direction: 'DEBIT',
            amountMinor: input.amountMinor,
            currency: input.currency,
          },
          {
            accountId: `system-clearing-${input.currency.toLowerCase()}`,
            accountType: 'EXTERNAL_CLEARING',
            direction: 'CREDIT',
            amountMinor: input.amountMinor,
            currency: input.currency,
          },
        ],
      },
      memberId,
      'MEMBER',
      ipAddress,
    );

    const now = new Date().toISOString();
    const transferId = `trf-cry-${Date.now()}`;
    const record: TransferRecord = {
      id: transferId,
      reference,
      senderMemberId: memberId,
      cryptoNetwork: input.network,
      destinationAddress: input.destinationAddress,
      txHash: sim.txHash,
      type: 'CRYPTO_WITHDRAWAL',
      amountMinor: input.amountMinor,
      amountFormatted: formatMoney({ amountMinor: input.amountMinor, currency: input.currency }),
      currency: input.currency,
      status: 'COMPLETED',
      note: `Simulated ${input.network} payout: ${input.destinationAddress}`,
      ledgerTransactionId: ledgerTx.id,
      idempotencyKey: input.idempotencyKey,
      isFlagged: fraudCheck.isFlagged,
      fraudFlags: fraudCheck.fraudFlags,
      receiptNumber: `RCP-CRY-${Date.now().toString().slice(-6)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.transfers.set(transferId, record);
    this.idempotencyStore.set(input.idempotencyKey, record);

    this.addNotification({
      memberId,
      title: 'Crypto Payout Simulated',
      message: `Simulated withdrawal of ${record.amountFormatted} via ${input.network} completed. Hash: ${sim.txHash.slice(0, 14)}...`,
      type: 'success',
      transferId,
    });

    return record;
  }

  // ---------------------------------------------------------------------------
  // TRANSFER QUERY & HISTORY
  // ---------------------------------------------------------------------------
  getMemberTransfers(
    memberId: string,
    query: {
      type?: TransferType;
      status?: TransferStatus;
      currency?: SupportedCurrency;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    let list = Array.from(this.transfers.values()).filter(
      (t) => t.senderMemberId === memberId || t.recipientMemberId === memberId,
    );

    if (query.type) list = list.filter((t) => t.type === query.type);
    if (query.status) list = list.filter((t) => t.status === query.status);
    if (query.currency) list = list.filter((t) => t.currency === query.currency);
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.reference.toLowerCase().includes(q) ||
          (t.recipientName && t.recipientName.toLowerCase().includes(q)) ||
          (t.note && t.note.toLowerCase().includes(q)) ||
          (t.destinationAddress && t.destinationAddress.toLowerCase().includes(q)),
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = query.page || 1;
    const limit = query.limit || 10;
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const data = list.slice((page - 1) * limit, page * limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  getTransferById(transferId: string): TransferRecord | undefined {
    return this.transfers.get(transferId);
  }

  // ---------------------------------------------------------------------------
  // FRAUD AUDIT & FLAGGED TRANSFERS (FOR SUPER_ADMIN VISIBILITY)
  // ---------------------------------------------------------------------------
  getFlaggedTransfers(): TransferRecord[] {
    return Array.from(this.transfers.values()).filter((t) => t.isFlagged);
  }

  async clearOrApproveFlaggedTransfer(
    transferId: string,
    action: 'APPROVE' | 'REJECT',
    adminId: string,
    reason: string,
    ipAddress: string,
  ): Promise<TransferRecord> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new Error('Transfer not found');

    transfer.isFlagged = false;
    transfer.updatedAt = new Date().toISOString();

    if (action === 'REJECT') {
      await this.processTransferState(transferId, 'FAILED', `Rejected by compliance admin: ${reason}`, ipAddress);
    }

    await this.auditService.record({
      actorId: adminId,
      actorRole: 'SUPER_ADMIN',
      action: action === 'APPROVE' ? 'ADMIN_APPROVE_FLAGGED_TRANSFER' : 'ADMIN_REJECT_FLAGGED_TRANSFER',
      targetType: 'TRANSFER',
      targetId: transfer.id,
      beforeState: { isFlagged: true, fraudFlags: transfer.fraudFlags },
      afterState: { isFlagged: false, action, reason },
      ipAddress,
    });

    return transfer;
  }

  // ---------------------------------------------------------------------------
  // RECEIPT GENERATOR (PDF / PRINTABLE HTML)
  // ---------------------------------------------------------------------------
  generateReceiptHtml(transferId: string, memberId: string): string {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.senderMemberId !== memberId && transfer.recipientMemberId !== memberId) {
      throw new Error('Access denied: transfer receipt does not belong to member.');
    }

    const isCredit = transfer.recipientMemberId === memberId && transfer.type === 'MEMBER_TO_MEMBER';
    const counterparty = isCredit
      ? `Received from member`
      : transfer.recipientName || transfer.destinationAddress || 'External Clearing Rail';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lumenfield Transfer Receipt - ${transfer.reference}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0E1B1F; margin: 40px; background: #fff; line-height: 1.5; }
    .banner { background: #FFF1CC; color: #5A4100; padding: 12px 18px; border-radius: 8px; border: 1px solid #F0D58A; font-size: 13px; font-weight: 600; margin-bottom: 24px; text-align: center; }
    .card { max-width: 620px; margin: 0 auto; border: 1px solid #DCE5E3; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0A3D3F; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 800; color: #0A3D3F; }
    .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; background: #E3F3F1; color: #0A4F4A; padding: 4px 10px; border-radius: 6px; }
    .amount-box { text-align: center; padding: 24px; background: #F4F7F6; border-radius: 12px; margin-bottom: 24px; }
    .amount { font-size: 36px; font-weight: 800; color: ${isCredit ? '#0A5C47' : '#0E1B1F'}; font-family: monospace; }
    .status { font-size: 13px; font-weight: 600; color: #0F766E; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 10px 0; border-bottom: 1px solid #EDF2F1; }
    td.label { color: #4A5B60; font-weight: 500; width: 40%; }
    td.value { font-weight: 600; text-align: right; }
    .footer { font-size: 11px; color: #8FA5A3; margin-top: 28px; text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="banner">Sandbox environment: all balances are test funds, not real money.</div>
  <div class="card">
    <div class="header">
      <div>
        <div class="brand">LUMENFIELD</div>
        <div style="font-size: 12px; color: #4A5B60; margin-top: 2px;">Official Transfer Receipt</div>
      </div>
      <div class="badge">${transfer.type.replace(/_/g, ' ')}</div>
    </div>

    <div class="amount-box">
      <div class="amount">${isCredit ? '+' : '-'}${transfer.amountFormatted}</div>
      <div class="status">Status: ${transfer.status}</div>
    </div>

    <table>
      <tr><td class="label">Receipt Number</td><td class="value" style="font-family: monospace;">${transfer.receiptNumber}</td></tr>
      <tr><td class="label">Reference</td><td class="value" style="font-family: monospace;">${transfer.reference}</td></tr>
      <tr><td class="label">Timestamp (UTC)</td><td class="value">${transfer.createdAt.replace('T', ' ').substring(0, 19)}</td></tr>
      <tr><td class="label">Counterparty</td><td class="value">${counterparty}</td></tr>
      <tr><td class="label">Transfer Type</td><td class="value">${transfer.type}</td></tr>
      <tr><td class="label">Currency</td><td class="value">${transfer.currency}</td></tr>
      <tr><td class="label">Platform Fee</td><td class="value" style="color: #0A5C47;">$0.00 (Sandbox Free)</td></tr>
      <tr><td class="label">Ledger Transaction ID</td><td class="value" style="font-family: monospace; font-size: 11px;">${transfer.ledgerTransactionId || 'N/A'}</td></tr>
      ${transfer.note ? `<tr><td class="label">Note</td><td class="value">${transfer.note}</td></tr>` : ''}
    </table>

    <div class="footer">
      Notice: Lumenfield is a private financial testbed. Balances represent test sandbox assets. Not an insured bank or chartered depository.
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
  }

  // ---------------------------------------------------------------------------
  // IN-APP NOTIFICATIONS
  // ---------------------------------------------------------------------------
  addNotification(params: {
    memberId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    transferId?: string;
  }): TransferNotification {
    const notif: TransferNotification = {
      id: `notif-trf-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      memberId: params.memberId,
      title: params.title,
      message: params.message,
      type: params.type,
      transferId: params.transferId,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const list = this.notifications.get(params.memberId) || [];
    list.unshift(notif);
    this.notifications.set(params.memberId, list);

    // Also link into KycService if present for unified member notification feed
    if (this.kycService) {
      this.kycService.addNotification({
        memberId: params.memberId,
        title: params.title,
        message: params.message,
        type: params.type,
      });
    }

    return notif;
  }

  getMemberNotifications(memberId: string): TransferNotification[] {
    return this.notifications.get(memberId) || [];
  }

  markNotificationsRead(memberId: string): void {
    const list = this.notifications.get(memberId) || [];
    for (const n of list) {
      n.read = true;
    }
  }
}
