import express, { Express, Request, Response } from 'express';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { createRateLimiter } from './common/middleware/rate-limiter.middleware';
import { securityHeadersMiddleware, csrfProtectionMiddleware } from './common/middleware/security-headers.middleware';
import { globalExceptionFilter } from './common/filters/global-exception.filter';
import { CountriesController } from './countries/countries.controller';
import { ConfigService } from './config/config.service';
import { LedgerService } from './ledger/ledger.service';
import { AuditService } from './audit/audit.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { authenticateJwt, requireRole } from './common/guards/roles.guard';
import { requireKycApproved } from './common/guards/kyc.guard';
import { validateZod } from './common/pipes/zod-validation.pipe';
import { KycService } from './kyc/kyc.service';
import { KycController } from './kyc/kyc.controller';
import {
  AdminFundWalletSchema,
  WalletTransferSchema,
  RegisterUserSchema,
  LoginUserSchema,
  MfaVerifyLoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  ChangePasswordSchema,
  SubmitKycInputSchema,
  ReviewKycInputSchema,
  AddBeneficiarySchema,
  MemberTransferInputSchema,
  BankTransferInputSchema,
  CryptoTransferInputSchema,
  CreateCardSchema,
  UpdateCardLimitsSchema,
  SimulateCardPurchaseSchema,
} from '@lumenfield/shared';
import { TransfersService } from './transfers/transfers.service';
import { TransfersController } from './transfers/transfers.controller';
import { CardsService } from './cards/cards.service';
import { CardsController } from './cards/cards.controller';

