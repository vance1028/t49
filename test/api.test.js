'use strict';

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { createApp } = require('../src/app');
const { waitForDb, close } = require('../src/db');
const store = require('../src/data/store');

const app = createApp();

before(async () => {
  await waitForDb();
});

beforeEach(async () => {
  await store.seed();
});

after(async () => {
  await close();
});

test('GET /api/health 返回 ok', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

/* ---------- 学生 ---------- */

test('GET /api/students 返回种子学生', async () => {
  const res = await request(app).get('/api/students');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 4);
});

test('GET /api/students 按状态筛选 ACTIVE', async () => {
  const res = await request(app).get('/api/students?status=ACTIVE');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 3);
  assert.ok(res.body.data.every((s) => s.status === 'ACTIVE'));
});

test('POST /api/students 创建成功', async () => {
  const res = await request(app)
    .post('/api/students')
    .send({ studentNo: 'XS2026100', name: '新同学', grade: '一年级', guardianPhone: '13900000000' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.studentNo, 'XS2026100');
});

test('POST /api/students 学号重复返回 409', async () => {
  const res = await request(app).post('/api/students').send({ studentNo: 'XS2026001', name: 'x' });
  assert.strictEqual(res.status, 409);
});

test('POST /api/students 空姓名返回 400', async () => {
  const res = await request(app).post('/api/students').send({ studentNo: 'XS9999', name: '' });
  assert.strictEqual(res.status, 400);
});

test('PUT /api/students 更新状态', async () => {
  const res = await request(app).put('/api/students/1').send({ status: 'INACTIVE' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.status, 'INACTIVE');
});

test('DELETE /api/students 删除并连带报名（级联）', async () => {
  const res = await request(app).delete('/api/students/1');
  assert.strictEqual(res.status, 204);
  const after2 = await request(app).get('/api/students/1');
  assert.strictEqual(after2.status, 404);
});

/* ---------- 套餐 ---------- */

test('GET /api/plans 返回套餐', async () => {
  const res = await request(app).get('/api/plans');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 3);
});

test('POST /api/plans 价格非整数返回 400', async () => {
  const res = await request(app).post('/api/plans').send({ name: '坏套餐', priceCents: 12.5 });
  assert.strictEqual(res.status, 400);
});

/* ---------- 报名 ---------- */

test('POST /api/enrollments 报名成功且金额取套餐价', async () => {
  const res = await request(app)
    .post('/api/enrollments')
    .send({ studentId: 1, planId: 2, startDate: '2026-07-01', endDate: '2026-07-31' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.amountCents, 99000);
});

test('POST /api/enrollments 非在读学生返回 409', async () => {
  // 学生 4 是 INACTIVE
  const res = await request(app)
    .post('/api/enrollments')
    .send({ studentId: 4, planId: 1, startDate: '2026-07-01', endDate: '2026-07-31' });
  assert.strictEqual(res.status, 409);
});

test('POST /api/enrollments 结束日期早于开始返回 400', async () => {
  const res = await request(app)
    .post('/api/enrollments')
    .send({ studentId: 1, planId: 1, startDate: '2026-07-31', endDate: '2026-07-01' });
  assert.strictEqual(res.status, 400);
});

test('POST /api/enrollments/:id/pay 标记缴费，重复缴费 409', async () => {
  // 报名 3 未缴费
  const res = await request(app).post('/api/enrollments/3/pay');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.paid, true);
  const again = await request(app).post('/api/enrollments/3/pay');
  assert.strictEqual(again.status, 409);
});

/* ---------- 菜单 ---------- */

test('GET /api/menus 按日期查询', async () => {
  const res = await request(app).get('/api/menus?date=2026-06-05');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 2);
});

test('POST /api/menus 新增返回 201，重复同餐次 upsert 返回 200', async () => {
  const create = await request(app)
    .post('/api/menus')
    .send({ menuDate: '2026-06-10', meal: 'LUNCH', dishes: '咖喱鸡饭' });
  assert.strictEqual(create.status, 201);
  const update = await request(app)
    .post('/api/menus')
    .send({ menuDate: '2026-06-10', meal: 'LUNCH', dishes: '咖喱牛肉饭' });
  assert.strictEqual(update.status, 200);
  assert.strictEqual(update.body.data.dishes, '咖喱牛肉饭');
});

/* ---------- 出勤 ---------- */

test('POST /api/attendances 签到成功', async () => {
  const res = await request(app)
    .post('/api/attendances')
    .send({ studentId: 1, attendDate: '2026-06-06', meal: 'LUNCH', status: 'PRESENT' });
  assert.strictEqual(res.status, 201);
});

test('POST /api/attendances 同生同日同餐重复返回 409', async () => {
  // 种子里 学生1 2026-06-05 LUNCH 已登记
  const res = await request(app)
    .post('/api/attendances')
    .send({ studentId: 1, attendDate: '2026-06-05', meal: 'LUNCH' });
  assert.strictEqual(res.status, 409);
});

test('GET /api/attendances 按日期查询', async () => {
  const res = await request(app).get('/api/attendances?date=2026-06-05');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 3);
});

test('未知接口返回 404', async () => {
  const res = await request(app).get('/api/unknown');
  assert.strictEqual(res.status, 404);
});

test('非法 JSON 请求体返回 400', async () => {
  const res = await request(app)
    .post('/api/students')
    .set('Content-Type', 'application/json')
    .send('{ bad json');
  assert.strictEqual(res.status, 400);
});
