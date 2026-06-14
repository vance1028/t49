'use strict';

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { createApp } = require('../src/app');
const { waitForDb, close } = require('../src/db');
const store = require('../src/data/store');

const app = createApp();

const USERS = {
  admin:    { username: 'admin',    password: 'admin123',   roleCode: 'ADMIN'   },
  teacher1: { username: 'teacher1', password: 'teacher123', roleCode: 'TEACHER' },
  teacher2: { username: 'teacher2', password: 'teacher123', roleCode: 'TEACHER' },
  kitchen1: { username: 'kitchen1', password: 'kitchen123', roleCode: 'KITCHEN' },
  parent1:  { username: 'parent1',  password: 'parent123',  roleCode: 'PARENT'  },
  parent2:  { username: 'parent2',  password: 'parent123',  roleCode: 'PARENT'  },
};

const TOKENS = {};

before(async () => {
  await waitForDb();
});

beforeEach(async () => {
  await store.seed();
  TOKENS.admin    = (await loginAs(USERS.admin)).token;
  TOKENS.teacher1 = (await loginAs(USERS.teacher1)).token;
  TOKENS.teacher2 = (await loginAs(USERS.teacher2)).token;
  TOKENS.kitchen1 = (await loginAs(USERS.kitchen1)).token;
  TOKENS.parent1  = (await loginAs(USERS.parent1)).token;
  TOKENS.parent2  = (await loginAs(USERS.parent2)).token;
});

after(async () => {
  await close();
});

