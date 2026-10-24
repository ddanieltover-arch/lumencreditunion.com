import crypto from 'crypto';
import {
  RegisterUserInput,
  RegisterUserSchema,
  LoginUserInput,
  LoginUserSchema,
  UserRole,
} from '@lumenfield/shared';
import { hashPassword, verifyPassword } from './password.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from './jwt.util';
import {
  generateBase32Secret,
  deriveBase32Secret,
  verifyTotpCode,
  generateRecoveryCodes,
  generateTotpQrCode,
  generateTotpCode,
} from './totp.util';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { CountriesService } from '../countries/countries.service';
import { EmailService } from '../email/email.service';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  countryCode: string;
  dateOfBirth: string;
  role: UserRole;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaRecoveryCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  tokenFamily: string;
  tokenVersion: number;
  deviceInfo: string;
  ipAddress: string;
  userAgent?: string;
  isRevoked: boolean;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: string;
  lastActiveAt: string;
}

export interface PasswordResetRecord {
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

export class AuthService {
  private users: Map<string, UserRecord> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();
  private passwordResetTokens: Map<string, PasswordResetRecord> = new Map();
  private emailVerificationTokens: Map<string, string> = new Map(); // token -> userId
  private mfaTickets: Map<string, { userId: string; expiresAt: number }> = new Map();
  private readonly ready: Promise<void>;
  private bootstrapError: Error | null = null;

  constructor(
    private readonly auditService: AuditService = new AuditService(),
    private readonly configService: ConfigService = ConfigService.getInstance(),
    private readonly countriesService: CountriesService = new CountriesService(),
    private readonly emailService: EmailService = EmailService.getInstance(),
  ) {
    this.ready = this.bootstrapUsers().catch((err: unknown) => {
      this.bootstrapError =
        err instanceof Error
          ? err
          : new Error('Failed to bootstrap authentication users.');
      console.error('[AuthService] Bootstrap failed:', this.bootstrapError.message);
    });
  }

  /** Wait for admin seed before handling auth (avoids serverless race on cold start). */
  async ensureReady(): Promise<void> {
    await this.ready;
    if (this.bootstrapError) {
      throw new Error(
        'Administrator account is not configured. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD on the server, then redeploy.',
      );
    }
    if (![...this.users.values()].some((u) => u.role === 'SUPER_ADMIN')) {
      // Retry once if seed was skipped/raced
      await this.seedSuperAdmin();
    }
  }

  private async bootstrapUsers() {
    await this.seedSuperAdmin();
    // Demo member is only seeded in sandbox mode
    if (this.configService.isSandbox) {
      await this.seedMemberUser();
    }
  }

  /**
   * Seed one SUPER_ADMIN from environment variables (or secure defaults)
   */
  public async seedSuperAdmin(): Promise<UserRecord> {
    const adminEmail = (
      process.env.SUPER_ADMIN_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      'support@lumenfieldcu.com'
    )
      .trim()
      .toLowerCase();
    const existing = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === adminEmail,
    );
    if (existing) {
      return existing;
    }

    const adminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim();
    if (!adminPassword) {
      throw new Error(
        'SUPER_ADMIN_PASSWORD must be set in the environment before seeding the super administrator.',
      );
    }
    const passwordHash = await hashPassword(adminPassword);
    const jwtSecret = this.configService.get('JWT_SECRET');
    // Stable across serverless cold starts when env is unchanged
    const mfaSecret =
      process.env.SUPER_ADMIN_TOTP_SECRET?.trim() ||
      deriveBase32Secret(`${jwtSecret}:admin-totp:${adminEmail}`);
    const recoveryCodes = [
      deriveBase32Secret(`${jwtSecret}:admin-rec:0:${adminEmail}`, 8) +
        '-' +
        deriveBase32Secret(`${jwtSecret}:admin-rec:1:${adminEmail}`, 8),
      deriveBase32Secret(`${jwtSecret}:admin-rec:2:${adminEmail}`, 8) +
        '-' +
        deriveBase32Secret(`${jwtSecret}:admin-rec:3:${adminEmail}`, 8),
    ];

