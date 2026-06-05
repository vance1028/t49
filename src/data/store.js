'use strict';

/**
 * 数据仓储层 - 基于 MySQL（mysql2/promise）。
 * 所有方法 async，返回 camelCase 字段对象。
 */

const { pool } = require('../db');

/* ----------------------------- 映射 ----------------------------- */

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

/* --------------------------- 初始化/重置 --------------------------- */

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['attendances', 'enrollments', 'daily_menus', 'meal_plans', 'students']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await conn.query(
      `INSERT INTO students (id, student_no, name, grade, school, guardian_name, guardian_phone, allergies, status) VALUES
        (1,'XS2026001','小明','三年级','实验小学','王女士','13800001111','花生','ACTIVE'),
        (2,'XS2026002','小红','四年级','实验小学','李先生','13800002222','','ACTIVE'),
        (3,'XS2026003','小刚','二年级','中心小学','张女士','13800003333','海鲜','ACTIVE'),
        (4,'XS2026004','小丽','五年级','中心小学','赵先生','13800004444','','INACTIVE')`,
    );
    await conn.query(
      `INSERT INTO meal_plans (id, name, meals, price_cents, period, description, active) VALUES
        (1,'工作日午餐月套餐','LUNCH',60000,'MONTHLY','周一至周五午餐',1),
        (2,'午晚两餐月套餐','LUNCH,DINNER',99000,'MONTHLY','周一至周五午餐+晚餐含作业辅导',1),
        (3,'单日午餐','LUNCH',3000,'DAILY','临时单日午餐',1)`,
    );
    await conn.query(
      `INSERT INTO enrollments (id, student_id, plan_id, start_date, end_date, amount_cents, paid, status) VALUES
        (1,1,1,'2026-06-01','2026-06-30',60000,1,'ACTIVE'),
        (2,2,2,'2026-06-01','2026-06-30',99000,1,'ACTIVE'),
        (3,3,1,'2026-06-01','2026-06-30',60000,0,'ACTIVE')`,
    );
    await conn.query(
      `INSERT INTO daily_menus (id, menu_date, meal, dishes) VALUES
        (1,'2026-06-05','LUNCH','红烧鸡腿、清炒时蔬、紫菜蛋汤、米饭'),
        (2,'2026-06-05','DINNER','番茄牛腩、蒜蓉西兰花、米饭'),
        (3,'2026-06-06','LUNCH','糖醋里脊、麻婆豆腐、冬瓜汤、米饭')`,
    );
    await conn.query(
      `INSERT INTO attendances (id, student_id, attend_date, meal, status, picked_up_by, remark) VALUES
        (1,1,'2026-06-05','LUNCH','PRESENT','','正常用餐'),
        (2,2,'2026-06-05','LUNCH','PRESENT','','正常用餐'),
        (3,3,'2026-06-05','LUNCH','ABSENT','','家长请假')`,
    );
  } finally {
    conn.release();
  }
}

/* ----------------------------- 学生 ----------------------------- */

async function listStudents({ status, school } = {}) {
  const where = [];
  const params = [];
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (school !== undefined) { where.push('school = ?'); params.push(school); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM students ${clause} ORDER BY id`, params);
  return rows.map(mapStudent);
}

async function getStudent(id) {
  const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
  return mapStudent(rows[0]);
}

async function findStudentByNo(studentNo) {
  const [rows] = await pool.query('SELECT * FROM students WHERE student_no = ?', [studentNo]);
  return mapStudent(rows[0]);
}

async function createStudent(s) {
  const [r] = await pool.query(
    `INSERT INTO students (student_no, name, grade, school, guardian_name, guardian_phone, allergies, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.studentNo, s.name, s.grade || '', s.school || '', s.guardianName || '',
     s.guardianPhone || '', s.allergies || '', s.status || 'ACTIVE'],
  );
  return getStudent(r.insertId);
}

async function updateStudent(id, patch) {
  const map = {
    name: 'name', grade: 'grade', school: 'school',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone',
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

/* ----------------------------- 套餐 ----------------------------- */

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

/* ----------------------------- 报名/订餐 ----------------------------- */

async function listEnrollments({ studentId } = {}) {
  if (studentId !== undefined) {
    const [rows] = await pool.query(
      'SELECT * FROM enrollments WHERE student_id = ? ORDER BY id', [studentId]);
    return rows.map(mapEnrollment);
  }
  const [rows] = await pool.query('SELECT * FROM enrollments ORDER BY id');
  return rows.map(mapEnrollment);
}

async function getEnrollment(id) {
  const [rows] = await pool.query('SELECT * FROM enrollments WHERE id = ?', [id]);
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

/* ----------------------------- 菜单 ----------------------------- */

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

/* ----------------------------- 出勤/签到 ----------------------------- */

async function listAttendances({ date, studentId } = {}) {
  const where = [];
  const params = [];
  if (date !== undefined) { where.push('attend_date = ?'); params.push(date); }
  if (studentId !== undefined) { where.push('student_id = ?'); params.push(studentId); }
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

module.exports = {
  seed,
  listStudents, getStudent, findStudentByNo, createStudent, updateStudent, deleteStudent,
  listPlans, getPlan, createPlan,
  listEnrollments, getEnrollment, createEnrollment, markEnrollmentPaid,
  listMenus, findMenu, upsertMenu,
  listAttendances, findAttendance, createAttendance,
};
