import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

/** 懒播种：把两队当前队员补进 checkins（已存在的行不动，中途加人自动出现） */
function seedCheckins(matchId) {
  const match = db
    .prepare('SELECT team_a_id, team_b_id FROM matches WHERE id = ?')
    .get(matchId);
  if (!match) throw httpError(404, '比赛不存在');
  db.prepare(
    `INSERT OR IGNORE INTO checkins (match_id, player_id, present)
     SELECT ?, id, 0 FROM players WHERE team_id IN (?, ?)`
  ).run(matchId, match.team_a_id, match.team_b_id);
}

function teamCheckin(matchId, teamId) {
  const players = db
    .prepare(
      `SELECT p.id AS playerId, p.name, p.student_no AS studentNo,
        COALESCE(c.present, 0) AS present
       FROM players p
       LEFT JOIN checkins c ON c.player_id = p.id AND c.match_id = ?
       WHERE p.team_id = ?
       ORDER BY LENGTH(p.student_no), p.student_no`
    )
    .all(matchId, teamId);
  const present = players.filter((p) => p.present).length;
  return { players, present, total: players.length };
}

router.get(
  '/:id/checkin',
  asyncHandler(async (req, res) => {
    const match = db
      .prepare(
        `SELECT m.id, s.name AS stageName, m.sort, m.start_time AS startTime,
          a.id AS teamAId, a.name AS teamAName, b.id AS teamBId, b.name AS teamBName
         FROM matches m
         JOIN stages s ON s.id = m.stage_id
         JOIN teams a ON a.id = m.team_a_id
         JOIN teams b ON b.id = m.team_b_id
         WHERE m.id = ?`
      )
      .get(req.params.id);
    if (!match) throw httpError(404, '比赛不存在');
    seedCheckins(match.id);
    const a = teamCheckin(match.id, match.teamAId);
    const b = teamCheckin(match.id, match.teamBId);
    res.json({
      match,
      teamA: { ...match, id: match.teamAId, name: match.teamAName, ...a },
      teamB: { id: match.teamBId, name: match.teamBName, ...b },
    });
  })
);

router.put(
  '/:id/checkin/:playerId',
  asyncHandler(async (req, res) => {
    const match = db
      .prepare('SELECT id, team_a_id, team_b_id FROM matches WHERE id = ?')
      .get(req.params.id);
    if (!match) throw httpError(404, '比赛不存在');
    const player = db
      .prepare('SELECT id FROM players WHERE id = ? AND team_id IN (?, ?)')
      .get(req.params.playerId, match.team_a_id, match.team_b_id);
    if (!player) throw httpError(400, '该队员不属于这场比赛的任何一队');
    const present = req.body.present ? 1 : 0;
    db.prepare(
      `INSERT INTO checkins (match_id, player_id, present) VALUES (?, ?, ?)
       ON CONFLICT(match_id, player_id) DO UPDATE SET present = excluded.present`
    ).run(match.id, player.id, present);
    res.json({ ok: true, present });
  })
);

router.post(
  '/:id/checkin/reset',
  asyncHandler(async (req, res) => {
    const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(req.params.id);
    if (!match) throw httpError(404, '比赛不存在');
    db.prepare('UPDATE checkins SET present = 0 WHERE match_id = ?').run(match.id);
    res.json({ ok: true });
  })
);

export default router;
