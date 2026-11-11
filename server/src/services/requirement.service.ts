/**
 * Module purpose: Validates and manages regulatory rules and requirements used by the compliance planning engine.
 */
import { Types } from 'mongoose';
import { businessFacts, evaluateRules, validateDueRule, validateRuleGroup } from '../engine';
import { agencyRepository, businessRepository, requirementRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { AuditContext, auditService } from './audit.service';
import { taskGenerationService } from './taskGeneration.service';
import { logger } from '../utils/logger';

/**
 * Rejects invalid applicability and due-date rule definitions before requirements are stored.
 */
function assertRules(data: Record<string, any>) {
  if (data.dueRule !== undefined) {
    const e = validateDueRule(data.dueRule);
    if (e) throw ApiError.badRequest('Validation failed', [{ path: 'dueRule', message: e }]);
  }
  if (data.applicabilityRules !== undefined) {
    const e = validateRuleGroup(data.applicabilityRules);
    if (e) throw ApiError.badRequest('Validation failed', [{ path: 'applicabilityRules', message: e }]);
  }
  if (data.frequency === 'CUSTOM' && !data.customIntervalMonths) {
    throw ApiError.badRequest('Validation failed', [{ path: 'customIntervalMonths', message: 'Custom frequency needs an interval in months' }]);
  }
}

/** Regenerates tasks everywhere in the background after a rule change. */
function regenerateInBackground() {
  taskGenerationService.generateForAll().catch((err) => logger.error('Background regeneration failed', err));
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const requirementService = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(query: Record<string, unknown>) {
    const q = parseListQuery(query, ['name', 'code', 'category', 'frequency', 'createdAt'], 'name');
    const filter: Record<string, any> = {};
    if (query.active === 'true') filter.active = true;
    if (query.active === 'false') filter.active = false;
    if (typeof query.category === 'string' && query.category) filter.category = query.category;
    if (typeof query.frequency === 'string' && query.frequency) filter.frequency = query.frequency;
    if (typeof query.agencyId === 'string' && Types.ObjectId.isValid(query.agencyId)) filter.agencyId = query.agencyId;
    if (q.search) {
      const rx = { $regex: escapeRegex(q.search), $options: 'i' };
      filter.$or = [{ name: rx }, { code: rx }, { description: rx }];
    }
    const { items, total } = await requirementRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: { path: 'agencyId', select: 'name acronym' },
    });
    return { items, meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(id: string) {
    const r = await requirementRepository.findById(id, { populate: { path: 'agencyId', select: 'name acronym website' } });
    if (!r) throw ApiError.notFound('Requirement not found');
    return r;
  },

  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(data: Record<string, any>, ctx: AuditContext) {
    assertRules(data);
    if (!(await agencyRepository.findById(data.agencyId))) throw ApiError.badRequest('Agency not found');
    const r = await requirementRepository.create({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId });
    await auditService.log(ctx, 'REQUIREMENT_CREATED', 'RegulatoryRequirement', String(r._id), { metadata: { code: r.code } });
    if (r.active) regenerateInBackground();
    return r;
  },

  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(id: string, data: Record<string, any>, ctx: AuditContext) {
    const existing = await requirementRepository.findById(id);
    if (!existing) throw ApiError.notFound('Requirement not found');
    assertRules({ frequency: existing.frequency, customIntervalMonths: existing.customIntervalMonths, ...data });
    const r = await requirementRepository.updateById(id, { ...data, updatedBy: ctx.userId });
    await auditService.log(ctx, data.active === false ? 'REQUIREMENT_DEACTIVATED' : 'REQUIREMENT_UPDATED', 'RegulatoryRequirement', id, {
      metadata: { fields: Object.keys(data) },
    });
    const affectsTasks = ['active', 'applicabilityRules', 'dueRule', 'frequency', 'effectiveFrom', 'effectiveUntil', 'customIntervalMonths'].some((k) => k in data);
    if (affectsTasks) regenerateInBackground();
    return r;
  },

  /** Shows which businesses a set of rules would apply to, before saving. */
  async preview(applicabilityRules: unknown) {
    const e = validateRuleGroup(applicabilityRules);
    if (e) throw ApiError.badRequest('Validation failed', [{ path: 'applicabilityRules', message: e }]);
    const businesses = await businessRepository.find({ businessStatus: { $ne: 'CLOSED' } }, { limit: 2000 });
    const matches = businesses
      .map((b) => ({ b, r: evaluateRules(applicabilityRules as any, businessFacts(b.toObject())) }))
      .filter((x) => x.r.applies);
    return {
      totalBusinesses: businesses.length,
      matching: matches.length,
      sample: matches.slice(0, 20).map((x) => ({ _id: x.b._id, businessName: x.b.businessName, state: x.b.state, businessType: x.b.businessType })),
    };
  },
};
