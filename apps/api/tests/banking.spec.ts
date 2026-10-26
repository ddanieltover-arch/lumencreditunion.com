import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateBankIdentity,
  validateBankIdentity,
  isValidIban,
  isValidAbaRouting,
  isValidClabe,
  normalizeBankIdentity,
  SANDBOX_INSTITUTIONS,
  IBAN_LENGTHS,
  resolveBankScheme,
} from '@lumenfield/shared';
import { AuthService } from '../src/auth/auth.service';
import { ConfigService } from '../src/config/config.service';
import { AuditService } from '../src/audit/audit.service';
import { TransfersService } from '../src/transfers/transfers.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { KycService } from '../src/kyc/kyc.service';
import { SandboxCryptoProvider } from '../src/transfers/crypto.provider';

describe('Country bank account generation', () => {
  it('produces a valid ABA routing number for US sandbox institution', () => {
    expect(isValidAbaRouting(SANDBOX_INSTITUTIONS.US.routingNumber)).toBe(true);
  });

  it('generates valid US / CA / GB / AU national identities', () => {
    for (const [cc, scheme] of [
      ['US', 'US_ABA'],
      ['CA', 'CA_EFT'],
      ['GB', 'GB_SORT'],
      ['AU', 'AU_BSB'],
    ] as const) {
      const id = generateBankIdentity(cc, 1001);
      expect(id.scheme).toBe(scheme);
      expect(validateBankIdentity(id)).toBe(true);
      expect(id.accountNumberNormalized).toBe(
        normalizeBankIdentity(id.accountNumberNormalized),
      );
    }
    const gb = generateBankIdentity('GB', 7);
    expect(gb.details.iban).toBeTruthy();
    expect(isValidIban(gb.details.iban!)).toBe(true);
  });

  it('generates IBAN with correct length and mod-97 for primary EU markets', () => {
    for (const cc of ['DE', 'FR', 'NL', 'ES', 'IT', 'IE', 'AT', 'BE', 'PT']) {
      const id = generateBankIdentity(cc, 42);
      expect(id.scheme).toBe('IBAN');
      expect(id.details.primary.length).toBe(IBAN_LENGTHS[cc]);
      expect(isValidIban(id.details.primary)).toBe(true);
      expect(validateBankIdentity(id)).toBe(true);
    }
  });

  it('generates valid Mexican CLABE check digit', () => {
    const id = generateBankIdentity('MX', 99);
    expect(id.scheme).toBe('MX_CLABE');
    expect(isValidClabe(id.details.clabe || id.details.primary)).toBe(true);
    expect(validateBankIdentity(id)).toBe(true);
  });

  it('falls back to LUMENFIELD_DOMESTIC for non-IBAN jurisdictions without national scheme', () => {
    expect(resolveBankScheme('AF')).toBe('LUMENFIELD_DOMESTIC');
    const id = generateBankIdentity('AF', 55);
    expect(id.scheme).toBe('LUMENFIELD_DOMESTIC');
    expect(validateBankIdentity(id)).toBe(true);
    expect(id.accountNumberNormalized.startsWith('LFAF')).toBe(true);
  });

  it('produces unique normalized accounts across 1k sequences per primary country', () => {
    for (const cc of ['US', 'CA', 'GB', 'DE', 'FR', 'AU']) {
      const seen = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const id = generateBankIdentity(cc, i);
        expect(seen.has(id.accountNumberNormalized)).toBe(false);
        seen.add(id.accountNumberNormalized);
      }
      expect(seen.size).toBe(1000);
    }
  });
});

describe('Auth registration mints bank identity + transfer lookup', () => {
  let authService: AuthService;
  let transfersService: TransfersService;

  beforeAll(async () => {
    process.env.SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'TestAdminPass123!#';
    process.env.SANDBOX_MODE = 'true';
    const configService = new ConfigService({
      SANDBOX_MODE: 'true',
      SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
    });
    const auditService = new AuditService();
    const kycService = new KycService(undefined, undefined, auditService);
    const ledgerService = new LedgerService(configService, auditService, kycService);
    authService = new AuthService(auditService, configService);
    await authService.ensureReady();
    transfersService = new TransfersService(
      ledgerService,
      authService,
      configService,
      auditService,
      kycService,
      new SandboxCryptoProvider(),
    );
  });

  it('registers members with country-format accounts and finds them by account number', async () => {
    const cases: Array<{ countryCode: string; email: string }> = [
      { countryCode: 'US', email: `bank.us.${Date.now()}@lumenfield.test` },
      { countryCode: 'DE', email: `bank.de.${Date.now()}@lumenfield.test` },
      { countryCode: 'GB', email: `bank.gb.${Date.now()}@lumenfield.test` },
      { countryCode: 'AU', email: `bank.au.${Date.now()}@lumenfield.test` },
    ];

    for (const c of cases) {
      const result = await authService.register(
        {
          email: c.email,
          password: 'SecurePass123!#',
          fullName: `Bank Test ${c.countryCode}`,
          phone: '+1 555 0199',
          countryCode: c.countryCode,
          dateOfBirth: '1991-06-15',
          role: 'MEMBER',
        },
        '127.0.0.1',
        'vitest',
      );

      const user = result.user;
      expect(user.accountNumberNormalized).toBeTruthy();
      expect(user.accountNumberDisplay).toBeTruthy();
      expect(user.bankScheme).toBeTruthy();
      expect(user.bankDetails).toBeTruthy();

      const byAccount = authService.findUserByAccountNumber(user.accountNumberNormalized!);
      expect(byAccount?.id).toBe(user.id);

      if (user.bankDetails?.accountNumber) {
        const byBare = authService.findUserByAccountNumber(user.bankDetails.accountNumber);
        expect(byBare?.id).toBe(user.id);
      }

      const lookup = await transfersService.lookupRecipient(user.accountNumberDisplay!);
      expect(lookup?.id).toBe(user.id);
      expect(lookup?.accountNumberDisplay).toBe(user.accountNumberDisplay);
    }
  });

  it('backfills bank identity for seeded demo member', async () => {
    const amara = authService.getUserById('00000000-0000-0000-0000-000000000002');
    expect(amara).toBeDefined();
    expect(amara?.accountNumberNormalized).toBeTruthy();
    expect(amara?.bankScheme).toBe('US_ABA');
    expect(isValidAbaRouting(amara?.bankDetails?.routingNumber || '')).toBe(true);
  });
});
