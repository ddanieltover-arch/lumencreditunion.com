import { SEEDED_COUNTRIES, SANCTIONED_COUNTRIES, SeedCountry } from '@lumenfield/db';

export class CountriesService {
  private countries: SeedCountry[] = [...SEEDED_COUNTRIES];
  private sanctioned: SeedCountry[] = [...SANCTIONED_COUNTRIES];

  /**
   * Returns all supported and enabled member countries.
   * If includeSanctioned=true, also includes blocked jurisdictions with sanction details.
   */
  async findAll(includeSanctioned = false): Promise<SeedCountry[]> {
    if (includeSanctioned) {
      return [...this.countries, ...this.sanctioned];
    }
    return this.countries.filter((c) => c.enabled && !c.isSanctioned);
  }

  /**
   * Finds a single country by 2-letter ISO code.
   */
  async findByCode(code: string): Promise<SeedCountry | undefined> {
    const upper = code.toUpperCase();
    return (
      this.countries.find((c) => c.code === upper) ||
      this.sanctioned.find((c) => c.code === upper)
    );
  }

  /**
   * Alias for findByCode
   */
  async getCountryByCode(code: string): Promise<SeedCountry | undefined> {
    return this.findByCode(code);
  }

  /**
   * Checks whether a jurisdiction is sanctioned under international compliance rules.
   */
  async checkSanction(code: string): Promise<{ isSanctioned: boolean; allowed: boolean; reason?: string }> {
    const upper = code.toUpperCase();
    const hit = this.sanctioned.find((c) => c.code === upper);
    if (hit) {
      return {
        isSanctioned: true,
        allowed: false,
        reason: hit.sanctionReason || 'Jurisdiction is under international economic sanctions',
      };
    }
    const enabledCountry = this.countries.find((c) => c.code === upper && c.enabled);
    return {
      isSanctioned: false,
      allowed: !!enabledCountry,
      reason: enabledCountry ? undefined : 'Country is not currently enabled for membership',
    };
  }
}
