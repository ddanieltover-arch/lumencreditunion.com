/**
 * Public package surface for browser + API consumers.
 * Seed CLI stays in ./seed.ts and must not be re-exported here —
 * evaluating process.argv at module load crashes the SPA.
 */
export * from './data/countries';
