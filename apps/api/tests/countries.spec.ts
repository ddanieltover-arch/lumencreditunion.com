import { describe, it, expect } from 'vitest';
import { CountriesService } from '../src/countries/countries.service';

describe('Countries Data & Sanctions Logic (HARD RULE 8)', () => {
  const service = new CountriesService();

  it('Acceptance Criteria: Seeded countries are returned by GET /countries', async () => {
    const countries = await service.findAll();
    const codes = countries.map((c) => c.code);

    // Primary markets plus global coverage
    expect(codes).toContain('US');
    expect(codes).toContain('CA');
    expect(codes).toContain('GB');
    expect(codes).toContain('DE');
    expect(codes).toContain('FR');
    expect(codes).toContain('NL');
    expect(codes).toContain('ES');
    expect(codes).toContain('IT');
    expect(codes).toContain('IE');
    expect(codes).toContain('JP');
    expect(codes).toContain('AU');
    expect(codes).toContain('BR');
    expect(codes).toContain('NG');
    expect(codes).toContain('IN');

    expect(countries.length).toBeGreaterThanOrEqual(180);
    expect(countries.every((c) => c.currency.length === 3)).toBe(true);
  });

  it('Each seeded country specifies currency, enabled flag, and accepted ID types', async () => {
    const us = await service.findByCode('US');
    expect(us).toBeDefined();
    expect(us?.currency).toBe('USD');
    expect(us?.currencySymbol).toBe('$');
    expect(us?.enabled).toBe(true);
    expect(us?.acceptedIdTypes).toContain('PASSPORT');
    expect(us?.acceptedIdTypes).toContain('DRIVERS_LICENSE');

    const gb = await service.findByCode('GB');
    expect(gb?.currency).toBe('GBP');
    expect(gb?.currencySymbol).toBe('£');
    expect(gb?.acceptedIdTypes).toContain('BRP');
  });

  it('Sanctioned countries are blocked from default findAll and fail sanction checks', async () => {
    const activeCountries = await service.findAll(false);
    expect(activeCountries.some((c) => c.code === 'CU')).toBe(false);
    expect(activeCountries.some((c) => c.code === 'IR')).toBe(false);
    expect(activeCountries.some((c) => c.code === 'KP')).toBe(false);

    const checkCuba = await service.checkSanction('CU');
    expect(checkCuba.isSanctioned).toBe(true);
    expect(checkCuba.allowed).toBe(false);

    const checkIran = await service.checkSanction('IR');
    expect(checkIran.isSanctioned).toBe(true);
    expect(checkIran.allowed).toBe(false);

    const checkUS = await service.checkSanction('US');
    expect(checkUS.isSanctioned).toBe(false);
    expect(checkUS.allowed).toBe(true);
  });
});
