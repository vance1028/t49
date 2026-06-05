'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, isNonEmptyString, isValidDate } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_MEAL = ['BREAKFAST', 'LUNCH', 'DINNER'];

router.get('/', wrap(async (req, res) => {
  const filters = {};
  if (req.query.date !== undefined) {
    if (!isValidDate(req.query.date)) return sendError(res, 400, '日期格式必须为 YYYY-MM-DD');
    filters.date = req.query.date;
  }
  const list = await store.listMenus(filters);
  res.json({ data: list, total: list.length });
}));

// 新增或更新某天某餐的菜单（按 日期+餐次 唯一）
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  if (!isValidDate(b.menuDate)) return sendError(res, 400, '日期格式必须为 YYYY-MM-DD');
  if (!VALID_MEAL.includes(b.meal)) return sendError(res, 400, `餐次只能是 ${VALID_MEAL.join(' / ')}`);
  if (!isNonEmptyString(b.dishes)) return sendError(res, 400, '菜品内容不能为空');
  const existed = await store.findMenu(b.menuDate, b.meal);
  const m = await store.upsertMenu({ menuDate: b.menuDate, meal: b.meal, dishes: b.dishes.trim() });
  res.status(existed ? 200 : 201).json({ data: m });
}));

module.exports = router;
