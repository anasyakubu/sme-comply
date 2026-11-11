/**
 * Module purpose: Wraps common Mongoose read/write operations so services reuse consistent filtering, pagination, and update behavior.
 */
import { FilterQuery, Model, PopulateOptions, SortOrder, UpdateQuery } from 'mongoose';

export interface FindOptions {
  sort?: Record<string, SortOrder>;
  skip?: number;
  limit?: number;
  populate?: string | PopulateOptions | Array<string | PopulateOptions>;
  select?: string;
}

/**
 * Thin data-access layer over a Mongoose model. Services depend on repositories
 * rather than models, keeping query details in one place.
 */
export class BaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  /**
   * Looks up one record by MongoDB ID with optional projection and populated references.
   */
  findById(id: string, options: Pick<FindOptions, 'populate' | 'select'> = {}) {
    let q = this.model.findById(id);
    if (options.select) q = q.select(options.select);
    if (options.populate) q = q.populate(options.populate as any);
    return q.exec();
  }

  /**
   * Finds the first matching record with optional projection and reference population.
   */
  findOne(filter: FilterQuery<T>, options: Pick<FindOptions, 'populate' | 'select'> = {}) {
    let q = this.model.findOne(filter);
    if (options.select) q = q.select(options.select);
    if (options.populate) q = q.populate(options.populate as any);
    return q.exec();
  }

  /**
   * Applies filtering, sorting, pagination, field selection, and relationship population.
   */
  find(filter: FilterQuery<T>, options: FindOptions = {}) {
    let q = this.model.find(filter);
    if (options.sort) q = q.sort(options.sort);
    if (options.skip) q = q.skip(options.skip);
    if (options.limit) q = q.limit(options.limit);
    if (options.select) q = q.select(options.select);
    if (options.populate) q = q.populate(options.populate as any);
    return q.exec();
  }

  /**
   * Fetches the requested page and matching record count together for pagination metadata.
   */
  // Items and count use the same filter so the frontend receives accurate pagination metadata.
  async paginate(filter: FilterQuery<T>, options: FindOptions & { skip: number; limit: number }) {
    const [items, total] = await Promise.all([this.find(filter, options), this.model.countDocuments(filter)]);
    return { items, total };
  }

  /**
   * Counts records matching the service’s filter.
   */
  count(filter: FilterQuery<T>) {
    return this.model.countDocuments(filter).exec();
  }

  /**
   * Inserts a validated record through its model.
   */
  create(data: Partial<T> | Record<string, unknown>) {
    return this.model.create(data);
  }

  /**
   * Updates one record while running model validators and returning the new value.
   */
  updateById(id: string, update: UpdateQuery<T>) {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
  }

  /**
   * Updates all records matching a service-defined filter.
   */
  updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>) {
    return this.model.updateMany(filter, update).exec();
  }

  /**
   * Runs independent bulk operations; one failed item does not block unrelated operations.
   */
  bulkWrite(ops: any[]) {
    return this.model.bulkWrite(ops, { ordered: false });
  }

  /**
   * Deletes all records matching the supplied filter.
   */
  deleteMany(filter: FilterQuery<T>) {
    return this.model.deleteMany(filter).exec();
  }

  /**
   * Deletes a single record by its ID.
   */
  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).exec();
  }

  aggregate<R = any>(pipeline: any[]) {
    return this.model.aggregate<R>(pipeline).exec();
  }
}
