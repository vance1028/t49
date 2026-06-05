-- 学生小饭桌管理平台 - 种子数据
SET NAMES utf8mb4;

INSERT IGNORE INTO students (id, student_no, name, grade, school, guardian_name, guardian_phone, allergies, status) VALUES
  (1, 'XS2026001', '小明', '三年级', '实验小学', '王女士', '13800001111', '花生', 'ACTIVE'),
  (2, 'XS2026002', '小红', '四年级', '实验小学', '李先生', '13800002222', '', 'ACTIVE'),
  (3, 'XS2026003', '小刚', '二年级', '中心小学', '张女士', '13800003333', '海鲜', 'ACTIVE'),
  (4, 'XS2026004', '小丽', '五年级', '中心小学', '赵先生', '13800004444', '', 'INACTIVE');

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
  (3, 3, '2026-06-05', 'LUNCH', 'ABSENT', '', '家长请假');
