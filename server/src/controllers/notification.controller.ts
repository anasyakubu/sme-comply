/**
 * Module purpose: Exposes the current user’s in-app notifications and read/delete operations.
 */
import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/response';

export const notificationController = {
  /**
   * Lists records visible to the requesting user with applicable filters and pagination.
   */
  async list(req: Request, res: Response) {
    const { items, meta } = await notificationService.list(req.user!.id, req.query as Record<string, unknown>);
    return sendSuccess(res, 'Notifications retrieved', items, 200, meta);
  },
  /**
   * Returns the unread count used by the navigation notification badge.
   */
  async unreadCount(req: Request, res: Response) {
    return sendSuccess(res, 'Unread count', { count: await notificationService.unreadCount(req.user!.id) });
  },
  /**
   * Marks one of the user’s notifications as read.
   */
  async markRead(req: Request, res: Response) {
    return sendSuccess(res, 'Marked as read', await notificationService.markRead(req.user!.id, req.params.id));
  },
  /**
   * Marks all current notifications as read.
   */
  async markAllRead(req: Request, res: Response) {
    return sendSuccess(res, 'All notifications marked as read', await notificationService.markAllRead(req.user!.id));
  },
  /**
   * Checks access and removes the requested entry.
   */
  async remove(req: Request, res: Response) {
    await notificationService.remove(req.user!.id, req.params.id);
    return sendSuccess(res, 'Notification deleted', null);
  },
};
