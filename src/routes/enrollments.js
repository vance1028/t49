'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, toPositiveInt, isValidDate } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const filters = {};
  if (req.query.studentId !== undefined) {
    const sid = toPositiveInt(req.query.studentId);
    if (sid === null) return sendError(res, 400, '无效的学生 ID');
    filters.studentId = sid;
  }
  const list = await store.listEnrollments(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的报名 ID');
  const e = await store.getEnrollment(id);
  if (!e) return sendError(res, 404, '报名记录不存在');
  res.json({ data: e });
}));

// 学生报名订餐：校验学生、套餐存在，日期合法，金额取套餐价格
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const sid = toPositiveInt(b.studentId);
  const pid = toPositiveInt(b.planId);
  if (sid === null) return sendError(res, 400, '必须指定有效的学生 ID');
  if (pid === null) return sendError(res, 400, '必须指定有效的套餐 ID');

  const student = await store.getStudent(sid);
  if (!student) return sendError(res, 400, '学生不存在');
  if (student.status !== 'ACTIVE') return sendError(res, 409, '该学生未在读，无法报名');

  const plan = await store.getPlan(pid);
  if (!plan) return sendError(res, 400, '套餐不存在');
  if (!plan.active) return sendError(res, 409, '该套餐已停用');

  if (!isValidDate(b.startDate) || !isValidDate(b.endDate)) {
    return sendError(res, 400, '开始/结束日期格式必须为 YYYY-MM-DD');
  }
  if (b.endDate < b.startDate) {
    return sendError(res, 400, '结束日期不能早于开始日期');
  }

  const e = await store.createEnrollment({
    studentId: sid,
    planId: pid,
    startDate: b.startDate,
    endDate: b.endDate,
    amountCents: plan.priceCents,
    paid: b.paid === true,
    status: 'ACTIVE',
  });
  res.status(201).json({ data: e });
}));

// 标记缴费
router.post('/:id/pay', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的报名 ID');
  const e = await store.getEnrollment(id);
  if (!e) return sendError(res, 404, '报名记录不存在');
  if (e.paid) return sendError(res, 409, '该报名已缴费');
  const updated = await store.markEnrollmentPaid(id);
  res.json({ data: updated });
}));

module.exports = router;
