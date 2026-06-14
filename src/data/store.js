'use strict';

const { pool } = require('../db');
const { hashPassword } = require('../utils/auth');
const { ROLE_CODES, applyFieldSecurity, applyFieldSecurityList } = require('../utils/security');

/* ------------------------- 基础映射函数 ------------------------- */

function mapStudent(r) {
  if (!r) return null;
  return {
    id: r.id,
    studentNo: r.student_no,
    name: r.name,
    grade: r.grade,
    school: r.school,
    guardianName: r.guardian_name,
    guardianPhone: r.guardian_phone,
    homeAddress: r.home_address,
    allergies: r.allergies,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPlan(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    meals: r.meals,
    priceCents: r.price_cents,
    period: r.period,
    description: r.description,
    active: !!r.active,
    createdAt: r.created_at,
  };
}

function mapEnrollment(r) {
  if (!r) return null;
  return {
    id: r.id,
    studentId: r.student_id,
    planId: r.plan_id,
    startDate: r.start_date,
    endDate: r.end_date,
    amountCents: r.amount_cents,
    paid: !!r.paid,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapMenu(r) {
  if (!r) return null;
  return {
    id: r.id,
    menuDate: r.menu_date,
    meal: r.meal,
    dishes: r.dishes,
    createdAt: r.created_at,
  };
}

function mapAttendance(r) {
  if (!r) return null;
  return {
    id: r.id,
    studentId: r.student_id,
    attendDate: r.attend_date,
    meal: r.meal,
    status: r.status,
    pickedUpBy: r.picked_up_by,
    checkedAt: r.checked_at,
    remark: r.remark,
  };
}

function mapRole(r) {
  if (!r) return null;
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    createdAt: r.created_at,
  };
}

function mapPermission(r) {
  if (!r) return null;
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    module: r.module,
    description: r.description,
    createdAt: r.created_at,
  };
}

function mapAccount(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    roleId: r.role_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAccountWithRole(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    roleId: r.role_id,
    roleCode: r.role_code,
    roleName: r.role_name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapParentBinding(r) {
  if (!r) return null;
  return {
    id: r.id,
    accountId: r.account_id,
    studentId: r.student_id,
    relation: r.relation,
    isPrimary: !!r.is_primary,
    createdAt: r.created_at,
  };
}

function mapTeacherAssignment(r) {
  if (!r) return null;
  return {
    id: r.id,
    accountId: r.account_id,
    studentId: r.student_id,
    createdAt: r.created_at,
  };
}

function mapFieldRule(r) {
  if (!r) return null;
  return {
    id: r.id,
    tableName: r.table_name,
    fieldName: r.field_name,
    roleCode: r.role_code,
    accessLevel: r.access_level,
    maskRule: r.mask_rule,
    createdAt: r.created_at,
  };
}

/* ------------------------- 可见域工具 ------------------------- */

function appendStudentScopeToWhere(where, params, scope) {
  if (!scope || !scope.roleCode) return;
  if (scope.roleCode === ROLE_CODES.ADMIN) return;
  if (!scope.visibleStudentIds || scope.visibleStudentIds.size === 0) {
    where.push('1 = 0');
    return;
  }
  const ids = [...scope.visibleStudentIds];
  const placeholders = ids.map(() => '?').join(',');
  where.push(`students.id IN (${placeholders})`);
  params.push(...ids);
}

function appendScopeByStudentId(where, params, studentIdCol, scope) {
  if (!scope || !scope.roleCode) return;
  if (scope.roleCode === ROLE_CODES.ADMIN) return;
  if (!scope.visibleStudentIds || scope.visibleStudentIds.size === 0) {
    where.push('1 = 0');
    return;
  }
  const ids = [...scope.visibleStudentIds];
  const placeholders = ids.map(() => '?').join(',');
  where.push(`${studentIdCol} IN (${placeholders})`);
  params.push(...ids);
}

function scopeFromAuth(auth) {
  if (!auth) return { roleCode: null, visibleStudentIds: new Set() };
  return {
    roleCode: auth.roleCode,
    visibleStudentIds: auth.visibleStudentIds || new Set(),
  };
}

/* ------------------------- 字段级安全规则（内存缓存） ------------------------- */

let _fieldRulesCache = null;
let _fieldRulesCacheAt = 0;
const CACHE_TTL_MS = 3000;

async function loadFieldRulesMap() {
  const now = Date.now();
  if (_fieldRulesCache && now - _fieldRulesCacheAt < CACHE_TTL_MS) return _fieldRulesCache;
  const [rows] = await pool.query('SELECT * FROM field_security_rules');
  const map = {};
  for (const r of rows) {
    const key = `${r.table_name}:${r.role_code}`;
    if (!map[key]) map[key] = {};
    // DB field_name -> camelCase
    const camel = r.field_name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    map[key][camel] = {
      accessLevel: r.access_level,
      maskRule: r.mask_rule,
    };
  }
  _fieldRulesCache = map;
  _fieldRulesCacheAt = now;
  return map;
}

function invalidateFieldRulesCache() {
  _fieldRulesCache = null;
  _fieldRulesCacheAt = 0;
}

/* =============================================================
   初始化 / 重置（包含账号密码 hash）
   ============================================================= */

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of [
      'attendances',
      'enrollments',
      'daily_menus',
      'meal_plans',
      'teacher_student_assignments',
      'parent_student_bindings',
      'students',
      'accounts',
      'role_permissions',
      'permissions',
      'roles',
      'field_security_rules',
    ]) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- roles ---
    await conn.query(
      `INSERT INTO roles (id, code, name, description) VALUES
        (1,'ADMIN','系统管理员','全局可见、全操作权限'),
        (2,'TEACHER','带班老师','查看所负责班次学生、登记出勤'),
        (3,'KITCHEN','厨房管理员','排菜单、查看备餐统计，看不到敏感隐私'),
        (4,'PARENT','学生家长','只能查看和操作自己孩子的数据')`,
    );

    // --- permissions ---
    await conn.query(
      `INSERT INTO permissions (id, code, name, module) VALUES
        (1,'student:list','查看学生列表','students'),
        (2,'student:read','查看学生详情','students'),
        (3,'student:create','新增学生','students'),
        (4,'student:update','编辑学生','students'),
        (5,'student:delete','删除学生','students'),
        (10,'plan:list','查看套餐列表','plans'),
        (11,'plan:read','查看套餐详情','plans'),
        (12,'plan:create','新增套餐','plans'),
        (20,'enrollment:list','查看报名/账单','enrollments'),
        (21,'enrollment:read','查看报名详情','enrollments'),
        (22,'enrollment:create','登记报名','enrollments'),
        (23,'enrollment:pay','标记缴费','enrollments'),
        (30,'menu:list','查看菜单','menus'),
        (31,'menu:upsert','新增/更新菜单','menus'),
        (40,'attendance:list','查看出勤记录','attendances'),
        (41,'attendance:create','登记出勤','attendances'),
        (50,'account:manage','账号管理','system'),
        (51,'role:manage','角色权限管理','system'),
        (52,'binding:manage','家长-学生绑定管理','system'),
        (53,'binding:read','查看自己的绑定','system')`,
    );

    // --- role_permissions ---
    const adminPerms = [1,2,3,4,5,10,11,12,20,21,22,23,30,31,40,41,50,51,52,53];
    const teacherPerms = [1,2,10,11,20,21,30,40,41,53];
    const kitchenPerms = [1,2,10,11,30,31,40,53];
    const parentPerms = [1,2,10,11,20,21,30,40,53];
    const rpRows = [];
    for (const p of adminPerms) rpRows.push([1, p]);
    for (const p of teacherPerms) rpRows.push([2, p]);
    for (const p of kitchenPerms) rpRows.push([3, p]);
    for (const p of parentPerms) rpRows.push([4, p]);
    await conn.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
      [rpRows],
    );

    // --- field_security_rules ---
    await conn.query(
      `INSERT INTO field_security_rules (table_name, field_name, role_code, access_level, mask_rule) VALUES
        ('students','guardian_phone','TEACHER','MASKED','PHONE'),
        ('students','guardian_name','TEACHER','MASKED','NAME'),
        ('students','home_address','TEACHER','MASKED','ADDRESS'),
        ('students','guardian_phone','KITCHEN','HIDDEN','NONE'),
        ('students','guardian_name','KITCHEN','HIDDEN','NONE'),
        ('students','home_address','KITCHEN','HIDDEN','NONE'),
        ('students','guardian_phone','PARENT','FULL','NONE'),
        ('students','guardian_name','PARENT','FULL','NONE'),
        ('students','home_address','PARENT','FULL','NONE'),
        ('students','guardian_phone','ADMIN','FULL','NONE'),
        ('students','guardian_name','ADMIN','FULL','NONE'),
        ('students','home_address','ADMIN','FULL','NONE')`,
    );

    // --- students ---
    await conn.query(
      `INSERT INTO students (id, student_no, name, grade, school, guardian_name, guardian_phone, home_address, allergies, status) VALUES
        (1,'XS2026001','小明','三年级','实验小学','王女士','13800001111','北京市朝阳区幸福小区1号楼101室','花生','ACTIVE'),
        (2,'XS2026002','小红','四年级','实验小学','李先生','13800002222','北京市海淀区阳光花园2栋302','','ACTIVE'),
        (3,'XS2026003','小刚','二年级','中心小学','张女士','13800003333','北京市西城区平安大道88号','海鲜','ACTIVE'),
        (4,'XS2026004','小丽','五年级','中心小学','赵先生','13800004444','北京市东城区和平里5号楼505','','INACTIVE')`,
    );

    // --- meal_plans ---
    await conn.query(
      `INSERT INTO meal_plans (id, name, meals, price_cents, period, description, active) VALUES
        (1,'工作日午餐月套餐','LUNCH',60000,'MONTHLY','周一至周五午餐',1),
        (2,'午晚两餐月套餐','LUNCH,DINNER',99000,'MONTHLY','周一至周五午餐+晚餐含作业辅导',1),
        (3,'单日午餐','LUNCH',3000,'DAILY','临时单日午餐',1)`,
    );

    // --- enrollments ---
    await conn.query(
      `INSERT INTO enrollments (id, student_id, plan_id, start_date, end_date, amount_cents, paid, status) VALUES
        (1,1,1,'2026-06-01','2026-06-30',60000,1,'ACTIVE'),
        (2,2,2,'2026-06-01','2026-06-30',99000,1,'ACTIVE'),
        (3,3,1,'2026-06-01','2026-06-30',60000,0,'ACTIVE')`,
    );

    // --- daily_menus ---
    await conn.query(
      `INSERT INTO daily_menus (id, menu_date, meal, dishes) VALUES
        (1,'2026-06-05','LUNCH','红烧鸡腿、清炒时蔬、紫菜蛋汤、米饭'),
        (2,'2026-06-05','DINNER','番茄牛腩、蒜蓉西兰花、米饭'),
        (3,'2026-06-06','LUNCH','糖醋里脊、麻婆豆腐、冬瓜汤、米饭')`,
    );

    // --- attendances ---
    await conn.query(
      `INSERT INTO attendances (id, student_id, attend_date, meal, status, picked_up_by, remark) VALUES
        (1,1,'2026-06-05','LUNCH','PRESENT','','正常用餐'),
        (2,2,'2026-06-05','LUNCH','PRESENT','','正常用餐'),
        (3,3,'2026-06-05','LUNCH','ABSENT','','家长请假')`,
    );

    // --- accounts（使用 bcryptjs 正确生成 hash） ---
    const accounts = [
      // id, username, password, displayName, roleId
      [1, 'admin',    'admin123',   '超级管理员', 1],
      [2, 'teacher1', 'teacher123', '王老师',     2],
      [3, 'teacher2', 'teacher123', '李老师',     2],
      [4, 'kitchen1', 'kitchen123', '厨房张师傅', 3],
      [5, 'parent1',  'parent123',  '王女士(小明妈妈)', 4],
      [6, 'parent2',  'parent123',  '张女士(小刚妈妈，两个孩子)', 4],
    ];
    for (const [id, u, p, dn, rid] of accounts) {
      await conn.query(
        `INSERT INTO accounts (id, username, password_hash, display_name, role_id, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [id, u, hashPassword(p), dn, rid],
      );
    }

    // --- 家长-学生绑定 ---
    // parent1 (id=5) 绑定 小明(id=1)
    // parent2 (id=6) 绑定 小刚(id=3) 和 小丽(id=4) —— 多孩子家长
    await conn.query(
      `INSERT INTO parent_student_bindings (account_id, student_id, relation, is_primary) VALUES
        (5,1,'MOTHER',1),
        (6,3,'MOTHER',1),
        (6,4,'AUNT',0)`,
    );

    // --- 老师-学生分配 ---
    // teacher1 (id=2) 负责实验小学：小明(1)、小红(2)
    // teacher2 (id=3) 跨班：负责 小红(2)、小刚(3)、小丽(4)
    await conn.query(
      `INSERT INTO teacher_student_assignments (account_id, student_id) VALUES
        (2,1),(2,2),
        (3,2),(3,3),(3,4)`,
    );

    invalidateFieldRulesCache();
  } finally {
    conn.release();
  }
}

/* =============================================================
   角色 / 权限 / 账号 / 绑定 —— 鉴权相关
   ============================================================= */

async function getRoleById(id) {
  const [rows] = await pool.query('SELECT * FROM roles WHERE id = ?', [id]);
  return mapRole(rows[0]);
}

async function getRoleByCode(code) {
  const [rows] = await pool.query('SELECT * FROM roles WHERE code = ?', [code]);
  return mapRole(rows[0]);
}

async function listRoles() {
  const [rows] = await pool.query('SELECT * FROM roles ORDER BY id');
  return rows.map(mapRole);
}

async function listPermissions({ module } = {}) {
  const where = [];
  const params = [];
  if (module) { where.push('module = ?'); params.push(module); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM permissions ${clause} ORDER BY id`, params);
  return rows.map(mapPermission);
}

async function listPermissionsByRoleId(roleId) {
  const [rows] = await pool.query(
    `SELECT p.* FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ? ORDER BY p.id`,
    [roleId],
  );
  return rows.map(mapPermission);
}

async function getPermissionCodesByRoleId(roleId) {
  const [rows] = await pool.query(
    `SELECT p.code FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ?`,
    [roleId],
  );
  return rows.map((r) => r.code);
}

async function setRolePermissions(roleId, permissionIds) {
  const conn = await pool.getConnection();
  try {
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    if (permissionIds.length) {
      const rows = permissionIds.map((pid) => [roleId, pid]);
      await conn.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
        [rows],
      );
    }
  } finally {
    conn.release();
  }
}

