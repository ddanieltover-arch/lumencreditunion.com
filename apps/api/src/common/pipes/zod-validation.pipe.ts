import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

export class BadRequestException extends Error {
  public statusCode = 400;
  public details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'BadRequestException';
    this.details = details;
  }
}

/**
 * Express middleware helper factory that applies a Zod schema validation
 * to req.body, req.query, or req.params.
 */
export function validateZod<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        }));
        const summary =
          issues.map((i) => i.message).filter(Boolean).join(' ') || 'Validation failed';
        next(new BadRequestException(summary, issues));
      } else {
        next(error);
      }
    }
  };
}
