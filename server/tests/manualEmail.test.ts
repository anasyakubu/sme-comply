/**
 * Module purpose: Covers Super Admin manual emails and reminders, SMTP outcomes, idempotency, history, validation, and unauthorized access.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { seed, ADMIN_PASSWORD, DEMO_PASSWORD } from '../src/seed/seed';
import { emailService } from '../src/services/email.service';
import { BusinessModel, EmailLogModel, ComplianceTaskModel, UserModel, ReminderSettingModel } from '../src/models';
import { startDb, clearDb, stopDb } from './helpers';

const app = createApp();
const base = '/api/v1';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const uuid = () => randomUUID();

async function login(email: string, password: string) {
  const res = await request(app).post(`${base}/auth/login`).send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

async function setup() {
  const superToken = await login('superadmin@smecomply.ng', ADMIN_PASSWORD);
  const adminToken = await login('admin@smecomply.ng', ADMIN_PASSWORD);
  const normalToken = await login('owner@demo.smecomply.ng', DEMO_PASSWORD);
  const recipient = (await UserModel.findOne({ email: 'owner@demo.smecomply.ng' }))!;
  const business = (await BusinessModel.findOne({ owner: recipient._id }))!;
  const task = (await ComplianceTaskModel.findOne({ businessId: business._id,
    status: { $nin: ['COMPLETED', 'NOT_APPLICABLE'] } }))!;
  expect(task).toBeTruthy();
  return { superToken, adminToken, normalToken, recipient, task, business };
}

beforeAll(async () => { await startDb(); });
afterAll(async () => { await stopDb(); });
beforeEach(async () => { await clearDb(); await seed({ quiet: true }); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Super Admin manual email and reminders', () => {
  it('sends an ordinary email without a reminder, and records the actor and recipient', async () => {
    const { superToken, recipient } = await setup();
    const smtp = vi.spyOn(emailService, 'sendDetailed').mockResolvedValue({ sent: true });
    const res = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL',
      subject: 'Account information', message: 'Hello from the team.', format: 'TEXT',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.task).toBeUndefined();
    expect(smtp).toHaveBeenCalledOnce();
    expect(smtp.mock.calls[0][0]).toBe(recipient.email);
    expect(smtp.mock.calls[0][2]).toBe(true);
    const history = await request(app).get(`${base}/admin/emails`).set(auth(superToken));
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].recipientEmail).toBe(recipient.email);
    expect(history.body.data[0].initiatedBy.email).toBe('superadmin@smecomply.ng');
    const detail = await request(app).get(`${base}/admin/emails/${res.body.data._id}`).set(auth(superToken));
    expect(detail.body.data.message).toBe('Hello from the team.');
    expect(await EmailLogModel.countDocuments({ type: 'MANUAL_REMINDER' })).toBe(0);
  });

  it('sends a manual reminder even with automatic reminders disabled, including obligation details', async () => {
    const { superToken, recipient, task, business } = await setup();
    await ReminderSettingModel.updateOne({ businessId: business._id }, { $set: { emailEnabled: false, inAppEnabled: false } });
    const smtp = vi.spyOn(emailService, 'sendDetailed').mockResolvedValue({ sent: true });
    const list = await request(app).get(`${base}/admin/emails/obligations`)
      .query({ recipientId: String(recipient._id) }).set(auth(superToken));
    expect(list.status).toBe(200);
    expect(list.body.data.some((row: { _id: string }) => row._id === String(task._id))).toBe(true);
    const res = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'MANUAL_REMINDER',
      taskId: String(task._id), subject: 'Action required', message: 'Please complete this promptly.', format: 'TEXT',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('MANUAL_REMINDER');
    expect(res.body.data.obligationName).toBe(task.title);
    expect(res.body.data.dueDate).toBeTruthy();
    expect(smtp.mock.calls[0][1].text).toContain(task.title);
    expect(smtp.mock.calls[0][1].text).toContain(business.businessName);
    expect(smtp.mock.calls[0][1].text).toContain('Due date:');
    expect(smtp.mock.calls[0][1].html).toContain('Compliance obligation:');
  });

  it('rejects malformed or missing recipient addresses and missing required fields', async () => {
    const { superToken, recipient } = await setup();
    const smtp = vi.spyOn(emailService, 'sendDetailed');
    const invalidId = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: 'invalid', requestId: uuid(), type: 'GENERAL', subject: 'Subject', message: 'Body',
    });
    expect(invalidId.status).toBe(400);
    await UserModel.updateOne({ _id: recipient._id }, { $set: { email: 'not-an-email' } });
    const invalidEmail = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL', subject: 'Subject', message: 'Body',
    });
    expect(invalidEmail.status).toBe(400);
    const empty = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL', subject: '', message: '',
    });
    expect(empty.status).toBe(400);
    expect(smtp).not.toHaveBeenCalled();
    expect(await EmailLogModel.countDocuments()).toBe(0);
  });

  it('denies API access to ADMIN and ordinary users, including history and obligation lists', async () => {
    const { superToken, adminToken, normalToken, recipient } = await setup();
    for (const token of [adminToken, normalToken]) {
      expect((await request(app).get(`${base}/admin/emails`).set(auth(token))).status).toBe(403);
      expect((await request(app).get(`${base}/admin/emails/obligations`)
        .query({ recipientId: String(recipient._id) }).set(auth(token))).status).toBe(403);
      expect((await request(app).post(`${base}/admin/emails`).set(auth(token)).send({
        recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL', subject: 'Test', message: 'Body',
      })).status).toBe(403);
    }
    expect((await request(app).get(`${base}/admin/emails`).set(auth(superToken))).status).toBe(200);
    expect(await EmailLogModel.countDocuments()).toBe(0);
  });

  it('stores failed SMTP attempts and prevents retrying the same request ID', async () => {
    const { superToken, recipient } = await setup();
    const smtp = vi.spyOn(emailService, 'sendDetailed').mockResolvedValue({ sent: false, code: 'SMTP_ERROR' });
    const body = { recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL',
      subject: 'Attempt', message: 'Test message', format: 'TEXT' };
    const failed = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send(body);
    expect(failed.status).toBe(502);
    const record = await EmailLogModel.findOne();
    expect(record?.status).toBe('FAILED');
    expect(record?.failureCode).toBe('SMTP_ERROR');
    expect(record?.sentAt).toBeUndefined();
    const dup = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send(body);
    expect(dup.status).toBe(409);
    expect(smtp).toHaveBeenCalledOnce();
    expect(await EmailLogModel.countDocuments()).toBe(1);
  });

  it('records missing SMTP credentials as a failed attempt instead of a fake send', async () => {
    const { superToken, recipient } = await setup();
    // Test setup uses SMTP_HOST='' and the development JSON fallback.
    const res = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL',
      subject: 'Not configured', message: 'This must not be reported as delivered.', format: 'TEXT',
    });
    expect(res.status).toBe(503);
    const history = await EmailLogModel.findOne({ subject: 'Not configured' });
    expect(history?.status).toBe('FAILED');
    expect(history?.failureCode).toBe('SMTP_NOT_CONFIGURED');
  });

  it('prevents two simultaneous submissions with the same idempotency key', async () => {
    const { superToken, recipient } = await setup();
    const smtp = vi.spyOn(emailService, 'sendDetailed').mockResolvedValue({ sent: true });
    const body = { recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL',
      subject: 'Once only', message: 'Please read this once.', format: 'TEXT' };
    const [a, b] = await Promise.all([
      request(app).post(`${base}/admin/emails`).set(auth(superToken)).send(body),
      request(app).post(`${base}/admin/emails`).set(auth(superToken)).send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(smtp).toHaveBeenCalledOnce();
    expect(await EmailLogModel.countDocuments({ subject: 'Once only' })).toBe(1);
  });

  it('escapes unsafe HTML while supporting bold formatting in rich-text messages', async () => {
    const { superToken, recipient } = await setup();
    const smtp = vi.spyOn(emailService, 'sendDetailed').mockResolvedValue({ sent: true });
    const res = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'GENERAL',
      subject: 'Formatted', message: '**Important** <script>alert(1)</script>', format: 'RICH_TEXT',
    });
    expect(res.status).toBe(201);
    expect(smtp.mock.calls[0][1].html).toContain('<strong>Important</strong>');
    expect(smtp.mock.calls[0][1].html).toContain('&lt;script&gt;');
    expect(smtp.mock.calls[0][1].html).not.toContain('<script>');
  });

  it('rejects a reminder targeting an obligation unrelated to the recipient', async () => {
    const { superToken } = await setup();
    // Demo compliance officer belongs to Arewa Tech only.
    const recipient = (await UserModel.findOne({ email: 'officer@demo.smecomply.ng' }))!;
    const otherBusiness = await BusinessModel.findOne({ businessName: "Mama Nkechi's Kitchen" });
    expect(otherBusiness).toBeTruthy();
    const unrelated = await ComplianceTaskModel.findOne({ businessId: otherBusiness!._id });
    expect(unrelated).toBeTruthy();
    const smtp = vi.spyOn(emailService, 'sendDetailed');
    const res = await request(app).post(`${base}/admin/emails`).set(auth(superToken)).send({
      recipientId: String(recipient._id), requestId: uuid(), type: 'MANUAL_REMINDER', taskId: String(unrelated!._id),
      subject: 'Unrelated', message: 'You should not receive this', format: 'TEXT',
    });
    expect(res.status).toBe(403);
    expect(smtp).not.toHaveBeenCalled();
  });
});
