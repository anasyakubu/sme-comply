/**
 * Module purpose: Returns and maintains configurable lookup options used by frontend forms.
 */
import { DEFAULT_BUSINESS_TYPES, NIGERIAN_STATES, FREQUENCIES, REQUIREMENT_CATEGORIES, DOCUMENT_TYPES } from '../config/constants';
import { RULE_FIELDS, RULE_OPERATORS, supportedDueRuleTypes } from '../engine';
import { lookupRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { AuditContext, auditService } from './audit.service';

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const lookupService = {
  /**
   * Loads selectable reference values used by frontend forms.
   */
  async options() {
    const values = await lookupRepository.find({ active: true }, { sort: { sortOrder: 1, value: 1 } });
    const businessTypes = values.filter((v) => v.kind === 'BUSINESS_TYPE').map((v) => v.value);
    const industries = values.filter((v) => v.kind === 'INDUSTRY').map((v) => v.value);
    return {
      businessTypes: businessTypes.length ? businessTypes : DEFAULT_BUSINESS_TYPES,
      industries,
      states: NIGERIAN_STATES,
      frequencies: FREQUENCIES,
      categories: REQUIREMENT_CATEGORIES,
      documentTypes: DOCUMENT_TYPES,
      ruleFields: RULE_FIELDS,
      ruleOperators: RULE_OPERATORS,
      dueRuleTypes: supportedDueRuleTypes(),
    };
  },

  /**
   * Returns administrator-visible lookup values in stable display order, including inactive values.
   */
  listAll(kind?: string) {
    return lookupRepository.find(kind ? { kind } : {}, { sort: { kind: 1, sortOrder: 1, value: 1 } });
  },

  /**
   * Validates the related records and creates a new persistent entry.
   */
  async create(data: { kind: 'BUSINESS_TYPE' | 'INDUSTRY'; value: string; sortOrder?: number }, ctx: AuditContext) {
    const v = await lookupRepository.create(data);
    await auditService.log(ctx, 'LOOKUP_CREATED', 'LookupValue', String(v._id), { metadata: data });
    return v;
  },

  /**
   * Checks the target entry and persists permitted changes.
   */
  async update(id: string, data: { value?: string; active?: boolean; sortOrder?: number }, ctx: AuditContext) {
    const v = await lookupRepository.updateById(id, data);
    if (!v) throw ApiError.notFound('Value not found');
    await auditService.log(ctx, 'LOOKUP_UPDATED', 'LookupValue', id, { metadata: data });
    return v;
  },
};
