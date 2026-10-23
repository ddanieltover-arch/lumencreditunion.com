import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/auth/auth.service';

describe('Acceptance Criterion: Refresh token rotation & replay revocation', () => {
  let authService: AuthService;

  beforeEach(async () => {
    authService = new AuthService();
  });

  it('rotates refresh tokens and successfully issues new token pair', async () => {
    // 1. Register a test member
    const reg = await authService.register(
      {
        email: 'token.test@lumenfield.internal',
        password: 'Password123!@#',
        fullName: 'Token Tester',
        countryCode: 'US',
        dateOfBirth: '1995-01-01',
        role: 'MEMBER',
      },
      '127.0.0.1',
    );

    // 2. Log in to receive first token pair (Access A1, Refresh R1)
    const loginRes = await authService.login(
      {
        email: 'token.test@lumenfield.internal',
        password: 'Password123!@#',
      },
      '127.0.0.1',
    );

    if (loginRes.requiresMfa) {
      throw new Error('Unexpected MFA prompt for standard member');
    }

    const { accessToken: a1, refreshToken: r1 } = loginRes;
    expect(a1).toBeDefined();
    expect(r1).toBeDefined();

    // 3. Rotate refresh token R1 -> receive (Access A2, Refresh R2)
    const rotated = await authService.rotateRefreshToken(r1, '127.0.0.1');
    expect(rotated.accessToken).toBeDefined();
    expect(rotated.refreshToken).toBeDefined();
    expect(rotated.refreshToken).not.toBe(r1);

    // 4. Session should still be active with R2
    const sessions = await authService.getUserSessions(reg.user.id);
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe(loginRes.session.id);
  });

  it('ACCEPTANCE CRITERIA: Reused refresh tokens revoke the session (Replay Attack Defense)', async () => {
    // 1. Register and log in
    const reg = await authService.register(
      {
        email: 'replay.test@lumenfield.internal',
        password: 'Password123!@#',
        fullName: 'Replay Tester',
        countryCode: 'GB',
        dateOfBirth: '1992-06-15',
        role: 'MEMBER',
      },
      '127.0.0.1',
    );

    const loginRes = await authService.login(
      {
        email: 'replay.test@lumenfield.internal',
        password: 'Password123!@#',
      },
      '127.0.0.1',
    );

    if (loginRes.requiresMfa) throw new Error('Unexpected MFA');
    const r1 = loginRes.refreshToken;

    // 2. Legitimate user rotates R1 to R2
    const rotation1 = await authService.rotateRefreshToken(r1, '127.0.0.1');
    const r2 = rotation1.refreshToken;

    // 3. MALICIOUS ACTOR / REPLAY: Attempt to reuse the already-rotated token R1!
    await expect(authService.rotateRefreshToken(r1, '198.51.100.22')).rejects.toThrow(
      /Refresh token reuse detected/i,
    );

    // 4. VERIFY: The session has been revoked!
    // Even the legitimate R2 token must now fail because the session was compromised and revoked!
    await expect(authService.rotateRefreshToken(r2, '127.0.0.1')).rejects.toThrow(
      /Refresh token reuse detected|revoked/i,
    );

    // 5. Active sessions list should now show 0 active sessions
    const activeSessions = await authService.getUserSessions(reg.user.id);
    expect(activeSessions.length).toBe(0);
  });
});
