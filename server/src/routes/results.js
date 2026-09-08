import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

/**
 * 标记/清除结果。winnerSide: 0=A胜(正), 1=B胜(正), null=清除。
 * 一正一负：胜方为正，负方自动确定。
 */
router.put(
  '/:id/result',
  asyncHandler(async (req, res) => {
    const match = db.prepare('SELECT id, winner_side FROM matches WHERE id = ?').get(req.params.id);
    if (!match) throw httpError(404, '比赛不存在');
    const { winnerSide, note } = req.body;
    if (winnerSide !== null && winnerSide !== 0 && winnerSide !== 1) {
      throw httpError(400, 'winnerSide 必须是 0、1 或 null');
    }
    db.prepare('UPDATE matches SET winner_side = ?, note = ? WHERE id = ?').run(
      winnerSide,
      note !== undefined ? note : null,
      match.id
    );
    const row = db
      .prepare(
        `SELECT m.id, m.winner_side AS winnerSide, m.note,
          a.name AS teamAName, b.name AS teamBName
         FROM matches m
         JOIN teams a ON a.id = m.team_a_id
         JOIN teams b ON b.id = m.team_b_id
         WHERE m.id = ?`
      )
      .get(match.id);
    res.json(row);
  })
);

export default router;
