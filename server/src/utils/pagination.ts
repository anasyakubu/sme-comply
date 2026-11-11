/**
 * Module purpose: Validates pagination and sort inputs, escapes search strings, and creates API paging metadata.
 */
import { SortOrder } from 'mongoose';

export interface ListQuery {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, SortOrder>;
  search?: string;
}

/**
 * Parses ?page, ?limit, ?sort (e.g. "-dueDate" or "name") and ?search.
 * Sort fields are restricted to an allow-list to avoid arbitrary field access.
 */
export function parseListQuery(
  query: Record<string, unknown>,
  allowedSort: string[],
  defaultSort = '-createdAt',
): ListQuery {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
  const requested = typeof query.sort === 'string' && query.sort ? query.sort : defaultSort;
  const valid = allowedSort.includes(requested.replace(/^-/, '')) ? requested : defaultSort;
  const sortField = valid.replace(/^-/, '');
  const direction: SortOrder = valid.startsWith('-') ? -1 : 1;
  const search = typeof query.search === 'string' && query.search.trim() ? query.search.trim() : undefined;
  return { page, limit, skip: (page - 1) * limit, sort: { [sortField]: direction }, search };
}

/**
 * Treats user search text literally instead of allowing special regex operators.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds pagination metadata for the frontend.
 */
export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
