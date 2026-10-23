import { Request, Response, NextFunction } from 'express';

export interface ErrorResponseEnvelope {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
  details?: any;
}

export function globalExceptionFilter(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  let statusCode = err.statusCode || err.status;
  if (!statusCode) {
    const msg = err.message || '';
    if (
      msg.includes('Session not found') ||
      msg.includes('refresh token') ||
      msg.includes('token reuse') ||
      msg.includes('Invalid email or password') ||
      msg.includes('MFA verification ticket') ||
      msg.includes('Two-Factor Authentication') ||
      msg.includes('Account locked') ||
      msg.includes('Account is temporarily locked') ||
      msg.includes('unauthorized') ||
      msg.includes('Unauthorized') ||
      msg.includes('jwt') ||
      msg.includes('JWT')
    ) {
      statusCode = 401;
    } else if (
      msg.includes('validation') ||
      msg.includes('Missing') ||
      msg.includes('sanction') ||
      msg.includes('Sanction')
    ) {
      statusCode = 400;
    } else if (msg.includes('not found') || msg.includes('Not found')) {
      statusCode = 404;
    } else {
      statusCode = 500;
    }
  }

  const message = err.message || 'Internal server error';

  const envelope: ErrorResponseEnvelope = {
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl || req.url,
  };

  if (err.details) {
    envelope.details = err.details;
  }

  if (statusCode >= 500) {
    console.error(`[Unhandled Exception] ${req.method} ${req.url}:`, err);
  } else {
    console.warn(`[WARN] ${req.method} ${req.url} ${statusCode} - ${message} (${req.ip || '127.0.0.1'})`);
  }

  res.status(statusCode).json(envelope);
}
