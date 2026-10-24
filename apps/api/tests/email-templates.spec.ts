import { describe, it, expect } from 'vitest';
import { EmailService } from '../src/email/email.service';
import { renderLayout } from '../src/email/layout';
import { escapeHtml } from '../src/email/escape';

describe('Email templates', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toContain('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('renders branded layout with logo and CTA', () => {
    const { html, text } = renderLayout({
      appUrl: 'https://www.lumenfieldcu.com',
      supportEmail: 'support@lumenfieldcu.com',
      preheader: 'Test preheader',
      headline: 'Test headline',
      greetingName: 'Amara',
      paragraphs: ['Body copy with <b>unsafe</b>.'],
      details: [{ label: 'Amount', value: '$10.00' }],
      cta: { label: 'Open dashboard', url: 'https://www.lumenfieldcu.com/' },
      securityNote: 'Security note',
    });

    expect(html).toContain('/email/lumenfield-logo.png');
    expect(html).toContain('Open dashboard');
    expect(html).toContain('support@lumenfieldcu.com');
    expect(html).toContain('&lt;b&gt;unsafe&lt;/b&gt;');
    expect(html).not.toContain('<b>unsafe</b>');
    expect(text).toContain('Test headline');
    expect(text).toContain('https://www.lumenfieldcu.com/');
  });

  it('delivers verification and password reset via EmailService (mock path)', async () => {
    const prev = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = '';
    const email = new EmailService();
    const verify = await email.sendVerificationEmail(
      'member@lumenfield.test',
      'Test Member',
      'abc123token',
    );
    const reset = await email.sendPasswordResetEmail(
      'member@lumenfield.test',
      'Test Member',
      'reset-token',
    );
    process.env.RESEND_API_KEY = prev;
    expect(verify.ok).toBe(true);
    expect(verify.mocked).toBe(true);
    expect(reset.ok).toBe(true);
    expect(reset.mocked).toBe(true);
  });

  it('covers key template send methods without throwing', async () => {
    const prev = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = '';
    const email = new EmailService();
    const to = 'member@lumenfield.test';
    const name = 'Test Member';

    const calls = [
      email.sendWelcomeEmail(to, name),
      email.sendPasswordChangedEmail(to, name),
      email.sendAccountLockedEmail(to, name, 15),
      email.sendMfaEnabledEmail(to, name),
      email.sendMfaDisabledEmail(to, name),
      email.sendKycApprovedEmail(to, name),
      email.sendKycRejectedEmail(to, name, 'Blurry document'),
      email.sendWalletFundedEmail(to, name, {
        amountFormatted: '$50.00',
        currency: 'USD',
        reference: 'TX-FND-1',
      }),
      email.sendTransferSentEmail(to, name, {
        amountFormatted: '$25.00',
        recipient: 'Kwame',
        reference: 'TX-P2P-1',
      }),
      email.sendCardCreatedEmail(to, name, { lastFour: '4821', currency: 'USD' }),
      email.sendLoanApprovedEmail(to, name, { amountFormatted: '$18,000.00' }),
      email.sendContactConfirmationEmail({
        visitorName: 'Jane',
        visitorEmail: 'jane@example.com',
        subject: 'Help',
      }),
      email.sendAdminNewKycEmail({
        memberName: name,
        memberEmail: to,
        documentType: 'passport',
        submissionId: 'kyc-1',
      }),
    ];

    const results = await Promise.all(calls);
    process.env.RESEND_API_KEY = prev;
    expect(results.every((r) => r.ok && r.mocked)).toBe(true);
  });
});