async function loginAs({ username, password }) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  if (res.status !== 200) {
    throw new Error(`登录失败 ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.data.token,
    account: res.body.data.account,
  };
}

function auth(token) { return { Authorization: `Bearer ${token}` }; }

/* =========================================================
   公开接口
   ========================================================= */

test('GET /api/health 公开返回 ok', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

/* =========================================================
   身份认证
   ========================================================= */

test('POST /api/auth/login 正确账号返回 token', async () => {
  const res = await request(app).post('/api/auth/login').send(USERS.admin);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.token);
  assert.strictEqual(res.body.data.account.roleCode, 'ADMIN');
});

test('POST /api/auth/login 错误密码返回 401', async () => {
  const res = await request(app).post('/api/auth/login')
    .send({ username: 'admin', password: 'wrongpass' });
  assert.strictEqual(res.status, 401);
});

test('未带 token 访问接口返回 401', async () => {
  const res = await request(app).get('/api/students');
  assert.strictEqual(res.status, 401);
});

test('无效 token 返回 401', async () => {
  const res = await request(app).get('/api/students')
    .set('Authorization', 'Bearer invalid.token.here');
  assert.strictEqual(res.status, 401);
});

test('GET /api/auth/me 返回当前登录账号信息', async () => {
  const res = await request(app).get('/api/auth/me').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.roleCode, 'PARENT');
  assert.ok(Array.isArray(res.body.data.permissionCodes));
  assert.strictEqual(res.body.data.children.length, 1);
  assert.strictEqual(res.body.data.children[0].studentId, 1);
});

/* =========================================================
   RBAC 越权测试
   ========================================================= */

test('PARENT 角色调用 student:create（无权限）返回 403', async () => {
  const res = await request(app).post('/api/students')
    .set(auth(TOKENS.parent1))
    .send({ studentNo: 'XX', name: 'x' });
  assert.strictEqual(res.status, 403);
  assert.match(res.body.error.message, /student:create/);
});

test('KITCHEN 角色调用 student:delete（无权限）返回 403', async () => {
  const res = await request(app).delete('/api/students/1')
    .set(auth(TOKENS.kitchen1));
  assert.strictEqual(res.status, 403);
});

test('TEACHER 角色调用 account:manage（无权限）返回 403', async () => {
  const res = await request(app).get('/api/accounts')
    .set(auth(TOKENS.teacher1));
  assert.strictEqual(res.status, 403);
});

/* =========================================================
   行级可见域：学生列表
   ========================================================= */

test('ADMIN 学生列表返回全部 4 条', async () => {
  const res = await request(app).get('/api/students').set(auth(TOKENS.admin));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 4);
});

test('teacher1 只负责小明(1)小红(2)，学生列表返回 2 条', async () => {
  const res = await request(app).get('/api/students').set(auth(TOKENS.teacher1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 2);
  const ids = res.body.data.map((s) => s.id).sort();
  assert.deepStrictEqual(ids, [1, 2]);
});

test('teacher2 跨班负责 2,3,4，学生列表返回 3 条', async () => {
  const res = await request(app).get('/api/students').set(auth(TOKENS.teacher2));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 3);
  const ids = res.body.data.map((s) => s.id).sort();
  assert.deepStrictEqual(ids, [2, 3, 4]);
});

test('parent1 只绑定小明(1)，学生列表返回 1 条', async () => {
  const res = await request(app).get('/api/students').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.data[0].id, 1);
});

test('parent2 绑定小刚(3)小丽(4)，多孩子家长返回 2 条', async () => {
  const res = await request(app).get('/api/students').set(auth(TOKENS.parent2));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 2);
  const ids = res.body.data.map((s) => s.id).sort();
  assert.deepStrictEqual(ids, [3, 4]);
});

test('parent1 查看小刚(3)详情返回 404（越权）', async () => {
  const res = await request(app).get('/api/students/3').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 404);
});

test('kitchen 学生列表返回全部但敏感字段隐藏', async () => {
  const res = await request(app).get('/api/students').set(auth(TOKENS.kitchen1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 4);
  for (const s of res.body.data) {
    assert.strictEqual(s.guardianPhone, undefined);
    assert.strictEqual(s.guardianName, undefined);
    assert.strictEqual(s.homeAddress, undefined);
    assert.ok('name' in s);
    assert.ok('grade' in s);
  }
});

/* =========================================================
   字段级脱敏
   ========================================================= */

test('ADMIN 查看学生详情：敏感字段完全可见', async () => {
  const res = await request(app).get('/api/students/1').set(auth(TOKENS.admin));
  assert.strictEqual(res.status, 200);
  const s = res.body.data;
  assert.strictEqual(s.guardianPhone, '13800001111');
  assert.strictEqual(s.guardianName, '王女士');
  assert.strictEqual(s.homeAddress, '北京市朝阳区幸福小区1号楼101室');
});

test('TEACHER 查看学生详情：敏感字段脱敏', async () => {
  const res = await request(app).get('/api/students/1').set(auth(TOKENS.teacher1));
  assert.strictEqual(res.status, 200);
  const s = res.body.data;
  assert.match(s.guardianPhone, /138\*\*\*\*1111/);
  assert.notStrictEqual(s.guardianPhone, '13800001111');
  assert.match(s.guardianName, /王\*/);
  assert.notStrictEqual(s.guardianName, '王女士');
  assert.ok(s.homeAddress.length < '北京市朝阳区幸福小区1号楼101室'.length || s.homeAddress.includes('*'));
});

test('PARENT 查看自己孩子详情：敏感字段完全可见', async () => {
  const res = await request(app).get('/api/students/1').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  const s = res.body.data;
  assert.strictEqual(s.guardianPhone, '13800001111');
  assert.strictEqual(s.guardianName, '王女士');
});

/* =========================================================
   行级可见域：报名/账单
   ========================================================= */

test('ADMIN 账单列表返回全部 3 条', async () => {
  const res = await request(app).get('/api/enrollments').set(auth(TOKENS.admin));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 3);
});

test('parent1（小明）账单列表仅返回小明的 1 条', async () => {
  const res = await request(app).get('/api/enrollments').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.data[0].studentId, 1);
});

test('teacher1（小明、小红）账单列表仅返回 2 条', async () => {
  const res = await request(app).get('/api/enrollments').set(auth(TOKENS.teacher1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 2);
  const sids = res.body.data.map((e) => e.studentId).sort();
  assert.deepStrictEqual(sids, [1, 2]);
});

test('parent1 查看小刚的账单详情返回 404（越权）', async () => {
  // 报名 3 属于学生 3（小刚）
  const res = await request(app).get('/api/enrollments/3').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 404);
});

/* =========================================================
   行级可见域：出勤
   ========================================================= */

test('ADMIN 出勤列表返回 3 条', async () => {
  const res = await request(app).get('/api/attendances').set(auth(TOKENS.admin));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 3);
});

test('parent1 出勤列表仅返回自己孩子（小明 1）的 1 条', async () => {
  const res = await request(app).get('/api/attendances').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.data[0].studentId, 1);
});

/* =========================================================
   写入操作越权验证
   ========================================================= */

test('parent1 尝试给小红(2)登记出勤返回 403', async () => {
  const res = await request(app).post('/api/attendances')
    .set(auth(TOKENS.parent1))
    .send({ studentId: 2, attendDate: '2026-06-10', meal: 'LUNCH', status: 'PRESENT' });
  assert.strictEqual(res.status, 403);
});

test('teacher1 给小明(1)登记出勤成功（在可见域内）', async () => {
  const res = await request(app).post('/api/attendances')
    .set(auth(TOKENS.teacher1))
    .send({ studentId: 1, attendDate: '2026-06-10', meal: 'LUNCH', status: 'PRESENT' });
  assert.strictEqual(res.status, 201);
});

test('teacher1 给小刚(3)登记出勤返回 403（不在可见域）', async () => {
  const res = await request(app).post('/api/attendances')
    .set(auth(TOKENS.teacher1))
    .send({ studentId: 3, attendDate: '2026-06-10', meal: 'LUNCH', status: 'PRESENT' });
  assert.strictEqual(res.status, 403);
});

/* =========================================================
   账号绑定管理（ADMIN 权限）
   ========================================================= */

test('ADMIN 新增家长账号并绑定学生成功', async () => {
  const createRes = await request(app).post('/api/accounts')
    .set(auth(TOKENS.admin))
    .send({
      username: 'parent_new',
      password: 'abc123456',
      displayName: '新家长',
      roleCode: 'PARENT',
    });
  assert.strictEqual(createRes.status, 201);
  const newAccountId = createRes.body.data.id;
  const bindRes = await request(app).post('/api/bindings')
    .set(auth(TOKENS.admin))
    .send({ accountId: newAccountId, studentId: 2, relation: 'MOTHER' });
  assert.strictEqual(bindRes.status, 201);
});

test('非 ADMIN 不能创建账号', async () => {
  const res = await request(app).post('/api/accounts')
    .set(auth(TOKENS.parent1))
    .send({ username: 'hacker', password: 'xxx', roleCode: 'ADMIN' });
  assert.strictEqual(res.status, 403);
});

test('parent 只能查看自己的绑定信息', async () => {
  const res = await request(app).get('/api/bindings').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.data[0].studentId, 1);
});

/* =========================================================
   备餐统计（厨房友好）
   ========================================================= */

test('出勤备餐统计接口正常', async () => {
  const res = await request(app).get('/api/attendances/stats/meal-count?date=2026-06-05')
    .set(auth(TOKENS.kitchen1));
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

/* =========================================================
   菜单：KITCHEN 有权更新，PARENT 无权限
   ========================================================= */

test('KITCHEN 更新菜单成功', async () => {
  const res = await request(app).post('/api/menus')
    .set(auth(TOKENS.kitchen1))
    .send({ menuDate: '2026-06-10', meal: 'LUNCH', dishes: '测试菜品' });
  assert.strictEqual(res.status, 201);
});

test('PARENT 尝试更新菜单返回 403', async () => {
  const res = await request(app).post('/api/menus')
    .set(auth(TOKENS.parent1))
    .send({ menuDate: '2026-06-10', meal: 'LUNCH', dishes: '我要改菜单' });
  assert.strictEqual(res.status, 403);
});

test('菜单列表所有登录角色都能看到', async () => {
  for (const k of ['parent1', 'teacher1', 'kitchen1', 'admin']) {
    const res = await request(app).get('/api/menus').set(auth(TOKENS[k]));
    assert.strictEqual(res.status, 200, `${k} 看菜单失败`);
    assert.ok(res.body.total >= 1);
  }
});

/* =========================================================
   套餐：PARENT 能读但不能创建
   ========================================================= */

test('PARENT 看套餐成功', async () => {
  const res = await request(app).get('/api/plans').set(auth(TOKENS.parent1));
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.total >= 1);
});

test('PARENT 创建套餐返回 403', async () => {
  const res = await request(app).post('/api/plans')
    .set(auth(TOKENS.parent1))
    .send({ name: '坏套餐', priceCents: 100 });
  assert.strictEqual(res.status, 403);
});

test('ADMIN 创建套餐成功', async () => {
  const res = await request(app).post('/api/plans')
    .set(auth(TOKENS.admin))
    .send({ name: '新套餐', priceCents: 50000 });
  assert.strictEqual(res.status, 201);
});
