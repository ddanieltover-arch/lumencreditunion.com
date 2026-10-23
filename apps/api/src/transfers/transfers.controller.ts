import { Request, Response, NextFunction } from 'express';
import { TransfersService } from './transfers.service';
import {
  AddBeneficiarySchema,
  MemberTransferInputSchema,
  BankTransferInputSchema,
  CryptoTransferInputSchema,
  RecipientLookupSchema,
  CryptoNetwork,
} from '@lumenfield/shared';

export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  lookupRecipient = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ((req.query.query || req.query.q) as string) || '';
      if (!query || query.length < 2) {
        res.status(400).json({ message: 'Query must be at least 2 characters.' });
        return;
      }
      const result = await this.transfersService.lookupRecipient(query);
      if (!result) {
        res.status(404).json({ message: `No member found matching "${query}".` });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  initiateMemberTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const transfer = await this.transfersService.initiateMemberTransfer(
        req.user!.id,
        req.body,
        ip,
      );
      res.status(201).json({
        success: true,
        message: 'Member transfer completed successfully.',
        transfer,
      });
    } catch (err) {
      next(err);
    }
  };

  getBeneficiaries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = this.transfersService.getBeneficiaries(req.user!.id);
      res.json(list);
    } catch (err) {
      next(err);
    }
  };

  addBeneficiary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const record = await this.transfersService.addBeneficiary(
        req.user!.id,
        req.body,
        ip,
      );
      res.status(201).json({
        success: true,
        message: 'Beneficiary added successfully.',
        beneficiary: record,
      });
    } catch (err) {
      next(err);
    }
  };

  initiateBankTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const transfer = await this.transfersService.initiateBankTransfer(
        req.user!.id,
        req.body,
        ip,
      );
      res.status(201).json({
        success: true,
        message: 'Bank transfer initiated.',
        transfer,
      });
    } catch (err) {
      next(err);
    }
  };

  processBankTransferState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { status, reason } = req.body;
      const transfer = await this.transfersService.processTransferState(
        req.params.id,
        status,
        reason,
        ip,
      );
      res.json({
        success: true,
        message: `Transfer transitioned to ${status}.`,
        transfer,
      });
    } catch (err) {
      next(err);
    }
  };

  getCryptoDepositAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const network = (req.query.network as CryptoNetwork) || 'USDC_SEPOLIA';
      const addressInfo = await this.transfersService.getCryptoDepositAddress(
        network,
        req.user!.id,
      );
      res.json(addressInfo);
    } catch (err) {
      next(err);
    }
  };

  simulateCryptoDeposit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { network, amountMinor, currency } = req.body;
      const transfer = await this.transfersService.simulateCryptoDeposit(
        req.user!.id,
        network,
        amountMinor,
        currency,
        ip,
      );
      res.status(201).json({
        success: true,
        message: 'Simulated crypto deposit credited.',
        transfer,
      });
    } catch (err) {
      next(err);
    }
  };

  initiateCryptoWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const transfer = await this.transfersService.initiateCryptoWithdrawal(
        req.user!.id,
        req.body,
        ip,
      );
      res.status(201).json({
        success: true,
        message: 'Simulated crypto withdrawal broadcast.',
        transfer,
      });
    } catch (err) {
      next(err);
    }
  };

  getTransfers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = {
        type: req.query.type as any,
        status: req.query.status as any,
        currency: req.query.currency as any,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
      };
      const result = this.transfersService.getMemberTransfers(req.user!.id, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getTransferReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const html = this.transfersService.generateReceiptHtml(
        req.params.id,
        req.user!.id,
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="receipt-${req.params.id}.html"`,
      );
      res.send(html);
    } catch (err) {
      next(err);
    }
  };

  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = this.transfersService.getMemberNotifications(req.user!.id);
      res.json(list);
    } catch (err) {
      next(err);
    }
  };

  markNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.transfersService.markNotificationsRead(req.user!.id);
      res.json({ success: true, message: 'Notifications marked as read.' });
    } catch (err) {
      next(err);
    }
  };

  getFlaggedTransfers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const list = this.transfersService.getFlaggedTransfers();
      res.json(list);
    } catch (err) {
      next(err);
    }
  };

  adjudicateFlaggedTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const { action, reason } = req.body;
      const transfer = await this.transfersService.clearOrApproveFlaggedTransfer(
        req.params.id,
        action,
        req.user!.id,
        reason || 'Admin review decision',
        ip,
      );
      res.json({
        success: true,
        message: `Flagged transfer ${action === 'APPROVE' ? 'cleared' : 'rejected'}.`,
        transfer,
      });
    } catch (err) {
      next(err);
    }
  };
}
