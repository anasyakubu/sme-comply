/**
 * Module purpose: Stores audit records that identify the actor, affected resource, action, and request metadata.
 */
import { Request } from 'express';
import { auditLogRepository } from '../repositories';
import { logger } from '../utils/logger';

export interface AuditContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export const auditContext = (req: Request): AuditContext => ({
  userId: req.user?.id,
  ip: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const auditService = {
  /** Never throws — an audit failure must not break the user's action. */
  async log(
    ctx: AuditContext,
    action: string,
    entity: string,
    entityId?: string,
    extra: { businessId?: string; metadata?: Record<string, unknown> } = {},
  ) {
    try {
      await auditLogRepository.create({
        user: ctx.userId as any,
        action,
        entity,
        entityId,
        businessId: extra.businessId as any,
        metadata: extra.metadata,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
      });
    } catch (err) {
      logger.warn('Audit log write failed', err);
    }
  },
};
