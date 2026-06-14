-- 学生小饭桌管理平台 - 初始化（建表 + 种子数据）
-- 注意建表顺序：先被引用的表、后引用方（避免外键循环依赖）

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ====== 无外键的基础表 ======

CREATE TABLE IF NOT EXISTS roles (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    code        VARCHAR(32)  NOT NULL,
    name        VARCHAR(64)  NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    module      VARCHAR(32)  NOT NULL DEFAULT '',
    description VARCHAR(255) NOT NULL DEFAULT '',
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_permissions_code (code),
    KEY idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    student_no     VARCHAR(32)  NOT NULL,
    name           VARCHAR(64)  NOT NULL,
    grade          VARCHAR(32)  NOT NULL DEFAULT '',
    school         VARCHAR(128) NOT NULL DEFAULT '',
    guardian_name  VARCHAR(64)  NOT NULL DEFAULT '',
    guardian_phone VARCHAR(20)  NOT NULL DEFAULT '',
    home_address   VARCHAR(255) NOT NULL DEFAULT '',
    allergies      VARCHAR(255) NOT NULL DEFAULT '',
    status         VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_students_no (student_no),
    KEY idx_students_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plans (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    name         VARCHAR(64)  NOT NULL,
    meals        VARCHAR(64)  NOT NULL DEFAULT 'LUNCH',
    price_cents  INT          NOT NULL DEFAULT 0,
    period       VARCHAR(16)  NOT NULL DEFAULT 'MONTHLY',
    description  VARCHAR(500) NOT NULL DEFAULT '',
    active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_menus (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    menu_date   DATE         NOT NULL,
    meal        VARCHAR(16)  NOT NULL DEFAULT 'LUNCH',
    dishes      VARCHAR(1000) NOT NULL DEFAULT '',
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_menu_date_meal (menu_date, meal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_security_rules (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    table_name   VARCHAR(64)  NOT NULL,
    field_name   VARCHAR(64)  NOT NULL,
    role_code    VARCHAR(32)  NOT NULL,
    access_level VARCHAR(16)  NOT NULL DEFAULT 'FULL',
    mask_rule    VARCHAR(32)  NOT NULL DEFAULT 'NONE',
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_field_role (table_name, field_name, role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====== 依赖 roles / permissions ======

CREATE TABLE IF NOT EXISTS role_permissions (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    role_id       BIGINT      NOT NULL,
    permission_id BIGINT      NOT NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_role_perm (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====== 依赖 roles ======

CREATE TABLE IF NOT EXISTS accounts (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(64)  NOT NULL DEFAULT '',
    role_id       BIGINT       NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_accounts_username (username),
    KEY idx_accounts_role (role_id),
    CONSTRAINT fk_accounts_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====== 依赖 accounts + students ======

CREATE TABLE IF NOT EXISTS parent_student_bindings (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    account_id   BIGINT      NOT NULL,
    student_id   BIGINT      NOT NULL,
    relation     VARCHAR(32) NOT NULL DEFAULT 'PARENT',
    is_primary   TINYINT(1)  NOT NULL DEFAULT 0,
    created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_parent_student (account_id, student_id),
    KEY idx_binding_student (student_id),
    CONSTRAINT fk_pb_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    CONSTRAINT fk_pb_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_student_assignments (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    account_id BIGINT      NOT NULL,
    student_id BIGINT      NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_teacher_student (account_id, student_id),
    KEY idx_ta_student (student_id),
    CONSTRAINT fk_ta_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====== 依赖 students + meal_plans ======

CREATE TABLE IF NOT EXISTS enrollments (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    student_id   BIGINT       NOT NULL,
    plan_id      BIGINT       NOT NULL,
    start_date   DATE         NOT NULL,
    end_date     DATE         NOT NULL,
    amount_cents INT          NOT NULL DEFAULT 0,
    paid         TINYINT(1)   NOT NULL DEFAULT 0,
    status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_enroll_student (student_id),
    KEY idx_enroll_plan (plan_id),
    CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_enroll_plan FOREIGN KEY (plan_id) REFERENCES meal_plans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====== 依赖 students ======

CREATE TABLE IF NOT EXISTS attendances (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    student_id   BIGINT       NOT NULL,
    attend_date  DATE         NOT NULL,
    meal         VARCHAR(16)  NOT NULL DEFAULT 'LUNCH',
    status       VARCHAR(16)  NOT NULL DEFAULT 'PRESENT',
    picked_up_by VARCHAR(64)  NOT NULL DEFAULT '',
    checked_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    remark       VARCHAR(255) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    UNIQUE KEY uk_attend (student_id, attend_date, meal),
    KEY idx_attend_date (attend_date),
    CONSTRAINT fk_attend_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ====== 种子数据：角色 ======

INSERT INTO roles (id, code, name, description) VALUES
(1, 'ADMIN',   '管理员', '拥有平台全部权限的超级管理员'),
(2, 'TEACHER', '老师',   '负责出勤登记、学生管理的带班老师'),
(3, 'KITCHEN', '厨房',   '管理菜单、查看备餐人数统计的厨房操作员'),
(4, 'PARENT',  '家长',   '查看自己孩子数据、请假、缴费的家长端账号')
ON DUPLICATE KEY UPDATE code = VALUES(code);

-- ====== 种子数据：权限点 ======

INSERT INTO permissions (id, code, name, module) VALUES
-- 学生管理
(1,  'student:list',      '查询学生列表',          'student'),
(2,  'student:read',      '查看学生详情',          'student'),
(3,  'student:create',    '新增学生',              'student'),
(4,  'student:update',    '修改学生信息',          'student'),
(5,  'student:delete',    '删除学生',              'student'),
-- 套餐 / 账单
(10, 'plan:list',         '查询套餐列表',          'plan'),
(11, 'plan:read',         '查看套餐详情',          'plan'),
(12, 'plan:create',       '创建或修改套餐',        'plan'),
(20, 'enrollment:list',   '查询账单列表',          'enrollment'),
(21, 'enrollment:read',   '查看账单详情',          'enrollment'),
(22, 'enrollment:create', '创建账单（登记入学）',  'enrollment'),
(23, 'enrollment:pay',    '账单缴费',              'enrollment'),
-- 菜单
(30, 'menu:list',         '查询每日菜单',          'menu'),
(31, 'menu:upsert',       '创建或修改菜单',        'menu'),
-- 出勤
(40, 'attendance:list',   '查询出勤记录',          'attendance'),
(41, 'attendance:create', '登记出勤',              'attendance'),
(42, 'attendance:stats',  '出勤统计 / 备餐人数',   'attendance'),
-- 系统
(50, 'account:manage',    '管理平台账号',          'system'),
(51, 'role:manage',       '管理角色权限配置',      'system'),
(52, 'binding:manage',    '维护家长-学生绑定',     'system'),
(53, 'binding:read',      '查看家长-学生绑定',     'system'),
(54, 'teacher:assign',    '维护教师-学生分配',     'system'),
(55, 'field:rule',        '配置字段安全规则',      'system')
ON DUPLICATE KEY UPDATE code = VALUES(code);

-- ====== 种子数据：角色-权限 关联 ======
-- ADMIN 拥有全部权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON DUPLICATE KEY UPDATE role_id = role_id;

-- TEACHER：学生+出勤+账单查询+登记
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 2), (2, 4), (2, 10), (2, 11), (2, 20), (2, 21), (2, 23),
(2, 30), (2, 40), (2, 41), (2, 42), (2, 53)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- KITCHEN：菜单全部 + 学生/出勤只读统计（学生敏感字段脱敏/隐藏）
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 1), (3, 2), (3, 10), (3, 11), (3, 30), (3, 31), (3, 40), (3, 42), (3, 53)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- PARENT：自己孩子学生详情+账单+出勤+菜单只读
INSERT INTO role_permissions (role_id, permission_id) VALUES
(4, 1), (4, 2), (4, 10), (4, 11), (4, 20), (4, 21), (4, 23),
(4, 30), (4, 40), (4, 41), (4, 53)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- ====== 种子数据：账号（bcrypt cost=10，实际密码见 store.js seed）======
-- 密码会在 store.seed() 里用 bcryptjs.hashSync 覆盖写入，此处占坑

INSERT INTO accounts (id, username, password_hash, display_name, role_id, status) VALUES
(1, 'admin',    '$2a$10$placeholder', '系统管理员', 1, 'ACTIVE'),
(2, 'teacher1', '$2a$10$placeholder', '李老师',     2, 'ACTIVE'),
(3, 'teacher2', '$2a$10$placeholder', '王老师',     2, 'ACTIVE'),
(4, 'kitchen1', '$2a$10$placeholder', '张师傅',     3, 'ACTIVE'),
(5, 'parent1',  '$2a$10$placeholder', '小明妈妈',   4, 'ACTIVE'),
(6, 'parent2',  '$2a$10$placeholder', '小刚爸爸',   4, 'ACTIVE')
ON DUPLICATE KEY UPDATE username = VALUES(username);

-- ====== 种子数据：学生 ======

INSERT INTO students (id, student_no, name, grade, school, guardian_name, guardian_phone, home_address, allergies) VALUES
(1, 'S2024001', '小明', '三年级1班', '阳光小学', '王芳', '13800001111', '北京市朝阳区望京路88号院1号楼', '花生'),
(2, 'S2024002', '小红', '三年级2班', '阳光小学', '李丽', '13800002222', '北京市朝阳区望京路88号院2号楼', ''),
(3, 'S2024003', '小刚', '四年级1班', '阳光小学', '张强', '13800003333', '北京市海淀区中关村大街1号', '海鲜'),
(4, 'S2024004', '小丽', '四年级2班', '阳光小学', '赵敏', '13800004444', '北京市海淀区中关村大街1号', '')
ON DUPLICATE KEY UPDATE student_no = VALUES(student_no);

-- ====== 种子数据：家长-学生绑定 ======

INSERT INTO parent_student_bindings (account_id, student_id, relation, is_primary) VALUES
(5, 1, 'MOTHER', 1),
(6, 3, 'FATHER', 1),
(6, 4, 'FATHER', 0)
ON DUPLICATE KEY UPDATE relation = VALUES(relation);

-- ====== 种子数据：教师-学生分配 ======

INSERT INTO teacher_student_assignments (account_id, student_id) VALUES
(2, 1), (2, 2),
(3, 2), (3, 3), (3, 4)
ON DUPLICATE KEY UPDATE account_id = account_id;

-- ====== 种子数据：字段安全规则（默认配置）======
-- 规则：ADMIN 完全可见；TEACHER 看脱敏；KITCHEN 完全隐藏隐私；PARENT 看自己孩子 FULL（store 额外处理）

INSERT INTO field_security_rules (table_name, field_name, role_code, access_level, mask_rule) VALUES
-- guardian_name
('students', 'guardian_name',  'ADMIN',   'FULL',   'NONE'),
('students', 'guardian_name',  'TEACHER', 'MASKED', 'NAME'),
('students', 'guardian_name',  'KITCHEN', 'HIDDEN', 'NONE'),
('students', 'guardian_name',  'PARENT',  'FULL',   'NONE'),
-- guardian_phone
('students', 'guardian_phone', 'ADMIN',   'FULL',   'NONE'),
('students', 'guardian_phone', 'TEACHER', 'MASKED', 'PHONE'),
('students', 'guardian_phone', 'KITCHEN', 'HIDDEN', 'NONE'),
('students', 'guardian_phone', 'PARENT',  'FULL',   'NONE'),
-- home_address
('students', 'home_address',   'ADMIN',   'FULL',   'NONE'),
('students', 'home_address',   'TEACHER', 'MASKED', 'ADDRESS'),
('students', 'home_address',   'KITCHEN', 'HIDDEN', 'NONE'),
('students', 'home_address',   'PARENT',  'FULL',   'NONE')
ON DUPLICATE KEY UPDATE access_level = VALUES(access_level);

-- ====== 种子数据：套餐 / 菜单 / 出勤（业务示例）======

INSERT INTO meal_plans (id, name, meals, price_cents, period, description) VALUES
(1, '午托标准套餐', 'LUNCH', 88000, 'MONTHLY', '午餐 + 午休，30天计费')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO enrollments (student_id, plan_id, start_date, end_date, amount_cents, paid) VALUES
(1, 1, '2025-06-01', '2025-06-30', 88000, 1),
(2, 1, '2025-06-01', '2025-06-30', 88000, 0),
(3, 1, '2025-06-01', '2025-06-30', 88000, 1)
ON DUPLICATE KEY UPDATE student_id = student_id;

INSERT INTO daily_menus (menu_date, meal, dishes) VALUES
('2025-06-12', 'LUNCH', '红烧排骨|清炒时蔬|西红柿鸡蛋汤|米饭'),
('2025-06-13', 'LUNCH', '宫保鸡丁|蒜蓉西兰花|紫菜蛋花汤|米饭')
ON DUPLICATE KEY UPDATE dishes = VALUES(dishes);

INSERT INTO attendances (student_id, attend_date, meal, status) VALUES
(1, '2025-06-12', 'LUNCH', 'PRESENT'),
(2, '2025-06-12', 'LUNCH', 'PRESENT'),
(3, '2025-06-12', 'LUNCH', 'LEAVE')
ON DUPLICATE KEY UPDATE status = VALUES(status);
