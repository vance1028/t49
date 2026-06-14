'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, toPositiveInt, isNonEmptyString } = require('../utils/http');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { ROLE_CODES } = require('../utils/security');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/roles', requireAuth(), wrap(async (req, res) => {
  const list = await store.listRoles();
  res.json({ data: list, total: list.length });
}));

router.get('/permissions', requireAuth(), wrap(async (req, res) => {
  const { module: mod } = req.query;
  const list = await store.listPermissions(mod ? { module: mod } : {});
  res.json({ data: list, total: list.length });
}));

router.get('/roles/:roleId/permissions', requireAuth(), wrap(async (req, res) => {
  const roleId = toPositiveInt(req.params.roleId);
  if (roleId === null) return sendError(res, 400, '无效的角色 ID');
  const list = await store.listPermissionsByRoleId(roleId);
  res.json({ data: list, total: list.length });
}));

router.post('/roles/:roleId/permissions', requireAuth(), requirePermission('role:manage'), wrap(async (req, res) => {
  const roleId = toPositiveInt(req.params.roleId);
  if (roleId === null) return sendError(res, 400, '无效的角色 ID');
  if (!(await store.getRoleById(roleId))) return sendError(res, 404, '角色不存在');
  const b = req.body || {};
  const permissionIds = Array.isArray(b.permissionIds) ? b.permissionIds : [];
  for (const pid of permissionIds) {
    if (!Number.isInteger(pid) || pid <= 0) return sendError(res, 400, '无效的权限 ID 列表');
  }
  await store.setRolePermissions(roleId, permissionIds);
  const list = await store.listPermissionsByRoleId(roleId);
  res.json({ data: list, total: list.length });
}));

router.get('/field-rules', requireAuth(), requirePermission('role:manage'), wrap(async (req, res) => {
  const { tableName, roleCode } = req.query;
  const filters = {};
  if (isNonEmptyString(tableName)) filters.tableName = tableName;
  if (isNonEmptyString(roleCode)) {
    if (!Object.values(ROLE_CODES).includes(roleCode)) return sendError(res, 400, '无效的角色编码');
    filters.roleCode = roleCode;
  }
  const list = await store.listFieldSecurityRules(filters);
  res.json({ data: list, total: list.length });
}));

module.exports = router;