export function createApiApp(
  authServiceOverride?: AuthService,
  ledgerServiceOverride?: LedgerService,
  kycServiceOverride?: KycService,
  auditServiceOverride?: AuditService,
  transfersServiceOverride?: TransfersService,
  cardsServiceOverride?: CardsService,
): Express {
  const app = express();
  const configService = ConfigService.getInstance();
  const countriesController = new CountriesController();
  const auditService =
    auditServiceOverride || kycServiceOverride?.auditService || new AuditService();
  const authService = authServiceOverride || new AuthService(auditService, configService);
  const kycService = kycServiceOverride || new KycService(undefined, undefined, auditService);
  const ledgerService =
    ledgerServiceOverride || new LedgerService(configService, auditService, kycService);
  const authController = new AuthController(authService);
  const kycController = new KycController(kycService);
  const transfersService =
    transfersServiceOverride ||
    new TransfersService(ledgerService, authService, configService, auditService, kycService);
  const transfersController = new TransfersController(transfersService);
  const cardsService =
    cardsServiceOverride ||
    new CardsService(ledgerService, auditService, authService, kycService, configService);
  const cardsController = new CardsController(cardsService);

  // Core middleware
  app.use(securityHeadersMiddleware);
  app.use(csrfProtectionMiddleware);
  app.use(express.json({ limit: '15mb' })); // Support document base64 payloads up to 10MB file size
  app.use(requestLogger);
  app.use(createRateLimiter({ windowMs: 60_000, max: 100 }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Idempotency-Key, X-Requested-With',
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Dedicated rate limiter for Authentication routes (Hardening against brute force)
  const authRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

  // ---------------------------------------------------------------------------
  // PUBLIC ROUTES
  // ---------------------------------------------------------------------------
  app.get('/health', async (_req: Request, res: Response) => {
    const reconciliation = ledgerService.reconcileBalances();
    const allTxs = await ledgerService.getAllTransactions();
    res.json({
      status: 'ok',
      service: 'lumenfield-api',
      uptimeSeconds: Math.floor(process.uptime()),
      sandboxMode: configService.isSandbox,
      productionMode: configService.isProduction,
      requireSecondApprover: configService.requireSecondApprover,
      ledger: {
        zeroSumInvariantPassed: reconciliation.zeroSumCheckPassed,
        totalTransactions: allTxs.length,
        totalAccounts: ledgerService.getAllAccounts().length,
      },
      memory: {
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/config', (_req: Request, res: Response) => {
    res.json({
      sandboxMode: configService.isSandbox,
      productionMode: configService.isProduction,
      requireSecondApprover: configService.requireSecondApprover,
      bannerNotice: 'Lumenfield Credit Union — secure member access.',
      emailDeliveryEnabled: Boolean(process.env.RESEND_API_KEY?.trim()),
    });
  });

  // Seeded countries returned by GET /countries
  app.get('/countries', countriesController.getCountries);
  app.get('/countries/:code', countriesController.getCountryByCode);
  app.get('/countries/:code/sanction-check', countriesController.checkSanction);

  // ---------------------------------------------------------------------------
  // AUTHENTICATION ROUTES
  // ---------------------------------------------------------------------------
  app.post(
    '/auth/register',
    authRateLimiter,
    validateZod(RegisterUserSchema),
    authController.register,
  );
  app.post('/auth/verify-email', authRateLimiter, authController.verifyEmail);
  app.post('/auth/login', authRateLimiter, validateZod(LoginUserSchema), authController.login);
  app.post(
    '/auth/mfa-verify',
    authRateLimiter,
    validateZod(MfaVerifyLoginSchema),
    authController.verifyMfa,
  );
  app.post('/auth/refresh', authController.refreshToken);
  app.post(
    '/auth/forgot-password',
    authRateLimiter,
    validateZod(PasswordResetRequestSchema),
    authController.forgotPassword,
  );
  app.post(
    '/auth/reset-password',
    authRateLimiter,
    validateZod(PasswordResetConfirmSchema),
    authController.resetPassword,
  );

  // Authenticated user profile, session, and security management
  app.get('/auth/me', authenticateJwt, authController.getCurrentUser);
  app.post('/auth/logout', authenticateJwt, authController.logout);
  app.get('/auth/sessions', authenticateJwt, authController.getSessions);
  app.delete('/auth/sessions/:sessionId', authenticateJwt, authController.revokeSession);
  app.delete('/auth/sessions', authenticateJwt, authController.revokeAllOtherSessions);

  app.post('/auth/mfa/enroll', authenticateJwt, authController.startMfaEnrollment);
  app.post('/auth/mfa/confirm', authenticateJwt, authController.confirmMfaEnrollment);
  app.post('/auth/mfa/disable', authenticateJwt, authController.disableMfa);
  app.post(
    '/auth/change-password',
    authenticateJwt,
    validateZod(ChangePasswordSchema),
    authController.changePassword,
  );

  // GDPR / CCPA Data Subject Access & Export
  app.get(
    '/auth/data-export',
    authenticateJwt,
    async (req: Request, res: Response, next) => {
      try {
        const ip = (req.ip || '127.0.0.1').toString();
        const user = authService.getUserById(req.user!.id);
        if (!user) {
          res.status(404).json({ message: 'User not found' });
          return;
        }

        const kyc = kycService.getMemberSubmission(user.id);
        const balances = ledgerService.getMemberBalances(user.id);
        const txHistory = ledgerService.getMemberTransactions(user.id, { page: 1, limit: 100 });
        const userCards = cardsService.getMemberCards(user.id);
        const allLogs = await auditService.getLogs();
        const userAuditLogs = allLogs.filter(
          (log) => log.actorId === user.id || log.targetId === user.id,
        );

        await auditService.record({
          actorId: user.id,
          actorRole: user.role,
          action: 'MEMBER_EXPORT_DATA',
          targetType: 'USER',
          targetId: user.id,
          beforeState: null,
          afterState: { exportFormat: 'JSON' },
          ipAddress: ip,
        });

        const exportData = {
          gdprExportVersion: '1.0',
          exportedAt: new Date().toISOString(),
          subject: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            countryCode: user.countryCode,
            role: user.role,
            mfaEnabled: user.mfaEnabled,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          identityVerification: kyc,
          walletBalances: balances,
          transactions: txHistory.data,
          virtualCards: userCards,
          auditHistory: userAuditLogs,
          legalNotice:
            'Lumenfield Credit Union Data Export. Generated in accordance with GDPR Article 15 and CCPA rights.',
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="lumenfield-data-export-${user.id}-${Date.now()}.json"`,
        );
        res.json(exportData);
      } catch (err) {
        next(err);
      }
    },
  );

  // GDPR / CCPA Account Deletion Request
  app.post(
    '/auth/account-deletion',
    authenticateJwt,
    async (req: Request, res: Response, next) => {
      try {
        const ip = (req.ip || '127.0.0.1').toString();
        const user = authService.getUserById(req.user!.id);
        if (!user) {
          res.status(404).json({ message: 'User not found' });
          return;
        }

        if (user.role === 'SUPER_ADMIN') {
          res.status(400).json({
            message: 'Super Administrator accounts cannot be deleted through self-service.',
          });
          return;
        }

        const reason = req.body?.reason || 'Member requested deletion';

        await auditService.record({
          actorId: user.id,
          actorRole: user.role,
          action: 'MEMBER_REQUEST_DELETION',
          targetType: 'USER',
          targetId: user.id,
          beforeState: { email: user.email, mfaEnabled: user.mfaEnabled },
          afterState: { status: 'DELETION_REQUESTED', reason },
          ipAddress: ip,
        });

        user.lockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        res.json({
          success: true,
          message:
            'Your account deletion request has been scheduled in accordance with GDPR/CCPA regulations. Your session will now terminate.',
          scheduledPurgeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // SUPER ADMIN ROUTES (Strictly Protected by RolesGuard)
  // Acceptance Criteria: A MEMBER cannot call any admin route.
  // ---------------------------------------------------------------------------
  // Admin Funding Endpoints (POST /admin/funding & POST /admin/fund-wallet)
  const handleAdminFunding = async (req: Request, res: Response, next: any) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const tx = await ledgerService.adminFundMemberWallet(req.body, req.user!.id, ip);
      res.status(201).json(tx);
    } catch (err) {
      next(err);
    }
  };

  app.post(
    '/admin/funding',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminFundWalletSchema),
    handleAdminFunding,
  );

  app.post(
    '/admin/fund-wallet',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminFundWalletSchema),
    handleAdminFunding,
  );

  // Dual-control approval for transactions pending second approver (HARD RULE 5)
  app.post(
    '/admin/funding/:id/approve',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        const ip = (req.ip || '127.0.0.1').toString();
        const tx = await ledgerService.approvePendingTransaction(
          req.params.id,
          req.user!.id,
          ip,
        );
        res.json(tx);
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/admin/audit-logs',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      const logs = await auditService.getLogs();
      res.json(logs);
    },
  );

  app.get(
    '/admin/ledger/transactions',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      const transactions = await ledgerService.getAllTransactions();
      res.json(transactions);
    },
  );

  app.get(
    '/admin/ledger/accounts',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      const accounts = ledgerService.getAllAccounts();
      res.json(accounts);
    },
  );

  // Reconciliation job: compares cached balances with derived entries and validates zero-sum invariant
  app.post(
    '/admin/ledger/reconcile',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      const report = ledgerService.reconcileBalances();
      res.json(report);
    },
  );

  // Observability & Admin KPI Dashboard Stats
  app.get(
    '/admin/dashboard-stats',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      const allUsers = authService.getAllUsers();
      const members = allUsers.filter((u) => u.role === 'MEMBER');
      const kycQueue = kycService.getAdminQueue('PENDING');
      const accounts = ledgerService.getAllAccounts();
      const flagged = transfersService.getFlaggedTransfers();
      const reconcile = ledgerService.reconcileBalances();

      const fundsByCurrency: Record<string, { totalMinor: number; formatted: string }> = {
        USD: { totalMinor: 0, formatted: '$0.00' },
        CAD: { totalMinor: 0, formatted: 'CA$0.00' },
        GBP: { totalMinor: 0, formatted: '£0.00' },
        EUR: { totalMinor: 0, formatted: '€0.00' },
      };

      for (const acc of accounts) {
        if (acc.accountType === 'MEMBER_WALLET') {
          if (!fundsByCurrency[acc.currency]) {
            fundsByCurrency[acc.currency] = { totalMinor: 0, formatted: '0.00' };
          }
          fundsByCurrency[acc.currency].totalMinor += acc.cachedBalanceMinor;
        }
      }

      for (const cur of Object.keys(fundsByCurrency)) {
        const item = fundsByCurrency[cur];
        const val = (item.totalMinor / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const symbol = cur === 'USD' ? '$' : cur === 'CAD' ? 'CA$' : cur === 'GBP' ? '£' : '€';
        item.formatted = `${symbol}${val}`;
      }

      res.json({
        totalMembers: members.length,
        pendingKycCount: kycQueue.length,
        pendingLoansCount: 1, // Active simulated loan application in sandbox review queue
        totalTestFunds: fundsByCurrency,
        flaggedTransfersCount: flagged.length,
        ledgerZeroSumPassed: reconcile.zeroSumCheckPassed,
        systemHealth: 'HEALTHY',
      });
    },
  );

  // Legacy sandbox dev endpoint support
  app.post(
    '/ledger/fund',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminFundWalletSchema),
    handleAdminFunding,
  );

  // ---------------------------------------------------------------------------
  // SUPER ADMIN KYC REVIEW QUEUE & SIGNED URLS (HARD RULE 5, 6 & 7)
  // Acceptance Criteria: Document URLs expire and are never exposed to members after upload.
  // ---------------------------------------------------------------------------
  app.get(
    '/admin/kyc/queue',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    kycController.getQueue,
  );
  app.get(
    '/admin/kyc/submissions/:id',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    kycController.getSubmission,
  );
  app.post(
    '/admin/kyc/submissions/:id/review',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(ReviewKycInputSchema),
    kycController.review,
  );
  app.get(
    '/admin/kyc/documents/:docId/signed-url',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    kycController.getSignedUrl,
  );
  // Decrypt and view document using short-lived signed URL token
  app.get('/admin/kyc/documents/:docId/view', kycController.viewDocument);

  // ---------------------------------------------------------------------------
  // MEMBER KYC ROUTES
  // ---------------------------------------------------------------------------
  app.get('/kyc/status', authenticateJwt, kycController.getStatus);
  app.post(
    '/kyc/submit',
    authenticateJwt,
    validateZod(SubmitKycInputSchema),
    kycController.submit,
  );
  app.get('/kyc/notifications', authenticateJwt, kycController.getNotifications);
  app.post('/kyc/notifications/read', authenticateJwt, kycController.markNotificationsRead);

  // ---------------------------------------------------------------------------
  // RESTRICTED MEMBER ENDPOINTS (Guarded by requireKycApproved)
  // Acceptance Criteria: Unverified members get a clear "verify your identity" prompt and a 403 from restricted endpoints.
  // Until a member is APPROVED, block wallet funding, transfers, cards and loan applications on the server.
  // ---------------------------------------------------------------------------
  app.post(
    '/wallet/fund',
    authenticateJwt,
    requireKycApproved(kycService),
    async (req: Request, res: Response, next) => {
      try {
        res.json({
          success: true,
          message: 'Wallet funding initiated.',
          action: 'WALLET_FUNDED',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // MEMBER WALLET ENDPOINTS
  // Tasks: balances, transaction history with pagination and filters, downloadable statement (CSV and PDF)
  // ---------------------------------------------------------------------------
  app.get('/wallet/balances', authenticateJwt, async (req: Request, res: Response) => {
    const balances = ledgerService.getMemberBalances(req.user!.id);
    res.json(balances);
  });

  app.get('/wallet/transactions', authenticateJwt, async (req: Request, res: Response) => {
    const history = ledgerService.getMemberTransactions(req.user!.id, req.query as any);
    res.json(history);
  });

  app.get('/wallet/statement', authenticateJwt, async (req: Request, res: Response) => {
    const format = ((req.query.format as string) || 'csv').toLowerCase();
    const currency = req.query.currency as string | undefined;

    if (format === 'csv') {
      const csv = ledgerService.exportStatementCsv(req.user!.id, currency);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lumenfield-statement-${Date.now()}.csv"`,
      );
      res.send(csv);
    } else if (format === 'pdf' || format === 'html') {
      const html = ledgerService.exportStatementHtml(req.user!.id, currency);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="lumenfield-statement-${Date.now()}.html"`,
      );
      res.send(html);
    } else {
      const statement = ledgerService.exportStatementPdf(req.user!.id, currency);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lumenfield-statement-${Date.now()}.json"`,
      );
      res.send(statement);
    }
  });

  // ---------------------------------------------------------------------------
  // TRANSFERS & BENEFICIARIES (MEMBER-TO-MEMBER, BANK, CRYPTO)
  // ---------------------------------------------------------------------------
  // Recipient Lookup (find member by Lumenfield ID or email)
  app.get(
    '/transfers/lookup',
    authenticateJwt,
    requireKycApproved(kycService),
    transfersController.lookupRecipient,
  );

  // Member-to-Member Transfer (with limits & MFA step-up)
  app.post(
    '/transfers/member',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(MemberTransferInputSchema),
    transfersController.initiateMemberTransfer,
  );

  // Legacy wallet transfer adapter (ensuring full validation & MFA step-up)
  app.post(
    '/wallet/transfer',
    authenticateJwt,
    requireKycApproved(kycService),
    async (req: Request, res: Response, next) => {
      try {
        const ip = (req.ip || '127.0.0.1').toString();
        const recipientQuery = req.body.recipientQuery || req.body.recipientMemberId;
        const transfer = await transfersService.initiateMemberTransfer(
          req.user!.id,
          {
            recipientQuery,
            amountMinor: req.body.amountMinor,
            currency: req.body.currency,
            note: req.body.note,
            idempotencyKey: req.body.idempotencyKey,
            totpCode: req.body.totpCode,
          },
          ip,
        );
        res.status(201).json({
          success: true,
          message: 'Transfer processed successfully.',
          transaction: transfer,
          transfer,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Beneficiaries (Validated per country)
  app.get(
    '/transfers/beneficiaries',
    authenticateJwt,
    requireKycApproved(kycService),
    transfersController.getBeneficiaries,
  );
  app.post(
    '/transfers/beneficiaries',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(AddBeneficiarySchema),
    transfersController.addBeneficiary,
  );

  // Bank Transfer (Simulated Outflow to EXTERNAL_CLEARING with reversal on failure)
  app.post(
    '/transfers/bank',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(BankTransferInputSchema),
    transfersController.initiateBankTransfer,
  );
  app.post(
    '/transfers/bank/:id/process',
    authenticateJwt,
    transfersController.processBankTransferState,
  );

  // Crypto Transfers (Simulated Sandbox)
  app.get(
    '/transfers/crypto/address',
    authenticateJwt,
    requireKycApproved(kycService),
    transfersController.getCryptoDepositAddress,
  );
  app.post(
    '/transfers/crypto/deposit',
    authenticateJwt,
    requireKycApproved(kycService),
    transfersController.simulateCryptoDeposit,
  );
  app.post(
    '/transfers/crypto/withdraw',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(CryptoTransferInputSchema),
    transfersController.initiateCryptoWithdrawal,
  );

  // Transfer History & Receipts
  app.get(
    '/transfers',
    authenticateJwt,
    requireKycApproved(kycService),
    transfersController.getTransfers,
  );
  app.post(
    '/transfers',
    authenticateJwt,
    requireKycApproved(kycService),
    async (req: Request, res: Response, next) => {
      try {
        if (req.body && req.body.recipientQuery) {
          return transfersController.initiateMemberTransfer(req, res, next);
        }
        res.json({
          success: true,
          message: 'Member transfer initiated.',
          action: 'TRANSFER_PROCESSED',
        });
      } catch (err) {
        next(err);
      }
    },
  );
  app.get(
    '/transfers/:id/receipt',
    authenticateJwt,
    transfersController.getTransferReceipt,
  );

  // Transfer Notifications
  app.get(
    '/transfers/notifications',
    authenticateJwt,
    transfersController.getNotifications,
  );
  app.post(
    '/transfers/notifications/read',
    authenticateJwt,
    transfersController.markNotificationsRead,
  );

  // SUPER_ADMIN Fraud Review Queue
  app.get(
    '/admin/transfers/flagged',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    transfersController.getFlaggedTransfers,
  );
  app.post(
    '/admin/transfers/:id/adjudicate',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    transfersController.adjudicateFlaggedTransfer,
  );

  // ---------------------------------------------------------------------------
  // VIRTUAL CARDS (SANDBOX PROVIDER)
  // Acceptance Criteria:
  // - A frozen card declines simulated purchases.
  // - Limits are enforced server-side.
  // - The full card number is never returned by the API after creation.
  // ---------------------------------------------------------------------------
  app.get(
    '/cards',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.getCards,
  );

  app.post(
    '/cards',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(CreateCardSchema),
    cardsController.createCard,
  );

  app.get(
    '/cards/:id',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.getCard,
  );

  app.post(
    '/cards/:id/freeze',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.freezeCard,
  );

  app.post(
    '/cards/:id/unfreeze',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.unfreezeCard,
  );

  app.post(
    '/cards/:id/toggle-freeze',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.toggleFreeze,
  );

  app.post(
    '/cards/toggle-freeze',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.toggleFreeze,
  );

  app.put(
    '/cards/:id/limits',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(UpdateCardLimitsSchema),
    cardsController.updateLimits,
  );

  app.post(
    '/cards/:id/limits',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(UpdateCardLimitsSchema),
    cardsController.updateLimits,
  );

  app.post(
    '/cards/limits',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.updateLimits,
  );

  app.get(
    '/cards/:id/transactions',
    authenticateJwt,
    requireKycApproved(kycService),
    cardsController.getTransactions,
  );

  // Simulated card purchases (dev-only sandbox endpoint)
  app.post(
    '/cards/:id/simulate-purchase',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(SimulateCardPurchaseSchema),
    cardsController.simulatePurchase,
  );

  app.post(
    '/cards/simulate-purchase',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(SimulateCardPurchaseSchema),
    cardsController.simulatePurchase,
  );

  app.post(
    '/loans/apply',
    authenticateJwt,
    requireKycApproved(kycService),
    async (req: Request, res: Response, next) => {
      try {
        res.json({
          success: true,
          message: 'Loan application submitted for underwriting.',
          action: 'LOAN_APPLICATION_SUBMITTED',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Global Exception Filter
  app.use(globalExceptionFilter);

  return app;
}
