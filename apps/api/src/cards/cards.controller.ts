import { Request, Response, NextFunction } from 'express';
import { CardsService } from './cards.service';
import { CardCurrency } from '@lumenfield/shared';

export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  getCards = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currency = req.query.currency as CardCurrency | undefined;
      const cards = this.cardsService.getMemberCards(req.user!.id, currency);
      res.json(cards);
    } catch (err) {
      next(err);
    }
  };

  createCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const result = await this.cardsService.createCard(req.user!.id, req.body, ip);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = this.cardsService.getCardById(req.params.id, req.user!.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  };

  toggleFreeze = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      let cardId = req.params.id;

      // Legacy fallback if cardId not in params
      if (!cardId && req.body.cardId) {
        cardId = req.body.cardId;
      }
      if (!cardId) {
        const cards = this.cardsService.getMemberCards(req.user!.id);
        if (cards.length > 0) {
          cardId = cards[0].id;
        } else {
          res.status(404).json({ message: 'No virtual card found to toggle freeze.' });
          return;
        }
      }

      const updated = await this.cardsService.toggleFreeze(cardId, req.user!.id, ip);
      res.json({
        success: true,
        message: `Card is now ${updated.status.toLowerCase()}.`,
        card: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  freezeCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const updated = await this.cardsService.updateCardStatus(
        req.params.id,
        req.user!.id,
        'FROZEN',
        ip,
      );
      res.json({
        success: true,
        message: 'Card frozen successfully.',
        card: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  unfreezeCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      const updated = await this.cardsService.updateCardStatus(
        req.params.id,
        req.user!.id,
        'ACTIVE',
        ip,
      );
      res.json({
        success: true,
        message: 'Card unfrozen successfully.',
        card: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  updateLimits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      let cardId = req.params.id;

      // Legacy fallback
      if (!cardId && req.body.cardId) {
        cardId = req.body.cardId;
      }
      if (!cardId) {
        const cards = this.cardsService.getMemberCards(req.user!.id);
        if (cards.length > 0) {
          cardId = cards[0].id;
        } else {
          res.status(404).json({ message: 'No virtual card found to update limits.' });
          return;
        }
      }

      const updated = await this.cardsService.updateCardLimits(
        cardId,
        req.user!.id,
        {
          dailyLimitMinor: req.body.dailyLimitMinor ?? req.body.dailyLimit,
          monthlyLimitMinor: req.body.monthlyLimitMinor ?? req.body.monthlyLimit,
        },
        ip,
      );
      res.json({
        success: true,
        message: 'Card spending limits updated.',
        card: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactions = this.cardsService.getCardTransactions(req.params.id, req.user!.id);
      res.json(transactions);
    } catch (err) {
      next(err);
    }
  };

  simulatePurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = (req.ip || '127.0.0.1').toString();
      let cardId = req.params.id;

      if (!cardId && req.body.cardId) {
        cardId = req.body.cardId;
      }
      if (!cardId) {
        const cards = this.cardsService.getMemberCards(req.user!.id);
        if (cards.length > 0) {
          cardId = cards[0].id;
        } else {
          res.status(404).json({ message: 'No virtual card found for purchase simulation.' });
          return;
        }
      }

      const result = await this.cardsService.simulatePurchase(
        cardId,
        {
          amountMinor: req.body.amountMinor,
          merchantName: req.body.merchantName,
          merchantCategory: req.body.merchantCategory,
          currency: req.body.currency,
          idempotencyKey: req.body.idempotencyKey,
        },
        ip,
        req.user!.id,
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };
}
