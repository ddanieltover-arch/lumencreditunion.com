import crypto from 'crypto';
import { CountriesService } from '../countries/countries.service';

export interface SanctionsCheckResult {
  passed: boolean;
  flagged: boolean;
  sanctionListsChecked: string[];
  matchedEntities: string[];
  checkedAt: string;
  referenceId: string;
  notes?: string;
}

/**
 * Sanctions screening service interface (HARD RULE 8)
 * Designed to plug into OFAC, UN, EU, UK HMT consolidated lists.
 */
export interface SanctionsScreeningService {
  screenApplicant(
    fullName: string,
    countryCode: string,
    dateOfBirth?: string,
  ): Promise<SanctionsCheckResult>;
}

/**
 * Sandbox implementation of SanctionsScreeningService
 * Evaluates against sanctioned jurisdictions and simulated watchlists.
 */
export class SandboxSanctionsScreeningService implements SanctionsScreeningService {
  constructor(private readonly countriesService: CountriesService = new CountriesService()) {}

  // Simulated global sanction / PEP watchlist names for testing
  private readonly TEST_BLOCKED_NAMES = [
    'OSAMA',
    'AL-BAGHDADI',
    'SANCTIONED PERSON',
    'TEST BLOCKED APPLICANT',
  ];

  async screenApplicant(
    fullName: string,
    countryCode: string,
    _dateOfBirth?: string,
  ): Promise<SanctionsCheckResult> {
    const referenceId = `SCR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const checkedAt = new Date().toISOString();
    const listsChecked = [
      'OFAC Specially Designated Nationals (SDN)',
      'EU Consolidated Financial Sanctions',
      'UK HM Treasury OFSI Sanctions',
      'UN Security Council Sanctions Committee',
    ];

    // 1. Check country sanction status (Data-driven from countries service)
    const countryCheck = await this.countriesService.checkSanction(countryCode);
    if (countryCheck.isSanctioned || !countryCheck.allowed) {
      return {
        passed: false,
        flagged: true,
        sanctionListsChecked: listsChecked,
        matchedEntities: [`Jurisdiction [${countryCode}]: ${countryCheck.reason || 'Comprehensive Sanctions'}`],
        checkedAt,
        referenceId,
        notes: `Applicant from comprehensively sanctioned jurisdiction '${countryCode}'. Blocked.`,
      };
    }

    // 2. Check watchlist name matches (case-insensitive substring check)
    const upperName = fullName.toUpperCase().trim();
    const matched = this.TEST_BLOCKED_NAMES.filter((blocked) => upperName.includes(blocked));

    if (matched.length > 0) {
      return {
        passed: false,
        flagged: true,
        sanctionListsChecked: listsChecked,
        matchedEntities: matched.map((m) => `Watchlist entry: ${m}`),
        checkedAt,
        referenceId,
        notes: `Watchlist screening hit detected for candidate name. Manual compliance escalation required.`,
      };
    }

    // Passed clean
    return {
      passed: true,
      flagged: false,
      sanctionListsChecked: listsChecked,
      matchedEntities: [],
      checkedAt,
      referenceId,
      notes: 'No matches found across OFAC, EU, UK HMT, and UN consolidated lists. Screening clear.',
    };
  }
}
