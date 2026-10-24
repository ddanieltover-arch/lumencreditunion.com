/**
 * Transactional email via Resend (live mode).
 * Falls back to console logging when RESEND_API_KEY is unset (local/dev).
 */
import { Resend } from 'resend';

export class EmailService {
  private static instance: EmailService;
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly replyTo: string | undefined;
  private readonly appUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    const supportEmail =
      process.env.SUPPORT_EMAIL?.trim() ||
      process.env.RESEND_REPLY_TO?.trim() ||
      'support@lumenfieldcu.com';
    this.from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      `Lumenfield Credit Union <${supportEmail}>`;
    this.replyTo = process.env.RESEND_REPLY_TO?.trim() || supportEmail;
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

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
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
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
    });

    if (error) {
      console.error('[EmailService] Resend error:', error);
      throw new Error(error.message || 'Failed to send email.');
    }

    return { id: data?.id, mocked: false };
  }

  async sendVerificationEmail(to: string, fullName: string, token: string) {
    const verifyUrl = `${this.appUrl}/?verifyEmail=${encodeURIComponent(token)}`;
    const subject = 'Verify your Lumenfield Credit Union email';
    const text = `Hi ${fullName},\n\nConfirm your email to activate your account:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— Lumenfield Credit Union`;
    const html = `
      <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0E1B1F">
        <h2 style="color:#0A3D3F;margin-bottom:8px">Verify your email</h2>
        <p style="line-height:1.55">Hi ${escapeHtml(fullName)},</p>
        <p style="line-height:1.55">Confirm your email address to activate your Lumenfield Credit Union account.</p>
        <p style="margin:28px 0">
          <a href="${verifyUrl}" style="background:#0A3D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">
            Verify email
          </a>
        </p>
        <p style="font-size:13px;color:#4A5B60;line-height:1.5">Or open this link:<br/><a href="${verifyUrl}" style="color:#0A3D3F">${verifyUrl}</a></p>
        <p style="font-size:12px;color:#8FA5A3">If you did not create this account, you can ignore this email.</p>
      </div>
    `;
    return this.send({ to, subject, html, text });
  }

  async sendPasswordResetEmail(to: string, fullName: string, token: string) {
    const resetUrl = `${this.appUrl}/?resetToken=${encodeURIComponent(token)}`;
    const subject = 'Reset your Lumenfield Credit Union password';
    const text = `Hi ${fullName},\n\nReset your password using this link (valid 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\n— Lumenfield Credit Union`;
    const html = `
      <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0E1B1F">
        <h2 style="color:#0A3D3F;margin-bottom:8px">Password reset</h2>
        <p style="line-height:1.55">Hi ${escapeHtml(fullName)},</p>
        <p style="line-height:1.55">We received a request to reset your password. This link expires in 1 hour.</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="background:#0A3D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">
            Reset password
          </a>
        </p>
        <p style="font-size:13px;color:#4A5B60;line-height:1.5">Or open this link:<br/><a href="${resetUrl}" style="color:#0A3D3F">${resetUrl}</a></p>
        <p style="font-size:12px;color:#8FA5A3">If you did not request a reset, no action is needed.</p>
      </div>
    `;
    return this.send({ to, subject, html, text });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
