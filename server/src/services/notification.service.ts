/**
 * Module purpose: Creates, distributes, and updates user notifications, including those created for compliance tasks.
 */
import { Types } from 'mongoose';
import { memberRepository, notificationRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, pageMeta, parseListQuery } from '../utils/pagination';
import { NOTIFICATION_TYPES } from '../models/Notification';

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NewNotification {
  userId: string;
  businessId?: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedTaskId?: string;
  reminderKey?: string;
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const notificationService = {
  /** Creates a notification. Returns null if a reminder with the same key was already sent. */
  async create(n: NewNotification) {
    try {
      return await notificationRepository.create(n as any);
    } catch (err: any) {
      if (err?.code === 11000) return null;
      throw err;
    }
  },

  /** Notifies every active member of a business, optionally excluding the actor. */
  async notifyBusiness(businessId: string, n: Omit<NewNotification, 'userId' | 'businessId'>, excludeUserId?: string) {
    const members = await memberRepository.find({ business: businessId, status: 'ACTIVE', user: { $ne: null } });
    await Promise.all(
      members
        .filter((m) => String(m.user) !== excludeUserId)
        .map((m) => this.create({ ...n, userId: String(m.user), businessId })),
    );
  },

  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(userId: string, query: Record<string, unknown>) {
    const q = parseListQuery(query, ['createdAt'], '-createdAt');
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.read === 'true') filter.read = true;
    if (query.read === 'false') filter.read = false;
    if (typeof query.type === 'string' && query.type) filter.type = query.type;
    if (typeof query.businessId === 'string' && Types.ObjectId.isValid(query.businessId)) filter.businessId = query.businessId;
    const { items, total } = await notificationRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: [{ path: 'businessId', select: 'businessName' }],
    });
    return { items, meta: pageMeta(q.page, q.limit, total) };
  },

  /**
   * Returns the unread count used by the navigation notification badge.
   */
  unreadCount(userId: string) {
    return notificationRepository.count({ userId, read: false });
  },

  /**
   * Marks one of the user’s notifications as read.
   */
  async markRead(userId: string, id: string) {
    const n = await notificationRepository.findOne({ _id: id, userId });
    if (!n) throw ApiError.notFound('Notification not found');
    if (!n.read) {
      n.read = true;
      n.readAt = new Date();
      await n.save();
    }
    return n;
  },

  /**
   * Marks all current notifications as read.
   */
  async markAllRead(userId: string) {
    const r = await notificationRepository.updateMany({ userId, read: false }, { read: true, readAt: new Date() });
    return { updated: r.modifiedCount };
  },

  /**
   * Checks access and removes the requested entry.
   */
  async remove(userId: string, id: string) {
    const n = await notificationRepository.findOne({ _id: id, userId });
    if (!n) throw ApiError.notFound('Notification not found');
    await n.deleteOne();
  },

  /** Admin view across all users. */
  async adminList(query: Record<string, unknown>) {
    const q = parseListQuery(query, ['createdAt', 'type'], '-createdAt');
    const filter: Record<string, unknown> = {};
    if (typeof query.type === 'string' && query.type) filter.type = query.type;
    if (query.emailSent === 'true') filter.emailSent = true;
    if (q.search) filter.title = { $regex: escapeRegex(q.search), $options: 'i' };
    const { items, total } = await notificationRepository.paginate(filter, {
      sort: q.sort,
      skip: q.skip,
      limit: q.limit,
      populate: [
        { path: 'userId', select: 'firstName lastName email' },
        { path: 'businessId', select: 'businessName' },
      ],
    });
    const byType = await notificationRepository.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    return { items, meta: pageMeta(q.page, q.limit, total), byType };
  },
};
