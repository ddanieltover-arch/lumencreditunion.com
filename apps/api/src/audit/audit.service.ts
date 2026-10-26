import { AuditLog } from '@lumenfield/shared';
import { loadPersistedAuditLogs, persistAuditLog } from './audit-persistence';

type GlobalAudit = typeof globalThis & { __lumenAuditService?: AuditService };

export class AuditService {
  private inMemoryLogs: AuditLog[] = [];
  private hydratePromise: Promise<void> | null = null;

  static getInstance(): AuditService {
    const g = globalThis as GlobalAudit;
    if (!g.__lumenAuditService) {
      g.__lumenAuditService = new AuditService();
    }
    return g.__lumenAuditService;
  }

  async ensureReady(): Promise<void> {
    if (!this.hydratePromise) {
      this.hydratePromise = this.hydrateFromStore().catch((err: unknown) => {
        console.error('[AuditService] Hydration failed:', err);
        this.hydratePromise = null;
      });
    }
    await this.hydratePromise;
  }

  private async hydrateFromStore(): Promise<void> {
    if (this.inMemoryLogs.length > 0) return;
    const persisted = await loadPersistedAuditLogs(500);
    if (!persisted.length) return;
    this.inMemoryLogs = persisted;
    console.log(`[AuditService] Restored ${persisted.length} audit log(s) from database.`);
  }

  async record(entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string }): Promise<AuditLog> {
    await this.ensureReady();
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry,
    };

    this.inMemoryLogs.unshift(log);
    void persistAuditLog(log);
    console.log(
      `[AuditLog] Actor: ${log.actorId} (${log.actorRole}) | Action: ${log.action} | Target: ${log.targetType}:${log.targetId} | IP: ${log.ipAddress}`,
    );

    return log;
  }

  async log(params: {
    actor: string;
    actorRole: any;
    action: any;
    targetType: string;
    targetId: string;
    beforeState?: any;
    afterState?: any;
    ipAddress: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return this.record({
      actorId: params.actor,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async getLogs(limit = 100): Promise<AuditLog[]> {
    await this.ensureReady();
    return this.inMemoryLogs.slice(0, limit);
  }
}
