import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import { generateTotpCode } from '../src/auth/totp.util';

describe('Auth Security: Lockout, TOTP MFA, and Registration Rules', () => {
  let authService: AuthService;

  beforeEach(async () => {
    authService = new AuthService();
  });

  it('locks account after 5 consecutive failed login attempts for 15 minutes', async () => {
    await authService.register(
      {
        email: 'lockout.test@lumenfield.internal',
        password: 'Password123!@#',
        fullName: 'Lockout Tester',
        phone: '+1 416 555 0199',
        countryCode: 'CA',
        dateOfBirth: '1990-01-01',
        role: 'MEMBER',
      },
      '127.0.0.1',
    );

    // Fail 4 times: should remain unlocked
    for (let i = 1; i <= 4; i++) {
      await expect(
        authService.login(
          { email: 'lockout.test@lumenfield.internal', password: 'WrongPassword' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(/Invalid email or password/i);
    }

    // 5th failure: triggers 15-minute lockout
    await expect(
      authService.login(
        { email: 'lockout.test@lumenfield.internal', password: 'WrongPassword' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(/Account locked: 5 consecutive failed login attempts/i);

    // Subsequent attempt even with CORRECT password is rejected while locked
    await expect(
      authService.login(
        { email: 'lockout.test@lumenfield.internal', password: 'Password123!@#' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(/Account is temporarily locked/i);
  });

  it('TOTP MFA enrollment, validation, and recovery code consumption', async () => {
    const reg = await authService.register(
      {
        email: 'mfa.user@lumenfield.internal',
        password: 'Password123!@#',
        fullName: 'MFA Tester',
        phone: '+1 312 555 0144',
        countryCode: 'US',
        dateOfBirth: '1998-07-20',
        role: 'MEMBER',
      },
      '127.0.0.1',
    );

    // Start enrollment
    const enrollment = await authService.startMfaEnrollment(reg.user.id);
    expect(enrollment.secret).toBeDefined();
    expect(enrollment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(enrollment.recoveryCodes).toHaveLength(8);

    // Generate valid TOTP code
    const validCode = generateTotpCode(enrollment.secret);

    // Confirm enrollment
    const confirmRes = await authService.confirmMfaEnrollment(
      reg.user.id,
      enrollment.secret,
      validCode,
      enrollment.recoveryCodes,
      '127.0.0.1',
    );
    expect(confirmRes.success).toBe(true);

    // Now login requires MFA:
    const loginPrompt = await authService.login(
      { email: 'mfa.user@lumenfield.internal', password: 'Password123!@#' },
      '127.0.0.1',
    );
    expect(loginPrompt.requiresMfa).toBe(true);
    if (!loginPrompt.requiresMfa) throw new Error('MFA was expected');

    // Use recovery code
    const recoveryCode = enrollment.recoveryCodes[0];
    const ticketLogin = await authService.verifyMfaTicketAndLogin(
      loginPrompt.mfaTicket,
      recoveryCode,
      '127.0.0.1',
    );
    expect(ticketLogin.requiresMfa).toBe(false);
    expect(ticketLogin.accessToken).toBeDefined();

    // Verify recovery code was consumed (cannot be used again)
    const user = authService.getUserById(reg.user.id);
    expect(user?.mfaRecoveryCodes).toHaveLength(7);
  });

  it('MFA is mandatory for SUPER_ADMIN and cannot be disabled', async () => {
    const admin = await authService.seedSuperAdmin();
    expect(admin.role).toBe('SUPER_ADMIN');
    expect(admin.mfaEnabled).toBe(true);

    // Attempt to disable MFA for SUPER_ADMIN
    await expect(
      authService.disableMfa(admin.id, 'LumenAdmin2026!#Secure', '123456', '127.0.0.1'),
    ).rejects.toThrow(/mandatory for Super Administrators/i);
  });

  it('rejects registration if applicant is under 18 years old', async () => {
    // Current year - 16
    const underAgeYear = new Date().getFullYear() - 16;
    await expect(
      authService.register(
        {
          email: 'underage@lumenfield.test',
          password: 'Password123!@#',
          fullName: 'Minor Applicant',
          phone: '+1 646 555 0111',
          countryCode: 'US',
          dateOfBirth: `${underAgeYear}-01-01`,
          role: 'MEMBER',
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow(/at least 18 years of age/i);
  });
});
