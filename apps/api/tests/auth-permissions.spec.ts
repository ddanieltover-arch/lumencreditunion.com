import { describe, it, expect } from 'vitest';
import { requireRole } from '../src/common/guards/roles.guard';
import { Request, Response } from 'express';

describe('Server-side Role Enforcement (HARD RULE 5)', () => {
  const createMockReqRes = (user?: { id: string; email: string; role: 'MEMBER' | 'SUPER_ADMIN' }) => {
    const req = {
      user,
      originalUrl: '/admin/fund-wallet',
    } as unknown as Request;

    let responseData: any = null;
    let statusCode = 200;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            responseData = data;
          },
        };
      },
    } as unknown as Response;

    return { req, res, getStatus: () => statusCode, getData: () => responseData };
  };

  it('rejects unauthenticated requests with 401 Unauthorized', () => {
    const { req, res, getStatus } = createMockReqRes(undefined);
    let nextCalled = false;

    const guard = requireRole(['SUPER_ADMIN']);
    guard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(getStatus()).toBe(401);
  });

  it('rejects MEMBER role attempting to access SUPER_ADMIN endpoint with 403 Forbidden', () => {
    const { req, res, getStatus } = createMockReqRes({
      id: 'member-123',
      email: 'member@example.com',
      role: 'MEMBER',
    });
    let nextCalled = false;

    const guard = requireRole(['SUPER_ADMIN']);
    guard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(getStatus()).toBe(403);
  });

  it('allows SUPER_ADMIN role on administrative routes', () => {
    const { req, res } = createMockReqRes({
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
    });
    let nextCalled = false;

    const guard = requireRole(['SUPER_ADMIN']);
    guard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
