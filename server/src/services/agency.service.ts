/**
 * Module purpose: Implements regulatory agency CRUD operations, searches, and change auditing.
 */
import { agencyRepository, requirementRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { AuditContext, auditService } from './audit.service';

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const agencyService = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(query: Record<string, unknown>) {
    const q = parseListQuery(query, ['name', 'acronym', 'createdAt'], 'acronym');
    const filter: Record<string, any> = {};
    if (query.active === 'true') filter.active = true;
    if (query.active === 'false') filter.active = false;
    if (typeof query.level === 'string' && query.level) filter.level = query.level;
    if (q.search) {
      const rx = { $regex: escapeRegex(q.search), $options: 'i' };
      filter.$or = [{ name: rx }, { acronym: rx }];
    }
    const { items, total } = await agencyRepository.paginate(filter, { sort: q.sort, skip: q.skip, limit: q.limit });
    const counts = await requirementRepository.aggregate([{ $group: { _id: '$agencyId', count: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.count]));
    return {
      items: items.map((a) => ({ ...a.toJSON(), requirementCount: countMap.get(String(a._id)) ?? 0 })),
      meta: pageMeta(q.page, q.limit, total),
    };
  },

  /**
   * Loads the requested record and returns it or reports that it cannot be found.
   */
  async get(id: string) {
    const agency = await agencyRepository.findById(id);
    if (!agency) throw ApiError.notFound('Agency not found');
    return agency;
  },

  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(data: Record<string, any>, ctx: AuditContext) {
    const agency = await agencyRepository.create({ ...data, createdBy: ctx.userId, updatedBy: ctx.userId });
    await auditService.log(ctx, 'AGENCY_CREATED', 'RegulatoryAgency', String(agency._id), { metadata: { acronym: agency.acronym } });
    return agency;
  },

  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(id: string, data: Record<string, any>, ctx: AuditContext) {
    const agency = await agencyRepository.updateById(id, { ...data, updatedBy: ctx.userId });
    if (!agency) throw ApiError.notFound('Agency not found');
    await auditService.log(ctx, data.active === false ? 'AGENCY_DEACTIVATED' : 'AGENCY_UPDATED', 'RegulatoryAgency', id, {
      metadata: { fields: Object.keys(data) },
    });
    return agency;
  },
};