async function listFieldSecurityRules({ tableName, roleCode } = {}) {
  const where = [];
  const params = [];
  if (tableName) { where.push('table_name = ?'); params.push(tableName); }
  if (roleCode) { where.push('role_code = ?'); params.push(roleCode); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM field_security_rules ${clause} ORDER BY id`, params);
  return rows.map(mapFieldRule);
}

async function getAccountById(id) {
  const [rows] = await pool.query('SELECT * FROM accounts WHERE id = ?', [id]);
  return mapAccount(rows[0]);
}

async function getAccountByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM accounts WHERE username = ?', [username]);
  return mapAccount(rows[0]);
}

async function getAccountWithRole(id) {
  const [rows] = await pool.query(
    `SELECT a.*, r.code AS role_code, r.name AS role_name
     FROM accounts a INNER JOIN roles r ON a.role_id = r.id
     WHERE a.id = ?`,
    [id],
  );
  return mapAccountWithRole(rows[0]);
}

async function listAccounts({ status, roleCode } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (roleCode) { where.push('r.code = ?'); params.push(roleCode); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT a.*, r.code AS role_code, r.name AS role_name
     FROM accounts a INNER JOIN roles r ON a.role_id = r.id
     ${clause} ORDER BY a.id`,
    params,
  );
  return rows.map((r) => {
    const a = mapAccountWithRole(r);
    delete a.passwordHash;
    return a;
  });
}

