import pg from 'pg';

/**
 * Minimal SQL client matching the Prisma raw-query surface used by persistence
 * helpers. Implemented with `pg` so the API no longer depends on
 * `prisma generate` at deploy time (which was breaking live login).
 *
 * Local and Vercel must set the same Neon `DATABASE_URL`. Git push / deploy
 * never runs migrations or truncates tables — only application upserts.
 */
export type SqlClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type GlobalDb = typeof globalThis & {
  __lumenPgPool?: pg.Pool | null;
  __lumenSqlClient?: SqlClient | null;
  __lumenDbInitFailed?: boolean;
  __lumenDbHostLogged?: boolean;
};

function createSqlClient(pool: pg.Pool): SqlClient {
  return {
    async $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> {
      const result = await pool.query(query, values);
      return result.rowCount ?? 0;
    },
    async $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> {
      const result = await pool.query(query, values);
      return result.rows as T;
    },
  };
}

export function getDatabaseHost(databaseUrl = process.env.DATABASE_URL): string | null {
  const raw = databaseUrl?.trim();
  if (!raw) return null;
  try {
    const matched = raw.match(/@([^/?]+)/);
    return matched?.[1] || null;
  } catch {
    return null;
  }
}

/** @deprecated name kept for call-site compatibility — backed by `pg`, not Prisma. */
export function getPrisma(): SqlClient | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.warn(
      '[DB] DATABASE_URL is not set — member/admin data will not persist across restarts.',
    );
    return null;
  }

  const g = globalThis as GlobalDb;
  if (g.__lumenDbInitFailed) return null;
  if (g.__lumenSqlClient) return g.__lumenSqlClient;

  try {
    const host = getDatabaseHost(databaseUrl);
    if (!g.__lumenDbHostLogged) {
      g.__lumenDbHostLogged = true;
      const kind = host && /neon\.tech/i.test(host) ? 'Neon' : 'Postgres';
      console.log(`[DB] Connected (${kind}) host=${host || 'unknown'}`);
      if (host && /localhost|127\.0\.0\.1/i.test(host)) {
        console.warn(
          '[DB] Localhost DATABASE_URL detected. For shared local+live data, use the same Neon URL as Vercel.',
        );
      }
    }

    const pool =
      g.__lumenPgPool ||
      new pg.Pool({
        connectionString: databaseUrl,
        // Neon / most hosted Postgres require TLS; local docker usually does not.
        ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
          ? undefined
          : { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
      });
    g.__lumenPgPool = pool;
    g.__lumenSqlClient = createSqlClient(pool);
    return g.__lumenSqlClient;
  } catch (err: unknown) {
    g.__lumenDbInitFailed = true;
    g.__lumenPgPool = null;
    g.__lumenSqlClient = null;
    console.error(
      '[DB] Postgres pool init failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
