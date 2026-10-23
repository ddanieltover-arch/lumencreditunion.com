import { Request, Response, NextFunction } from 'express';

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'self' https://aistudio.google.com;",
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing unless allowed in studio preview
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict sensitive browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );

  // HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
}

/**
 * CSRF Protection & Input Sanitization Middleware
 * Enforces custom headers on mutating actions to prevent cross-site request forgery.
 */
export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (mutatingMethods.includes(req.method)) {
    // Check for standard anti-CSRF measures:
    // 1. Authorization header (Bearer token)
    // 2. Or X-Requested-With header
    // 3. Or explicit application/json Content-Type
    const authHeader = req.headers['authorization'];
    const requestedWith = req.headers['x-requested-with'];
    const contentType = req.headers['content-type'] || '';

    const isSecureCall =
      authHeader ||
      requestedWith ||
      contentType.includes('application/json') ||
      req.path.startsWith('/auth/login') ||
      req.path.startsWith('/auth/register');

    if (!isSecureCall) {
      res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Potential CSRF detected: Missing application/json or CSRF token header.',
      });
      return;
    }

    // Input sanitization: recursively escape or strip <script> tags from string body properties
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
  }

  next();
}

function sanitizeObject(obj: Record<string, any>) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Disallow script injections and strip HTML control characters
      obj[key] = val
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '');
    } else if (typeof val === 'object' && val !== null) {
      sanitizeObject(val);
    }
  }
}
