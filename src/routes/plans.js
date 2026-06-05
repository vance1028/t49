'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, isNonEmptyString, toPositiveInt } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_PERIOD = ['DAILY', 'WEEKLY', 'MONTHLY'];

router.get('/', wrap(async (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  const list = await store.listPlans({ activeOnly });
  res.json({ data: list, total: list.length });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的套餐 ID');
  const p = await store.getPlan(id);
  if (!p) return sendError(res, 404, '套餐不存在');
  res.json({ data: p });
}));

router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  if (!isNonEmptyString(b.name)) return sendError(res, 400, '套餐名称不能为空');
  if (!Number.isInteger(b.priceCents) || b.priceCents < 0) {
    return sendError(res, 400, '价格（分）必须是非负整数');
  }
  if (b.period !== undefined && !VALID_PERIOD.includes(b.period)) {
    return sendError(res, 400, `周期只能是 ${VALID_PERIOD.join(' / ')}`);
  }
  const p = await store.createPlan({ ...b, name: b.name.trim() });
  res.status(201).json({ data: p });
}));

module.exports = router;
