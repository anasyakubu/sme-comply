/**
 * Module purpose: Integration tests exercise major API flows and check authentication and access boundaries.
 */
import request from 'supertest';
import { createApp } from '../src/app';
import { seed, DEMO_PASSWORD, ADMIN_PASSWORD } from '../src/seed/seed';
import { taskGenerationService } from '../src/services/taskGeneration.service';
import { ComplianceTaskModel } from '../src/models';
import { clearDb, startDb, stopDb } from './helpers';

const app = createApp();
const api = '/api/v1';

async function login(email: string, password = DEMO_PASSWORD) {
  const res = await request(app).post(`${api}/auth/login`).send({ email, password });
  expect(res.status).toBe(200);
  return { token: res.body.data.accessToken as string, cookie: res.headers['set-cookie'] as unknown as string[] };
}

beforeAll(async () => {
  await startDb();
});
afterAll(async () => {
  await stopDb();
});

describe('authentication', () => {
  beforeAll(async () => {
    await clearDb();
  });

  it('registers, rejects duplicates and signs in', async () => {
    const body = { firstName: 'Tunde', lastName: 'Ade', email: 'tunde@example.com', password: 'Secret123' };
    const res = await request(app).post(`${api}/auth/register`).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTruthy();

    const dup = await request(app).post(`${api}/auth/register`).send(body);
    expect(dup.status).toBe(409);

    const bad = await request(app).post(`${api}/auth/login`).send({ email: body.email, password: 'wrong-pass1' });
    expect(bad.status).toBe(401);
  });

  it('validates input', async () => {
    const res = await request(app).post(`${api}/auth/register`).send({ email: 'not-an-email', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const { cookie } = await login('tunde@example.com', 'Secret123');
    const first = await request(app).post(`${api}/auth/refresh`).set('Cookie', cookie);
    expect(first.status).toBe(200);
    const reuse = await request(app).post(`${api}/auth/refresh`).set('Cookie', cookie);
    expect(reuse.status).toBe(401);
  });

  it('blocks protected routes without a token', async () => {
    expect((await request(app).get(`${api}/businesses`)).status).toBe(401);
  });

  it('strips Mongo operators from input', async () => {
    const res = await request(app).post(`${api}/auth/login`).send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('businesses, tasks and permissions (seeded)', () => {
  beforeAll(async () => {
    await clearDb();
    await seed({ quiet: true });
  });

  it('creates a business and generates tasks from the rules', async () => {
    await request(app).post(`${api}/auth/register`).send({ firstName: 'T', lastName: 'Two', email: 'tunde2@example.com', password: 'Secret123' });
    const { token } = await login('tunde2@example.com', 'Secret123');
    const res = await request(app)
      .post(`${api}/businesses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        businessName: 'Test Ventures',
        businessType: 'Limited Liability Company',
        industry: 'Technology',
        state: 'Lagos',
        employeeCount: 5,
        dateOfIncorporation: '2022-01-10',
        flags: { vatRegistered: true, taxRegistered: true },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.generation.created).toBeGreaterThan(0);

    const businessId = res.body.data.business._id;
    const tasks = await request(app).get(`${api}/compliance-tasks?businessId=${businessId}&limit=100`).set('Authorization', `Bearer ${token}`);
    const titles = tasks.body.data.map((t: any) => t.title);
    expect(titles).toContain('VAT return and remittance');
    expect(titles).not.toContain('Register for a Tax Identification Number');
  });

  it('does not create duplicate tasks when generation runs again', async () => {
    const before = await ComplianceTaskModel.countDocuments();
    await taskGenerationService.generateForAll();
    expect(await ComplianceTaskModel.countDocuments()).toBe(before);
  });

  it("hides other people's businesses", async () => {
    const { token } = await login('tunde2@example.com', 'Secret123');
    const list = await request(app).get(`${api}/businesses`).set('Authorization', `Bearer ${token}`);
    expect(list.body.data.every((b: any) => b.businessName === 'Test Ventures')).toBe(true);

    const owner = await login('owner@demo.smecomply.ng');
    const ownerList = await request(app).get(`${api}/businesses`).set('Authorization', `Bearer ${owner.token}`);
    const demoId = ownerList.body.data[0]._id;
    const peek = await request(app).get(`${api}/businesses/${demoId}`).set('Authorization', `Bearer ${token}`);
    expect(peek.status).toBe(404);
  });

  it('lets an accountant update tasks but not invite members or mark tasks not applicable', async () => {
    const { token } = await login('accountant@demo.smecomply.ng');
    const businesses = await request(app).get(`${api}/businesses`).set('Authorization', `Bearer ${token}`);
    const businessId = businesses.body.data.find((b: any) => b.businessName === 'Arewa Tech Solutions')._id;

    const invite = await request(app)
      .post(`${api}/businesses/${businessId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'x@example.com', role: 'ACCOUNTANT' });
    expect(invite.status).toBe(403);

    const tasks = await request(app).get(`${api}/compliance-tasks?businessId=${businessId}&status=PENDING,UPCOMING`).set('Authorization', `Bearer ${token}`);
    const taskId = tasks.body.data[0]._id;
    const na = await request(app).patch(`${api}/compliance-tasks/${taskId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'NOT_APPLICABLE' });
    expect(na.status).toBe(403);
    const done = await request(app).post(`${api}/compliance-tasks/${taskId}/complete`).set('Authorization', `Bearer ${token}`).send({});
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('COMPLETED');
  });

  it('restricts admin routes to admins', async () => {
    const owner = await login('owner@demo.smecomply.ng');
    expect((await request(app).get(`${api}/admin/overview`).set('Authorization', `Bearer ${owner.token}`)).status).toBe(403);
    const admin = await login('admin@smecomply.ng', ADMIN_PASSWORD);
    const overview = await request(app).get(`${api}/admin/overview`).set('Authorization', `Bearer ${admin.token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data.requirements).toBeGreaterThan(0);
  });

  it('rejects files whose contents do not match their extension', async () => {
    const owner = await login('owner@demo.smecomply.ng');
    const list = await request(app).get(`${api}/businesses`).set('Authorization', `Bearer ${owner.token}`);
    const res = await request(app)
      .post(`${api}/documents`)
      .set('Authorization', `Bearer ${owner.token}`)
      .field('businessId', list.body.data[0]._id)
      .attach('file', Buffer.from('MZ fake executable'), { filename: 'receipt.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('exports a CSV report', async () => {
    const owner = await login('owner@demo.smecomply.ng');
    const list = await request(app).get(`${api}/businesses`).set('Authorization', `Bearer ${owner.token}`);
    const res = await request(app)
      .get(`${api}/reports/compliance.csv?businessId=${list.body.data[0]._id}&from=2025-01-01&to=2027-12-31`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });
});
