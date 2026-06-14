'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, isNonEmptyString, toPositiveInt } = require('../utils/http');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { ROLE_CODES } = require('../utils/security');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_STATUS = ['ACTIVE', 'INACTIVE'];

router.get('/', requireAuth(), requirePermission('student:list'), wrap(async (req, res) => {
  const { status, school } = req.query;
  const filters = {};
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) return sendError(res, 400, '状态只能是 ACTIVE / INACTIVE');
    filters.status = status;
  }
  if (isNonEmptyString(school)) filters.school = school.trim();
  const list = await store.listStudents(filters, req.auth);
  res.json({ data: list, total: list.length });
}));

router.get('/:id', requireAuth(), requirePermission('student:read'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的学生 ID');
  const s = await store.getStudent(id, req.auth);
  if (!s) return sendError(res, 404, '学生不存在或无权查看');
  res.json({ data: s });
}));

router.post('/', requireAuth(), requirePermission('student:create'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!isNonEmptyString(b.studentNo)) return sendError(res, 400, '学号不能为空');
  if (!isNonEmptyString(b.name)) return sendError(res, 400, '姓名不能为空');
  if (b.status !== undefined && !VALID_STATUS.includes(b.status)) {
    return sendError(res, 400, '状态只能是 ACTIVE / INACTIVE');
  }
  if (await store.findStudentByNo(b.studentNo.trim())) {
    return sendError(res, 409, '学号已存在');
  }
  const s = await store.createStudent({ ...b, studentNo: b.studentNo.trim(), name: b.name.trim() });
  res.status(201).json({ data: s });
}));

router.put('/:id', requireAuth(), requirePermission('student:update'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的学生 ID');
  if (!(await store.getStudent(id))) return sendError(res, 404, '学生不存在');
  const b = req.body || {};
  if (b.name !== undefined && !isNonEmptyString(b.name)) return sendError(res, 400, '姓名不能为空');
  if (b.status !== undefined && !VALID_STATUS.includes(b.status)) {
    return sendError(res, 400, '状态只能是 ACTIVE / INACTIVE');
  }
  const updated = await store.updateStudent(id, b);
  res.json({ data: updated });
}));

router.delete('/:id', requireAuth(), requirePermission('student:delete'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的学生 ID');
  if (!(await store.getStudent(id))) return sendError(res, 404, '学生不存在');
  await store.deleteStudent(id);
  res.status(204).end();
}));

router.get('/:id/meal-stats', requireAuth(), requirePermission('attendance:list'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的学生 ID');
  const s = await store.getStudent(id, req.auth);
  if (!s) return sendError(res, 404, '学生不存在或无权查看');
  const { date, meal } = req.query;
  const filters = {};
  if (date) filters.date = date;
  if (meal) filters.meal = meal;
  const stats = await store.getMealCountStats(filters);
  res.json({ data: { student: s, stats } });
}));

module.exports = router;
