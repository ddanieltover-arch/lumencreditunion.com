import crypto from 'crypto';
import QRCode from 'qrcode';
import { CryptoNetwork } from '@lumenfield/shared';

export interface CryptoDepositAddress {
  network: CryptoNetwork;
  currency: string;
  address: string;
  qrCodeDataUrl: string;
  memoOrTag?: string;
  isSimulated: true;
  warningNotice: string;
  networkDetails: {
    protocol: string;
    confirmationsRequired: number;
    estimatedSpeedMinutes: number;
  };
}

export interface CryptoSimulationResult {
  txHash: string;
  network: CryptoNetwork;
  amountMinor: number;
  currency: string;
  confirmations: number;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  simulatedAt: string;
  explorerUrl: string;
  warningNotice: string;
}

export interface CryptoProvider {
  generateDepositAddress(network: CryptoNetwork, memberId: string): Promise<CryptoDepositAddress>;
  simulateDeposit(params: {
    network: CryptoNetwork;
    memberId: string;
    amountMinor: number;
    currency: string;
  }): Promise<CryptoSimulationResult>;
  simulateWithdrawal(params: {
    network: CryptoNetwork;
    destinationAddress: string;
    amountMinor: number;
    currency: string;
  }): Promise<CryptoSimulationResult>;
}

export class SandboxCryptoProvider implements CryptoProvider {
  private static addressStore = new Map<string, string>(); // `${memberId}:${network}` -> address

  async generateDepositAddress(
    network: CryptoNetwork,
    memberId: string,
  ): Promise<CryptoDepositAddress> {
    const key = `${memberId}:${network}`;
    let address = SandboxCryptoProvider.addressStore.get(key);

    if (!address) {
      const hash = crypto.createHash('sha256').update(`${memberId}-${network}-sandbox-seed`).digest('hex');
      switch (network) {
        case 'BTC':
          // Bitcoin testnet address (tb1q...)
          address = `tb1q${hash.slice(0, 38)}`;
          break;
        case 'ETH':
        case 'USDC_SEPOLIA':
          // Ethereum Sepolia testnet address (0x...)
          address = `0x${hash.slice(0, 40)}`;
          break;
        case 'SOL':
          // Solana Devnet address
          address = `SolDev${hash.slice(0, 36)}`;
          break;
      }
      SandboxCryptoProvider.addressStore.set(key, address);
    }

    // Generate real visual QR code for the simulated address
    const qrCodeDataUrl = await QRCode.toDataURL(address, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0A3D3F', // Brand Teal
        light: '#FFFFFF',
      },
    });

    const networkMeta: Record<
      CryptoNetwork,
      { protocol: string; confirmationsRequired: number; estimatedSpeedMinutes: number }
    > = {
      BTC: { protocol: 'Bitcoin Testnet4', confirmationsRequired: 2, estimatedSpeedMinutes: 20 },
      ETH: { protocol: 'Ethereum Sepolia', confirmationsRequired: 12, estimatedSpeedMinutes: 3 },
      USDC_SEPOLIA: {
        protocol: 'ERC-20 USDC on Sepolia',
        confirmationsRequired: 12,
        estimatedSpeedMinutes: 2,
      },
      SOL: { protocol: 'Solana Devnet', confirmationsRequired: 32, estimatedSpeedMinutes: 1 },
    };

    return {
      network,
      currency: network === 'USDC_SEPOLIA' ? 'USD' : network,
      address,
      qrCodeDataUrl,
      isSimulated: true,
      warningNotice:
        'SANDBOX SIMULATION: This is a testnet demo address. Do NOT send real mainnet cryptocurrency. No custody or real assets exist.',
      networkDetails: networkMeta[network],
    };
  }

  async simulateDeposit(params: {
    network: CryptoNetwork;
    memberId: string;
    amountMinor: number;
    currency: string;
  }): Promise<CryptoSimulationResult> {
    const txHash = `0xsim_dep_${crypto.randomBytes(16).toString('hex')}`;
    return {
      txHash,
      network: params.network,
      amountMinor: params.amountMinor,
      currency: params.currency,
      confirmations: 12,
      status: 'CONFIRMED',
      simulatedAt: new Date().toISOString(),
      explorerUrl: `https://sandbox-explorer.lumenfield.test/tx/${txHash}`,
      warningNotice: 'Simulated sandbox testnet credit (No real blockchain assets).',
    };
  }

  async simulateWithdrawal(params: {
    network: CryptoNetwork;
    destinationAddress: string;
    amountMinor: number;
    currency: string;
  }): Promise<CryptoSimulationResult> {
    const txHash = `0xsim_wd_${crypto.randomBytes(16).toString('hex')}`;
    return {
      txHash,
      network: params.network,
      amountMinor: params.amountMinor,
      currency: params.currency,
      confirmations: 1,
      status: 'CONFIRMED',
      simulatedAt: new Date().toISOString(),
      explorerUrl: `https://sandbox-explorer.lumenfield.test/tx/${txHash}`,
      warningNotice: 'Simulated sandbox withdrawal rail (No real blockchain transaction broadcast).',
    };
  }
}
