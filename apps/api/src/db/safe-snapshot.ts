/**
 * Guards full-document snapshot writes so a cold/empty serverless isolate
 * cannot overwrite a richer Neon snapshot (the main cause of "deploy wiped members").
 */

export function shouldReplaceSnapshot(opts: {
  store: string;
  existingCount: number;
  incomingCount: number;
  /** Allow intentional clears only when caller sets this. */
  allowEmptyOverwrite?: boolean;
}): boolean {
  const { store, existingCount, incomingCount, allowEmptyOverwrite } = opts;

  if (incomingCount === 0 && existingCount > 0 && !allowEmptyOverwrite) {
    console.warn(
      `[${store}] Refusing to persist empty snapshot over ${existingCount} durable row(s).`,
    );
    return false;
  }

  // Never shrink the durable book unless counts are equal (updates) or growing
  if (incomingCount < existingCount) {
    console.warn(
      `[${store}] Refusing to persist smaller snapshot (${incomingCount} < ${existingCount} in DB).`,
    );
    return false;
  }

  return true;
}
