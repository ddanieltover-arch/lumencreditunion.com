import crypto from 'crypto';
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
  CreateFundingRequestSchema,
  ReviewFundingRequestSchema,
  WalletTransferSchema,
  RegisterUserSchema,
  LoginUserSchema,
  MfaVerifyLoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  ChangePasswordSchema,
  SubmitKycInputSchema,
  ReviewKycInputSchema,
  AdminUpdateKycSchema,
  AdminUpdateMemberSchema,
  AddBeneficiarySchema,
  MemberTransferInputSchema,
  BankTransferInputSchema,
  CryptoTransferInputSchema,
  CreateCardSchema,
  UpdateCardLimitsSchema,
  SimulateCardPurchaseSchema,
  AdminUpdateCardSchema,
  AdminCreateCardSchema,
  AdminCreditCardWalletSchema,
  UpdateCardStatusSchema,
  formatMoney,
  parseMajorToMinor,
  SupportedCurrency,
} from '@lumenfield/shared';
import { TransfersService } from './transfers/transfers.service';
import { TransfersController } from './transfers/transfers.controller';
import { CardsService } from './cards/cards.service';
import { CardsController } from './cards/cards.controller';
import { EmailService } from './email/email.service';
import {
  loadPersistedFundingRequests,
  persistFundingRequest,
  type PersistedFundingRequest,
} from './wallet/funding-persistence';
import {
  loadPersistedLoans,
  persistLoanApplication,
  type PersistedLoanApplication,
} from './loans/loan-persistence';

type FundingRequestRecord = PersistedFundingRequest;

type GlobalFunding = typeof globalThis & {
  __lumenFundingRequests?: Map<string, FundingRequestRecord>;
  __lumenFundingHydrate?: Promise<void>;
};

function getFundingStore(): Map<string, FundingRequestRecord> {
  const g = globalThis as GlobalFunding;
  if (!g.__lumenFundingRequests) {
    g.__lumenFundingRequests = new Map();
  }
  return g.__lumenFundingRequests;
}

async function ensureFundingStoreReady(): Promise<Map<string, FundingRequestRecord>> {
  const g = globalThis as GlobalFunding;
  const store = getFundingStore();
  if (!g.__lumenFundingHydrate) {
    g.__lumenFundingHydrate = loadPersistedFundingRequests()
      .then((rows) => {
        for (const row of rows) {
          if (row?.id) store.set(row.id, row);
        }
        if (rows.length) {
          console.log(`[Funding] Restored ${rows.length} funding request(s) from database.`);
        }
      })
      .catch((err) => {
        console.error('[Funding] Hydration failed:', err);
        g.__lumenFundingHydrate = undefined;
      });
  }
  await g.__lumenFundingHydrate;
  return store;
}

type GlobalLoans = typeof globalThis & {
  __lumenLoanApplications?: Map<string, PersistedLoanApplication>;
  __lumenLoanHydrate?: Promise<void>;
};

function getLoanStore(): Map<string, PersistedLoanApplication> {
  const g = globalThis as GlobalLoans;
  if (!g.__lumenLoanApplications) {
    g.__lumenLoanApplications = new Map();
  }
  return g.__lumenLoanApplications;
}

