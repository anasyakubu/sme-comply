/**
 * Module purpose: Evaluates regulatory applicability against business facts using nested ALL/ANY rule groups, and validates rule structure.
 */
/**
 * Data-driven applicability rules.
 *
 * A rule group looks like:
 * { "match": "ALL", "conditions": [
 *     { "field": "businessType", "operator": "IN", "value": ["Limited Liability Company"] },
 *     { "field": "employeeCount", "operator": "GTE", "value": 3 },
 *     { "match": "ANY", "conditions": [ ... nested group ... ] }
 * ] }
 *
 * An empty or missing group means "applies to every business".
 */
export const RULE_OPERATORS = ['EQ', 'NEQ', 'IN', 'NOT_IN', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS', 'IS_TRUE', 'IS_FALSE', 'CONTAINS'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const RULE_FIELDS = [
  { field: 'businessType', label: 'Business type', kind: 'string' },
  { field: 'state', label: 'State', kind: 'string' },
  { field: 'industry', label: 'Industry', kind: 'string' },
  { field: 'employeeCount', label: 'Number of employees', kind: 'number' },
  { field: 'annualTurnover', label: 'Annual turnover (NGN)', kind: 'number' },
  { field: 'businessStatus', label: 'Business status', kind: 'string' },
  { field: 'flags.cacRegistered', label: 'Registered with CAC', kind: 'boolean' },
  { field: 'flags.taxRegistered', label: 'Has a Tax ID', kind: 'boolean' },
  { field: 'flags.vatRegistered', label: 'Registered for VAT', kind: 'boolean' },
  { field: 'flags.pensionRegistered', label: 'Registered for pension', kind: 'boolean' },
  { field: 'flags.regulatedProducts', label: 'Makes or sells regulated products', kind: 'boolean' },
  { field: 'flags.importsExports', label: 'Imports or exports goods', kind: 'boolean' },
] as const;

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
}

export interface RuleGroup {
  match?: 'ALL' | 'ANY';
  conditions?: Array<RuleCondition | RuleGroup>;
}

export interface EvaluationResult {
  applies: boolean;
  reasons: string[];
}

const isGroup = (c: RuleCondition | RuleGroup): c is RuleGroup => Array.isArray((c as RuleGroup).conditions);

/**
 * Looks up a dotted field path in business facts so rules can refer to nested flags.
 */
function resolve(facts: Record<string, any>, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), facts);
}

const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

/**
 * Compares a business fact with one requirement condition using its specified operator.
 */
function evaluateCondition(c: RuleCondition, facts: Record<string, any>): boolean {
  const actual = resolve(facts, c.field);
  const expected = c.value;
  switch (c.operator) {
    case 'EQ':
      return norm(actual) === norm(expected);
    case 'NEQ':
      return norm(actual) !== norm(expected);
    case 'IN':
      return Array.isArray(expected) && expected.map(norm).includes(norm(actual));
    case 'NOT_IN':
      return Array.isArray(expected) && !expected.map(norm).includes(norm(actual));
    case 'GT':
      return typeof actual === 'number' && actual > Number(expected);
    case 'GTE':
      return typeof actual === 'number' && actual >= Number(expected);
    case 'LT':
      return typeof actual === 'number' && actual < Number(expected);
    case 'LTE':
      return typeof actual === 'number' && actual <= Number(expected);
    case 'EXISTS':
      return actual !== undefined && actual !== null && actual !== '';
    case 'IS_TRUE':
      return actual === true;
    case 'IS_FALSE':
      return actual !== true;
    case 'CONTAINS':
      return typeof actual === 'string' && typeof expected === 'string' && norm(actual)!.toString().includes(norm(expected)!.toString());
    default:
      return false;
  }
}

function describe(c: RuleCondition): string {
  const v = Array.isArray(c.value) ? c.value.join(', ') : c.value;
  return `${c.field} ${c.operator}${v === undefined ? '' : ` ${v}`}`;
}

/**
 * Recursively combines rule results: ALL requires every condition; ANY requires one. Empty groups apply to all businesses.
 * @param group - The nested rule group saved with a requirement.
 * @param facts - The business attributes to test.
 * @returns Whether the rule applies and the matching explanations.
 */
export function evaluateRules(group: RuleGroup | null | undefined, facts: Record<string, any>): EvaluationResult {
  if (!group || !group.conditions || group.conditions.length === 0) {
    return { applies: true, reasons: ['Applies to all businesses'] };
  }
  const match = group.match ?? 'ALL';
  const reasons: string[] = [];
  const results = group.conditions.map((c) => {
    if (isGroup(c)) {
      const r = evaluateRules(c, facts);
      if (r.applies) reasons.push(...r.reasons);
      return r.applies;
    }
    const ok = evaluateCondition(c, facts);
    if (ok) reasons.push(describe(c));
    return ok;
  });
  // A rule tree combines nested groups recursively. Only matched reasons are shown to the caller.
  const applies = match === 'ALL' ? results.every(Boolean) : results.some(Boolean);
  return { applies, reasons: applies ? reasons : [] };
}

/** Flattens a business document into the facts the rules can reference. */
export function businessFacts(business: Record<string, any>): Record<string, any> {
  return {
    businessType: business.businessType,
    state: business.state,
    industry: business.industry,
    employeeCount: Number(business.employeeCount ?? 0),
    annualTurnover: Number(business.annualTurnover ?? 0),
    businessStatus: business.businessStatus,
    flags: { ...(business.flags ?? {}) },
  };
}

/**
 * Rejects malformed or excessively nested rules before they can be persisted.
 */
export function validateRuleGroup(group: any, depth = 0): string | null {
  if (group == null) return null;
  if (depth > 4) return 'Rules can be nested at most 4 levels deep';
  if (typeof group !== 'object') return 'Applicability rules must be an object';
  if (group.match && !['ALL', 'ANY'].includes(group.match)) return 'match must be ALL or ANY';
  if (group.conditions === undefined) return null;
  if (!Array.isArray(group.conditions)) return 'conditions must be an array';
  for (const c of group.conditions) {
    if (Array.isArray(c?.conditions)) {
      const e = validateRuleGroup(c, depth + 1);
      if (e) return e;
      continue;
    }
    if (typeof c?.field !== 'string' || !c.field) return 'Each condition needs a field';
    if (!RULE_OPERATORS.includes(c.operator)) return `Unknown operator: ${c?.operator}`;
    if (['IN', 'NOT_IN'].includes(c.operator) && !Array.isArray(c.value)) return `${c.operator} needs a list of values`;
  }
  return null;
}
