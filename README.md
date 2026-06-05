# 学生小饭桌管理平台 - 后端 API

一个纯后端的 REST API 服务，用于管理学生小饭桌（课后托管午晚餐）的学生档案、餐费套餐、报名订餐、每日菜单与出勤签到。
本项目作为「功能迭代」类评测题目的基础工程：Node + Express + MySQL，docker compose 一键编排。

## 技术栈

- Node.js (≥ 18) + Express 4
- 数据库：MySQL 8（`mysql2/promise` 连接池）
- 编排：Docker Compose
- 测试：Node 内置 `node:test` + `supertest`

## 快速开始

### 方式一：docker compose（推荐）

```bash
docker compose up --build
```

- API 暴露在 `http://localhost:4920`
- MySQL 暴露在宿主机 `13326` 端口
- 首次启动时 `db/init.sql` 自动建表并写入种子数据

### 方式二：本地运行

```bash
export DB_HOST=127.0.0.1 DB_PORT=13326 DB_USER=meal DB_PASSWORD=mealpass DB_NAME=mealcare
npm install
npm run seed
npm start
```

### 运行测试

测试连接真实 MySQL（默认 `127.0.0.1:13326`），每个用例前重置种子数据：

```bash
npm test
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4920` | API 监听端口 |
| `DB_HOST` | `127.0.0.1` | MySQL 主机 |
| `DB_PORT` | `13326` | MySQL 端口 |
| `DB_USER` | `meal` | MySQL 用户 |
| `DB_PASSWORD` | `mealpass` | MySQL 密码 |
| `DB_NAME` | `mealcare` | 数据库名 |
| `SEED_ON_START` | - | 设为 `false` 可禁用启动时空库自动播种 |

## 数据模型

- **students 学生**：`id, student_no(唯一), name, grade, school, guardian_name, guardian_phone, allergies, status(ACTIVE/INACTIVE)`
- **meal_plans 餐费套餐**：`id, name, meals, price_cents, period(DAILY/WEEKLY/MONTHLY), description, active`
- **enrollments 报名订餐**：`id, student_id(FK), plan_id(FK), start_date, end_date, amount_cents, paid, status`
- **daily_menus 每日菜单**：`id, menu_date, meal, dishes`，`(menu_date, meal)` 唯一
- **attendances 出勤签到**：`id, student_id(FK), attend_date, meal, status(PRESENT/ABSENT/LEAVE), picked_up_by, remark`，`(student_id, attend_date, meal)` 唯一

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/students` | 学生列表（支持 `status`/`school` 筛选） |
| GET | `/api/students/{id}` | 学生详情 |
| POST | `/api/students` | 新增学生 |
| PUT | `/api/students/{id}` | 更新学生 |
| DELETE | `/api/students/{id}` | 删除学生（级联报名/出勤） |
| GET | `/api/plans` | 套餐列表（`activeOnly=true` 仅在售） |
| GET | `/api/plans/{id}` | 套餐详情 |
| POST | `/api/plans` | 新增套餐 |
| GET | `/api/enrollments` | 报名列表（支持 `studentId` 筛选） |
| GET | `/api/enrollments/{id}` | 报名详情 |
| POST | `/api/enrollments` | 学生报名订餐（校验学生在读、套餐在售、金额取套餐价） |
| POST | `/api/enrollments/{id}/pay` | 标记缴费 |
| GET | `/api/menus` | 菜单列表（支持 `date` 筛选） |
| POST | `/api/menus` | 新增/更新某日某餐菜单（按 日期+餐次 upsert） |
| GET | `/api/attendances` | 出勤列表（支持 `date`/`studentId` 筛选） |
| POST | `/api/attendances` | 出勤/签到登记（同生同日同餐唯一） |

## 响应约定

- 成功：`{ "data": ... }`，列表附带 `total`
- 失败：`{ "error": { "message": "..." } }`，配合对应 HTTP 状态码（400/404/409/500）
