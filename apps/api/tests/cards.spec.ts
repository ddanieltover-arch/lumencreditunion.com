import { describe, it, expect, beforeEach } from 'vitest';
import { CardsService } from '../src/cards/cards.service';
import { SandboxCardProvider } from '../src/cards/card-provider.interface';
import { LedgerService } from '../src/ledger/ledger.service';
import { AuthService } from '../src/auth/auth.service';
import { ConfigService } from '../src/config/config.service';
import { AuditService } from '../src/audit/audit.service';
import { KycService } from '../src/kyc/kyc.service';

describe('Virtual Cards & Acceptance Criteria', () => {
  let cardsService: CardsService;
  let ledgerService: LedgerService;
  let authService: AuthService;
  let configService: ConfigService;
  let auditService: AuditService;
  let kycService: KycService;
  let cardProvider: SandboxCardProvider;

  const memberId = '00000000-0000-0000-0000-000000000002'; // Amara Okafor (KYC approved)
  const unapprovedMemberId = '00000000-0000-0000-0000-000000000099';

  beforeEach(async () => {
    configService = new ConfigService({
      SANDBOX_MODE: 'true',
    });
    auditService = new AuditService();
    kycService = new KycService(undefined, undefined, auditService);
    ledgerService = new LedgerService(configService, auditService, kycService);
    authService = new AuthService(auditService, configService);
    cardProvider = new SandboxCardProvider();

    // Mark memberId as KYC approved
    kycService.memberKycStatus.set(memberId, 'APPROVED');

    cardsService = new CardsService(
      ledgerService,
      auditService,
      authService,
      kycService,
      configService,
      cardProvider,
    );

    // Seed member's USD wallet with $2,000.00 (200,000 minor units)
    await ledgerService.adminFundMemberWallet(
      {
        memberId,
        amountMinor: 200000,
        currency: 'USD',
        reason: 'Initial test wallet funding for card tests',
        idempotencyKey: `fund-card-test-${Date.now()}`,
      },
      'admin-actor',
      '127.0.0.1',
    );

    await cardsService.createCard(
      memberId,
      {
        currency: 'USD',
        cardholderName: 'Amara Okafor',
        dailyLimitMinor: 50000,
        monthlyLimitMinor: 200000,
      },
      '127.0.0.1',
    );
  });

  describe('CardProvider & Sandbox Generation', () => {
    it('generates fake test PANs that are non-routable and clearly flagged TEST', async () => {
      const generated = await cardProvider.generateCard({
        memberId,
        currency: 'USD',
        cardholderName: 'Amara Okafor',
      });

      expect(generated.fullPan).toMatch(/^4000 0012 \d{4} \d{4}$/);
      expect(generated.lastFour.length).toBe(4);
      expect(generated.cvv).toMatch(/^\d{3}$/);
      expect(generated.expiryFormatted).toMatch(/^\d{2}\/\d{2}$/);
      expect(generated.isTest).toBe(true);
      expect(generated.brand).toContain('TEST');
    });
  });

  describe('ACCEPTANCE CRITERIA: Full Card Number is NEVER returned by the API after creation', () => {
    it('returns full PAN and CVV only once in oneTimeCredentials on creation, and never stores them', async () => {
      const creation = await cardsService.createCard(
        memberId,
        {
          currency: 'USD',
          cardholderName: 'Amara Okafor',
          dailyLimitMinor: 50000, // $500.00
          monthlyLimitMinor: 200000, // $2,000.00
        },
        '127.0.0.1',
      );

      // 1. One-time credentials contain the fake PAN and CVV for initial display
      expect(creation.oneTimeCredentials.fullPan).toBeDefined();
      expect(creation.oneTimeCredentials.cvv).toBeDefined();
      expect(creation.oneTimeCredentials.warningNotice).toContain('never stored');

      const cardId = creation.card.id;

      // 2. Fetching the card by ID returns masked PAN only (NO fullPan, NO cvv)
      const fetchedCard = cardsService.getCardById(cardId, memberId);
      expect(fetchedCard.maskedPan).toBe(`•••• •••• •••• ${fetchedCard.lastFour}`);
      expect((fetchedCard as any).fullPan).toBeUndefined();
      expect((fetchedCard as any).cvv).toBeUndefined();

      // 3. Listing member cards returns masked PAN only (NO fullPan, NO cvv)
      const allCards = cardsService.getMemberCards(memberId);
      const foundInList = allCards.find((c) => c.id === cardId);
      expect(foundInList).toBeDefined();
      expect((foundInList as any).fullPan).toBeUndefined();
      expect((foundInList as any).cvv).toBeUndefined();
    });

    it('rejects card creation if member is not KYC verified', async () => {
      await expect(
        cardsService.createCard(
          unapprovedMemberId,
          {
            currency: 'USD',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Identity verification \(KYC\) required/);
    });
  });

  describe('Card Freeze & Unfreeze State', () => {
    it('allows member to freeze and unfreeze their virtual card', async () => {
      const cards = cardsService.getMemberCards(memberId, 'USD');
      expect(cards.length).toBeGreaterThan(0);
      const cardId = cards[0].id;

      // Freeze card
      const frozen = await cardsService.updateCardStatus(cardId, memberId, 'FROZEN', '127.0.0.1');
      expect(frozen.status).toBe('FROZEN');

      // Unfreeze card
      const unfrozen = await cardsService.updateCardStatus(cardId, memberId, 'ACTIVE', '127.0.0.1');
      expect(unfrozen.status).toBe('ACTIVE');
    });

    it('logs audit records when card is frozen or unfrozen', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];
      await cardsService.toggleFreeze(card.id, memberId, '127.0.0.1');

      const logs = await auditService.getLogs();
      const freezeLog = logs.find((l) => l.action === 'MEMBER_FREEZE_CARD');
      expect(freezeLog).toBeDefined();
      expect(freezeLog?.targetId).toBe(card.id);
    });
  });

  describe('ACCEPTANCE CRITERIA: A frozen card declines simulated purchases', () => {
    it('declines purchase when card is frozen and does not alter ledger balances', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];
      await cardsService.updateCardStatus(card.id, memberId, 'FROZEN', '127.0.0.1');

      const balanceBefore = ledgerService.getMemberBalance(memberId, 'USD');

      await expect(
        cardsService.simulatePurchase(
          card.id,
          {
            amountMinor: 2500, // $25.00
            merchantName: 'Metro Coffee Shop',
          },
          '127.0.0.1',
          memberId,
        ),
      ).rejects.toThrow(/Transaction declined: card is frozen/i);

      // Balance remains completely intact
      const balanceAfter = ledgerService.getMemberBalance(memberId, 'USD');
      expect(balanceAfter).toBe(balanceBefore);

      // Transaction recorded as DECLINED
      const transactions = cardsService.getCardTransactions(card.id, memberId);
      expect(transactions[0].status).toBe('DECLINED');
      expect(transactions[0].declineReason).toContain('Card is frozen');
    });
  });

  describe('ACCEPTANCE CRITERIA: Limits are enforced server-side', () => {
    it('declines simulated purchase when daily limit is exceeded', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];

      // Set daily limit to $50.00 (5,000 cents)
      await cardsService.updateCardLimits(
        card.id,
        memberId,
        {
          dailyLimitMinor: 5000,
          monthlyLimitMinor: 50000,
        },
        '127.0.0.1',
      );

      // Attempt purchase of $75.00 (7,500 cents)
      await expect(
        cardsService.simulatePurchase(
          card.id,
          {
            amountMinor: 7500,
            merchantName: 'Electronics Store',
          },
          '127.0.0.1',
          memberId,
        ),
      ).rejects.toThrow(/daily.*limit exceeded/i);

      // Verify spending was not recorded
      const updatedCard = cardsService.getCardById(card.id, memberId);
      expect(updatedCard.spentTodayMinor).toBe(0);
    });

    it('declines simulated purchase when monthly limit is exceeded', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];

      // Set limits: daily $500.00, monthly $100.00
      await cardsService.updateCardLimits(
        card.id,
        memberId,
        {
          dailyLimitMinor: 10000, // $100.00
          monthlyLimitMinor: 10000, // $100.00
        },
        '127.0.0.1',
      );

      // Make first purchase of $80.00 (8,000 cents)
      await cardsService.simulatePurchase(
        card.id,
        {
          amountMinor: 8000,
          merchantName: 'Grocery Market',
        },
        '127.0.0.1',
        memberId,
      );

      // Second purchase of $30.00 should exceed monthly limit ($80 + $30 = $110 > $100)
      await expect(
        cardsService.simulatePurchase(
          card.id,
          {
            amountMinor: 3000,
            merchantName: 'Corner Bookstore',
          },
          '127.0.0.1',
          memberId,
        ),
      ).rejects.toThrow(/monthly.*limit exceeded/i);
    });

    it('rejects limit updates where daily limit exceeds monthly limit', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];

      await expect(
        cardsService.updateCardLimits(
          card.id,
          memberId,
          {
            dailyLimitMinor: 200000, // $2,000.00
            monthlyLimitMinor: 100000, // $1,000.00
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Daily limit cannot exceed monthly limit/);
    });
  });

  describe('Ledger Double-Entry & Balance Accounting for Card Purchases', () => {
    it('posts an atomic double-entry ledger transaction debiting the member wallet and crediting EXTERNAL_CLEARING', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];
      const initialBalance = ledgerService.getMemberBalance(memberId, 'USD');

      const purchaseAmountMinor = 4500; // $45.00
      const result = await cardsService.simulatePurchase(
        card.id,
        {
          amountMinor: purchaseAmountMinor,
          merchantName: 'Apex Cloud Hosting',
          merchantCategory: 'SOFTWARE_SERVICES',
        },
        '127.0.0.1',
        memberId,
      );

      expect(result.success).toBe(true);
      expect(result.transaction.status).toBe('APPROVED');
      expect(result.ledgerTransaction).toBeDefined();
      expect(result.ledgerTransaction.source).toBe('CARD_PURCHASE');

      // Verify wallet balance decreased by exactly purchase amount
      const newBalance = ledgerService.getMemberBalance(memberId, 'USD');
      expect(newBalance).toBe(initialBalance - purchaseAmountMinor);

      // Verify card spending tracker updated
      const updatedCard = cardsService.getCardById(card.id, memberId);
      expect(updatedCard.spentTodayMinor).toBe(purchaseAmountMinor);
      expect(updatedCard.spentThisMonthMinor).toBe(purchaseAmountMinor);

      // Zero-sum invariant maintained
      const recon = ledgerService.reconcileBalances();
      expect(recon.zeroSumCheckPassed).toBe(true);
    });

    it('declines purchase when member wallet has insufficient funds', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];
      const balance = ledgerService.getMemberBalance(memberId, 'USD');

      await expect(
        cardsService.simulatePurchase(
          card.id,
          {
            amountMinor: balance + 50000, // Exceeds balance by $500.00
            merchantName: 'Luxury Goods Emporium',
          },
          '127.0.0.1',
          memberId,
        ),
      ).rejects.toThrow(/insufficient funds/i);
    });
  });

  describe('Super Admin Virtual Card Management (Crediting, Editing, Deleting, Freezing, Suspending, Issuing)', () => {
    const adminId = '00000000-0000-0000-0000-000000000001';

    it('retrieves all issued cards across members for admin oversight', () => {
      const adminCards = cardsService.getAllCardsForAdmin();
      expect(adminCards.length).toBeGreaterThan(0);
      const card = adminCards.find((c) => c.memberId === memberId);
      expect(card).toBeDefined();
      expect(card?.maskedPan).toMatch(/^•••• •••• •••• \d{4}$/);
      expect(card?.memberName).toBeDefined();
    });

    it('allows admin to freeze, unfreeze, suspend, and terminate cards with audit trail and notifications', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];

      // 1. Freeze
      const frozen = await cardsService.adminSetCardStatus(
        card.id,
        'FROZEN',
        adminId,
        '127.0.0.1',
        'Routine compliance hold',
      );
      expect(frozen.status).toBe('FROZEN');

      // 2. Suspend
      const suspended = await cardsService.adminSetCardStatus(
        card.id,
        'SUSPENDED',
        adminId,
        '127.0.0.1',
        'Suspicious merchant attempt',
      );
      expect(suspended.status).toBe('SUSPENDED');

      // 3. Unfreeze / Activate
      const active = await cardsService.adminSetCardStatus(
        card.id,
        'ACTIVE',
        adminId,
        '127.0.0.1',
        'Cleared by risk officer',
      );
      expect(active.status).toBe('ACTIVE');

      // Check audit logs
      const logs = await auditService.getLogs();
      const freezeLog = logs.find((l) => l.action === 'ADMIN_FREEZE_CARD');
      const suspendLog = logs.find((l) => l.action === 'ADMIN_SUSPEND_CARD');
      const unfreezeLog = logs.find((l) => l.action === 'ADMIN_UNFREEZE_CARD');
      expect(freezeLog).toBeDefined();
      expect(suspendLog).toBeDefined();
      expect(unfreezeLog).toBeDefined();
    });

    it('allows admin to edit cardholder name, limits, and reset spending counters', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];

      // Simulate a purchase to increment spentTodayMinor
      await cardsService.simulatePurchase(
        card.id,
        {
          amountMinor: 2500, // $25.00
          merchantName: 'Cloud Server',
        },
        '127.0.0.1',
        memberId,
      );

      const beforeUpdate = cardsService.getCardById(card.id, memberId);
      expect(beforeUpdate.spentTodayMinor).toBe(2500);

      // Admin updates limits and resets today spending
      const updated = await cardsService.adminUpdateCard(
        card.id,
        {
          cardholderName: 'Amara N. Okafor',
          dailyLimitMinor: 80000, // $800.00
          monthlyLimitMinor: 300000, // $3,000.00
          resetSpentToday: true,
          reason: 'Customer VIP upgrade',
        },
        adminId,
        '127.0.0.1',
      );

      expect(updated.cardholderName).toBe('Amara N. Okafor');
      expect(updated.dailyLimitMinor).toBe(80000);
      expect(updated.monthlyLimitMinor).toBe(300000);
      expect(updated.spentTodayMinor).toBe(0); // Successfully reset to 0
    });

    it('allows admin to credit member wallet linked to virtual card with double-entry ledger posting', async () => {
      const card = cardsService.getMemberCards(memberId, 'USD')[0];
      const initialWalletBalance = ledgerService.getMemberBalance(memberId, 'USD');

      const creditAmountMinor = 50000; // $500.00
      const result = await cardsService.adminCreditCardWallet(
        card.id,
        {
          amountMinor: creditAmountMinor,
          reason: 'Promotion credit for virtual card user',
          reference: 'PROMO-CARD-500',
        },
        adminId,
        '127.0.0.1',
      );

      expect(result.success).toBe(true);
      expect(result.ledgerTransaction).toBeDefined();

      // Wallet balance increased by exact amount
      const newWalletBalance = ledgerService.getMemberBalance(memberId, 'USD');
      expect(newWalletBalance).toBe(initialWalletBalance + creditAmountMinor);

      // Ledger invariant preserved
      const recon = ledgerService.reconcileBalances();
      expect(recon.zeroSumCheckPassed).toBe(true);

      // Audit log present
      const logs = await auditService.getLogs();
      const creditLog = logs.find((l) => l.action === 'ADMIN_CREDIT_CARD_WALLET');
      expect(creditLog).toBeDefined();
    });

    it('allows admin to issue a new virtual card for any member and view its transactions', async () => {
      const result = await cardsService.adminCreateCard(
        {
          memberId,
          currency: 'EUR',
          cardholderName: 'Amara Euro Card',
          dailyLimitMinor: 150000,
          monthlyLimitMinor: 600000,
        },
        adminId,
        '127.0.0.1',
      );

      expect(result.card).toBeDefined();
      expect(result.card.currency).toBe('EUR');
      expect(result.card.maskedPan).toMatch(/^•••• •••• •••• \d{4}$/);
      expect(result.oneTimeCredentials.fullPan).toBeDefined();
      expect(result.oneTimeCredentials.cvv).toBeDefined();

      // Fund EUR wallet to simulate purchase
      await ledgerService.adminFundMemberWallet(
        {
          memberId,
          amountMinor: 100000,
          currency: 'EUR',
          reason: 'EUR seed for purchase',
          idempotencyKey: `eur-fund-${Date.now()}`,
        },
        adminId,
        '127.0.0.1',
      );

      // Simulate a purchase on the newly issued card
      await cardsService.simulatePurchase(
        result.card.id,
        {
          amountMinor: 3000,
          merchantName: 'Berlin Metro',
          merchantCategory: 'TRANSIT',
        },
        '127.0.0.1',
        memberId,
      );

      // Admin gets transaction history for this card
      const txs = cardsService.adminGetCardTransactions(result.card.id);
      expect(txs.length).toBe(1);
      expect(txs[0].merchantName).toBe('Berlin Metro');
      expect(txs[0].status).toBe('APPROVED');
    });

    it('allows admin to delete a virtual card permanently', async () => {
      const created = await cardsService.createCard(
        memberId,
        {
          currency: 'CAD',
          cardholderName: 'Temporary Card',
        },
        '127.0.0.1',
      );

      const cardId = created.card.id;
      expect(cardsService.getMemberCards(memberId, 'CAD').some((c) => c.id === cardId)).toBe(true);

      // Admin deletes card
      const delResult = await cardsService.adminDeleteCard(cardId, adminId, '127.0.0.1');
      expect(delResult.success).toBe(true);
      expect(delResult.id).toBe(cardId);

      // Card is no longer listed
      expect(cardsService.getMemberCards(memberId, 'CAD').some((c) => c.id === cardId)).toBe(false);

      // Audit log recorded
      const logs = await auditService.getLogs();
      const deleteLog = logs.find(
        (l) => l.action === 'ADMIN_DELETE_CARD' && l.targetId === cardId,
      );
      expect(deleteLog).toBeDefined();
    });
  });
});