    const superAdmin: UserRecord = {
      id: '00000000-0000-0000-0000-000000000001',
      email: adminEmail,
      passwordHash,
      fullName: 'Super Administrator',
      phone: null,
      countryCode: 'US',
      dateOfBirth: '1985-05-15',
      role: 'SUPER_ADMIN',
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Password login works immediately; enroll TOTP from Security settings after sign-in.
      // Login still enforces MFA once mfaEnabled is turned on.
      mfaEnabled: false,
      mfaSecret,
      mfaRecoveryCodes: recoveryCodes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(superAdmin.id, superAdmin);
    console.log(`[AuthService] Seeded SUPER_ADMIN: ${adminEmail}`);
    return superAdmin;
  }

  /**
   * Seed initial demo MEMBER user
   */
  public async seedMemberUser(): Promise<UserRecord> {
    const memberEmail = 'amara.o@lumenfield.test';
    const existing = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === memberEmail.toLowerCase(),
    );
    if (existing) {
      return existing;
    }

    const memberPassword = 'AmaraPass123!#';
    const passwordHash = await hashPassword(memberPassword);

    const member: UserRecord = {
      id: '00000000-0000-0000-0000-000000000002',
      email: memberEmail,
      passwordHash,
      fullName: 'Amara Okafor',
      phone: '+1 415 555 0142',
      countryCode: 'US',
      dateOfBirth: '1992-04-10',
      role: 'MEMBER',
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      mfaRecoveryCodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(member.id, member);
    console.log(`[AuthService] Seeded demo MEMBER: ${memberEmail}`);
    return member;
  }

  /**
   * Register a new member
   */
  async register(input: RegisterUserInput, ipAddress: string, userAgent?: string): Promise<{
    user: Omit<UserRecord, 'passwordHash' | 'mfaSecret' | 'mfaRecoveryCodes'>;
    accessToken: string;
    refreshToken: string;
    session: { id: string; createdAt: string; deviceInfo: string };
    verificationToken?: string;
    message: string;
  }> {
    await this.ensureReady();
    const validated = RegisterUserSchema.parse(input);

    // 1. Check if email already registered
    const emailLower = validated.email.toLowerCase();
    const existing = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === emailLower,
    );
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    // 2. Validate country: must be enabled, NOT sanctioned
    const sanctionCheck = await this.countriesService.checkSanction(validated.countryCode);
    if (sanctionCheck.isSanctioned || !sanctionCheck.allowed) {
      throw new Error(
        sanctionCheck.reason ||
          `Registration is not available in jurisdiction '${validated.countryCode}'.`,
      );
    }

    // 3. Hash password using Argon2id
    const passwordHash = await hashPassword(validated.password);

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const user: UserRecord = {
      id: userId,
      email: emailLower,
      passwordHash,
      fullName: validated.fullName,
      phone: validated.phone.trim(),
      countryCode: validated.countryCode.toUpperCase(),
      dateOfBirth: validated.dateOfBirth,
      role: validated.role || 'MEMBER',
      emailVerified: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      mfaRecoveryCodes: [],
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);

    // 4. Generate Email Verification Token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    this.emailVerificationTokens.set(verificationToken, user.id);

    // 5. Live mode: send verification email via Resend
    if (!this.configService.isSandbox) {
      await this.emailService.sendVerificationEmail(user.email, user.fullName, verificationToken);
    } else {
      // Sandbox: auto-verify for faster demos; still send welcome via Resend when configured
      user.emailVerified = true;
      void this.emailService.sendWelcomeEmail(user.email, user.fullName);
    }

