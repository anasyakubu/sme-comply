/**
 * Module purpose: Tests nested business-rule evaluation and invalid applicability rules.
 */
import { businessFacts, evaluateRules, validateRuleGroup } from '../src/engine';

const facts = businessFacts({
  businessType: 'Limited Liability Company',
  state: 'Kano',
  industry: 'Technology',
  employeeCount: 15,
  annualTurnover: 85_000_000,
  businessStatus: 'ACTIVE',
  flags: { vatRegistered: true, pensionRegistered: false },
});

describe('evaluateRules', () => {
  it('applies to everyone when there are no conditions', () => {
    expect(evaluateRules(undefined, facts).applies).toBe(true);
    expect(evaluateRules({ match: 'ALL', conditions: [] }, facts).applies).toBe(true);
  });

  it('matches ALL conditions', () => {
    const r = evaluateRules(
      { match: 'ALL', conditions: [
        { field: 'businessType', operator: 'IN', value: ['Limited Liability Company', 'Public Limited Company'] },
        { field: 'employeeCount', operator: 'GTE', value: 3 },
      ] },
      facts,
    );
    expect(r.applies).toBe(true);
    expect(r.reasons).toHaveLength(2);
  });

  it('fails ALL when one condition fails', () => {
    expect(evaluateRules({ match: 'ALL', conditions: [
      { field: 'state', operator: 'EQ', value: 'Lagos' },
      { field: 'employeeCount', operator: 'GTE', value: 3 },
    ] }, facts).applies).toBe(false);
  });

  it('matches ANY condition', () => {
    expect(evaluateRules({ match: 'ANY', conditions: [
      { field: 'state', operator: 'EQ', value: 'Lagos' },
      { field: 'annualTurnover', operator: 'GTE', value: 50_000_000 },
    ] }, facts).applies).toBe(true);
  });

  it('compares strings case-insensitively', () => {
    expect(evaluateRules({ conditions: [{ field: 'state', operator: 'EQ', value: 'kano' }] }, facts).applies).toBe(true);
  });

  it('reads boolean flags', () => {
    expect(evaluateRules({ conditions: [{ field: 'flags.vatRegistered', operator: 'IS_TRUE' }] }, facts).applies).toBe(true);
    expect(evaluateRules({ conditions: [{ field: 'flags.pensionRegistered', operator: 'IS_TRUE' }] }, facts).applies).toBe(false);
    expect(evaluateRules({ conditions: [{ field: 'flags.importsExports', operator: 'IS_FALSE' }] }, facts).applies).toBe(true);
  });

  it('supports nested groups', () => {
    expect(evaluateRules({ match: 'ALL', conditions: [
      { field: 'industry', operator: 'EQ', value: 'Technology' },
      { match: 'ANY', conditions: [
        { field: 'state', operator: 'IN', value: ['Lagos', 'FCT'] },
        { field: 'employeeCount', operator: 'GT', value: 10 },
      ] },
    ] }, facts).applies).toBe(true);
  });

  it('handles NOT_IN, LT, EXISTS and CONTAINS', () => {
    expect(evaluateRules({ conditions: [{ field: 'state', operator: 'NOT_IN', value: ['Lagos'] }] }, facts).applies).toBe(true);
    expect(evaluateRules({ conditions: [{ field: 'employeeCount', operator: 'LT', value: 10 }] }, facts).applies).toBe(false);
    expect(evaluateRules({ conditions: [{ field: 'industry', operator: 'EXISTS' }] }, facts).applies).toBe(true);
    expect(evaluateRules({ conditions: [{ field: 'businessType', operator: 'CONTAINS', value: 'liability' }] }, facts).applies).toBe(true);
  });
});

describe('validateRuleGroup', () => {
  it('accepts valid rules and rejects bad ones', () => {
    expect(validateRuleGroup({ match: 'ALL', conditions: [{ field: 'state', operator: 'EQ', value: 'Kano' }] })).toBeNull();
    expect(validateRuleGroup({ match: 'SOME', conditions: [] })).toMatch(/match/);
    expect(validateRuleGroup({ conditions: [{ field: 'state', operator: 'LIKE' }] })).toMatch(/operator/);
    expect(validateRuleGroup({ conditions: [{ field: 'state', operator: 'IN', value: 'Kano' }] })).toMatch(/list/);
  });
});
