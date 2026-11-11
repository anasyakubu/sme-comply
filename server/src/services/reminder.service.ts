/**
 * Module purpose: Sends scheduled automatic reminders based on each business’s preferences. Notification keys prevent sending the same reminder window twice.
 */
import { env } from '../config/env';
import { reminderKeyFor, reminderKind } from '../engine';
import {
  businessRepository,
  memberRepository,
  notificationRepository,
  reminderSettingRepository,
  taskRepository,
  userRepository,
} from '../repositories';
import { addDaysUTC, diffInDays, formatDate, todayInTimezone } from '../utils/dates';
import { emailTemplates } from '../utils/emailTemplates';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { DEFAULT_REMINDER_OFFSETS } from '../config/constants';
import { ReminderSettingModel } from '../models';

export interface ReminderRunResult {
  tasksChecked: number;
  notificationsCreated: number;
  emailsSent: number;
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const reminderService = {
  /**
   * Loads a business’s automatic reminder preferences, creating default offsets when no record exists.
   */
  async getSettings(businessId: string) {
    const existing = await reminderSettingRepository.findOne({ businessId });
    if (existing) return existing;
    return reminderSettingRepository.create({ businessId: businessId as any, daysBefore: DEFAULT_REMINDER_OFFSETS });
  },

  async updateSettings(
    businessId: string,
    data: { daysBefore?: number[]; remindWhenOverdue?: boolean; emailEnabled?: boolean; inAppEnabled?: boolean },
    userId: string,
  ) {
    const settings = await this.getSettings(businessId);
    if (data.daysBefore) settings.daysBefore = Array.from(new Set(data.daysBefore)).sort((a, b) => b - a);
    if (data.remindWhenOverdue !== undefined) settings.remindWhenOverdue = data.remindWhenOverdue;
    if (data.emailEnabled !== undefined) settings.emailEnabled = data.emailEnabled;
    if (data.inAppEnabled !== undefined) settings.inAppEnabled = data.inAppEnabled;
    settings.updatedBy = userId as any;
    await settings.save();
    return settings;
  },

  /**
   * Finds open tasks inside reminder windows and notifies each active member once
   * per reminder key. Safe to run repeatedly: duplicates are rejected by a unique index.
   */
  async run(today: Date = todayInTimezone(env.APP_TIMEZONE)): Promise<ReminderRunResult> {
    const result: ReminderRunResult = { tasksChecked: 0, notificationsCreated: 0, emailsSent: 0 };
    const maxWindow = 60;
    const tasks = await taskRepository.find({
      status: { $in: ['UPCOMING', 'PENDING', 'IN_PROGRESS', 'OVERDUE'] },
      dueDate: { $lte: addDaysUTC(today, maxWindow), $gte: addDaysUTC(today, -45) },
    });
    result.tasksChecked = tasks.length;

    // Reuse business settings and membership lookups across the day’s many tasks.
    const settingsCache = new Map<string, InstanceType<typeof ReminderSettingModel>>();
    const businessCache = new Map<string, string>();
    const membersCache = new Map<string, string[]>();

    for (const task of tasks) {
      const businessId = String(task.businessId);
      if (!settingsCache.has(businessId)) settingsCache.set(businessId, await this.getSettings(businessId));
      const settings = settingsCache.get(businessId)!;
      if (!settings.inAppEnabled && !settings.emailEnabled) continue;

      // Only configured reminder windows produce a key; the database uses it to reject repeats.
      const key = reminderKeyFor(task.dueDate, today, settings.daysBefore, settings.remindWhenOverdue);
      if (!key) continue;

      if (!businessCache.has(businessId)) {
        const b = await businessRepository.findById(businessId, { select: 'businessName businessStatus' });
        businessCache.set(businessId, b && b.businessStatus !== 'CLOSED' ? b.businessName : '');
      }
      const businessName = businessCache.get(businessId)!;
      if (!businessName) continue;

      if (!membersCache.has(businessId)) {
        const members = await memberRepository.find({ business: businessId, status: 'ACTIVE', user: { $ne: null } });
        membersCache.set(businessId, members.map((m) => String(m.user)));
      }

      const kind = reminderKind(key);
      const days = diffInDays(task.dueDate, today);
      const due = formatDate(task.dueDate);
      const title =
        kind === 'DUE_TODAY' ? `${task.title} is due today` : kind === 'OVERDUE' ? `${task.title} is overdue` : `${task.title} is due in ${days} day${days === 1 ? '' : 's'}`;
      const message =
        kind === 'OVERDUE'
          ? `${businessName}: this was due on ${due} (${-days} day${days === -1 ? '' : 's'} ago).`
          : `${businessName}: due on ${due} (${task.periodLabel ?? task.period}).`;

      for (const userId of membersCache.get(businessId)!) {
        const notification = await notificationService.create({
          userId,
          businessId,
          type: kind,
          title,
          message,
          relatedTaskId: String(task._id),
          reminderKey: key,
        });
        // Notification creation may return null for a repeat reminder; no email is sent in that case.
        if (!notification) continue; // already reminded for this window
        result.notificationsCreated++;

        if (settings.emailEnabled) {
          const user = await userRepository.findById(userId, { select: 'firstName email isActive' });
          if (!user?.isActive) continue;
          const payload = { name: user.firstName, business: businessName, task: task.title, taskId: String(task._id) };
          const content =
            kind === 'DUE_TODAY'
              ? emailTemplates.dueToday(payload)
              : kind === 'OVERDUE'
                ? emailTemplates.overdue({ ...payload, dueDate: due, daysOverdue: -days })
                : emailTemplates.reminder({ ...payload, dueDate: due, daysLeft: days });
          if (await emailService.send(user.email, content)) {
            result.emailsSent++;
            await notificationRepository.updateById(String(notification._id), { emailSent: true });
          }
        }
        if (!settings.inAppEnabled) {
          // Email-only preference: the record stays for deduplication but starts as read.
          await notificationRepository.updateById(String(notification._id), { read: true, readAt: new Date() });
        }
      }
    }
    logger.info(`Reminder run: ${JSON.stringify(result)}`);
    return result;
  },
};
