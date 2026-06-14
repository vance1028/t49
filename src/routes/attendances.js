'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, toPositiveInt, isValidDate } = require('../utils/http');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_MEAL = ['BREAKFAST', 'LUNCH', 'DINNER'];
const VALID_STATUS = ['PRESENT', 'ABSENT', 'LEAVE'];

router.get('/', requireAuth(), requirePermission('attendance:list'), wrap(async (req, res) => {
  const filters = {};
  if (req.query.date !== undefined) {
    if (!isValidDate(req.query.date)) return sendError(res, 400, '日期格式必须为 YYYY-MM-DD');
    filters.date = req.query.date;
  }
  if (req.query.studentId !== undefined) {
    const sid = toPositiveInt(req.query.studentId);
    if (sid === null) return sendError(res, 400, '无效的学生 ID');
    filters.studentId = sid;
  }
  const list = await store.listAttendances(filters, req.auth);
  res.json({ data: list, total: list.length });
}));

router.get('/stats/meal-count', requireAuth(), requirePermission('attendance:list'), wrap(async (req, res) => {
  const { date, meal } = req.query;
  const filters = {};
  if (date) {
    if (!isValidDate(date)) return sendError(res, 400, '日期格式必须为 YYYY-MM-DD');
    filters.date = date;
  }
  if (meal) {
    if (!VALID_MEAL.includes(meal)) return sendError(res, 400, `餐次只能是 ${VALID_MEAL.join(' / ')}`);
    filters.meal = meal;
  }
  const stats = await store.getMealCountStats(filters);
  res.json({ data: stats, total: stats.length });
}));

router.post('/', requireAuth(), requirePermission('attendance:create'), wrap(async (req, res) => {
  const b = req.body || {};
  const sid = toPositiveInt(b.studentId);
  if (sid === null) return sendError(res, 400, '必须指定有效的学生 ID');

  if (req.auth.roleCode !== 'ADMIN' && !req.auth.visibleStudentIds.has(sid)) {
    return sendError(res, 403, '无权为该学生登记出勤');
  }

  const student = await store.getStudent(sid);
  if (!student) return sendError(res, 400, '学生不存在');

  if (!isValidDate(b.attendDate)) return sendError(res, 400, '日期格式必须为 YYYY-MM-DD');
  const meal = b.meal || 'LUNCH';
  if (!VALID_MEAL.includes(meal)) return sendError(res, 400, `餐次只能是 ${VALID_MEAL.join(' / ')}`);
  const status = b.status || 'PRESENT';
  if (!VALID_STATUS.includes(status)) return sendError(res, 400, `状态只能是 ${VALID_STATUS.join(' / ')}`);

  if (await store.findAttendance(sid, b.attendDate, meal)) {
    return sendError(res, 409, '该学生当天该餐次已登记');
  }

  const a = await store.createAttendance({
    studentId: sid,
    attendDate: b.attendDate,
    meal,
    status,
    pickedUpBy: b.pickedUpBy,
    remark: b.remark,
  });
  res.status(201).json({ data: a });
}));

module.exports = router;
