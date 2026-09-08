import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';
import { buildStageExport } from '../excel.js';

const router = Router();

/** 按赛段导出全部比赛结果为 xlsx */
router.get(
  '/stage/:id',
  asyncHandler(async (req, res) => {
    const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
    if (!stage) throw httpError(404, '赛段不存在');
    const matches = db
      .prepare(
        `SELECT m.sort, a.name AS teamA, b.name AS teamB, m.start_time AS startTime,
          m.winner_side AS winnerSide, m.note
        FROM matches m
        JOIN teams a ON a.id = m.team_a_id
        JOIN teams b ON b.id = m.team_b_id
        WHERE m.stage_id = ?
        ORDER BY m.sort, m.id`
      )
      .all(stage.id);
    const buf = await buildStageExport(stage.name, matches);
    const filename = encodeURIComponent(`${stage.name}-比赛结果.xlsx`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(buf);
  })
);

export default router;
