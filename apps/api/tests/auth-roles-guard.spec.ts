import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiApp } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { signAccessToken } from '../src/auth/jwt.util';
import { ConfigService } from '../src/config/config.service';
import http from 'http';

describe('Acceptance Criterion: A MEMBER cannot call any admin route', () => {
  let app: ReturnType<typeof createApiApp>;
  let server: http.Server;
  let baseUrl: string;
  let authService: AuthService;
  const config = ConfigService.getInstance();
  const jwtSecret = config.get('JWT_SECRET');

  beforeEach(async () => {
    authService = new AuthService();
    app = createApiApp(authService);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('rejects unauthenticated requests to /admin/audit-logs with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/admin/audit-logs`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/Unauthorized/i);
  });

  it('ACCEPTANCE CRITERIA: A MEMBER cannot call any admin route (gets 403 Forbidden)', async () => {
    // Generate valid JWT token for a MEMBER
    const memberToken = signAccessToken(
      {
        sub: 'member-user-uuid-1',
        email: 'member@lumenfield.test',
        role: 'MEMBER',
        sessionId: 'session-member-1',
      },
      jwtSecret,
      '15m',
    );

    // Attempt calling admin route 1: GET /admin/audit-logs
    const resLogs = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
      },
    });
    expect(resLogs.status).toBe(403);
    const bodyLogs = await resLogs.json();
    expect(bodyLogs.message).toContain("Forbidden: role 'MEMBER' lacks permission for this endpoint");

    // Attempt calling admin route 2: GET /admin/ledger/transactions
    const resTx = await fetch(`${baseUrl}/admin/ledger/transactions`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
      },
    });
    expect(resTx.status).toBe(403);

    // Attempt calling admin route 3: POST /admin/fund-wallet
    const resFund = await fetch(`${baseUrl}/admin/fund-wallet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        memberId: '00000000-0000-0000-0000-000000000002',
        amountMinor: 10000,
        currency: 'USD',
        reason: 'Unauthorized attempt',
        idempotencyKey: 'idemp-hack-01',
      }),
    });
    expect(resFund.status).toBe(403);
  });

  it('allows a SUPER_ADMIN to call admin routes', async () => {
    const adminToken = signAccessToken(
      {
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'admin@lumenfield.internal',
        role: 'SUPER_ADMIN',
        sessionId: 'session-admin-1',
      },
      jwtSecret,
      '15m',
    );

    const res = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
