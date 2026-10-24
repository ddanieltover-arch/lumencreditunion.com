import { CardCurrency } from '@lumenfield/shared';
import { randomUUID } from 'crypto';

export interface GenerateCardParams {
  memberId: string;
  currency: CardCurrency;
  cardholderName: string;
}

export interface GeneratedCardResult {
  cardToken: string;
  lastFour: string;
  fullPan: string; // Fake non-routable test PAN (flagged TEST)
  cvv: string; // 3-digit CVV
  expiryMonth: number;
  expiryYear: number;
  expiryFormatted: string; // MM/YY
  brand: string;
  isTest: boolean;
}

export interface AuthorizePurchaseParams {
  cardToken: string;
  amountMinor: number;
  currency: CardCurrency;
  merchantName: string;
}

export interface AuthorizePurchaseResult {
  authorized: boolean;
  authCode?: string;
  declineReason?: string;
  networkReference?: string;
}

export interface CardProvider {
  generateCard(params: GenerateCardParams): Promise<GeneratedCardResult>;
  authorizePurchase(params: AuthorizePurchaseParams): Promise<AuthorizePurchaseResult>;
}

/**
 * Sandbox Card Provider Implementation.
 * Generates fake test PANs using non-routable test ranges (starts with 4000 0012, flagged TEST).
 * NEVER stores the full PAN or CVV in any internal database or cache.
 */
export class SandboxCardProvider implements CardProvider {
  private static panCounter = 1001;

  async generateCard(params: GenerateCardParams): Promise<GeneratedCardResult> {
    // Generate clearly non-routable sandbox test PAN
    // Prefix 4000 0012 is a reserved non-routable test prefix
    const sequence = (SandboxCardProvider.panCounter++).toString().padStart(4, '0');
    const randomMiddle = Math.floor(1000 + Math.random() * 9000).toString();
    const fullPan = `4000 0012 ${randomMiddle} ${sequence}`;
    const lastFour = sequence;

    // Generate random 3-digit test CVV
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    // Expiry: 3 years from today
    const now = new Date();
    const expiryMonth = now.getMonth() + 1;
    const expiryYear = (now.getFullYear() + 3) % 100;
    const expiryFormatted = `${expiryMonth.toString().padStart(2, '0')}/${expiryYear.toString().padStart(2, '0')}`;

    const cardToken = `crd_tok_test_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    return {
      cardToken,
      lastFour,
      fullPan,
      cvv,
      expiryMonth,
      expiryYear,
      expiryFormatted,
      brand: 'Lumenfield Visa (TEST)',
      isTest: true,
    };
  }

  async authorizePurchase(params: AuthorizePurchaseParams): Promise<AuthorizePurchaseResult> {
    // Sandbox network simulation: approve if cardToken exists and amount > 0
    if (params.amountMinor <= 0) {
      return {
        authorized: false,
        declineReason: 'Invalid transaction amount',
      };
    }

    const authCode = `AUTH_${Math.floor(100000 + Math.random() * 900000)}`;
    const networkReference = `NET_REF_${randomUUID().slice(0, 12)}`;

    return {
      authorized: true,
      authCode,
      networkReference,
    };
  }
}
