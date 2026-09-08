import { Router } from 'express';
import { db, getState, setState } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

const STAGE_LIST_SQL = `
SELECT s.id, s.name, s.sort,
  (SELECT COUNT(*) FROM matches m WHERE m.stage_id = s.id) AS matchCount,
  (SELECT COUNT(*) FROM matches m WHERE m.stage_id = s.id AND m.winner_side IS NOT NULL) AS doneCount
FROM stages s ORDER BY s.sort, s.id`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(db.prepare(STAGE_LIST_SQL).all());
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name ?? '').trim();
    if (!name) throw httpError(400, '赛段名不能为空');
    if (db.prepare('SELECT id FROM stages WHERE name = ?').get(name)) {
      throw httpError(409, `赛段「${name}」已存在`);
    }
    const sort =
      req.body.sort ?? (db.prepare('SELECT COALESCE(MAX(sort), 0) + 10 s FROM stages').get().s);
    const info = db.prepare('INSERT INTO stages (name, sort) VALUES (?, ?)').run(name, sort);
    res.status(201).json(db.prepare('SELECT * FROM stages WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
    if (!stage) throw httpError(404, '赛段不存在');
    const name = req.body.name !== undefined ? String(req.body.name).trim() : stage.name;
    if (!name) throw httpError(400, '赛段名不能为空');
    const dup = db.prepare('SELECT id FROM stages WHERE name = ? AND id <> ?').get(name, stage.id);
    if (dup) throw httpError(409, `赛段「${name}」已存在`);
    const sort = req.body.sort !== undefined ? Number(req.body.sort) : stage.sort;
    db.prepare('UPDATE stages SET name = ?, sort = ? WHERE id = ?').run(name, sort, stage.id);
    res.json(db.prepare('SELECT * FROM stages WHERE id = ?').get(stage.id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
    if (!stage) throw httpError(404, '赛段不存在');
    const matchCount = db
      .prepare('SELECT COUNT(*) c FROM matches WHERE stage_id = ?')
      .get(stage.id).c;
    if (matchCount > 0) {
      throw httpError(409, `赛段「${stage.name}」下有 ${matchCount} 场比赛，请先删除或移动这些比赛`, { matchCount });
    }
    db.prepare('DELETE FROM stages WHERE id = ?').run(stage.id);
    if (getState('current_stage_id') === String(stage.id)) setState('current_stage_id', 'null');
    res.json({ ok: true });
  })
);

// ---- 当前赛段（全局切换） ----

router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const raw = getState('current_stage_id');
    const stageId = raw && raw !== 'null' ? Number(raw) : null;
    let stage = null;
    if (stageId) {
      stage = db.prepare('SELECT id, name, sort FROM stages WHERE id = ?').get(stageId) || null;
      if (!stage) setState('current_stage_id', 'null'); // 悬空引用自愈
    }
    res.json({ stageId: stage ? stage.id : null, stage });
  })
);

router.put(
  '/current',
  asyncHandler(async (req, res) => {
    const { stageId } = req.body;
    if (stageId == null) {
      setState('current_stage_id', 'null');
      return res.json({ stageId: null, stage: null });
    }
    const stage = db.prepare('SELECT id, name, sort FROM stages WHERE id = ?').get(stageId);
    if (!stage) throw httpError(404, '赛段不存在');
    setState('current_stage_id', String(stage.id));
    res.json({ stageId: stage.id, stage });
  })
);

export default router;
