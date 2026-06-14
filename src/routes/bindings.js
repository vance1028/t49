'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, toPositiveInt, isNonEmptyString } = require('../utils/http');
const { requireAuth, requirePermission, requireAnyPermission } = require('../middleware/auth');
const { ROLE_CODES } = require('../utils/security');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireAuth(), requireAnyPermission('binding:read', 'binding:manage'), wrap(async (req, res) => {
  let list;
  if (req.auth.roleCode === ROLE_CODES.ADMIN) {
    const { accountId, studentId } = req.query;
    const filters = {};
    if (accountId !== undefined) {
      const aid = toPositiveInt(accountId);
      if (aid === null) return sendError(res, 400, '无效的账号 ID');
      filters.accountId = aid;
    }
    if (studentId !== undefined) {
      const sid = toPositiveInt(studentId);
      if (sid === null) return sendError(res, 400, '无效的学生 ID');
      filters.studentId = sid;
    }
    list = await store.listAllParentBindings(filters);
  } else if (req.auth.roleCode === ROLE_CODES.PARENT) {
    list = await store.listParentBindingsByAccount(req.auth.accountId);
  } else {
    return sendError(res, 403, '无权查看绑定信息');
  }
  res.json({ data: list, total: list.length });
}));

router.post('/', requireAuth(), requirePermission('binding:manage'), wrap(async (req, res) => {
  const b = req.body || {};
  const accountId = toPositiveInt(b.accountId);
  const studentId = toPositiveInt(b.studentId);
  if (accountId === null) return sendError(res, 400, '无效的家长账号 ID');
  if (studentId === null) return sendError(res, 400, '无效的学生 ID');

  const account = await store.getAccountWithRole(accountId);
  if (!account) return sendError(res, 400, '家长账号不存在');
  if (account.roleCode !== ROLE_CODES.PARENT) {
    return sendError(res, 409, '该账号不是家长角色，无法绑定学生');
  }
  if (!(await store.getStudent(studentId))) return sendError(res, 400, '学生不存在');

  if (await store.getParentBinding(accountId, studentId)) {
    return sendError(res, 409, '该家长已绑定该学生');
  }

  const binding = await store.createParentBinding({
    accountId,
    studentId,
    relation: isNonEmptyString(b.relation) ? b.relation.trim() : 'PARENT',
    isPrimary: b.isPrimary === true,
  });
  res.status(201).json({ data: binding });
}));

router.delete('/:id', requireAuth(), requirePermission('binding:manage'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的绑定 ID');
  const existed = await store.getParentBindingById(id);
  if (!existed) return sendError(res, 404, '绑定记录不存在');
  await store.deleteParentBinding(id);
  res.status(204).end();
}));

router.get('/teacher-assignments', requireAuth(), wrap(async (req, res) => {
  if (req.auth.roleCode === ROLE_CODES.ADMIN) {
    const { accountId, studentId } = req.query;
    const filters = {};
    if (accountId !== undefined) {
      const aid = toPositiveInt(accountId);
      if (aid === null) return sendError(res, 400, '无效的账号 ID');
      filters.accountId = aid;
    }
    if (studentId !== undefined) {
      const sid = toPositiveInt(studentId);
      if (sid === null) return sendError(res, 400, '无效的学生 ID');
      filters.studentId = sid;
    }
    const list = await store.listAllTeacherAssignments(filters);
    return res.json({ data: list, total: list.length });
  }
  if (req.auth.roleCode === ROLE_CODES.TEACHER) {
    const list = await store.listTeacherAssignmentsByAccount(req.auth.accountId);
    return res.json({ data: list, total: list.length });
  }
  return sendError(res, 403, '无权查看教师分配信息');
}));

router.post('/teacher-assignments', requireAuth(), requirePermission('binding:manage'), wrap(async (req, res) => {
  const b = req.body || {};
  const accountId = toPositiveInt(b.accountId);
  const studentId = toPositiveInt(b.studentId);
  if (accountId === null) return sendError(res, 400, '无效的教师账号 ID');
  if (studentId === null) return sendError(res, 400, '无效的学生 ID');

  const account = await store.getAccountWithRole(accountId);
  if (!account) return sendError(res, 400, '教师账号不存在');
  if (account.roleCode !== ROLE_CODES.TEACHER) {
    return sendError(res, 409, '该账号不是老师角色，无法分配学生');
  }
  if (!(await store.getStudent(studentId))) return sendError(res, 400, '学生不存在');

  if (await store.getTeacherAssignment(accountId, studentId)) {
    return sendError(res, 409, '该老师已分配该学生');
  }
  const ta = await store.createTeacherAssignment({ accountId, studentId });
  res.status(201).json({ data: ta });
}));

router.delete('/teacher-assignments/:id', requireAuth(), requirePermission('binding:manage'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的分配 ID');
  if (!(await store.getTeacherAssignmentById(id))) return sendError(res, 404, '分配记录不存在');
  await store.deleteTeacherAssignment(id);
  res.status(204).end();
}));

module.exports = router;