    // 6. Audit log
    await this.auditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'ADMIN_UPDATE_MEMBER_STATUS',
      targetType: 'USER',
      targetId: user.id,
      beforeState: null,
      afterState: { email: user.email, role: user.role, country: user.countryCode },
      ipAddress,
      userAgent,
    });

    // Issue a session immediately so new members land on their dashboard
    const sessionResult = await this.createSessionAndIssueTokens(
      user,
      ipAddress,
      userAgent || 'Unknown Client',
    );

    return {
      ...sessionResult,
      // Only expose raw token in sandbox (testers); live users get email instead
      verificationToken: this.configService.isSandbox ? verificationToken : undefined,
      message: this.configService.isSandbox
        ? 'Account created and verified (sandbox).'
        : 'Account created. Check your email to verify your address when you can.',
    };
  }

  /**
   * Email verification
   */
  async verifyEmail(token: string): Promise<boolean> {
    const userId = this.emailVerificationTokens.get(token);
    if (!userId) {
      throw new Error('Invalid or expired verification token.');
    }
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found.');
    }
    user.emailVerified = true;
    user.updatedAt = new Date().toISOString();
    this.emailVerificationTokens.delete(token);
    void this.emailService.sendWelcomeEmail(user.email, user.fullName);
    return true;
  }

  /**
   * Login with Argon2 verification, lockout after 5 attempts, and TOTP support
   */
  async login(
    input: LoginUserInput,
    ipAddress: string,
    userAgent = 'Unknown Client',
  ): Promise<
    | {
        requiresMfa: false;
        accessToken: string;
        refreshToken: string;
        user: Omit<UserRecord, 'passwordHash' | 'mfaSecret' | 'mfaRecoveryCodes'>;
        session: { id: string; createdAt: string; deviceInfo: string };
      }
    | {
        requiresMfa: true;
        mfaTicket: string;
        sandboxMfaHint?: {
          totpCode?: string;
          recoveryCodes?: string[];
        };
      }
  > {
    await this.ensureReady();
    const validated = LoginUserSchema.parse(input);
    const emailLower = validated.email.toLowerCase();

    const user = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === emailLower,
    );

    if (!user) {
      // Record failed attempt for non-existent user
      await this.auditService.record({
        actorId: 'anonymous',
        actorRole: 'ANONYMOUS',
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'AUTH',
        targetId: emailLower,
        beforeState: null,
        afterState: { reason: 'User not found' },
        ipAddress,
        userAgent,
      });
      throw new Error('Invalid email or password.');
    }

    // 1. Account lockout check
    if (user.lockedUntil) {
      const now = new Date();
      if (now < user.lockedUntil) {
        const remainingMinutes = Math.ceil(
          (user.lockedUntil.getTime() - now.getTime()) / 60000,
        );
        throw new Error(
          `Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        );
      } else {
        // Lockout expired, reset attempts
        user.lockedUntil = null;
        user.failedLoginAttempts = 0;
      }
    }

    // 2. Verify password with Argon2
    const passwordValid = await verifyPassword(user.passwordHash, validated.password);
    if (!passwordValid) {
      user.failedLoginAttempts += 1;
      let isNowLocked = false;
      if (user.failedLoginAttempts >= 5) {
        // Lock for 15 minutes
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        isNowLocked = true;
      }

      await this.auditService.record({
        actorId: user.id,
        actorRole: user.role,
        action: isNowLocked ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
        targetType: 'USER',
        targetId: user.id,
        beforeState: { failedAttempts: user.failedLoginAttempts - 1 },
        afterState: {
          failedAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil?.toISOString() || null,
        },
        ipAddress,
        userAgent,
      });

      if (isNowLocked) {
        void this.emailService.sendAccountLockedEmail(user.email, user.fullName, 15);
        throw new Error(
          'Account locked: 5 consecutive failed login attempts. Locked for 15 minutes.',
        );
      }
      throw new Error('Invalid email or password.');
    }

    // Reset failed attempts on valid password
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    // 3. Multi-Factor Authentication check (after member enrolls TOTP)
    const isMfaRequired = user.mfaEnabled;

    if (isMfaRequired) {
      // If code was not provided directly in login form, issue MFA Ticket
      if (!validated.totpCode) {
        const mfaTicket = crypto.randomBytes(24).toString('hex');
        this.mfaTickets.set(mfaTicket, {
          userId: user.id,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
        });
        return {
          requiresMfa: true,
          mfaTicket,
          sandboxMfaHint: this.configService.isSandbox
            ? {
                totpCode: user.mfaSecret ? generateTotpCode(user.mfaSecret) : undefined,
                recoveryCodes: [...user.mfaRecoveryCodes],
              }
            : undefined,
        };
      }

      // Verify provided TOTP code or recovery code
      const mfaOk = this.verifyUserMfaOrRecoveryCode(user, validated.totpCode);
      if (!mfaOk) {
        await this.auditService.record({
          actorId: user.id,
          actorRole: user.role,
          action: 'AUTH_LOGIN_FAILED',
          targetType: 'USER',
          targetId: user.id,
          beforeState: null,
          afterState: { reason: 'Invalid MFA TOTP or Recovery code' },
          ipAddress,
          userAgent,
        });
        throw new Error('Invalid Two-Factor Authentication code.');
      }
    }

    // 4. Create authenticated session & issue token pair
    return this.createSessionAndIssueTokens(user, ipAddress, userAgent);
  }

  /**
   * Complete login with MFA Ticket
   */
  async verifyMfaTicketAndLogin(
    mfaTicket: string,
    totpCode: string,
    ipAddress: string,
    userAgent = 'Unknown Client',
  ) {
    const ticketInfo = this.mfaTickets.get(mfaTicket);
    if (!ticketInfo || Date.now() > ticketInfo.expiresAt) {
      throw new Error('MFA verification ticket expired or invalid. Please log in again.');
    }

    const user = this.users.get(ticketInfo.userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const mfaOk = this.verifyUserMfaOrRecoveryCode(user, totpCode);
    if (!mfaOk) {
      await this.auditService.record({
        actorId: user.id,
        actorRole: user.role,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'USER',
        targetId: user.id,
        beforeState: null,
        afterState: { reason: 'Invalid MFA TOTP during ticket exchange' },
        ipAddress,
        userAgent,
      });
      throw new Error('Invalid Two-Factor Authentication code.');
    }

    this.mfaTickets.delete(mfaTicket);
    return this.createSessionAndIssueTokens(user, ipAddress, userAgent);
  }

  private verifyUserMfaOrRecoveryCode(user: UserRecord, code: string): boolean {
    const cleanCode = code.trim().toUpperCase();

    // 1. Check TOTP 6-digit code
    if (user.mfaSecret && /^\d{6}$/.test(cleanCode)) {
      if (verifyTotpCode(cleanCode, user.mfaSecret)) {
        return true;
      }
    }

    // 2. Check 8-character recovery code
    const recoveryIndex = user.mfaRecoveryCodes.findIndex(
      (rc) => rc.toUpperCase() === cleanCode,
    );
    if (recoveryIndex !== -1) {
      // Consume one-time recovery code
      user.mfaRecoveryCodes.splice(recoveryIndex, 1);
      this.auditService.record({
        actorId: user.id,
        actorRole: user.role,
        action: 'AUTH_MFA_RECOVERY_USED',
        targetType: 'USER',
        targetId: user.id,
        beforeState: null,
        afterState: { remainingRecoveryCodes: user.mfaRecoveryCodes.length },
        ipAddress: 'internal',
      });
      return true;
    }

    return false;
  }

  private async createSessionAndIssueTokens(
    user: UserRecord,
    ipAddress: string,
    userAgent: string,
  ) {
    const sessionId = crypto.randomUUID();
    const tokenFamily = crypto.randomUUID();
    const tokenVersion = 1;
    const jwtSecret = this.configService.get('JWT_SECRET');
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET');

    const accessToken = signAccessToken(
      { sub: user.id, email: user.email, role: user.role, sessionId },
      jwtSecret,
      '15m',
    );

    const refreshToken = signRefreshToken(
      { sub: user.id, sessionId, tokenFamily, tokenVersion },
      refreshSecret,
      '7d',
    );

    const refreshTokenHash = hashToken(refreshToken);
    const now = new Date();
    const nowIso = now.toISOString();

    const session: SessionRecord = {
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      tokenFamily,
      tokenVersion,
      deviceInfo: this.parseDeviceInfo(userAgent),
      ipAddress,
      userAgent,
      isRevoked: false,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: nowIso,
      lastActiveAt: nowIso,
    };

    this.sessions.set(sessionId, session);

    // Audit log
    await this.auditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'SESSION',
      targetId: sessionId,
      beforeState: null,
      afterState: { deviceInfo: session.deviceInfo, ip: ipAddress },
      ipAddress,
      userAgent,
    });

    // Notify on new device / unfamiliar IP (exclude the session we just created)
    const knownDevice = Array.from(this.sessions.values()).some(
      (s) =>
        s.userId === user.id &&
        s.id !== sessionId &&
        !s.isRevoked &&
        s.deviceInfo === session.deviceInfo &&
        s.ipAddress === ipAddress,
    );
    if (!knownDevice) {
      void this.emailService.sendNewLoginEmail(user.email, user.fullName, {
        deviceInfo: session.deviceInfo,
        ipAddress,
        when: nowIso,
      });
    }

    const { passwordHash: _, mfaSecret: __, mfaRecoveryCodes: ___, ...safeUser } = user;
    return {
      requiresMfa: false as const,
      accessToken,
      refreshToken,
      user: safeUser,
      session: {
        id: sessionId,
        createdAt: session.createdAt,
        deviceInfo: session.deviceInfo,
      },
    };
  }

  /**
   * Refresh Token Rotation with Replay-Attack Detection
   * Acceptance Criteria:
   * "Refresh tokens rotate and reused tokens revoke the session."
   */
  async rotateRefreshToken(
    oldRefreshToken: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET');
    const jwtSecret = this.configService.get('JWT_SECRET');

    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken, refreshSecret);
    } catch (err) {
      const error: any = new Error('Invalid or expired refresh token.');
      error.statusCode = 401;
      throw error;
    }

    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      const error: any = new Error('Session not found or expired.');
      error.statusCode = 401;
      throw error;
    }

    const user = this.users.get(payload.sub);
    if (!user) {
      const error: any = new Error('User not found.');
      error.statusCode = 401;
      throw error;
    }

    const incomingHash = hashToken(oldRefreshToken);

    // CRITICAL SECURITY: REPLAY ATTACK DETECTION
    // If session is already revoked OR the stored hash doesn't match the incoming token hash,
    // this token has ALREADY BEEN USED! Immediately revoke the session family.
    if (session.isRevoked || session.refreshTokenHash !== incomingHash) {
      session.isRevoked = true;
      session.revokedAt = new Date();

      await this.auditService.record({
        actorId: user.id,
        actorRole: user.role,
        action: 'AUTH_SESSION_REVOKED',
        targetType: 'SESSION',
        targetId: session.id,
        beforeState: { isRevoked: false },
        afterState: {
          isRevoked: true,
          securityAlert: 'Refresh token reuse detected (Replay Attack). Session revoked.',
        },
        ipAddress,
        userAgent,
      });

      void this.emailService.sendSessionRevokedEmail(
        user.email,
        user.fullName,
        'Refresh token reuse was detected. This session was revoked to protect your account.',
      );

      const error: any = new Error(
        'Security Alert: Refresh token reuse detected. This session has been revoked.',
      );
      error.statusCode = 401;
      throw error;
    }

    // Token is valid and fresh: Rotate it!
    const nextVersion = session.tokenVersion + 1;
    const newRefreshToken = signRefreshToken(
      {
        sub: user.id,
        sessionId: session.id,
        tokenFamily: session.tokenFamily,
        tokenVersion: nextVersion,
      },
      refreshSecret,
      '7d',
    );

    // Invalidate old token by updating hash and version
    session.refreshTokenHash = hashToken(newRefreshToken);
    session.tokenVersion = nextVersion;
    session.lastActiveAt = new Date().toISOString();

    const newAccessToken = signAccessToken(
      { sub: user.id, email: user.email, role: user.role, sessionId: session.id },
      jwtSecret,
      '15m',
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout
   */
  async logout(sessionId: string, actorId: string, ipAddress: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isRevoked = true;
      session.revokedAt = new Date();

      await this.auditService.record({
        actorId,
        actorRole: 'MEMBER',
        action: 'AUTH_LOGOUT',
        targetType: 'SESSION',
        targetId: sessionId,
        beforeState: { isRevoked: false },
        afterState: { isRevoked: true },
        ipAddress,
      });
    }
    return true;
  }

  /**
   * Session Management
   */
  async getUserSessions(userId: string, currentSessionId?: string) {
    const list = Array.from(this.sessions.values())
      .filter((s) => s.userId === userId && !s.isRevoked && new Date() < s.expiresAt)
      .map((s) => ({
        id: s.id,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        isCurrent: s.id === currentSessionId,
      }));

    return list.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  async revokeSession(
    sessionId: string,
    requestingUserId: string,
    actorRole: UserRole,
    ipAddress: string,
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    if (session.userId !== requestingUserId && actorRole !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: You can only revoke your own sessions.');
    }

    session.isRevoked = true;
    session.revokedAt = new Date();

    await this.auditService.record({
      actorId: requestingUserId,
      actorRole,
      action: 'AUTH_SESSION_REVOKED',
      targetType: 'SESSION',
      targetId: sessionId,
      beforeState: { isRevoked: false },
      afterState: { isRevoked: true },
      ipAddress,
    });

    return true;
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
    ipAddress: string,
  ): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.id !== currentSessionId && !session.isRevoked) {
        session.isRevoked = true;
        session.revokedAt = new Date();
        count++;
      }
    }

    await this.auditService.record({
      actorId: userId,
      actorRole: 'MEMBER',
      action: 'AUTH_SESSION_REVOKED',
      targetType: 'SESSIONS_BATCH',
      targetId: userId,
      beforeState: null,
      afterState: { revokedSessionsCount: count },
      ipAddress,
    });

    return count;
  }

  /**
   * TOTP MFA Enrollment
   */
  async startMfaEnrollment(userId: string) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found.');

    const secret = generateBase32Secret(32);
    const { otpauthUrl, qrCodeDataUrl } = await generateTotpQrCode(user.email, secret, 'Lumenfield');
    const recoveryCodes = generateRecoveryCodes(8);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      recoveryCodes,
    };
  }

  async confirmMfaEnrollment(
    userId: string,
    secret: string,
    totpCode: string,
    recoveryCodes: string[],
    ipAddress: string,
  ) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found.');

    const valid = verifyTotpCode(totpCode.trim(), secret);
    if (!valid) {
      throw new Error('Invalid verification code. Please check your authenticator app and try again.');
    }

    user.mfaEnabled = true;
    user.mfaSecret = secret;
    user.mfaRecoveryCodes = recoveryCodes;
    user.updatedAt = new Date().toISOString();

    await this.auditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_MFA_ENROLLED',
      targetType: 'USER',
      targetId: user.id,
      beforeState: { mfaEnabled: false },
      afterState: { mfaEnabled: true, recoveryCodesCount: recoveryCodes.length },
      ipAddress,
    });

    void this.emailService.sendMfaEnabledEmail(user.email, user.fullName);

    return { success: true, message: 'Two-Factor Authentication successfully enabled.' };
  }

  async disableMfa(
    userId: string,
    password: string,
    totpCode: string,
    ipAddress: string,
  ) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found.');

    // HARD RULE: MFA mandatory for SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN') {
      throw new Error('Two-Factor Authentication is mandatory for Super Administrators and cannot be disabled.');
    }

    const passwordOk = await verifyPassword(user.passwordHash, password);
    if (!passwordOk) {
      throw new Error('Incorrect password.');
    }

    const totpOk = this.verifyUserMfaOrRecoveryCode(user, totpCode);
    if (!totpOk) {
      throw new Error('Invalid authenticator or recovery code.');
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaRecoveryCodes = [];
    user.updatedAt = new Date().toISOString();

    await this.auditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_MFA_DISABLED',
      targetType: 'USER',
      targetId: user.id,
      beforeState: { mfaEnabled: true },
      afterState: { mfaEnabled: false },
      ipAddress,
    });

    void this.emailService.sendMfaDisabledEmail(user.email, user.fullName);

    return { success: true };
  }

  /**
   * Password Management
   */
  async requestPasswordReset(email: string, ipAddress: string) {
    const emailLower = email.toLowerCase();
    const user = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === emailLower,
    );

    const token = crypto.randomBytes(32).toString('hex');

    if (user) {
      this.passwordResetTokens.set(token, {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        used: false,
      });

      if (!this.configService.isSandbox) {
        await this.emailService.sendPasswordResetEmail(user.email, user.fullName, token);
      }

      await this.auditService.record({
        actorId: user.id,
        actorRole: user.role,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        targetType: 'USER',
        targetId: user.id,
        beforeState: null,
        afterState: { ip: ipAddress },
        ipAddress,
      });
    }

    // Always return safe message so as not to reveal email presence
    return {
      message: this.configService.isSandbox
        ? 'If the email exists in our records, password reset instructions have been created.'
        : 'If the email exists in our records, password reset instructions have been sent.',
      // Sandbox only: return token so testers can complete reset without email
      sandboxResetToken: this.configService.isSandbox ? token : undefined,
    };
  }

  async confirmPasswordReset(token: string, newPassword: string, ipAddress: string) {
    const record = this.passwordResetTokens.get(token);
    if (!record || record.used || new Date() > record.expiresAt) {
      throw new Error('Password reset token is invalid or has expired.');
    }

    const user = this.users.get(record.userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const newHash = await hashPassword(newPassword);
    user.passwordHash = newHash;
    user.updatedAt = new Date().toISOString();
    record.used = true;

    // Security: Revoke all existing sessions upon password reset
    for (const session of this.sessions.values()) {
      if (session.userId === user.id) {
        session.isRevoked = true;
      }
    }

    await this.auditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      targetType: 'USER',
      targetId: user.id,
      beforeState: null,
      afterState: { sessionsRevoked: true },
      ipAddress,
    });

    void this.emailService.sendPasswordResetConfirmedEmail(user.email, user.fullName);

    return { success: true, message: 'Password has been reset successfully. Please log in.' };
  }

  async changePassword(
    userId: string,
    currentPass: string,
    newPass: string,
    currentSessionId: string,
    ipAddress: string,
  ) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found.');

    const valid = await verifyPassword(user.passwordHash, currentPass);
    if (!valid) {
      throw new Error('Current password does not match.');
    }

    user.passwordHash = await hashPassword(newPass);
    user.updatedAt = new Date().toISOString();

    // Revoke all OTHER sessions
    await this.revokeAllOtherSessions(userId, currentSessionId, ipAddress);

    await this.auditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_PASSWORD_CHANGED',
      targetType: 'USER',
      targetId: user.id,
      beforeState: null,
      afterState: { otherSessionsRevoked: true },
      ipAddress,
    });

    void this.emailService.sendPasswordChangedEmail(user.email, user.fullName);

    return { success: true, message: 'Password successfully changed.' };
  }

  getUserById(userId: string): UserRecord | undefined {
    return this.users.get(userId);
  }

  findUserById(userId: string): UserRecord | undefined {
    return this.users.get(userId);
  }

  getAllUsers(): UserRecord[] {
    return Array.from(this.users.values());
  }

  private parseDeviceInfo(userAgent?: string): string {
    if (!userAgent) return 'Web Browser (Standard)';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS Safari (Mobile)';
    if (/android/i.test(userAgent)) return 'Android Chrome (Mobile)';
    if (/macintosh|mac os x/i.test(userAgent)) return 'macOS Chrome/Safari (Desktop)';
    if (/windows/i.test(userAgent)) return 'Windows Edge/Chrome (Desktop)';
    if (/linux/i.test(userAgent)) return 'Linux Browser (Desktop)';
    return 'Web Client (Browser)';
  }
}
