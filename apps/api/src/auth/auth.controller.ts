import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const result = await this.authService.register(req.body, ip, req.headers['user-agent']);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      const verified = await this.authService.verifyEmail(token);
      res.json({ success: verified, message: 'Email verified successfully.' });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const result = await this.authService.login(req.body, ip, req.headers['user-agent']);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  verifyMfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { mfaTicket, totpCode } = req.body;
      const result = await this.authService.verifyMfaTicketAndLogin(
        mfaTicket,
        totpCode,
        ip,
        req.headers['user-agent'],
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ statusCode: 400, message: 'Missing refreshToken in request body.' });
        return;
      }
      const tokens = await this.authService.rotateRefreshToken(
        refreshToken,
        ip,
        req.headers['user-agent'],
      );
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const sessionId = req.user!.sessionId;
      await this.authService.logout(sessionId, req.user!.id, ip);
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
      next(err);
    }
  };

  getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.ensureReady();
      const user = this.authService.getUserById(req.user!.id);
      if (!user) {
        res.status(404).json({ statusCode: 404, message: 'User not found.' });
        return;
      }
      const { passwordHash: _, mfaSecret: __, mfaRecoveryCodes: ___, ...safeUser } = user;
      res.json({ user: safeUser, sessionId: req.user!.sessionId });
    } catch (err) {
      next(err);
    }
  };

  getSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await this.authService.getUserSessions(req.user!.id, req.user!.sessionId);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { sessionId } = req.params;
      await this.authService.revokeSession(sessionId, req.user!.id, req.user!.role, ip);
      res.json({ success: true, message: `Session ${sessionId} revoked.` });
    } catch (err) {
      next(err);
    }
  };

  revokeAllOtherSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const count = await this.authService.revokeAllOtherSessions(
        req.user!.id,
        req.user!.sessionId,
        ip,
      );
      res.json({ success: true, count, message: `${count} other session(s) revoked.` });
    } catch (err) {
      next(err);
    }
  };

  startMfaEnrollment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enrollment = await this.authService.startMfaEnrollment(req.user!.id);
      res.json(enrollment);
    } catch (err) {
      next(err);
    }
  };

  confirmMfaEnrollment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { secret, totpCode, recoveryCodes } = req.body;
      const result = await this.authService.confirmMfaEnrollment(
        req.user!.id,
        secret,
        totpCode,
        recoveryCodes,
        ip,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  disableMfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { password, totpCode } = req.body;
      const result = await this.authService.disableMfa(req.user!.id, password, totpCode, ip);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const result = await this.authService.requestPasswordReset(req.body.email, ip);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { token, newPassword } = req.body;
      const result = await this.authService.confirmPasswordReset(token, newPassword, ip);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { currentPassword, newPassword } = req.body;
      const result = await this.authService.changePassword(
        req.user!.id,
        currentPassword,
        newPassword,
        req.user!.sessionId,
        ip,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
