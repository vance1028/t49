'use strict';

const ROLE_CODES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  KITCHEN: 'KITCHEN',
  PARENT: 'PARENT',
};

const MASK_RULES = {
  PHONE: 'PHONE',
  NAME: 'NAME',
  ADDRESS: 'ADDRESS',
  ID_CARD: 'ID_CARD',
  EMAIL: 'EMAIL',
};

const ACCESS_LEVELS = {
  FULL: 'FULL',
  MASKED: 'MASKED',
  HIDDEN: 'HIDDEN',
};

function maskByRule(value, rule) {
  if (value === null || value === undefined) return value;
  const s = String(value);
  switch (rule) {
    case MASK_RULES.PHONE: {
      if (s.length < 7) return '*'.repeat(s.length);
      return s.slice(0, 3) + '****' + s.slice(-4);
    }
    case MASK_RULES.NAME: {
      if (s.length <= 1) return '*';
      return s.slice(0, 1) + '*'.repeat(Math.max(s.length - 1, 1));
    }
    case MASK_RULES.ADDRESS: {
      if (s.length <= 6) return '*'.repeat(s.length);
      return s.slice(0, 6) + '*'.repeat(Math.min(s.length - 6, 8));
    }
    case MASK_RULES.ID_CARD: {
      if (s.length < 8) return '*'.repeat(s.length);
      return s.slice(0, 4) + '*'.repeat(s.length - 8) + s.slice(-4);
    }
    case MASK_RULES.EMAIL: {
      const at = s.indexOf('@');
      if (at <= 1) return '*'.repeat(s.length);
      return s.slice(0, 1) + '*'.repeat(at - 1) + s.slice(at);
    }
    default:
      return s;
  }
}

function applyFieldSecurity(tableName, record, roleCode, fieldRulesMap) {
  if (!record) return record;
  const rules = fieldRulesMap[`${tableName}:${roleCode}`] || {};
  const out = { ...record };
  for (const [field, rule] of Object.entries(rules)) {
    if (field in out) {
      if (rule.accessLevel === ACCESS_LEVELS.HIDDEN) {
        delete out[field];
      } else if (rule.accessLevel === ACCESS_LEVELS.MASKED) {
        out[field] = maskByRule(out[field], rule.maskRule);
      }
    }
  }
  return out;
}

function applyFieldSecurityList(tableName, list, roleCode, fieldRulesMap) {
  if (!Array.isArray(list)) return list;
  return list.map((r) => applyFieldSecurity(tableName, r, roleCode, fieldRulesMap));
}

module.exports = {
  ROLE_CODES,
  MASK_RULES,
  ACCESS_LEVELS,
  maskByRule,
  applyFieldSecurity,
  applyFieldSecurityList,
};
