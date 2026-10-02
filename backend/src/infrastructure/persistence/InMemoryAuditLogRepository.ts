import { AuditLogEntry, AuditLogFilter, AuditLogPage } from '../../domain/models/AuditLogEntry.js';
import { AuditLogRepository } from '../../domain/ports/out/AuditLogRepository.js';
import { decodeAuditCursor, encodeAuditCursor } from '../../domain/shared/auditCursor.js';

const copy = (e: AuditLogEntry): AuditLogEntry => structuredClone(e);

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private entries: AuditLogEntry[] = [];

  async record(entry: AuditLogEntry): Promise<void> {
    this.entries.push(copy(entry));
  }

  async list(filter: AuditLogFilter): Promise<AuditLogPage> {
    const cursor = filter.cursor ? decodeAuditCursor(filter.cursor) : undefined;
    const from = filter.from ? Date.parse(filter.from) : undefined;
    const to = filter.to ? Date.parse(filter.to) : undefined;
    const rows = this.entries
      .filter((e) => !filter.action || e.action === filter.action)
      .filter((e) => !filter.restaurantId || e.restaurantId === filter.restaurantId)
      .filter((e) => !filter.actorUserId || e.actorUserId === filter.actorUserId)
      .filter((e) => from === undefined || Date.parse(e.createdAt) >= from)
      .filter((e) => to === undefined || Date.parse(e.createdAt) <= to)
      .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1))
      .filter((e) => {
        if (!cursor) return true;
        return e.createdAt < cursor.createdAt || (e.createdAt === cursor.createdAt && e.id < cursor.id);
      });
    const page = rows.slice(0, filter.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(copy),
      nextCursor: rows.length > filter.limit && last ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }
}
