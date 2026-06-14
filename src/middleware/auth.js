'use strict';

const { verifyToken } = require('../utils/auth');
const store = require('../data/store');
const { sendError } = require('../utils/http');

function requireAuth(optional = false) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : header;

      if (!token) {
        if (optional) {
          req.auth = null;
          return next();
        }
        return sendError(res, 401, '未登录，请先登录');
      }

      const payload = verifyToken(token);
      if (!payload) {
        return sendError(res, 401, '登录已过期或凭证无效，请重新登录');
      }

      const account = await store.getAccountWithRole(payload.sub);
      if (!account) {
        return sendError(res, 401, '账号不存在或已被删除');
      }
      if (account.status !== 'ACTIVE') {
        return sendError(res, 403, '账号已被停用，请联系管理员');
      }

      const perms = await store.getPermissionCodesByRoleId(account.roleId);
      const visibleStudentIds = await store.getVisibleStudentIds(account.id, account.roleCode);

      req.auth = {
        accountId: account.id,
        username: account.username,
        displayName: account.displayName,
        roleId: account.roleId,
        roleCode: account.roleCode,
        permissionCodes: new Set(perms),
        visibleStudentIds: new Set(visibleStudentIds),
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

function requirePermission(...permCodes) {
  return (req, res, next) => {
    if (!req.auth) {
      return sendError(res, 401, '未登录');
    }
    for (const code of permCodes) {
      if (!req.auth.permissionCodes.has(code)) {
        return sendError(res, 403, `没有该操作所需权限：${code}`);
      }
    }
    next();
  };
}

function requireAnyPermission(...permCodes) {
  return (req, res, next) => {
    if (!req.auth) {
      return sendError(res, 401, '未登录');
    }
    const ok = permCodes.some((c) => req.auth.permissionCodes.has(c));
    if (!ok) {
      return sendError(res, 403, `没有该操作所需的权限`);
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requirePermission,
  requireAnyPermission,
};
