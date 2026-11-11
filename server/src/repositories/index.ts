/**
 * Module purpose: Instantiates reusable repositories for each Mongoose model, keeping services independent of direct model construction.
 */
import { BaseRepository } from './base.repository';
import {
  AuditLogModel,
  BusinessMemberModel,
  BusinessModel,
  ComplianceTaskModel,
  DocumentModel,
  EmailLogModel,
  FilingRecordModel,
  LookupValueModel,
  NotificationModel,
  RefreshTokenModel,
  RegulatoryAgencyModel,
  RegulatoryRequirementModel,
  ReminderSettingModel,
  UserModel,
} from '../models';

export const userRepository = new BaseRepository(UserModel);
export const refreshTokenRepository = new BaseRepository(RefreshTokenModel);
export const businessRepository = new BaseRepository(BusinessModel);
export const memberRepository = new BaseRepository(BusinessMemberModel);
export const agencyRepository = new BaseRepository(RegulatoryAgencyModel);
export const requirementRepository = new BaseRepository(RegulatoryRequirementModel);
export const taskRepository = new BaseRepository(ComplianceTaskModel);
export const filingRepository = new BaseRepository(FilingRecordModel);
export const documentRepository = new BaseRepository(DocumentModel);
export const notificationRepository = new BaseRepository(NotificationModel);
export const reminderSettingRepository = new BaseRepository(ReminderSettingModel);
export const auditLogRepository = new BaseRepository(AuditLogModel);
export const lookupRepository = new BaseRepository(LookupValueModel);
export const emailLogRepository = new BaseRepository(EmailLogModel);
