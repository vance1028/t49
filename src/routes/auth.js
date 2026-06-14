'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, isNonEmptyString } = require('../utils/http');
const { verifyPassword, signToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/login', wrap(async (req, res) => {
  const b = req.body || {};
  if (!isNonEmptyString(b.username)) return sendError(res, 400, '用户名不能为空');
  if (!isNonEmptyString(b.password)) return sendError(res, 400, '密码不能为空');

  const account = await store.getAccountByUsername(b.username.trim());
  if (!account) return sendError(res, 401, '用户名或密码错误');
  if (account.status !== 'ACTIVE') return sendError(res, 403, '账号已被停用');

  if (!verifyPassword(b.password, account.passwordHash)) {
    return sendError(res, 401, '用户名或密码错误');
  }

  const accountRole = await store.getAccountWithRole(account.id);
  const token = signToken({
    id: account.id,
    username: account.username,
    roleId: accountRole.roleId,
    roleCode: accountRole.roleCode,
    displayName: accountRole.displayName,
  });

  res.json({
    data: {
      token,
      tokenType: 'Bearer',
      account: {
        id: account.id,
        username: account.username,
        displayName: accountRole.displayName,
        roleCode: accountRole.roleCode,
        roleName: accountRole.roleName,
      },
    },
  });
}));

router.get('/me', requireAuth(), wrap(async (req, res) => {
  const role = await store.getRoleById(req.auth.roleId);
  const bindings = await store.listParentBindingsByAccount(req.auth.accountId);
  res.json({
    data: {
      id: req.auth.accountId,
      username: req.auth.username,
      displayName: req.auth.displayName,
      roleCode: req.auth.roleCode,
      roleName: role ? role.name : '',
      permissionCodes: [...req.auth.permissionCodes],
      visibleStudentCount: req.auth.visibleStudentIds.size,
      children: bindings.map((b) => ({
        studentId: b.studentId,
        relation: b.relation,
        isPrimary: !!b.isPrimary,
      })),
    },
  });
}));

module.exports = router;
