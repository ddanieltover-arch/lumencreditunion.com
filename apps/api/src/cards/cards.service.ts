import { randomUUID } from 'crypto';
import {
  CardCurrency,
  CardStatus,
  CreateCardInput,
  UpdateCardLimitsInput,
  SimulateCardPurchaseInput,
  VirtualCardRecord,
  CardCreationResponse,
  CardTransactionRecord,
  formatMoney,
} from '@lumenfield/shared';
import { CardProvider, SandboxCardProvider } from './card-provider.interface';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { KycService } from '../kyc/kyc.service';
import { ConfigService } from '../config/config.service';
import { EmailService } from '../email/email.service';

interface StoredCard {
  id: string;
  memberId: string;
  cardToken: string;
  lastFour: string;
  maskedPan: string;
  brand: string;
  currency: CardCurrency;
  status: CardStatus;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  expiryFormatted: string;
  dailyLimitMinor: number;
  monthlyLimitMinor: number;
  spentTodayMinor: number;
  spentThisMonthMinor: number;
  isVirtual: boolean;
  createdAt: string;
  updatedAt: string;
}

export class CardsService {
  private cards = new Map<string, StoredCard>(); // cardId -> StoredCard
  private cardTransactions: CardTransactionRecord[] = []; // List of all card purchases
  private readonly cardProvider: CardProvider;

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly kycService: KycService,
    private readonly configService: ConfigService,
    cardProvider?: CardProvider,
    private readonly emailService: EmailService = EmailService.getInstance(),
  ) {
    this.cardProvider = cardProvider || new SandboxCardProvider();
    this.seedInitialCards();
  }

  private memberContact(memberId: string): { email: string; fullName: string } | null {
    const user = this.authService.findUserById(memberId);
    if (!user?.email) return null;
    return { email: user.email, fullName: user.fullName || 'Member' };
  }

  private notifyCardDeclined(
    memberId: string,
    declined: CardTransactionRecord,
    lastFour: string,
  ) {
    const member = this.memberContact(memberId);
    if (!member) return;
    void this.emailService.sendCardPurchaseDeclinedEmail(member.email, member.fullName, {
      amountFormatted: formatMoney({
        amountMinor: declined.amountMinor,
        currency: declined.currency,
      }),
      merchant: declined.merchantName,
      reason: declined.declineReason || `Card •••• ${lastFour} declined`,
    });
  }

  /**
   * Seed initial virtual cards for standard test members.
   * Notice: Full PAN and CVV are NEVER stored here.
   */
  private seedInitialCards(): void {
    const amaraId = '00000000-0000-0000-0000-000000000002';
    const now = new Date().toISOString();

    const amaraUsdCard: StoredCard = {
      id: 'crd-0000-0000-0000-000000000001',
      memberId: amaraId,
      cardToken: 'crd_tok_test_amara_usd_001',
      lastFour: '4821',
      maskedPan: '•••• •••• •••• 4821',
      brand: 'Lumenfield Visa',
      currency: 'USD',
      status: 'ACTIVE',
      cardholderName: 'Amara Okafor',
      expiryMonth: 9,
      expiryYear: 29,
      expiryFormatted: '09/29',
      dailyLimitMinor: 100000, // $1,000.00
      monthlyLimitMinor: 500000, // $5,000.00
      spentTodayMinor: 0,
      spentThisMonthMinor: 0,
      isVirtual: true,
      createdAt: now,
      updatedAt: now,
    };
    this.cards.set(amaraUsdCard.id, amaraUsdCard);

    const amaraCadCard: StoredCard = {
      id: 'crd-0000-0000-0000-000000000002',
      memberId: amaraId,
      cardToken: 'crd_tok_test_amara_cad_002',
      lastFour: '9152',
      maskedPan: '•••• •••• •••• 9152',
      brand: 'Lumenfield Visa',
      currency: 'CAD',
      status: 'ACTIVE',
      cardholderName: 'Amara Okafor',
      expiryMonth: 11,
      expiryYear: 29,
      expiryFormatted: '11/29',
      dailyLimitMinor: 100000, // C$1,000.00
      monthlyLimitMinor: 500000, // C$5,000.00
      spentTodayMinor: 0,
      spentThisMonthMinor: 0,
      isVirtual: true,
      createdAt: now,
      updatedAt: now,
    };
    this.cards.set(amaraCadCard.id, amaraCadCard);
  }

  /**
   * Helper to format a stored card for public/API response.
   * Guarantees full PAN and CVV are NEVER returned.
   */
  private sanitizeCard(card: StoredCard): VirtualCardRecord {
    return {
      id: card.id,
      memberId: card.memberId,
      cardToken: card.cardToken,
      lastFour: card.lastFour,
      maskedPan: card.maskedPan,
      brand: card.brand,
      currency: card.currency,
      status: card.status,
      cardholderName: card.cardholderName,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      expiryFormatted: card.expiryFormatted,
      dailyLimitMinor: card.dailyLimitMinor,
      monthlyLimitMinor: card.monthlyLimitMinor,
      spentTodayMinor: card.spentTodayMinor,
      spentThisMonthMinor: card.spentThisMonthMinor,
      isVirtual: card.isVirtual,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }

  /**
   * Create a virtual card for a member wallet.
   * Expiry and CVV are shown ONLY ONCE on creation response.
   * Full PAN and CVV are NEVER stored in plaintext in the database.
   */
  async createCard(
    memberId: string,
    input: CreateCardInput,
    ipAddress: string,
  ): Promise<CardCreationResponse> {
    // 1. Enforce KYC verification
    const isApproved = this.kycService.isMemberKycApproved(memberId);
    if (!isApproved) {
      const err: any = new Error(
        'Identity verification (KYC) required before creating a virtual card.',
      );
      err.statusCode = 403;
      throw err;
    }

    // 2. Resolve cardholder name
    let cardholderName = input.cardholderName?.trim();
    if (!cardholderName) {
      const user = this.authService.findUserById(memberId);
      cardholderName = user ? user.fullName : 'Lumenfield Member';
    }

    // 3. Set and validate limits
    const dailyLimitMinor = input.dailyLimitMinor ?? 100000; // $1,000.00
    const monthlyLimitMinor = input.monthlyLimitMinor ?? 500000; // $5,000.00

    if (dailyLimitMinor > monthlyLimitMinor) {
      const err: any = new Error('Daily limit cannot exceed monthly limit.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Generate card via CardProvider
    const generated = await this.cardProvider.generateCard({
      memberId,
      currency: input.currency,
      cardholderName,
    });

    const now = new Date().toISOString();
    const cardId = `crd-${randomUUID()}`;

    // 5. Store card WITHOUT fullPan and WITHOUT CVV
    const storedCard: StoredCard = {
      id: cardId,
      memberId,
      cardToken: generated.cardToken,
      lastFour: generated.lastFour,
      maskedPan: `•••• •••• •••• ${generated.lastFour}`,
      brand: generated.brand,
      currency: input.currency,
      status: 'ACTIVE',
      cardholderName,
      expiryMonth: generated.expiryMonth,
      expiryYear: generated.expiryYear,
      expiryFormatted: generated.expiryFormatted,
      dailyLimitMinor,
      monthlyLimitMinor,
      spentTodayMinor: 0,
      spentThisMonthMinor: 0,
      isVirtual: true,
      createdAt: now,
      updatedAt: now,
    };

    this.cards.set(cardId, storedCard);

    // 6. Audit log entry
    await this.auditService.log({
      actor: memberId,
      actorRole: 'MEMBER',
      action: 'MEMBER_CREATE_VIRTUAL_CARD',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: null,
      afterState: {
        id: cardId,
        currency: input.currency,
        lastFour: generated.lastFour,
        dailyLimitMinor,
        monthlyLimitMinor,
      },
      ipAddress,
    });

    const member = this.memberContact(memberId);
    if (member) {
      void this.emailService.sendCardCreatedEmail(member.email, member.fullName, {
        lastFour: generated.lastFour,
        currency: input.currency,
      });
    }

    // 7. Return card with one-time credentials
    return {
      card: this.sanitizeCard(storedCard),
      oneTimeCredentials: {
        fullPan: generated.fullPan,
        cvv: generated.cvv,
        expiry: generated.expiryFormatted,
        warningNotice:
          'Save these credentials now. For your security, the full card number and CVV are never stored in Lumenfield and cannot be retrieved again.',
      },
    };
  }

  /**
   * Retrieve all virtual cards for a member.
   * Acceptance Criteria: The full card number is never returned by the API after creation.
   */
  getMemberCards(memberId: string, currency?: CardCurrency): VirtualCardRecord[] {
    const results: VirtualCardRecord[] = [];
    for (const card of this.cards.values()) {
      if (card.memberId === memberId) {
        if (!currency || card.currency === currency) {
          results.push(this.sanitizeCard(card));
        }
      }
    }
    return results;
  }

  /**
   * Retrieve a specific card by ID.
   */
  getCardById(cardId: string, memberId: string): VirtualCardRecord {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (card.memberId !== memberId) {
      const err: any = new Error('Unauthorized to view this card.');
      err.statusCode = 403;
      throw err;
    }

    return this.sanitizeCard(card);
  }

  /**
   * Freeze / Unfreeze a virtual card.
   */
  async updateCardStatus(
    cardId: string,
    memberId: string,
    newStatus: CardStatus,
    ipAddress: string,
  ): Promise<VirtualCardRecord> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (card.memberId !== memberId) {
      const err: any = new Error('Unauthorized to modify this card.');
      err.statusCode = 403;
      throw err;
    }

    const beforeStatus = card.status;
    card.status = newStatus;
    card.updatedAt = new Date().toISOString();

    await this.auditService.log({
      actor: memberId,
      actorRole: 'MEMBER',
      action: newStatus === 'FROZEN' ? 'MEMBER_FREEZE_CARD' : 'MEMBER_UNFREEZE_CARD',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: { status: beforeStatus },
      afterState: { status: newStatus },
      ipAddress,
    });

    const member = this.memberContact(memberId);
    if (member) {
      if (newStatus === 'FROZEN') {
        void this.emailService.sendCardFrozenEmail(member.email, member.fullName, {
          lastFour: card.lastFour,
        });
      } else if (newStatus === 'ACTIVE') {
        void this.emailService.sendCardUnfrozenEmail(member.email, member.fullName, {
          lastFour: card.lastFour,
        });
      }
    }

    return this.sanitizeCard(card);
  }

  /**
   * Toggle freeze status of card.
   */
  async toggleFreeze(cardId: string, memberId: string, ipAddress: string): Promise<VirtualCardRecord> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const targetStatus: CardStatus = card.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
    return this.updateCardStatus(cardId, memberId, targetStatus, ipAddress);
  }

  /**
   * Update daily and monthly limits on a virtual card.
   * Acceptance Criteria: Limits are enforced server-side.
   */
  async updateCardLimits(
    cardId: string,
    memberId: string,
    input: UpdateCardLimitsInput,
    ipAddress: string,
  ): Promise<VirtualCardRecord> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (card.memberId !== memberId) {
      const err: any = new Error('Unauthorized to update limits on this card.');
      err.statusCode = 403;
      throw err;
    }

    if (input.dailyLimitMinor > input.monthlyLimitMinor) {
      const err: any = new Error('Daily limit cannot exceed monthly limit.');
      err.statusCode = 400;
      throw err;
    }

    const beforeLimits = {
      dailyLimitMinor: card.dailyLimitMinor,
      monthlyLimitMinor: card.monthlyLimitMinor,
    };

    card.dailyLimitMinor = input.dailyLimitMinor;
    card.monthlyLimitMinor = input.monthlyLimitMinor;
    card.updatedAt = new Date().toISOString();

    await this.auditService.log({
      actor: memberId,
      actorRole: 'MEMBER',
      action: 'MEMBER_UPDATE_CARD_LIMITS',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: beforeLimits,
      afterState: {
        dailyLimitMinor: input.dailyLimitMinor,
        monthlyLimitMinor: input.monthlyLimitMinor,
      },
      ipAddress,
    });

    const member = this.memberContact(memberId);
    if (member) {
      void this.emailService.sendCardLimitsUpdatedEmail(member.email, member.fullName, {
        lastFour: card.lastFour,
        dailyLimitFormatted: formatMoney({
          amountMinor: input.dailyLimitMinor,
          currency: card.currency,
        }),
        monthlyLimitFormatted: formatMoney({
          amountMinor: input.monthlyLimitMinor,
          currency: card.currency,
        }),
      });
    }

    return this.sanitizeCard(card);
  }

  /**
   * Retrieve card transactions.
   */
  getCardTransactions(cardId: string, memberId: string): CardTransactionRecord[] {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (card.memberId !== memberId) {
      const err: any = new Error('Unauthorized to view transactions for this card.');
      err.statusCode = 403;
      throw err;
    }

    return this.cardTransactions
      .filter((tx) => tx.cardId === cardId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Simulated card purchase (dev-only endpoint).
   *
   * Acceptance criteria:
   * - A frozen card declines simulated purchases.
   * - Limits are enforced server-side.
   * - Double-entry ledger transaction posted atomically.
   */
  async simulatePurchase(
    cardId: string,
    input: SimulateCardPurchaseInput,
    ipAddress: string,
    requestingMemberId?: string,
  ): Promise<{
    success: boolean;
    transaction: CardTransactionRecord;
    ledgerTransaction?: any;
  }> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (requestingMemberId && card.memberId !== requestingMemberId) {
      const err: any = new Error('Unauthorized: card does not belong to member.');
      err.statusCode = 403;
      throw err;
    }

    const idempotencyKey =
      input.idempotencyKey || `card-purch-${card.id}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const recordBase = {
      id: `ctx-${Date.now()}-${randomUUID().slice(0, 6)}`,
      cardId: card.id,
      memberId: card.memberId,
      amountMinor: input.amountMinor,
      currency: card.currency,
      merchantName: input.merchantName,
      merchantCategory: input.merchantCategory || 'RETAIL',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };

    // 1. ACCEPTANCE CRITERIA: A frozen card declines simulated purchases
    if (card.status === 'FROZEN') {
      const declinedRecord: CardTransactionRecord = {
        ...recordBase,
        status: 'DECLINED',
        declineReason: 'Card is frozen. Transaction declined.',
      };
      this.cardTransactions.push(declinedRecord);
      this.notifyCardDeclined(card.memberId, declinedRecord, card.lastFour);

      const err: any = new Error('Transaction declined: card is frozen.');
      err.statusCode = 400;
      err.transaction = declinedRecord;
      throw err;
    }

    // 2. Verify member wallet has sufficient funds
    const availableMinor = this.ledgerService.getMemberBalance(card.memberId, card.currency);
    if (availableMinor < input.amountMinor) {
      const reason = `Insufficient funds in ${card.currency} wallet (Available: ${formatMoney({ amountMinor: availableMinor, currency: card.currency })}, Required: ${formatMoney({ amountMinor: input.amountMinor, currency: card.currency })}).`;
      const declinedRecord: CardTransactionRecord = {
        ...recordBase,
        status: 'DECLINED',
        declineReason: reason,
      };
      this.cardTransactions.push(declinedRecord);
      this.notifyCardDeclined(card.memberId, declinedRecord, card.lastFour);

      const err: any = new Error(`Transaction declined: ${reason}`);
      err.statusCode = 400;
      err.transaction = declinedRecord;
      throw err;
    }

    // 3. ACCEPTANCE CRITERIA: Monthly limit enforced server-side
    if (card.spentThisMonthMinor + input.amountMinor > card.monthlyLimitMinor) {
      const reason = `Monthly limit exceeded (Limit: ${formatMoney({ amountMinor: card.monthlyLimitMinor, currency: card.currency })}, Spent: ${formatMoney({ amountMinor: card.spentThisMonthMinor, currency: card.currency })}).`;
      const declinedRecord: CardTransactionRecord = {
        ...recordBase,
        status: 'DECLINED',
        declineReason: reason,
      };
      this.cardTransactions.push(declinedRecord);
      this.notifyCardDeclined(card.memberId, declinedRecord, card.lastFour);

      const err: any = new Error(`Transaction declined: ${reason}`);
      err.statusCode = 400;
      err.transaction = declinedRecord;
      throw err;
    }

    // 4. ACCEPTANCE CRITERIA: Daily limit enforced server-side
    if (card.spentTodayMinor + input.amountMinor > card.dailyLimitMinor) {
      const reason = `Daily limit exceeded (Limit: ${formatMoney({ amountMinor: card.dailyLimitMinor, currency: card.currency })}, Spent: ${formatMoney({ amountMinor: card.spentTodayMinor, currency: card.currency })}).`;
      const declinedRecord: CardTransactionRecord = {
        ...recordBase,
        status: 'DECLINED',
        declineReason: reason,
      };
      this.cardTransactions.push(declinedRecord);
      this.notifyCardDeclined(card.memberId, declinedRecord, card.lastFour);

      const err: any = new Error(`Transaction declined: ${reason}`);
      err.statusCode = 400;
      err.transaction = declinedRecord;
      throw err;
    }

    // 5. Authorize with CardProvider
    const authResult = await this.cardProvider.authorizePurchase({
      cardToken: card.cardToken,
      amountMinor: input.amountMinor,
      currency: card.currency,
      merchantName: input.merchantName,
    });

    if (!authResult.authorized) {
      const declinedRecord: CardTransactionRecord = {
        ...recordBase,
        status: 'DECLINED',
        declineReason: authResult.declineReason || 'Card provider declined transaction',
      };
      this.cardTransactions.push(declinedRecord);
      this.notifyCardDeclined(card.memberId, declinedRecord, card.lastFour);

      const err: any = new Error(
        `Transaction declined by provider: ${authResult.declineReason || 'Unknown error'}`,
      );
      err.statusCode = 400;
      err.transaction = declinedRecord;
      throw err;
    }

    // 6. Post double-entry balanced ledger transaction
    const ledgerTx = await this.ledgerService.transferOrSpend({
      fromMemberId: card.memberId,
      toAccountId: `system-clearing-${card.currency.toLowerCase()}`,
      amountMinor: input.amountMinor,
      currency: card.currency,
      description: `Card Purchase: ${input.merchantName} (•••• ${card.lastFour})`,
      idempotencyKey,
      source: 'CARD_PURCHASE',
      actorId: card.memberId,
      ipAddress,
    });

    // 7. Update card spending state
    card.spentTodayMinor += input.amountMinor;
    card.spentThisMonthMinor += input.amountMinor;
    card.updatedAt = new Date().toISOString();

    const approvedRecord: CardTransactionRecord = {
      ...recordBase,
      status: 'APPROVED',
      ledgerTransactionId: ledgerTx.id,
    };
    this.cardTransactions.push(approvedRecord);

    // 8. Add member notification
    this.kycService.addNotification({
      memberId: card.memberId,
      title: 'Card Purchase Approved',
      message: `${formatMoney({ amountMinor: input.amountMinor, currency: card.currency })} authorized at ${input.merchantName} on virtual card •••• ${card.lastFour}.`,
      type: 'info',
    });

    const member = this.memberContact(card.memberId);
    if (member) {
      void this.emailService.sendCardPurchaseApprovedEmail(member.email, member.fullName, {
        amountFormatted: formatMoney({
          amountMinor: input.amountMinor,
          currency: card.currency,
        }),
        merchant: input.merchantName,
        lastFour: card.lastFour,
      });
    }

    // 9. Audit log
    await this.auditService.log({
      actor: card.memberId,
      actorRole: 'MEMBER',
      action: 'CARD_PURCHASE_SIMULATED',
      targetType: 'VIRTUAL_CARD',
      targetId: card.id,
      beforeState: null,
      afterState: {
        amountMinor: input.amountMinor,
        currency: card.currency,
        merchant: input.merchantName,
        ledgerTransactionId: ledgerTx.id,
      },
      ipAddress,
    });

    return {
      success: true,
      transaction: approvedRecord,
      ledgerTransaction: ledgerTx,
    };
  }
}
