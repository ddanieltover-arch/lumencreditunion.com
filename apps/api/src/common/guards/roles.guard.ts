import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@lumenfield/shared';
import { verifyAccessToken } from '../../auth/jwt.util';
import { ConfigService } from '../../config/config.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * JWT Authentication Middleware
 * Extracts Bearer token from Authorization header and verifies it.
 */
export function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      statusCode: 401,
      message: 'Unauthorized: missing or invalid authorization header.',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const jwtSecret = ConfigService.getInstance().get('JWT_SECRET');

  try {
    const payload = verifyAccessToken(token, jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };
    next();
  } catch (err: any) {
    res.status(401).json({
      statusCode: 401,
      message: `Unauthorized: ${err.message || 'invalid token'}`,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}

/**
 * Server-side RolesGuard (HARD RULE 5)
 * Enforced on the server for every route, NEVER only in the UI.
 * Acceptance criteria: A MEMBER cannot call any admin route.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        statusCode: 401,
        message: 'Unauthorized: authentication required.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        statusCode: 403,
        message: `Forbidden: role '${user.role}' lacks permission for this endpoint. Required: [${allowedRoles.join(', ')}]`,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
      return;
    }

    next();
  };
}
