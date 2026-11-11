/**
 * Module purpose: Loads initial/sample records into MongoDB. This utility is for setup, not for servicing normal API requests.
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { DEFAULT_BUSINESS_TYPES } from '../config/constants';
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
import { authService } from '../services/auth.service';
import { reminderService } from '../services/reminder.service';
import { taskGenerationService } from '../services/taskGeneration.service';
import { todayInTimezone } from '../utils/dates';
import { agencies, industries, requirements } from './data';

export const DEMO_PASSWORD = 'Demo@12345';
export const ADMIN_PASSWORD = 'Admin@12345';

export async function seed({ quiet = false } = {}) {
  const log = (...a: unknown[]) => !quiet && console.log(...a);
  const today = todayInTimezone(env.APP_TIMEZONE);

  log('Clearing collections…');
  await Promise.all(
    [
      AuditLogModel, BusinessMemberModel, BusinessModel, ComplianceTaskModel, DocumentModel, EmailLogModel, FilingRecordModel,
      LookupValueModel, NotificationModel, RefreshTokenModel, RegulatoryAgencyModel, RegulatoryRequirementModel,
      ReminderSettingModel, UserModel,
    ].map((m) => (m as mongoose.Model<any>).deleteMany({})),
  );
  await Promise.all([ComplianceTaskModel.syncIndexes(), NotificationModel.syncIndexes(), BusinessMemberModel.syncIndexes(), EmailLogModel.syncIndexes()]);

  log('Creating users…');
  const [superAdmin, admin, owner, accountant, officer] = await UserModel.create([
    { firstName: 'Super', lastName: 'Admin', email: 'superadmin@smecomply.ng', role: 'SUPER_ADMIN', passwordHash: await authService.hashPassword(ADMIN_PASSWORD), emailVerified: true },
    { firstName: 'Platform', lastName: 'Admin', email: 'admin@smecomply.ng', role: 'ADMIN', passwordHash: await authService.hashPassword(ADMIN_PASSWORD), emailVerified: true },
    { firstName: 'Aisha', lastName: 'Bello', email: 'owner@demo.smecomply.ng', phone: '08030000001', role: 'OWNER', passwordHash: await authService.hashPassword(DEMO_PASSWORD), emailVerified: true },
    { firstName: 'Chinedu', lastName: 'Okafor', email: 'accountant@demo.smecomply.ng', phone: '08030000002', role: 'ACCOUNTANT', passwordHash: await authService.hashPassword(DEMO_PASSWORD), emailVerified: true },
    { firstName: 'Funmi', lastName: 'Adeyemi', email: 'officer@demo.smecomply.ng', phone: '08030000003', role: 'COMPLIANCE_OFFICER', passwordHash: await authService.hashPassword(DEMO_PASSWORD), emailVerified: true },
  ]);

  log('Creating lookups…');
  await LookupValueModel.insertMany([
    ...DEFAULT_BUSINESS_TYPES.map((value, i) => ({ kind: 'BUSINESS_TYPE', value, sortOrder: i })),
    ...industries.map((value, i) => ({ kind: 'INDUSTRY', value, sortOrder: i })),
  ]);

  log('Creating sample agencies and requirements…');
  const agencyDocs = await RegulatoryAgencyModel.insertMany(
    agencies.map((a) => ({ ...a, isSampleData: true, active: true, createdBy: superAdmin._id })),
  );
  const agencyByAcronym = new Map(agencyDocs.map((a) => [a.acronym, a._id]));
  await RegulatoryRequirementModel.insertMany(
    requirements.map(({ agency, ...r }) => ({
      ...r,
      agencyId: agencyByAcronym.get(agency),
      guidanceUrl: r.officialWebsite,
      active: true,
      isSampleData: true,
      createdBy: superAdmin._id,
    })),
  );

  log('Creating demo businesses…');
  const arewa = await BusinessModel.create({
    businessName: 'Arewa Tech Solutions',
    legalName: 'Arewa Tech Solutions Limited',
    registrationNumber: 'RC 1234567 (demo)',
    taxIdentificationNumber: '12345678-0001 (demo)',
    businessType: 'Limited Liability Company',
    industry: 'Technology',
    state: 'Kano',
    city: 'Kano',
    address: '12 Zoo Road, Kano (demo address)',
    phone: '08030000010',
    email: 'info@arewatech.demo',
    dateOfIncorporation: new Date(Date.UTC(2021, 2, 15)),
    employeeCount: 15,
    annualTurnover: 85_000_000,
    flags: { cacRegistered: true, taxRegistered: true, vatRegistered: true, pensionRegistered: true },
    owner: owner._id,
    isDemo: true,
  });
  const nkechi = await BusinessModel.create({
    businessName: "Mama Nkechi's Kitchen",
    legalName: "Mama Nkechi's Kitchen (Business Name)",
    registrationNumber: 'BN 7654321 (demo)',
    businessType: 'Sole Proprietorship',
    industry: 'Food & Beverage',
    state: 'Lagos',
    city: 'Yaba',
    address: '5 Herbert Macaulay Way, Yaba (demo address)',
    dateOfIncorporation: new Date(Date.UTC(2023, 7, 1)),
    employeeCount: 4,
    annualTurnover: 18_000_000,
    flags: { cacRegistered: true, taxRegistered: false, regulatedProducts: true },
    owner: owner._id,
    isDemo: true,
  });

  await BusinessMemberModel.insertMany([
    { user: owner._id, business: arewa._id, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
    { user: accountant._id, business: arewa._id, role: 'ACCOUNTANT', status: 'ACTIVE', invitedBy: owner._id, invitedAt: new Date(), joinedAt: new Date() },
    { user: officer._id, business: arewa._id, role: 'COMPLIANCE_OFFICER', status: 'ACTIVE', invitedBy: owner._id, invitedAt: new Date(), joinedAt: new Date() },
    { user: owner._id, business: nkechi._id, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
    { user: accountant._id, business: nkechi._id, role: 'ACCOUNTANT', status: 'ACTIVE', invitedBy: owner._id, invitedAt: new Date(), joinedAt: new Date() },
  ]);
  await ReminderSettingModel.insertMany([{ businessId: arewa._id }, { businessId: nkechi._id }]);

  log('Generating compliance tasks with the rules engine…');
  for (const b of [arewa, nkechi]) {
    const r = await taskGenerationService.generateForBusiness(String(b._id), today, { lookbackMonths: 6 });
    log(`  ${b.businessName}: ${r.applicableRequirements} requirements apply, ${r.created} tasks created`);
  }
  await taskGenerationService.refreshStatuses(today);

  log('Recording sample filings…');
  // Complete most past-due tasks, leaving the two most recent overdue ones open so the demo shows both states.
  const pastDue = await ComplianceTaskModel.find({ status: 'OVERDUE' }).sort({ dueDate: 1 });
  const leaveOpen = new Set(pastDue.slice(-2).map((t) => String(t._id)));
  for (const task of pastDue) {
    if (leaveOpen.has(String(task._id))) continue;
    const filedOn = new Date(task.dueDate.getTime() - 2 * 86_400_000);
    await FilingRecordModel.create({
      taskId: task._id,
      businessId: task.businessId,
      filedBy: String(task.businessId) === String(arewa._id) ? accountant._id : owner._id,
      filingDate: filedOn,
      referenceNumber: `DEMO-${task.period}-${String(task._id).slice(-4).toUpperCase()}`,
      status: 'ACCEPTED',
      submittedTo: 'Agency portal (recorded manually)',
      notes: 'Sample filing record created by the seed script.',
    });
    task.status = 'COMPLETED';
    task.priority = 'LOW';
    task.completedAt = filedOn;
    task.completedBy = accountant._id;
    await task.save();
  }
  const inProgress = await ComplianceTaskModel.findOne({ businessId: arewa._id, status: 'PENDING' }).sort({ dueDate: 1 });
  if (inProgress) {
    inProgress.status = 'IN_PROGRESS';
    inProgress.notes.push({ body: 'Gathering the schedule from payroll. (demo note)', author: officer._id, createdAt: new Date() } as any);
    await inProgress.save();
  }

  log('Sending reminders (in-app; emails go to the console unless SMTP is configured)…');
  const reminders = await reminderService.run(today);
  await NotificationModel.create({
    userId: owner._id,
    type: 'SYSTEM',
    title: 'Welcome to the SME Comply demo',
    message: 'Regulatory data in this demo is sample data. Verify requirements with the relevant authority.',
  });

  const counts = {
    users: await UserModel.countDocuments(),
    agencies: agencyDocs.length,
    requirements: requirements.length,
    tasks: await ComplianceTaskModel.countDocuments(),
    filings: await FilingRecordModel.countDocuments(),
    notifications: await NotificationModel.countDocuments(),
    reminders,
  };
  log('\nSeed complete', counts);
  log(`
Demo accounts
  Super admin        superadmin@smecomply.ng       ${ADMIN_PASSWORD}
  Admin              admin@smecomply.ng            ${ADMIN_PASSWORD}
  Business owner     owner@demo.smecomply.ng       ${DEMO_PASSWORD}
  Accountant         accountant@demo.smecomply.ng  ${DEMO_PASSWORD}
  Compliance officer officer@demo.smecomply.ng     ${DEMO_PASSWORD}
`);
  return counts;
}

if (require.main === module) {
  (async () => {
    if (env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
      console.error('Refusing to seed in production (it deletes all data). Set SEED_FORCE=true to override.');
      process.exit(1);
    }
    await connectDatabase();
    await seed();
    await disconnectDatabase();
  })().catch(async (err) => {
    console.error(err);
    await disconnectDatabase();
    process.exit(1);
  });
}
