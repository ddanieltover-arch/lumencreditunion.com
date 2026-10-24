/**
 * Transactional email via Resend (live mode).
 * Falls back to console logging when RESEND_API_KEY is unset (local/dev).
 * Email failures are logged and never throw to callers of safe* helpers.
 */
import { Resend } from 'resend';
import * as authTpl from './templates/auth';
import * as kycTpl from './templates/kyc';
import * as walletTpl from './templates/wallet';
import * as transfersTpl from './templates/transfers';
import * as cardsTpl from './templates/cards';
import * as loansTpl from './templates/loans';
import * as contactTpl from './templates/contact';
import * as adminTpl from './templates/admin';
import type { RenderedEmail } from './types';

export class EmailService {
  private static instance: EmailService;
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly replyTo: string | undefined;
  private readonly appUrl: string;
  readonly supportEmail: string;
  readonly adminNotifyEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.supportEmail =
      process.env.SUPPORT_EMAIL?.trim() ||
      process.env.RESEND_REPLY_TO?.trim() ||
      'support@lumenfieldcu.com';
    this.adminNotifyEmail =
      process.env.SUPER_ADMIN_EMAIL?.trim() || this.supportEmail;
    this.from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      `Lumenfield Credit Union <${this.supportEmail}>`;
    this.replyTo = process.env.RESEND_REPLY_TO?.trim() || this.supportEmail;
    this.appUrl = (
      process.env.APP_URL ||
      'https://www.lumenfieldcu.com'
    ).replace(/\/$/, '');
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  get isConfigured(): boolean {
    return this.resend !== null;
  }

  private base(fullName: string) {
    return {
      appUrl: this.appUrl,
      supportEmail: this.supportEmail,
      fullName,
    };
  }

