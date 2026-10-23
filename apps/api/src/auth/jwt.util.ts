import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRole } from '@lumenfield/shared';

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  tokenFamily: string;
  tokenVersion: number;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: TokenPayload, secret: string, expiresIn = '15m'): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

export function signRefreshToken(
  payload: RefreshTokenPayload,
  secret: string,
  expiresIn = '7d',
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

export function verifyAccessToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

export function verifyRefreshToken(token: string, secret: string): RefreshTokenPayload {
  return jwt.verify(token, secret) as RefreshTokenPayload;
}
