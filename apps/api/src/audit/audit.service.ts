import { AuditLog } from '@lumenfield/shared';

export class AuditService {
  private inMemoryLogs: AuditLog[] = [];

  async record(entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string }): Promise<AuditLog> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry,
    };

    this.inMemoryLogs.unshift(log);
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
    return this.inMemoryLogs.slice(0, limit);
  }
}