async function ensureLoanStoreReady(): Promise<Map<string, PersistedLoanApplication>> {
  const g = globalThis as GlobalLoans;
  const store = getLoanStore();
  if (!g.__lumenLoanHydrate) {
    g.__lumenLoanHydrate = loadPersistedLoans()
      .then((rows) => {
        for (const row of rows) {
          if (row?.id) store.set(row.id, row);
        }
        if (rows.length) {
          console.log(`[Loans] Restored ${rows.length} loan application(s) from database.`);
        }
      })
      .catch((err) => {
        console.error('[Loans] Hydration failed:', err);
        g.__lumenLoanHydrate = undefined;
      });
  }
  await g.__lumenLoanHydrate;
  return store;
}

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
  const authService =
    authServiceOverride || AuthService.getInstance(auditService, configService);
  const kycService = kycServiceOverride || KycService.getInstance();
  const ledgerService =
    ledgerServiceOverride ||
    LedgerService.getInstance(configService, auditService, kycService, authService);
  const authController = new AuthController(authService);
  const kycController = new KycController(kycService);
  const transfersService =
    transfersServiceOverride ||
    new TransfersService(ledgerService, authService, configService, auditService, kycService);
  const transfersController = new TransfersController(transfersService);
  const cardsService =
    cardsServiceOverride ||
    CardsService.getInstance(
      ledgerService,
      auditService,
      authService,
      kycService,
      configService,
    );
  const cardsController = new CardsController(cardsService);
  const emailService = EmailService.getInstance();

  /** Re-apply approved funding requests when the in-memory ledger was wiped (cold start). */
  let fundingReplayPromise: Promise<void> | undefined;
  const replayApprovedFundingIntoLedger = async () => {
    if (!fundingReplayPromise) {
      fundingReplayPromise = (async () => {
        await ledgerService.ensureReady();
        const fundingRequests = await ensureFundingStoreReady();
        let replayed = 0;
        for (const record of fundingRequests.values()) {
          if (record.status !== 'APPROVED' || !record.amountMinor || !record.memberId) continue;
          try {
            await ledgerService.adminFundMemberWallet(
              {
                memberId: record.memberId,
                amountMinor: record.amountMinor,
                currency: record.currency,
                reason: `Member funding request: ${record.reason}`,
                reference: `FR-${record.id.slice(0, 12).toUpperCase()}`,
                source: 'DEPOSIT',
                idempotencyKey: `fund-req-${record.id}`,
              },
              record.reviewedById || 'system-replay',
              '127.0.0.1',
            );
            replayed += 1;
          } catch (err) {
            console.warn(
              `[Ledger] Could not replay approved funding ${record.id}:`,
              (err as Error)?.message || err,
            );
          }
        }
        if (replayed > 0) {
          console.log(
            `[Ledger] Reconciled ${replayed} approved funding request(s) into the ledger.`,
          );
        }
      })().catch((err) => {
        fundingReplayPromise = undefined;
        throw err;
      });
    }
    await fundingReplayPromise;
  };

  // Process-wide durable stores (hydrated from Postgres)
  void ensureFundingStoreReady();
  void ensureLoanStoreReady();
  void replayApprovedFundingIntoLedger();
  void cardsService.ensureReady();

  // Core middleware — parse JSON before CSRF so body-based checks work
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '15mb' })); // Support document base64 payloads up to 10MB file size
  app.use(csrfProtectionMiddleware);
  app.use(requestLogger);
  // Only rate-limit API routes — Vite/SPA assets share this Express mount in local fullstack mode.
  app.use(createRateLimiter({ windowMs: 60_000, max: 100, apiOnly: true }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
      adminSeedConfigured: Boolean(process.env.SUPER_ADMIN_PASSWORD?.trim()),
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
      adminSeedConfigured: Boolean(process.env.SUPER_ADMIN_PASSWORD?.trim()),
    });
  });

  // Seeded countries returned by GET /countries
  app.get('/countries', countriesController.getCountries);
  app.get('/countries/:code', countriesController.getCountryByCode);
  app.get('/countries/:code/sanction-check', countriesController.checkSanction);

  // Public contact form → Resend (visitor confirmation + support inbox)
  const contactRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
  app.post('/contact', contactRateLimiter, async (req: Request, res: Response, next) => {
    try {
      const visitorName = String(req.body?.name || '').trim();
      const visitorEmail = String(req.body?.email || '').trim();
      const subject = String(req.body?.subject || 'Member support').trim();
      const message = String(req.body?.message || '').trim();

      if (!visitorName || !visitorEmail || !message) {
        res.status(400).json({
          message: 'Name, email, and message are required.',
        });
        return;
      }

      const inbox = await emailService.sendContactSupportInboxEmail({
        visitorName,
        visitorEmail,
        subject,
        message,
      });
      const confirmation = await emailService.sendContactConfirmationEmail({
        visitorName,
        visitorEmail,
        subject,
      });

      if (!inbox.ok && !confirmation.ok) {
        res.status(503).json({
          success: false,
          message:
            'We could not deliver your message right now. Please email support@lumenfieldcu.com directly.',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Your message has been sent to Member Services.',
        emailDeliveryEnabled: emailService.isConfigured,
      });
    } catch (err) {
      next(err);
    }
  });

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

        void emailService.sendDataExportReadyEmail(user.email, user.fullName);

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
        const scheduledPurgeDate = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();

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

        void emailService.sendAccountDeletionScheduledEmail(
          user.email,
          user.fullName,
          scheduledPurgeDate,
        );

        res.json({
          success: true,
          message:
            'Your account deletion request has been scheduled in accordance with GDPR/CCPA regulations. Your session will now terminate.',
          scheduledPurgeDate,
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
    await ledgerService.ensureReady();
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const tx = await ledgerService.adminFundMemberWallet(req.body, req.user!.id, ip);
      const memberId = String(req.body.memberId || tx.metadata?.memberId || '');
      const member = authService.getUserById(memberId);
      const creditEntry = tx.entries.find(
        (e) => e.accountType === 'MEMBER_WALLET' && e.direction === 'CREDIT',
      );
      const amountFormatted = creditEntry
        ? formatMoney({
            amountMinor: creditEntry.amountMinor,
            currency: creditEntry.currency as SupportedCurrency,
          })
        : tx.reference;

      if (tx.status === 'PENDING_APPROVAL') {
        void emailService.sendAdminDualApprovalPendingEmail({
          amountFormatted,
          reference: tx.reference,
          memberId,
          transactionId: tx.id,
        });
      } else if (member) {
        void emailService.sendWalletFundedEmail(member.email, member.fullName, {
          amountFormatted,
          currency: tx.currency,
          reference: tx.reference,
          reason: req.body.reason,
        });
      }

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
        const memberId = String(tx.metadata?.memberId || '');
        const member = authService.getUserById(memberId);
        const creditEntry = tx.entries.find(
          (e) => e.accountType === 'MEMBER_WALLET' && e.direction === 'CREDIT',
        );
        const amountFormatted = creditEntry
          ? formatMoney({
              amountMinor: creditEntry.amountMinor,
              currency: creditEntry.currency as SupportedCurrency,
            })
          : tx.reference;
        if (member) {
          void emailService.sendDualApprovalPostedEmail(member.email, member.fullName, {
            amountFormatted,
            reference: tx.reference,
          });
          void emailService.sendWalletFundedEmail(member.email, member.fullName, {
            amountFormatted,
            currency: tx.currency,
            reference: tx.reference,
          });
        }
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
      await ledgerService.ensureReady();
      const transactions = await ledgerService.getAllTransactions();
      res.json(transactions);
    },
  );

  app.get(
    '/admin/ledger/accounts',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      await ledgerService.ensureReady();
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
      await ledgerService.ensureReady();
      const report = ledgerService.reconcileBalances();
      res.json(report);
    },
  );

  /** Build member directory rows (MEMBER role only — never SUPER_ADMIN). */
  const buildMemberDirectory = async () => {
    await Promise.all([
      authService.ensureReady(),
      kycService.ensureReady(),
      ledgerService.ensureReady(),
    ]);

    // Keep auth registry aligned with durable KYC member rows
    for (const sub of kycService.getAdminQueue()) {
      authService.ensureMemberFromProfile({
        id: sub.memberId,
        email: sub.memberEmail,
        fullName: sub.memberName || sub.memberEmail,
        countryCode: sub.countryCode,
      });
    }

    return authService
      .getAllUsers()
      .filter((u) => u.role === 'MEMBER')
      .map((u) => {
        if (!u.accountNumberNormalized) {
          authService.ensureBankIdentity(u);
        }
        const submission = kycService.getMemberSubmission(u.id, u.email);
        const kycStatus =
          submission?.status ||
          (kycService.isMemberKycApproved(u.id, u.email) ? 'APPROVED' : 'NOT_SUBMITTED');
        const walletBalances = (['USD', 'CAD', 'GBP', 'EUR'] as const).reduce(
          (acc, currency) => {
            const wallet = ledgerService.getOrCreateMemberWallet(u.id, currency);
            acc[currency] = Number(wallet.cachedBalanceMinor) / 100;
            return acc;
          },
          {} as Record<string, number>,
        );
        return {
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          countryCode: u.countryCode,
          role: u.role,
          emailVerified: u.emailVerified,
          createdAt: u.createdAt,
          bankScheme: u.bankScheme || null,
          bankDetails: u.bankDetails || null,
          accountNumberNormalized: u.accountNumberNormalized || null,
          accountNumberDisplay: u.accountNumberDisplay || null,
          identityVerified: kycStatus === 'APPROVED',
          kycStatus,
          wallets: walletBalances,
        };
      });
  };

  // Registered members directory (SUPER_ADMIN only — never includes admins)
  // Path avoids SPA tab slug /admin/members
  app.get(
    '/admin/member-directory',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response) => {
      const members = await buildMemberDirectory();
      res.json({ members, total: members.length });
    },
  );

  // Keep under /admin/member-directory/* so SPA tab slug /admin/members is never intercepted
  const handleAdminUpdateMember = async (req: Request, res: Response, next: any) => {
    try {
      await Promise.all([authService.ensureReady(), kycService.ensureReady()]);
      const ip = (req.ip || '127.0.0.1').toString();
      const updated = await authService.updateMember(
        req.params.memberId,
        req.body,
        req.user!.id,
        ip,
      );
      // Keep linked KYC email/name in sync when profile changes
      const sub = kycService.getMemberSubmission(updated.id, updated.email);
      if (sub) {
        try {
          await kycService.adminUpdateSubmission(
            sub.id,
            {
              memberName: updated.fullName,
              memberEmail: updated.email,
              countryCode: updated.countryCode,
            },
            req.user!.id,
            ip,
          );
        } catch (kycErr) {
          console.warn('[admin] KYC sync after member update failed:', kycErr);
        }
      }
      const directory = await buildMemberDirectory();
      const row = directory.find((m) => m.id === updated.id);
      res.json({ member: row || updated, success: true });
    } catch (err) {
      next(err);
    }
  };

  const handleAdminDeleteMember = async (req: Request, res: Response, next: any) => {
    try {
      await Promise.all([authService.ensureReady(), kycService.ensureReady()]);
      const ip = (req.ip || '127.0.0.1').toString();
      const memberId = String(req.params.memberId || '').trim();
      if (!memberId) {
        res.status(400).json({ statusCode: 400, message: 'Member id is required.' });
        return;
      }
      const user =
        authService.getUserById(memberId) ||
        authService.getAllUsers().find(
          (u) => u.id === memberId || u.email.toLowerCase() === memberId.toLowerCase(),
        );
      if (!user || user.role !== 'MEMBER') {
        res.status(404).json({
          statusCode: 404,
          message: 'Member not found. Refresh the directory and try again.',
        });
        return;
      }
      await kycService.deleteSubmissionsForMember(user.id, user.email);
      const result = await authService.deleteMember(user.id, req.user!.id, ip);
      res.json({ ...result, success: true });
    } catch (err) {
      next(err);
    }
  };

  app.put(
    '/admin/member-directory/:memberId',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateMemberSchema),
    handleAdminUpdateMember,
  );
  app.patch(
    '/admin/member-directory/:memberId',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateMemberSchema),
    handleAdminUpdateMember,
  );
  // Prefer POST delete — some hosts/proxies strip HTTP DELETE
  app.post(
    '/admin/member-directory/:memberId/delete',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    handleAdminDeleteMember,
  );
  app.delete(
    '/admin/member-directory/:memberId',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    handleAdminDeleteMember,
  );
  // Legacy aliases
  app.put(
    '/admin/members/:memberId',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateMemberSchema),
    handleAdminUpdateMember,
  );
  app.patch(
    '/admin/members/:memberId',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateMemberSchema),
    handleAdminUpdateMember,
  );
  app.post(
    '/admin/members/:memberId/delete',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    handleAdminDeleteMember,
  );
  app.delete(
    '/admin/members/:memberId',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    handleAdminDeleteMember,
  );

  // Observability & Admin KPI Dashboard Stats
  // Single payload: members + KYC + loans + funds so every tile matches durable data.
  app.get(
    '/admin/dashboard-stats',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response, next) => {
      try {
        await Promise.all([
          authService.ensureReady(),
          kycService.ensureReady(),
          ensureFundingStoreReady(),
          ensureLoanStoreReady(),
          replayApprovedFundingIntoLedger(),
        ]);
        const directory = await buildMemberDirectory();
        const kycQueue = kycService.getAdminQueue('PENDING');
        const allKyc = kycService.getAdminQueue();
        const loanStore = await ensureLoanStoreReady();
        const loans = Array.from(loanStore.values()).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        const pendingLoans = loans.filter(
          (l) => l.status === 'under_review' || l.status === 'submitted',
        );
        const accounts = ledgerService.getAllAccounts();
        const ledgerTransactions = await ledgerService.getAllTransactions();
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

        // Prefer directory wallet totals so tile matches member table
        const directoryUsdMinor = Math.round(
          directory.reduce((sum, m) => sum + Number(m.wallets?.USD || 0) * 100, 0),
        );
        if (directoryUsdMinor > fundsByCurrency.USD.totalMinor) {
          fundsByCurrency.USD.totalMinor = directoryUsdMinor;
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

        const verifiedMembers = directory.filter((m) => m.identityVerified).length;
        await cardsService.ensureReady();
        const allAdminCards = cardsService.getAllCardsForAdmin();
        const activeCardsCount = allAdminCards.filter((c) => c.status === 'ACTIVE').length;
        const frozenCardsCount = allAdminCards.filter((c) => c.status === 'FROZEN').length;

        res.json({
          totalMembers: directory.length,
          verifiedMembers,
          pendingKycCount: kycQueue.length,
          pendingLoansCount: pendingLoans.length,
          totalCardsCount: allAdminCards.length,
          activeCardsCount,
          frozenCardsCount,
          totalTestFunds: fundsByCurrency,
          totalFundsUsd: fundsByCurrency.USD.totalMinor / 100,
          flaggedTransfersCount: flagged.length,
          ledgerZeroSumPassed: reconcile.zeroSumCheckPassed,
          systemHealth: 'HEALTHY',
          members: directory,
          loans,
          kycSubmissions: allKyc,
          ledgerTransactions,
          cards: allAdminCards,
        });
      } catch (err) {
        next(err);
      }
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
  app.put(
    '/admin/kyc/submissions/:id',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateKycSchema),
    kycController.update,
  );
  app.patch(
    '/admin/kyc/submissions/:id',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateKycSchema),
    kycController.update,
  );
  app.delete(
    '/admin/kyc/submissions/:id',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    kycController.remove,
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

  // Member funding requests (request credit from the credit union / admin)
  app.post(
    '/wallet/funding-requests',
    authenticateJwt,
    requireRole(['MEMBER']),
    requireKycApproved(kycService),
    validateZod(CreateFundingRequestSchema),
    async (req: Request, res: Response, next) => {
      try {
        await authService.ensureReady();
        const fundingRequests = await ensureFundingStoreReady();
        const user = authService.getUserById(req.user!.id);
        if (!user) {
          res.status(404).json({ statusCode: 404, message: 'Member not found.' });
          return;
        }
        const body = req.body as {
          amount: number | string;
          currency: SupportedCurrency;
          reason: string;
          sourceHint: string;
        };
        const money = parseMajorToMinor(body.amount, body.currency);
        if (money.amountMinor <= 0) {
          res.status(400).json({ statusCode: 400, message: 'Amount must be greater than zero.' });
          return;
        }
        const now = new Date().toISOString();
        const id = `fr-${crypto.randomUUID()}`;
        const record: FundingRequestRecord = {
          id,
          memberId: user.id,
          memberName: user.fullName,
          memberEmail: user.email,
          amountMinor: money.amountMinor,
          amountFormatted: formatMoney(money),
          currency: body.currency,
          reason: String(body.reason || '').trim(),
          sourceHint: body.sourceHint || 'BANK_TRANSFER',
          status: 'PENDING',
          reviewerNote: null,
          reviewedById: null,
          reviewedAt: null,
          ledgerTransactionId: null,
          createdAt: now,
          updatedAt: now,
        };
        fundingRequests.set(id, record);
        await persistFundingRequest(record);
        try {
          await auditService.record({
            actorId: user.id,
            actorRole: 'MEMBER',
            action: 'MEMBER_FUNDING_REQUESTED',
            targetType: 'FUNDING_REQUEST',
            targetId: id,
            beforeState: null,
            afterState: {
              amountMinor: record.amountMinor,
              currency: record.currency,
              reason: record.reason,
            },
            ipAddress: (req.ip || '127.0.0.1').toString(),
            userAgent: req.headers['user-agent'],
          });
        } catch (auditErr) {
          console.error('[Funding] Audit log failed (request still saved):', auditErr);
        }
        res.status(201).json(record);
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/wallet/funding-requests',
    authenticateJwt,
    requireRole(['MEMBER']),
    async (req: Request, res: Response, next) => {
      try {
        const fundingRequests = await ensureFundingStoreReady();
        const list = Array.from(fundingRequests.values())
          .filter((r) => r.memberId === req.user!.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json({ requests: list, total: list.length });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/admin/funding-requests',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        const fundingRequests = await ensureFundingStoreReady();
        const status = String(req.query.status || 'PENDING').toUpperCase();
        let list = Array.from(fundingRequests.values());
        if (status !== 'ALL') {
          list = list.filter((r) => r.status === status);
        }
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json({ requests: list, total: list.length });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/admin/funding-requests/:id/review',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(ReviewFundingRequestSchema),
    async (req: Request, res: Response, next) => {
      try {
        const fundingRequests = await ensureFundingStoreReady();
        const record = fundingRequests.get(req.params.id);
        if (!record) {
          res.status(404).json({ statusCode: 404, message: 'Funding request not found.' });
          return;
        }
        if (record.status !== 'PENDING') {
          res.status(409).json({
            statusCode: 409,
            message: `Request is already ${record.status.toLowerCase()}.`,
          });
          return;
        }
        const { decision, note } = req.body as { decision: 'APPROVE' | 'REJECT'; note?: string };
        const ip = (req.ip || '127.0.0.1').toString();
        const now = new Date().toISOString();

        if (decision === 'REJECT') {
          record.status = 'REJECTED';
          record.reviewerNote = (note || '').trim();
          record.reviewedById = req.user!.id;
          record.reviewedAt = now;
          record.updatedAt = now;
          fundingRequests.set(record.id, record);
          await persistFundingRequest(record);
          res.json(record);
          return;
        }

        const tx = await ledgerService.adminFundMemberWallet(
          {
            memberId: record.memberId,
            amountMinor: record.amountMinor,
            currency: record.currency,
            reason: `Member funding request: ${record.reason}`,
            reference: `FR-${record.id.slice(0, 12).toUpperCase()}`,
            source: 'DEPOSIT',
            idempotencyKey: `fund-req-${record.id}`,
          },
          req.user!.id,
          ip,
        );

        record.status = 'APPROVED';
        record.reviewerNote = (note || '').trim() || null;
        record.reviewedById = req.user!.id;
        record.reviewedAt = now;
        record.updatedAt = now;
        record.ledgerTransactionId = tx.id;
        fundingRequests.set(record.id, record);
        await persistFundingRequest(record);

        const member = authService.getUserById(record.memberId);
        if (member && tx.status !== 'PENDING_APPROVAL') {
          void emailService.sendWalletFundedEmail(member.email, member.fullName, {
            amountFormatted: record.amountFormatted,
            currency: record.currency,
            reference: tx.reference,
            reason: record.reason,
          });
        }

        res.json({ ...record, ledgerTransaction: tx });
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
    await replayApprovedFundingIntoLedger();
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    const balances = ledgerService.getMemberBalances(req.user!.id);
    res.json(balances);
  });

  app.get('/wallet/transactions', authenticateJwt, async (req: Request, res: Response) => {
    await replayApprovedFundingIntoLedger();
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    const history = ledgerService.getMemberTransactions(req.user!.id, req.query as any);
    res.json(history);
  });

  app.get('/wallet/statement', authenticateJwt, async (req: Request, res: Response) => {
    const format = ((req.query.format as string) || 'csv').toLowerCase();
    const currency = req.query.currency as string | undefined;
    const user = authService.getUserById(req.user!.id);
    if (user) {
      void emailService.sendStatementReadyEmail(user.email, user.fullName, currency);
    }

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
        `attachment; filename="lumenfield-statement-${Date.now()}.html"`,
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

  // Currency swap (server-side notify + optional ledger post for email pipeline)
  app.post(
    '/wallet/swap',
    authenticateJwt,
    requireKycApproved(kycService),
    async (req: Request, res: Response, next) => {
      try {
        const from = String(req.body?.fromCurrency || '').toUpperCase() as SupportedCurrency;
        const to = String(req.body?.toCurrency || '').toUpperCase() as SupportedCurrency;
        const amountMajor = Number(req.body?.amount);
        if (!from || !to || from === to || !Number.isFinite(amountMajor) || amountMajor <= 0) {
          res.status(400).json({ message: 'Invalid currency swap request.' });
          return;
        }

        const ratesToUSD: Record<string, number> = {
          USD: 1.0,
          CAD: 0.74,
          GBP: 1.28,
          EUR: 1.08,
        };
        if (!(from in ratesToUSD) || !(to in ratesToUSD)) {
          res.status(400).json({ message: 'Unsupported currency pair.' });
          return;
        }

        const fromMinor = parseMajorToMinor(amountMajor.toFixed(2), from).amountMinor;
        const amountInUSD = amountMajor * ratesToUSD[from];
        const convertedMajor = amountInUSD / ratesToUSD[to];
        const toMinor = parseMajorToMinor(convertedMajor.toFixed(2), to).amountMinor;

        const available = ledgerService.getOrCreateMemberWallet(req.user!.id, from).cachedBalanceMinor;
        if (fromMinor > available) {
          res.status(400).json({ message: `Insufficient ${from} balance.` });
          return;
        }

        const ip = (req.ip || '127.0.0.1').toString();
        const reference = `SWAP-${Date.now().toString(36).toUpperCase()}`;
        await ledgerService.postTransaction(
          {
            idempotencyKey: `idemp-swap-${req.user!.id}-${Date.now()}`,
            reference,
            transactionType: 'CURRENCY_SWAP',
            description: `Currency swap ${from} → ${to}`,
            currency: from,
            source: 'TRANSFER',
            metadata: { from, to, fromMinor, toMinor },
            entries: [
              {
                accountId: ledgerService.getOrCreateMemberWallet(req.user!.id, from).id,
                accountType: 'MEMBER_WALLET',
                direction: 'DEBIT',
                amountMinor: fromMinor,
                currency: from,
              },
              {
                accountId: `system-pool-${from.toLowerCase()}`,
                accountType: 'SANDBOX_FUNDING_POOL',
                direction: 'CREDIT',
                amountMinor: fromMinor,
                currency: from,
              },
            ],
          },
          req.user!.id,
          'MEMBER',
          ip,
        );
        await ledgerService.postTransaction(
          {
            idempotencyKey: `idemp-swap-in-${req.user!.id}-${Date.now()}`,
            reference: `${reference}-IN`,
            transactionType: 'CURRENCY_SWAP',
            description: `Currency swap credit ${to}`,
            currency: to,
            source: 'TRANSFER',
            metadata: { from, to, fromMinor, toMinor },
            entries: [
              {
                accountId: `system-pool-${to.toLowerCase()}`,
                accountType: 'SANDBOX_FUNDING_POOL',
                direction: 'DEBIT',
                amountMinor: toMinor,
                currency: to,
              },
              {
                accountId: ledgerService.getOrCreateMemberWallet(req.user!.id, to).id,
                accountType: 'MEMBER_WALLET',
                direction: 'CREDIT',
                amountMinor: toMinor,
                currency: to,
              },
            ],
          },
          req.user!.id,
          'MEMBER',
          ip,
        );

        const user = authService.getUserById(req.user!.id);
        if (user) {
          void emailService.sendCurrencySwapEmail(user.email, user.fullName, {
            fromAmount: formatMoney({ amountMinor: fromMinor, currency: from }),
            toAmount: formatMoney({ amountMinor: toMinor, currency: to }),
            fromCurrency: from,
            toCurrency: to,
          });
        }

        res.json({
          success: true,
          reference,
          from: { currency: from, amountMinor: fromMinor },
          to: { currency: to, amountMinor: toMinor },
        });
      } catch (err) {
        next(err);
      }
    },
  );

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
  // ---------------------------------------------------------------------------
  // SUPER ADMIN — VIRTUAL CARD MANAGEMENT
  // ---------------------------------------------------------------------------
  app.get(
    '/admin/cards',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (_req: Request, res: Response, next) => {
      try {
        await cardsService.ensureReady();
        const cards = cardsService.getAllCardsForAdmin();
        res.json({ cards, total: cards.length });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/admin/cards',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminCreateCardSchema),
    async (req: Request, res: Response, next) => {
      try {
        await cardsService.ensureReady();
        const ip = (req.ip || '127.0.0.1').toString();
        const result = await cardsService.adminCreateCard(req.body, req.user!.id, ip);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  app.patch(
    '/admin/cards/:id',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminUpdateCardSchema),
    async (req: Request, res: Response, next) => {
      try {
        await cardsService.ensureReady();
        const ip = (req.ip || '127.0.0.1').toString();
        const card = await cardsService.adminUpdateCard(
          req.params.id,
          req.body,
          req.user!.id,
          ip,
        );
        res.json({ success: true, card });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/admin/cards/:id/status',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(UpdateCardStatusSchema),
    async (req: Request, res: Response, next) => {
      try {
        await cardsService.ensureReady();
        const ip = (req.ip || '127.0.0.1').toString();
        const card = await cardsService.adminSetCardStatus(
          req.params.id,
          req.body.status,
          req.user!.id,
          ip,
          req.body.reason,
        );
        res.json({ success: true, card });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/admin/cards/:id/delete',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        await cardsService.ensureReady();
        const ip = (req.ip || '127.0.0.1').toString();
        const result = await cardsService.adminDeleteCard(req.params.id, req.user!.id, ip);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/admin/cards/:id/credit',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    validateZod(AdminCreditCardWalletSchema),
    async (req: Request, res: Response, next) => {
      try {
        await Promise.all([cardsService.ensureReady(), ledgerService.ensureReady()]);
        const ip = (req.ip || '127.0.0.1').toString();
        const result = await cardsService.adminCreditCardWallet(
          req.params.id,
          req.body,
          req.user!.id,
          ip,
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/admin/cards/:id/transactions',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        await cardsService.ensureReady();
        const transactions = cardsService.adminGetCardTransactions(req.params.id);
        res.json({ transactions, total: transactions.length });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/cards',
    authenticateJwt,
    requireKycApproved(kycService),
    async (req, res, next) => {
      try {
        await cardsService.ensureReady();
        return cardsController.getCards(req, res, next);
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/cards',
    authenticateJwt,
    requireKycApproved(kycService),
    validateZod(CreateCardSchema),
    async (req, res, next) => {
      try {
        await cardsService.ensureReady();
        return cardsController.createCard(req, res, next);
      } catch (err) {
        next(err);
      }
    },
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
        await authService.ensureReady();
        const loanStore = await ensureLoanStoreReady();
        const user = authService.getUserById(req.user!.id);
        if (!user) {
          res.status(404).json({ message: 'User not found.' });
          return;
        }
        const type = (req.body?.type === 'mortgage' ? 'mortgage' : 'auto') as
          | 'auto'
          | 'mortgage';
        const amount = Number(req.body?.amount || req.body?.requestedAmount || 0);
        const termMonths = Number(req.body?.termMonths || 60);
        const purpose = String(req.body?.purpose || 'General');
        const assetDetails = req.body?.assetDetails
          ? String(req.body.assetDetails)
          : undefined;
        const downPayment = req.body?.downPayment != null ? Number(req.body.downPayment) : undefined;
        if (!Number.isFinite(amount) || amount <= 0) {
          res.status(400).json({ message: 'Valid loan amount is required.' });
          return;
        }

        const now = new Date().toISOString();
        const loanId = `loan-${type}-${crypto.randomUUID().slice(0, 8)}`;
        const amountFormatted = formatMoney({
          amountMinor: Math.round(amount * 100),
          currency: 'USD',
        });
        const record: PersistedLoanApplication = {
          id: loanId,
          memberId: user.id,
          memberName: user.fullName,
          memberEmail: user.email,
          type,
          requestedAmount: amount,
          termMonths,
          purpose,
          assetDetails,
          downPayment,
          status: 'under_review',
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        };
        loanStore.set(loanId, record);
        await persistLoanApplication(record);

        void emailService.sendLoanSubmittedEmail(user.email, user.fullName, {
          loanType: type,
          amountFormatted,
          termMonths,
        });
        void emailService.sendLoanUnderReviewEmail(user.email, user.fullName, {
          amountFormatted,
        });
        void emailService.sendAdminNewLoanEmail({
          memberName: user.fullName,
          loanType: type,
          amountFormatted,
          loanId,
        });

        res.status(201).json({
          success: true,
          message: 'Loan application submitted for underwriting.',
          action: 'LOAN_APPLICATION_SUBMITTED',
          loan: record,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/loans/mine',
    authenticateJwt,
    requireRole(['MEMBER']),
    async (req: Request, res: Response, next) => {
      try {
        const loanStore = await ensureLoanStoreReady();
        const list = Array.from(loanStore.values())
          .filter((l) => l.memberId === req.user!.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json({ loans: list, total: list.length });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/admin/loans',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        const loanStore = await ensureLoanStoreReady();
        const status = String(req.query.status || 'ALL').toLowerCase();
        let list = Array.from(loanStore.values());
        if (status !== 'all') {
          list = list.filter((l) => l.status === status || (status === 'pending' && (l.status === 'under_review' || l.status === 'submitted')));
        }
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json({ loans: list, total: list.length });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/admin/loans/:id/decision',
    authenticateJwt,
    requireRole(['SUPER_ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        const loanStore = await ensureLoanStoreReady();
        let loan = loanStore.get(req.params.id);
        // Allow admin UI to notify even if the loan was only tracked client-side
        if (!loan && req.body?.memberEmail && req.body?.memberName) {
          loan = {
            id: req.params.id,
            memberId: String(req.body.memberId || 'unknown'),
            memberName: String(req.body.memberName),
            memberEmail: String(req.body.memberEmail),
            type: req.body.type === 'mortgage' ? 'mortgage' : 'auto',
            requestedAmount: Number(req.body.requestedAmount || 0),
            termMonths: Number(req.body.termMonths || 0),
            purpose: String(req.body.purpose || ''),
            status: 'under_review',
            currency: String(req.body.currency || 'USD'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          loanStore.set(loan.id, loan);
          await persistLoanApplication(loan);
        }
        if (!loan) {
          res.status(404).json({ message: 'Loan application not found.' });
          return;
        }
        const decision = String(req.body?.decision || '').toUpperCase();
        const reason = req.body?.reason ? String(req.body.reason) : undefined;
        const amountFormatted = formatMoney({
          amountMinor: Math.round(loan.requestedAmount * 100),
          currency: 'USD',
        });

        if (decision === 'APPROVE') {
          loan.status = 'approved';
          loan.updatedAt = new Date().toISOString();
          const member = authService.getUserById(loan.memberId);
          if (member) {
            const ip = (req.ip || '127.0.0.1').toString();
            const amountMinor = Math.round(loan.requestedAmount * 100);
            try {
              await ledgerService.adminFundMemberWallet(
                {
                  memberId: loan.memberId,
                  currency: 'USD',
                  amountMinor,
                  reason: `Loan disbursement ${loan.id}`,
                  source: 'LOAN_DISBURSEMENT',
                  idempotencyKey: `idemp-loan-${loan.id}`,
                },
                req.user!.id,
                ip,
              );
            } catch (fundErr) {
              console.warn('[loans] disbursement skipped:', fundErr);
            }
          }
          void emailService.sendLoanApprovedEmail(loan.memberEmail, loan.memberName, {
            amountFormatted,
          });
        } else if (decision === 'REJECT') {
          loan.status = 'rejected';
          loan.updatedAt = new Date().toISOString();
          void emailService.sendLoanRejectedEmail(loan.memberEmail, loan.memberName, {
            amountFormatted,
            reason,
          });
        } else {
          res.status(400).json({ message: 'decision must be APPROVE or REJECT.' });
          return;
        }

        loanStore.set(loan.id, loan);
        await persistLoanApplication(loan);
        res.json({ success: true, loan });
      } catch (err) {
        next(err);
      }
    },
  );

  // Global Exception Filter
  app.use(globalExceptionFilter);

  return app;
}
