'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, toPositiveInt, isNonEmptyString } = require('../utils/http');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { hashPassword } = require('../utils/auth');
const { ROLE_CODES } = require('../utils/security');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_ROLE_CODES = Object.values(ROLE_CODES);
const VALID_STATUS = ['ACTIVE', 'INACTIVE'];

router.get('/', requireAuth(), requirePermission('account:manage'), wrap(async (req, res) => {
  const filters = {};
  const { status, roleCode } = req.query;
  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) return sendError(res, 400, '状态只能是 ACTIVE / INACTIVE');
    filters.status = status;
  }
  if (isNonEmptyString(roleCode)) {
    if (!VALID_ROLE_CODES.includes(roleCode)) return sendError(res, 400, '无效的角色编码');
    filters.roleCode = roleCode;
  }
  const list = await store.listAccounts(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/:id', requireAuth(), requirePermission('account:manage'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的账号 ID');
  const a = await store.getAccountWithRole(id);
  if (!a) return sendError(res, 404, '账号不存在');
  delete a.passwordHash;
  res.json({ data: a });
}));

router.post('/', requireAuth(), requirePermission('account:manage'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!isNonEmptyString(b.username)) return sendError(res, 400, '用户名不能为空');
  if (!isNonEmptyString(b.password)) return sendError(res, 400, '密码不能为空');
  if (b.password.length < 6) return sendError(res, 400, '密码至少 6 位');
  if (!isNonEmptyString(b.roleCode) || !VALID_ROLE_CODES.includes(b.roleCode)) {
    return sendError(res, 400, `必须指定有效角色：${VALID_ROLE_CODES.join(' / ')}`);
  }
  if (await store.getAccountByUsername(b.username.trim())) {
    return sendError(res, 409, '用户名已存在');
  }
  const role = await store.getRoleByCode(b.roleCode);
  const created = await store.createAccount({
    username: b.username.trim(),
    passwordHash: hashPassword(b.password),
    displayName: isNonEmptyString(b.displayName) ? b.displayName.trim() : b.username.trim(),
    roleId: role.id,
    status: b.status || 'ACTIVE',
  });
  delete created.passwordHash;
  res.status(201).json({ data: created });
}));

router.put('/:id', requireAuth(), requirePermission('account:manage'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的账号 ID');
  if (!(await store.getAccountById(id))) return sendError(res, 404, '账号不存在');
  const b = req.body || {};
  const patch = {};
  if (isNonEmptyString(b.displayName)) patch.displayName = b.displayName.trim();
  if (b.status !== undefined) {
    if (!VALID_STATUS.includes(b.status)) return sendError(res, 400, '状态只能是 ACTIVE / INACTIVE');
    patch.status = b.status;
  }
  if (isNonEmptyString(b.password)) {
    if (b.password.length < 6) return sendError(res, 400, '密码至少 6 位');
    patch.passwordHash = hashPassword(b.password);
  }
  if (isNonEmptyString(b.roleCode)) {
    if (!VALID_ROLE_CODES.includes(b.roleCode)) return sendError(res, 400, '无效的角色编码');
    const role = await store.getRoleByCode(b.roleCode);
    patch.roleId = role.id;
  }
  const updated = await store.updateAccount(id, patch);
  delete updated.passwordHash;
  res.json({ data: updated });
}));

router.delete('/:id', requireAuth(), requirePermission('account:manage'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的账号 ID');
  if (!(await store.getAccountById(id))) return sendError(res, 404, '账号不存在');
  if (id === req.auth.accountId) return sendError(res, 409, '不能删除自己的账号');
  await store.deleteAccount(id);
  res.status(204).end();
}));

module.exports = router;
