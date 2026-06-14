-- 学生小饭桌管理平台 - 种子数据
-- 注意：accounts 的 password_hash 需要用 bcryptjs 在 node 种子脚本中正确生成
SET NAMES utf8mb4;

INSERT IGNORE INTO roles (id, code, name, description) VALUES
  (1, 'ADMIN',   '系统管理员', '全局可见、全操作权限'),
  (2, 'TEACHER', '带班老师',   '查看所负责班次学生、登记出勤'),
  (3, 'KITCHEN', '厨房管理员', '排菜单、查看备餐统计，看不到敏感隐私'),
  (4, 'PARENT',  '学生家长',   '只能查看和操作自己孩子的数据');

INSERT IGNORE INTO permissions (id, code, name, module) VALUES
  (1,  'student:list',     '查看学生列表',       'student'),
  (2,  'student:read',     '查看学生详情',       'student'),
  (3,  'student:create',   '新增学生',           'student'),
  (4,  'student:update',   '编辑学生',           'student'),
  (5,  'student:delete',   '删除学生',           'student'),
  (10, 'plan:list',        '查看套餐列表',       'plan'),
  (11, 'plan:read',        '查看套餐详情',       'plan'),
  (12, 'plan:create',      '新增套餐',           'plan'),
  (20, 'enrollment:list',  '查看报名/账单',      'enrollment'),
  (21, 'enrollment:read',  '查看报名详情',       'enrollment'),
  (22, 'enrollment:create','登记报名',           'enrollment'),
  (23, 'enrollment:pay',   '标记缴费',           'enrollment'),
  (30, 'menu:list',        '查看菜单',           'menu'),
  (31, 'menu:upsert',      '新增/更新菜单',      'menu'),
  (40, 'attendance:list',  '查看出勤记录',       'attendance'),
  (41, 'attendance:create','登记出勤',           'attendance'),
  (42, 'attendance:stats', '出勤统计/备餐人数',  'attendance'),
  (50, 'account:manage',   '账号管理',           'system'),
  (51, 'role:manage',      '角色权限管理',       'system'),
  (52, 'binding:manage',   '家长-学生绑定管理',  'system'),
  (53, 'binding:read',     '查看自己的绑定',     'system'),
  (54, 'teacher:assign',   '教师-学生分配管理',  'system');

INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
  -- ADMIN 全部权限
  (1,1),(1,2),(1,3),(1,4),(1,5),
  (1,10),(1,11),(1,12),
  (1,20),(1,21),(1,22),(1,23),
  (1,30),(1,31),
  (1,40),(1,41),(1,42),
  (1,50),(1,51),(1,52),(1,53),(1,54),
  -- TEACHER
  (2,1),(2,2),(2,4),
  (2,10),(2,11),
  (2,20),(2,21),(2,23),
  (2,30),
  (2,40),(2,41),(2,42),
  (2,53),
  -- KITCHEN
  (3,1),(3,2),
  (3,10),(3,11),
  (3,30),(3,31),
  (3,40),(3,42),
  (3,53),
  -- PARENT
  (4,1),(4,2),
  (4,10),(4,11),
  (4,20),(4,21),(4,23),
  (4,30),
  (4,40),(4,41),
  (4,53);

INSERT IGNORE INTO field_security_rules (table_name, field_name, role_code, access_level, mask_rule) VALUES
  ('students', 'guardian_phone', 'TEACHER', 'MASKED', 'PHONE'),
  ('students', 'guardian_name',  'TEACHER', 'MASKED', 'NAME'),
  ('students', 'home_address',   'TEACHER', 'MASKED', 'ADDRESS'),
  ('students', 'guardian_phone', 'KITCHEN', 'HIDDEN', 'NONE'),
  ('students', 'guardian_name',  'KITCHEN', 'HIDDEN', 'NONE'),
  ('students', 'home_address',   'KITCHEN', 'HIDDEN', 'NONE'),
  ('students', 'guardian_phone', 'PARENT',  'FULL',   'NONE'),
  ('students', 'guardian_name',  'PARENT',  'FULL',   'NONE'),
  ('students', 'home_address',   'PARENT',  'FULL',   'NONE'),
  ('students', 'guardian_phone', 'ADMIN',   'FULL',   'NONE'),
  ('students', 'guardian_name',  'ADMIN',   'FULL',   'NONE'),
  ('students', 'home_address',   'ADMIN',   'FULL',   'NONE');

INSERT IGNORE INTO students (id, student_no, name, grade, school, guardian_name, guardian_phone, home_address, allergies, status) VALUES
  (1, 'XS2026001', '小明', '三年级', '实验小学', '王女士', '13800001111', '北京市朝阳区幸福小区1号楼101室', '花生', 'ACTIVE'),
  (2, 'XS2026002', '小红', '四年级', '实验小学', '李先生', '13800002222', '北京市海淀区阳光花园2栋302',   '',     'ACTIVE'),
  (3, 'XS2026003', '小刚', '二年级', '中心小学', '张女士', '13800003333', '北京市西城区平安大道88号',     '海鲜', 'ACTIVE'),
  (4, 'XS2026004', '小丽', '五年级', '中心小学', '赵先生', '13800004444', '北京市东城区和平里5号楼505',   '',     'INACTIVE');

INSERT IGNORE INTO meal_plans (id, name, meals, price_cents, period, description, active) VALUES
  (1, '工作日午餐月套餐', 'LUNCH', 60000, 'MONTHLY', '周一至周五午餐', 1),
  (2, '午晚两餐月套餐', 'LUNCH,DINNER', 99000, 'MONTHLY', '周一至周五午餐+晚餐含作业辅导', 1),
  (3, '单日午餐', 'LUNCH', 3000, 'DAILY', '临时单日午餐', 1);

INSERT IGNORE INTO enrollments (id, student_id, plan_id, start_date, end_date, amount_cents, paid, status) VALUES
  (1, 1, 1, '2026-06-01', '2026-06-30', 60000, 1, 'ACTIVE'),
  (2, 2, 2, '2026-06-01', '2026-06-30', 99000, 1, 'ACTIVE'),
  (3, 3, 1, '2026-06-01', '2026-06-30', 60000, 0, 'ACTIVE');

INSERT IGNORE INTO daily_menus (id, menu_date, meal, dishes) VALUES
  (1, '2026-06-05', 'LUNCH', '红烧鸡腿、清炒时蔬、紫菜蛋汤、米饭'),
  (2, '2026-06-05', 'DINNER', '番茄牛腩、蒜蓉西兰花、米饭'),
  (3, '2026-06-06', 'LUNCH', '糖醋里脊、麻婆豆腐、冬瓜汤、米饭');

INSERT IGNORE INTO attendances (id, student_id, attend_date, meal, status, picked_up_by, remark) VALUES
  (1, 1, '2026-06-05', 'LUNCH', 'PRESENT', '', '正常用餐'),
  (2, 2, '2026-06-05', 'LUNCH', 'PRESENT', '', '正常用餐'),
  (3, 3, '2026-06-05', 'LUNCH', 'ABSENT',  '', '家长请假');
