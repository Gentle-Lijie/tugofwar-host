import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';
import { buildStageExport, buildCheckinExport } from '../excel.js';

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

/**
 * 导出签到记录为 xlsx。可选 ?match=<id> 单场 / ?stage=<id> 按赛段 / 无参数全部。
 * 没有签到场次的队员也列出（状态「未签到」），签到前中途加的队员同样覆盖。
 */
router.get(
  '/checkins',
  asyncHandler(async (req, res) => {
    const { match: matchId, stage: stageId } = req.query;
    let where = '';
    const params = [];
    let filename = '签到记录';
    if (matchId) {
      const match = db
        .prepare(
          `SELECT m.id, m.sort, s.name AS stageName FROM matches m
            JOIN stages s ON s.id = m.stage_id WHERE m.id = ?`
        )
        .get(matchId);
      if (!match) throw httpError(404, '比赛不存在');
      where = 'AND m.id = ?';
      params.push(match.id);
      filename = `${match.stageName}-第${match.sort}场-签到记录`;
    } else if (stageId) {
      const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(stageId);
      if (!stage) throw httpError(404, '赛段不存在');
      where = 'AND m.stage_id = ?';
      params.push(stage.id);
      filename = `${stage.name}-签到记录`;
    }
    // 以队伍当前名单为准（LEFT JOIN checkins），与检录页的懒播种口径一致
    const rows = db
      .prepare(
        `SELECT s.name AS stageName, m.sort, t.name AS team,
          p.name AS playerName, p.student_no AS studentNo,
          CASE WHEN p.team_id = m.team_a_id THEN 0 ELSE 1 END AS side,
          COALESCE(c.present, 0) AS present
        FROM matches m
        JOIN stages s ON s.id = m.stage_id
        JOIN players p ON p.team_id IN (m.team_a_id, m.team_b_id)
        JOIN teams t ON t.id = p.team_id
        LEFT JOIN checkins c ON c.match_id = m.id AND c.player_id = p.id
        WHERE 1=1 ${where}
        ORDER BY s.sort, m.sort, m.id, side, LENGTH(p.student_no), p.student_no`
      )
      .all(...params);
    const buf = await buildCheckinExport(rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`
    );
    res.send(buf);
  })
);

export default router;
