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
  AdminUpdateCardInput,
  AdminCreateCardInput,
  AdminCreditCardWalletInput,
  formatMoney,
} from '@lumenfield/shared';
import { CardProvider, SandboxCardProvider } from './card-provider.interface';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { KycService } from '../kyc/kyc.service';
import { ConfigService } from '../config/config.service';
import { EmailService } from '../email/email.service';
import {
  loadPersistedCardSnapshot,
  persistCardSnapshot,
  type PersistedCard,
} from './card-persistence';

type GlobalCards = typeof globalThis & { __lumenCardsService?: CardsService };

export type AdminCardRow = VirtualCardRecord & {
  memberName: string;
  memberEmail: string;
};

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
  private hydratePromise: Promise<void> | null = null;

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
  }

  static getInstance(
    ledgerService: LedgerService,
    auditService: AuditService,
    authService: AuthService,
    kycService: KycService,
    configService: ConfigService,
  ): CardsService {
    const g = globalThis as GlobalCards;
    if (!g.__lumenCardsService) {
      g.__lumenCardsService = new CardsService(
        ledgerService,
        auditService,
        authService,
        kycService,
        configService,
      );
    }
    return g.__lumenCardsService;
  }

  async ensureReady(): Promise<void> {
    if (!this.hydratePromise) {
      this.hydratePromise = this.hydrateFromStore()
        .then(() => {
          if (this.cards.size > 0) this.schedulePersist();
        })
        .catch((err) => {
          console.error('[Cards] Hydration failed:', err);
          this.hydratePromise = null;
        });
    }
    await this.hydratePromise;
  }

  private async hydrateFromStore(): Promise<void> {
    const snapshot = await loadPersistedCardSnapshot();
    if (!snapshot) return;
    if (this.cards.size === 0 && Array.isArray(snapshot.cards)) {
      for (const card of snapshot.cards) {
        if (card?.id) this.cards.set(card.id, card as StoredCard);
      }
    }
    if (
      this.cardTransactions.length === 0 &&
      Array.isArray(snapshot.transactions) &&
      snapshot.transactions.length
    ) {
      this.cardTransactions = snapshot.transactions.slice();
    }
    if (this.cards.size) {
      console.log(
        `[Cards] Restored ${this.cards.size} card(s) and ${this.cardTransactions.length} transaction(s) from database.`,
      );
    }
  }

  private schedulePersist(): void {
    void this.persistNow();
  }

  private async persistNow(): Promise<void> {
    await persistCardSnapshot({
      cards: Array.from(this.cards.values()) as PersistedCard[],
      transactions: this.cardTransactions.slice(),
      updatedAt: new Date().toISOString(),
    });
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
    this.schedulePersist();

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
    this.schedulePersist();

    const action =
      newStatus === 'FROZEN'
        ? 'MEMBER_FREEZE_CARD'
        : newStatus === 'ACTIVE'
          ? 'MEMBER_UNFREEZE_CARD'
          : newStatus === 'SUSPENDED'
            ? 'ADMIN_SUSPEND_CARD'
            : 'ADMIN_TERMINATE_CARD';

    await this.auditService.log({
      actor: memberId,
      actorRole: 'MEMBER',
      action,
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: { status: beforeStatus },
      afterState: { status: newStatus },
      ipAddress,
    });

    const member = this.memberContact(memberId);
    if (member) {
      if (newStatus === 'FROZEN' || newStatus === 'SUSPENDED') {
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

    const targetStatus: CardStatus =
      card.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
    return this.updateCardStatus(cardId, memberId, targetStatus, ipAddress);
  }

  /** Admin directory of all issued virtual cards (with member identity). */
  getAllCardsForAdmin(): AdminCardRow[] {
    const rows: AdminCardRow[] = [];
    for (const card of this.cards.values()) {
      const user = this.authService.findUserById(card.memberId);
      rows.push({
        ...this.sanitizeCard(card),
        memberName: user?.fullName || card.cardholderName || 'Member',
        memberEmail: user?.email || '',
      });
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async adminUpdateCard(
    cardId: string,
    input: AdminUpdateCardInput,
    adminId: string,
    ipAddress: string,
  ): Promise<VirtualCardRecord> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const before = { ...this.sanitizeCard(card) };
    if (input.cardholderName !== undefined) {
      card.cardholderName = input.cardholderName.trim();
    }
    if (input.dailyLimitMinor !== undefined) {
      card.dailyLimitMinor = input.dailyLimitMinor;
    }
    if (input.monthlyLimitMinor !== undefined) {
      card.monthlyLimitMinor = input.monthlyLimitMinor;
    }
    if (card.dailyLimitMinor > card.monthlyLimitMinor) {
      const err: any = new Error('Daily limit cannot exceed monthly limit.');
      err.statusCode = 400;
      throw err;
    }
    if (input.resetSpentToday) {
      card.spentTodayMinor = 0;
    }
    if (input.resetSpentThisMonth) {
      card.spentThisMonthMinor = 0;
    }

    const statusChanged = input.status !== undefined && input.status !== card.status;
    if (statusChanged && input.status) {
      card.status = input.status;
    }

    card.updatedAt = new Date().toISOString();
    this.schedulePersist();

    await this.auditService.log({
      actor: adminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_UPDATE_CARD',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: before,
      afterState: {
        ...this.sanitizeCard(card),
        reason: input.reason || null,
        resetSpentToday: !!input.resetSpentToday,
        resetSpentThisMonth: !!input.resetSpentThisMonth,
      },
      ipAddress,
    });

    if (statusChanged && input.status) {
      const member = this.memberContact(card.memberId);
      if (member && (input.status === 'FROZEN' || input.status === 'SUSPENDED')) {
        void this.emailService.sendCardFrozenEmail(member.email, member.fullName, {
          lastFour: card.lastFour,
        });
      } else if (member && input.status === 'ACTIVE') {
        void this.emailService.sendCardUnfrozenEmail(member.email, member.fullName, {
          lastFour: card.lastFour,
        });
      }
      this.kycService.addNotification({
        memberId: card.memberId,
        title: `Virtual Card ${input.status === 'ACTIVE' ? 'Activated' : input.status === 'FROZEN' ? 'Frozen' : input.status === 'SUSPENDED' ? 'Suspended' : 'Terminated'}`,
        message: `Virtual card •••• ${card.lastFour} (${card.currency}) status was updated to ${input.status.toLowerCase()} by an administrator.${input.reason ? ` Reason: ${input.reason}` : ''}`,
        type: input.status === 'ACTIVE' ? 'success' : 'warning',
      });
    }

    return this.sanitizeCard(card);
  }

  async adminSetCardStatus(
    cardId: string,
    status: CardStatus,
    adminId: string,
    ipAddress: string,
    reason?: string,
  ): Promise<VirtualCardRecord> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const beforeStatus = card.status;
    card.status = status;
    card.updatedAt = new Date().toISOString();
    this.schedulePersist();

    const action =
      status === 'FROZEN'
        ? 'ADMIN_FREEZE_CARD'
        : status === 'ACTIVE'
          ? 'ADMIN_UNFREEZE_CARD'
          : status === 'SUSPENDED'
            ? 'ADMIN_SUSPEND_CARD'
            : 'ADMIN_TERMINATE_CARD';

    await this.auditService.log({
      actor: adminId,
      actorRole: 'SUPER_ADMIN',
      action,
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: { status: beforeStatus },
      afterState: { status, reason: reason || null },
      ipAddress,
    });

    const member = this.memberContact(card.memberId);
    if (member && (status === 'FROZEN' || status === 'SUSPENDED')) {
      void this.emailService.sendCardFrozenEmail(member.email, member.fullName, {
        lastFour: card.lastFour,
      });
    } else if (member && status === 'ACTIVE') {
      void this.emailService.sendCardUnfrozenEmail(member.email, member.fullName, {
        lastFour: card.lastFour,
      });
    }

    this.kycService.addNotification({
      memberId: card.memberId,
      title: `Virtual Card ${status === 'ACTIVE' ? 'Activated' : status === 'FROZEN' ? 'Frozen' : status === 'SUSPENDED' ? 'Suspended' : 'Terminated'}`,
      message: `Virtual card •••• ${card.lastFour} (${card.currency}) has been set to ${status.toLowerCase()} by an administrator.${reason ? ` Reason: ${reason}` : ''}`,
      type: status === 'ACTIVE' ? 'success' : 'warning',
    });

    return this.sanitizeCard(card);
  }

  async adminDeleteCard(
    cardId: string,
    adminId: string,
    ipAddress: string,
  ): Promise<{ success: true; id: string }> {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const before = this.sanitizeCard(card);
    this.cards.delete(cardId);
    this.cardTransactions = this.cardTransactions.filter((tx) => tx.cardId !== cardId);
    this.schedulePersist();

    await this.auditService.log({
      actor: adminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_DELETE_CARD',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: before,
      afterState: null,
      ipAddress,
    });

    this.kycService.addNotification({
      memberId: card.memberId,
      title: 'Virtual Card Revoked',
      message: `Virtual card •••• ${card.lastFour} (${card.currency}) has been deleted by an administrator.`,
      type: 'warning',
    });

    return { success: true, id: cardId };
  }

  async adminCreditCardWallet(
    cardId: string,
    input: AdminCreditCardWalletInput,
    adminId: string,
    ipAddress: string,
  ) {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const reference =
      input.reference || `CARD-CR-${card.lastFour}-${Date.now().toString(36).toUpperCase()}`;
    const reason =
      input.reason ||
      `Admin credit to ${card.currency} wallet for virtual card •••• ${card.lastFour}`;

    const tx = await this.ledgerService.adminFundMemberWallet(
      {
        memberId: card.memberId,
        amountMinor: input.amountMinor,
        currency: card.currency,
        reason,
        reference,
        source: 'TEST',
        idempotencyKey:
          input.idempotencyKey || `admin-card-credit-${cardId}-${input.amountMinor}`,
      },
      adminId,
      ipAddress,
    );

    await this.auditService.log({
      actor: adminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_CREDIT_CARD_WALLET',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: null,
      afterState: {
        memberId: card.memberId,
        currency: card.currency,
        amountMinor: input.amountMinor,
        ledgerTransactionId: tx.id,
        reference: tx.reference,
      },
      ipAddress,
    });

    this.kycService.addNotification({
      memberId: card.memberId,
      title: 'Card Wallet Credited',
      message: `${formatMoney({ amountMinor: input.amountMinor, currency: card.currency })} has been credited to your ${card.currency} wallet for virtual card •••• ${card.lastFour}.`,
      type: 'success',
    });

    return {
      success: true,
      card: this.sanitizeCard(card),
      ledgerTransaction: tx,
      amountFormatted: formatMoney({
        amountMinor: input.amountMinor,
        currency: card.currency,
      }),
    };
  }

  /**
   * Retrieve all transactions for a specific card (admin view).
   */
  adminGetCardTransactions(cardId: string): CardTransactionRecord[] {
    const card = this.cards.get(cardId);
    if (!card) {
      const err: any = new Error(`Card ${cardId} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return this.cardTransactions
      .filter((tx) => tx.cardId === cardId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Admin issue virtual card for a member.
   */
  async adminCreateCard(
    input: AdminCreateCardInput,
    adminId: string,
    ipAddress: string,
  ): Promise<CardCreationResponse> {
    const user = this.authService.findUserById(input.memberId);
    const cardholderName = input.cardholderName?.trim() || user?.fullName || 'Lumenfield Member';

    const dailyLimitMinor = input.dailyLimitMinor ?? 100000;
    const monthlyLimitMinor = input.monthlyLimitMinor ?? 500000;

    if (dailyLimitMinor > monthlyLimitMinor) {
      const err: any = new Error('Daily limit cannot exceed monthly limit.');
      err.statusCode = 400;
      throw err;
    }
    const generated = await this.cardProvider.generateCard({
      memberId: input.memberId,
      currency: input.currency,
      cardholderName,
    });

    const now = new Date().toISOString();
    const cardId = `crd-${randomUUID()}`;

    const storedCard: StoredCard = {
      id: cardId,
      memberId: input.memberId,
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
    this.schedulePersist();

    await this.auditService.log({
      actor: adminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_CREATE_VIRTUAL_CARD',
      targetType: 'VIRTUAL_CARD',
      targetId: cardId,
      beforeState: null,
      afterState: {
        id: cardId,
        memberId: input.memberId,
        currency: input.currency,
        lastFour: generated.lastFour,
        dailyLimitMinor,
        monthlyLimitMinor,
      },
      ipAddress,
    });

    this.kycService.addNotification({
      memberId: input.memberId,
      title: 'Virtual Card Issued',
      message: `A new ${input.currency} virtual card ending in •••• ${generated.lastFour} was issued for your account by an administrator.`,
      type: 'success',
    });

    const member = this.memberContact(input.memberId);
    if (member) {
      void this.emailService.sendCardCreatedEmail(member.email, member.fullName, {
        lastFour: generated.lastFour,
        currency: input.currency,
      });
    }

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
    this.schedulePersist();

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

    // 1. Non-active cards decline simulated purchases
    if (card.status !== 'ACTIVE') {
      const reason =
        card.status === 'FROZEN'
          ? 'Card is frozen. Transaction declined.'
          : card.status === 'SUSPENDED'
            ? 'Card is suspended. Transaction declined.'
            : 'Card is terminated. Transaction declined.';
      const declinedRecord: CardTransactionRecord = {
        ...recordBase,
        status: 'DECLINED',
        declineReason: reason,
      };
      this.cardTransactions.push(declinedRecord);
      this.schedulePersist();
      this.notifyCardDeclined(card.memberId, declinedRecord, card.lastFour);

      const err: any = new Error(`Transaction declined: ${reason}`);
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
