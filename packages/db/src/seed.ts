import { ALL_COUNTRIES } from './data/countries';

export async function seedCountries(prismaClient?: any) {
  console.log(`[Seed] Seeding ${ALL_COUNTRIES.length} countries (enabled + sanctioned blocklist)...`);

  if (!prismaClient) {
    console.log('[Seed] Standalone mode: returning in-memory country data.');
    return ALL_COUNTRIES;
  }

  for (const country of ALL_COUNTRIES) {
    await prismaClient.country.upsert({
      where: { code: country.code },
      update: {
        name: country.name,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        enabled: country.enabled,
        acceptedIdTypes: country.acceptedIdTypes,
        autoLoansEnabled: country.autoLoansEnabled,
        mortgageEnabled: country.mortgageEnabled,
        cardsEnabled: country.cardsEnabled,
        isSanctioned: country.isSanctioned,
        sanctionReason: country.sanctionReason,
      },
      create: {
        code: country.code,
        name: country.name,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        enabled: country.enabled,
        acceptedIdTypes: country.acceptedIdTypes,
        autoLoansEnabled: country.autoLoansEnabled,
        mortgageEnabled: country.mortgageEnabled,
        cardsEnabled: country.cardsEnabled,
        isSanctioned: country.isSanctioned,
        sanctionReason: country.sanctionReason,
      },
    });
  }

  console.log('[Seed] Successfully seeded countries into database.');
  return ALL_COUNTRIES;
}

// When executed directly via `tsx packages/db/src/seed.ts` (Node only)
const isNode =
  typeof process !== 'undefined' &&
  !!process.versions?.node &&
  Array.isArray(process.argv);

if (isNode && import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedCountries()
    .then(() => {
      console.log('[Seed] Complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error seeding database:', err);
      process.exit(1);
    });
}