  private adminBase() {
    return { appUrl: this.appUrl, supportEmail: this.supportEmail };
  }

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyToOverride?: string;
  }): Promise<{ id?: string; mocked: boolean }> {
    if (!this.resend) {
      console.warn(
        `[EmailService] RESEND_API_KEY not set — email not sent.\nTo: ${params.to}\nSubject: ${params.subject}\n${params.text}`,
      );
      return { mocked: true };
    }

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyToOverride || this.replyTo
        ? { replyTo: params.replyToOverride || this.replyTo }
        : {}),
    });

    if (error) {
      console.error('[EmailService] Resend error:', error);
      throw new Error(error.message || 'Failed to send email.');
    }

    return { id: data?.id, mocked: false };
  }

  /** Deliver a rendered template; swallow errors so domain flows never fail. */
  async deliver(
    to: string,
    rendered: RenderedEmail,
    replyToOverride?: string,
  ): Promise<{ id?: string; mocked: boolean; ok: boolean }> {
    try {
      const result = await this.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyToOverride,
      });
      return { ...result, ok: true };
    } catch (err) {
      console.error('[EmailService] deliver failed:', err);
      return { mocked: false, ok: false };
    }
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  async sendVerificationEmail(to: string, fullName: string, token: string) {
    return this.deliver(to, authTpl.verificationEmail(this.base(fullName), token));
  }

  async sendWelcomeEmail(to: string, fullName: string) {
    return this.deliver(to, authTpl.welcomeEmail(this.base(fullName)));
  }

  async sendPasswordResetEmail(to: string, fullName: string, token: string) {
    return this.deliver(
      to,
      authTpl.passwordResetRequestEmail(this.base(fullName), token),
    );
  }

  async sendPasswordResetConfirmedEmail(to: string, fullName: string) {
    return this.deliver(to, authTpl.passwordResetConfirmedEmail(this.base(fullName)));
  }

  async sendPasswordChangedEmail(to: string, fullName: string) {
    return this.deliver(to, authTpl.passwordChangedEmail(this.base(fullName)));
  }

  async sendAccountLockedEmail(
    to: string,
    fullName: string,
    minutesLocked: number,
  ) {
    return this.deliver(
      to,
      authTpl.accountLockedEmail(this.base(fullName), minutesLocked),
    );
  }

  async sendNewLoginEmail(
    to: string,
    fullName: string,
    details: { deviceInfo: string; ipAddress: string; when: string },
  ) {
    return this.deliver(to, authTpl.newLoginEmail(this.base(fullName), details));
  }

  async sendSessionRevokedEmail(to: string, fullName: string, reason: string) {
    return this.deliver(
      to,
      authTpl.sessionRevokedEmail(this.base(fullName), reason),
    );
  }

  async sendMfaEnabledEmail(to: string, fullName: string) {
    return this.deliver(to, authTpl.mfaEnabledEmail(this.base(fullName)));
  }

  async sendMfaDisabledEmail(to: string, fullName: string) {
    return this.deliver(to, authTpl.mfaDisabledEmail(this.base(fullName)));
  }

  async sendAccountDeletionScheduledEmail(
    to: string,
    fullName: string,
    purgeDateIso: string,
  ) {
    return this.deliver(
      to,
      authTpl.accountDeletionScheduledEmail(this.base(fullName), purgeDateIso),
    );
  }

  async sendDataExportReadyEmail(to: string, fullName: string) {
    return this.deliver(to, authTpl.dataExportReadyEmail(this.base(fullName)));
  }

  // ---------------------------------------------------------------------------
  // KYC
  // ---------------------------------------------------------------------------
  async sendKycSubmittedEmail(to: string, fullName: string, documentType: string) {
    return this.deliver(
      to,
      kycTpl.kycSubmittedEmail(this.base(fullName), documentType),
    );
  }

  async sendKycApprovedEmail(to: string, fullName: string) {
    return this.deliver(to, kycTpl.kycApprovedEmail(this.base(fullName)));
  }

  async sendKycRejectedEmail(to: string, fullName: string, reason: string) {
    return this.deliver(
      to,
      kycTpl.kycRejectedEmail(this.base(fullName), reason),
    );
  }

  async sendKycNeedsMoreInfoEmail(to: string, fullName: string, reason: string) {
    return this.deliver(
      to,
      kycTpl.kycNeedsMoreInfoEmail(this.base(fullName), reason),
    );
  }

  async sendAdminNewKycEmail(details: {
    memberName: string;
    memberEmail: string;
    documentType: string;
    submissionId: string;
  }) {
    return this.deliver(
      this.adminNotifyEmail,
      adminTpl.adminNewKycEmail(this.adminBase(), details),
    );
  }

  // ---------------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------------
  async sendWalletFundedEmail(
    to: string,
    fullName: string,
    details: {
      amountFormatted: string;
      currency: string;
      reference: string;
      reason?: string;
    },
  ) {
    return this.deliver(
      to,
      walletTpl.walletFundedEmail(this.base(fullName), details),
    );
  }

  async sendDualApprovalPostedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; reference: string },
  ) {
    return this.deliver(
      to,
      walletTpl.dualApprovalPostedEmail(this.base(fullName), details),
    );
  }

  async sendAdminDualApprovalPendingEmail(details: {
    amountFormatted: string;
    reference: string;
    memberId: string;
    transactionId: string;
  }) {
    return this.deliver(
      this.adminNotifyEmail,
      adminTpl.adminDualApprovalPendingEmail(this.adminBase(), details),
    );
  }

  async sendCurrencySwapEmail(
    to: string,
    fullName: string,
    details: {
      fromAmount: string;
      toAmount: string;
      fromCurrency: string;
      toCurrency: string;
    },
  ) {
    return this.deliver(
      to,
      walletTpl.currencySwapEmail(this.base(fullName), details),
    );
  }

  async sendStatementReadyEmail(to: string, fullName: string, currency?: string) {
    return this.deliver(
      to,
      walletTpl.statementReadyEmail(this.base(fullName), currency),
    );
  }

  // ---------------------------------------------------------------------------
  // Transfers
  // ---------------------------------------------------------------------------
  async sendTransferSentEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; recipient: string; reference: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.transferSentEmail(this.base(fullName), details),
    );
  }

  async sendTransferReceivedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; sender: string; reference: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.transferReceivedEmail(this.base(fullName), details),
    );
  }

  async sendBeneficiaryAddedEmail(
    to: string,
    fullName: string,
    details: { name: string; countryCode: string; coolingHours: number },
  ) {
    return this.deliver(
      to,
      transfersTpl.beneficiaryAddedEmail(this.base(fullName), details),
    );
  }

  async sendBeneficiaryReadyEmail(
    to: string,
    fullName: string,
    details: { name: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.beneficiaryReadyEmail(this.base(fullName), details),
    );
  }

  async sendBankTransferInitiatedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; beneficiary: string; reference: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.bankTransferInitiatedEmail(this.base(fullName), details),
    );
  }

  async sendBankTransferClearedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; reference: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.bankTransferClearedEmail(this.base(fullName), details),
    );
  }

  async sendBankTransferFailedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; reference: string; reason: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.bankTransferFailedEmail(this.base(fullName), details),
    );
  }

  async sendTransferFlaggedMemberEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; reference: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.transferFlaggedMemberEmail(this.base(fullName), details),
    );
  }

  async sendTransferFlagClearedEmail(
    to: string,
    fullName: string,
    details: { reference: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.transferFlagClearedEmail(this.base(fullName), details),
    );
  }

  async sendTransferFlagRejectedEmail(
    to: string,
    fullName: string,
    details: { reference: string; reason: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.transferFlagRejectedEmail(this.base(fullName), details),
    );
  }

  async sendAdminFlaggedTransferEmail(details: {
    amountFormatted: string;
    reference: string;
    flags: string;
    transferId: string;
  }) {
    return this.deliver(
      this.adminNotifyEmail,
      adminTpl.adminFlaggedTransferEmail(this.adminBase(), details),
    );
  }

  async sendCryptoDepositEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; network: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.cryptoDepositEmail(this.base(fullName), details),
    );
  }

  async sendCryptoWithdrawalEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; network: string; txHashShort: string },
  ) {
    return this.deliver(
      to,
      transfersTpl.cryptoWithdrawalEmail(this.base(fullName), details),
    );
  }

  // ---------------------------------------------------------------------------
  // Cards
  // ---------------------------------------------------------------------------
  async sendCardCreatedEmail(
    to: string,
    fullName: string,
    details: { lastFour: string; currency: string },
  ) {
    return this.deliver(
      to,
      cardsTpl.cardCreatedEmail(this.base(fullName), details),
    );
  }

  async sendCardFrozenEmail(
    to: string,
    fullName: string,
    details: { lastFour: string },
  ) {
    return this.deliver(
      to,
      cardsTpl.cardFrozenEmail(this.base(fullName), details),
    );
  }

  async sendCardUnfrozenEmail(
    to: string,
    fullName: string,
    details: { lastFour: string },
  ) {
    return this.deliver(
      to,
      cardsTpl.cardUnfrozenEmail(this.base(fullName), details),
    );
  }

  async sendCardLimitsUpdatedEmail(
    to: string,
    fullName: string,
    details: {
      lastFour: string;
      dailyLimitFormatted: string;
      monthlyLimitFormatted: string;
    },
  ) {
    return this.deliver(
      to,
      cardsTpl.cardLimitsUpdatedEmail(this.base(fullName), details),
    );
  }

  async sendCardPurchaseApprovedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; merchant: string; lastFour: string },
  ) {
    return this.deliver(
      to,
      cardsTpl.cardPurchaseApprovedEmail(this.base(fullName), details),
    );
  }

  async sendCardPurchaseDeclinedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; merchant: string; reason: string },
  ) {
    return this.deliver(
      to,
      cardsTpl.cardPurchaseDeclinedEmail(this.base(fullName), details),
    );
  }

  // ---------------------------------------------------------------------------
  // Loans
  // ---------------------------------------------------------------------------
  async sendLoanSubmittedEmail(
    to: string,
    fullName: string,
    details: { loanType: string; amountFormatted: string; termMonths: number },
  ) {
    return this.deliver(
      to,
      loansTpl.loanSubmittedEmail(this.base(fullName), details),
    );
  }

  async sendLoanUnderReviewEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string },
  ) {
    return this.deliver(
      to,
      loansTpl.loanUnderReviewEmail(this.base(fullName), details),
    );
  }

  async sendLoanApprovedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string },
  ) {
    return this.deliver(
      to,
      loansTpl.loanApprovedEmail(this.base(fullName), details),
    );
  }

  async sendLoanRejectedEmail(
    to: string,
    fullName: string,
    details: { amountFormatted: string; reason?: string },
  ) {
    return this.deliver(
      to,
      loansTpl.loanRejectedEmail(this.base(fullName), details),
    );
  }

  async sendAdminNewLoanEmail(details: {
    memberName: string;
    loanType: string;
    amountFormatted: string;
    loanId: string;
  }) {
    return this.deliver(
      this.adminNotifyEmail,
      adminTpl.adminNewLoanEmail(this.adminBase(), details),
    );
  }

  // ---------------------------------------------------------------------------
  // Contact
  // ---------------------------------------------------------------------------
  async sendContactConfirmationEmail(params: {
    visitorName: string;
    visitorEmail: string;
    subject: string;
  }) {
    return this.deliver(
      params.visitorEmail,
      contactTpl.contactConfirmationEmail({
        appUrl: this.appUrl,
        supportEmail: this.supportEmail,
        ...params,
      }),
    );
  }

  async sendContactSupportInboxEmail(params: {
    visitorName: string;
    visitorEmail: string;
    subject: string;
    message: string;
  }) {
    return this.deliver(
      this.supportEmail,
      contactTpl.contactSupportInboxEmail({
        appUrl: this.appUrl,
        supportEmail: this.supportEmail,
        ...params,
      }),
      params.visitorEmail,
    );
  }
}
