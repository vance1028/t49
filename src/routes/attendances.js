'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, toPositiveInt, isValidDate } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_MEAL = ['BREAKFAST', 'LUNCH', 'DINNER'];
const VALID_STATUS = ['PRESENT', 'ABSENT', 'LEAVE'];

router.get('/', wrap(async (req, res) => {
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
  const list = await store.listAttendances(filters);
  res.json({ data: list, total: list.length });
}));

// 签到/考勤登记：同一学生同一天同一餐只能登记一次
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const sid = toPositiveInt(b.studentId);
  if (sid === null) return sendError(res, 400, '必须指定有效的学生 ID');
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