async function createAccount({ username, passwordHash, displayName, roleId, status }) {
  const [r] = await pool.query(
    `INSERT INTO accounts (username, password_hash, display_name, role_id, status)
     VALUES (?, ?, ?, ?, ?)`,
    [username, passwordHash, displayName || '', roleId, status || 'ACTIVE'],
  );
  return getAccountWithRole(r.insertId);
}

async function updateAccount(id, patch) {
  const map = {
    displayName: 'display_name',
    passwordHash: 'password_hash',
    roleId: 'role_id',
    status: 'status',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getAccountWithRole(id);
}

async function deleteAccount(id) {
  const [r] = await pool.query('DELETE FROM accounts WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/** 根据账号ID和角色代码计算该账号可见的学生ID列表（查询层强制过滤） */
async function getVisibleStudentIds(accountId, roleCode) {
  switch (roleCode) {
    case ROLE_CODES.ADMIN: {
      const [rows] = await pool.query('SELECT id FROM students');
      return rows.map((r) => r.id);
    }
    case ROLE_CODES.TEACHER: {
      const [rows] = await pool.query(
        'SELECT DISTINCT student_id FROM teacher_student_assignments WHERE account_id = ?',
        [accountId],
      );
      return rows.map((r) => r.student_id);
    }
    case ROLE_CODES.PARENT: {
      const [rows] = await pool.query(
        'SELECT DISTINCT student_id FROM parent_student_bindings WHERE account_id = ?',
        [accountId],
      );
      return rows.map((r) => r.student_id);
    }
    case ROLE_CODES.KITCHEN: {
      // 厨房可以看到所有学生的"非隐私"字段（用于备餐人数统计），通过字段级规则脱敏
      const [rows] = await pool.query('SELECT id FROM students');
      return rows.map((r) => r.id);
    }
    default:
      return [];
  }
}

/* ----------------- 家长-学生绑定 ----------------- */

async function getParentBinding(accountId, studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM parent_student_bindings WHERE account_id = ? AND student_id = ?',
    [accountId, studentId],
  );
  return mapParentBinding(rows[0]);
}

async function getParentBindingById(id) {
  const [rows] = await pool.query('SELECT * FROM parent_student_bindings WHERE id = ?', [id]);
  return mapParentBinding(rows[0]);
}

async function listAllParentBindings({ accountId, studentId } = {}) {
  const where = [];
  const params = [];
  if (accountId !== undefined) { where.push('account_id = ?'); params.push(accountId); }
  if (studentId !== undefined) { where.push('student_id = ?'); params.push(studentId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM parent_student_bindings ${clause} ORDER BY id`,
    params,
  );
  return rows.map(mapParentBinding);
}

async function listParentBindingsByAccount(accountId) {
  const [rows] = await pool.query(
    'SELECT * FROM parent_student_bindings WHERE account_id = ? ORDER BY id',
    [accountId],
  );
  return rows.map(mapParentBinding);
}

async function createParentBinding({ accountId, studentId, relation, isPrimary }) {
  const [r] = await pool.query(
    `INSERT INTO parent_student_bindings (account_id, student_id, relation, is_primary)
     VALUES (?, ?, ?, ?)`,
    [accountId, studentId, relation || 'PARENT', isPrimary ? 1 : 0],
  );
  return getParentBindingById(r.insertId);
}

async function deleteParentBinding(id) {
  const [r] = await pool.query('DELETE FROM parent_student_bindings WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* ----------------- 教师-学生分配 ----------------- */

async function getTeacherAssignment(accountId, studentId) {
  const [rows] = await pool.query(
    'SELECT * FROM teacher_student_assignments WHERE account_id = ? AND student_id = ?',
    [accountId, studentId],
  );
  return mapTeacherAssignment(rows[0]);
}

async function getTeacherAssignmentById(id) {
  const [rows] = await pool.query('SELECT * FROM teacher_student_assignments WHERE id = ?', [id]);
  return mapTeacherAssignment(rows[0]);
}

async function listAllTeacherAssignments({ accountId, studentId } = {}) {
  const where = [];
  const params = [];
  if (accountId !== undefined) { where.push('account_id = ?'); params.push(accountId); }
  if (studentId !== undefined) { where.push('student_id = ?'); params.push(studentId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM teacher_student_assignments ${clause} ORDER BY id`,
    params,
  );
  return rows.map(mapTeacherAssignment);
}

async function listTeacherAssignmentsByAccount(accountId) {
  const [rows] = await pool.query(
    'SELECT * FROM teacher_student_assignments WHERE account_id = ? ORDER BY id',
    [accountId],
  );
  return rows.map(mapTeacherAssignment);
}

async function createTeacherAssignment({ accountId, studentId }) {
  const [r] = await pool.query(
    'INSERT INTO teacher_student_assignments (account_id, student_id) VALUES (?, ?)',
    [accountId, studentId],
  );
  return getTeacherAssignmentById(r.insertId);
}

async function deleteTeacherAssignment(id) {
  const [r] = await pool.query('DELETE FROM teacher_student_assignments WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* =============================================================
   学生（带可见域过滤 + 字段脱敏）
   ============================================================= */

async function listStudents({ status, school } = {}, auth = null) {
  const scope = scopeFromAuth(auth);
  const where = [];
  const params = [];
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (school !== undefined) { where.push('school = ?'); params.push(school); }
  appendStudentScopeToWhere(where, params, scope);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM students ${clause} ORDER BY id`, params);
  const fieldRules = await loadFieldRulesMap();
  return applyFieldSecurityList('students', rows.map(mapStudent), scope.roleCode, fieldRules);
}

async function getStudent(id, auth = null) {
  const scope = scopeFromAuth(auth);
  const where = ['id = ?'];
  const params = [id];
  appendStudentScopeToWhere(where, params, scope);
  const [rows] = await pool.query(
    `SELECT * FROM students WHERE ${where.join(' AND ')} LIMIT 1`,
    params,
  );
  if (!rows[0]) return null;
  const fieldRules = await loadFieldRulesMap();
  return applyFieldSecurity('students', mapStudent(rows[0]), scope.roleCode, fieldRules);
}

async function findStudentByNo(studentNo) {
  const [rows] = await pool.query('SELECT * FROM students WHERE student_no = ?', [studentNo]);
  return mapStudent(rows[0]);
}

async function createStudent(s) {
  const [r] = await pool.query(
    `INSERT INTO students (student_no, name, grade, school, guardian_name, guardian_phone, home_address, allergies, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.studentNo, s.name, s.grade || '', s.school || '', s.guardianName || '',
     s.guardianPhone || '', s.homeAddress || '', s.allergies || '', s.status || 'ACTIVE'],
  );
  return getStudent(r.insertId);
}

async function updateStudent(id, patch) {
  const map = {
    name: 'name', grade: 'grade', school: 'school',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone',
    homeAddress: 'home_address',
    allergies: 'allergies', status: 'status',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getStudent(id);
}

async function deleteStudent(id) {
  const [r] = await pool.query('DELETE FROM students WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* =============================================================
   套餐
   ============================================================= */

async function listPlans({ activeOnly } = {}) {
  const clause = activeOnly ? 'WHERE active = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM meal_plans ${clause} ORDER BY id`);
  return rows.map(mapPlan);
}

async function getPlan(id) {
  const [rows] = await pool.query('SELECT * FROM meal_plans WHERE id = ?', [id]);
  return mapPlan(rows[0]);
}

async function createPlan(p) {
  const [r] = await pool.query(
    `INSERT INTO meal_plans (name, meals, price_cents, period, description, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p.name, p.meals || 'LUNCH', p.priceCents || 0, p.period || 'MONTHLY',
     p.description || '', p.active === false ? 0 : 1],
  );
  return getPlan(r.insertId);
}

/* =============================================================
   报名/账单（带学生可见域过滤）
   ============================================================= */

async function listEnrollments({ studentId } = {}, auth = null) {
  const scope = scopeFromAuth(auth);
  const where = [];
  const params = [];
  if (studentId !== undefined) {
    where.push('student_id = ?');
    params.push(studentId);
  }
  appendScopeByStudentId(where, params, 'enrollments.student_id', scope);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM enrollments ${clause} ORDER BY id`,
    params,
  );
  return rows.map(mapEnrollment);
}

async function getEnrollment(id, auth = null) {
  const scope = scopeFromAuth(auth);
  const where = ['enrollments.id = ?'];
  const params = [id];
  appendScopeByStudentId(where, params, 'enrollments.student_id', scope);
  const [rows] = await pool.query(
    `SELECT * FROM enrollments WHERE ${where.join(' AND ')} LIMIT 1`,
    params,
  );
  return mapEnrollment(rows[0]);
}

async function createEnrollment(e) {
  const [r] = await pool.query(
    `INSERT INTO enrollments (student_id, plan_id, start_date, end_date, amount_cents, paid, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [e.studentId, e.planId, e.startDate, e.endDate, e.amountCents, e.paid ? 1 : 0, e.status || 'ACTIVE'],
  );
  return getEnrollment(r.insertId);
}

async function markEnrollmentPaid(id) {
  await pool.query('UPDATE enrollments SET paid = 1 WHERE id = ?', [id]);
  return getEnrollment(id);
}

/* =============================================================
   菜单
   ============================================================= */

async function listMenus({ date } = {}) {
  if (date !== undefined) {
    const [rows] = await pool.query(
      'SELECT * FROM daily_menus WHERE menu_date = ? ORDER BY meal', [date]);
    return rows.map(mapMenu);
  }
  const [rows] = await pool.query('SELECT * FROM daily_menus ORDER BY menu_date DESC, meal');
  return rows.map(mapMenu);
}

async function findMenu(date, meal) {
  const [rows] = await pool.query(
    'SELECT * FROM daily_menus WHERE menu_date = ? AND meal = ?', [date, meal]);
  return mapMenu(rows[0]);
}

async function upsertMenu(m) {
  await pool.query(
    `INSERT INTO daily_menus (menu_date, meal, dishes) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE dishes = VALUES(dishes)`,
    [m.menuDate, m.meal, m.dishes || ''],
  );
  return findMenu(m.menuDate, m.meal);
}

/* =============================================================
   出勤/签到（带学生可见域过滤）
   ============================================================= */

async function listAttendances({ date, studentId } = {}, auth = null) {
  const scope = scopeFromAuth(auth);
  const where = [];
  const params = [];
  if (date !== undefined) { where.push('attend_date = ?'); params.push(date); }
  if (studentId !== undefined) { where.push('student_id = ?'); params.push(studentId); }
  appendScopeByStudentId(where, params, 'attendances.student_id', scope);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM attendances ${clause} ORDER BY attend_date DESC, id`, params);
  return rows.map(mapAttendance);
}

async function findAttendance(studentId, date, meal) {
  const [rows] = await pool.query(
    'SELECT * FROM attendances WHERE student_id = ? AND attend_date = ? AND meal = ?',
    [studentId, date, meal]);
  return mapAttendance(rows[0]);
}

async function createAttendance(a) {
  const [r] = await pool.query(
    `INSERT INTO attendances (student_id, attend_date, meal, status, picked_up_by, remark)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [a.studentId, a.attendDate, a.meal, a.status || 'PRESENT', a.pickedUpBy || '', a.remark || ''],
  );
  const [rows] = await pool.query('SELECT * FROM attendances WHERE id = ?', [r.insertId]);
  return mapAttendance(rows[0]);
}

/* =============================================================
   厨房统计视图（按日期、餐次的人数统计，不涉及隐私字段）
   ============================================================= */

async function getMealCountStats({ date, meal } = {}) {
  const where = ["a.status = 'PRESENT'"];
  const params = [];
  if (date) { where.push('a.attend_date = ?'); params.push(date); }
  if (meal) { where.push('a.meal = ?'); params.push(meal); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT a.attend_date AS attendDate, a.meal, COUNT(*) AS presentCount
     FROM attendances a ${clause} GROUP BY a.attend_date, a.meal ORDER BY a.attend_date DESC, a.meal`,
    params,
  );
  return rows.map((r) => ({
    attendDate: r.attendDate,
    meal: r.meal,
    presentCount: Number(r.presentCount),
  }));
}

module.exports = {
  seed,
  invalidateFieldRulesCache,
  loadFieldRulesMap,
  getVisibleStudentIds,

  // roles / permissions
  getRoleById, getRoleByCode, listRoles,
  listPermissions, listPermissionsByRoleId, getPermissionCodesByRoleId, setRolePermissions,
  listFieldSecurityRules,

  // accounts
  getAccountById, getAccountByUsername, getAccountWithRole,
  listAccounts, createAccount, updateAccount, deleteAccount,

  // parent-student bindings
  getParentBinding, getParentBindingById, listAllParentBindings, listParentBindingsByAccount,
  createParentBinding, deleteParentBinding,

  // teacher-student assignments
  getTeacherAssignment, getTeacherAssignmentById,
  listAllTeacherAssignments, listTeacherAssignmentsByAccount,
  createTeacherAssignment, deleteTeacherAssignment,

  // students
  listStudents, getStudent, findStudentByNo, createStudent, updateStudent, deleteStudent,

  // plans
  listPlans, getPlan, createPlan,

  // enrollments
  listEnrollments, getEnrollment, createEnrollment, markEnrollmentPaid,

  // menus
  listMenus, findMenu, upsertMenu,

  // attendances
  listAttendances, findAttendance, createAttendance,

  // stats
  getMealCountStats,
};
