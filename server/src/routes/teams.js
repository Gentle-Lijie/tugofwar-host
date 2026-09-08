import { Router } from 'express';
import { db, normalizeTeamName } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

const TEAM_LIST_SQL = `
SELECT t.id, t.name, t.color,
  (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS playerCount,
  (SELECT COUNT(*) FROM matches m WHERE (m.team_a_id = t.id AND m.winner_side = 0)
                                 OR (m.team_b_id = t.id AND m.winner_side = 1)) AS wins,
  (SELECT COUNT(*) FROM matches m WHERE (m.team_a_id = t.id AND m.winner_side = 1)
                                 OR (m.team_b_id = t.id AND m.winner_side = 0)) AS losses
FROM teams t ORDER BY t.id`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(db.prepare(TEAM_LIST_SQL).all());
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = normalizeTeamName(req.body.name);
    if (!name) throw httpError(400, '队伍名不能为空');
    if (db.prepare('SELECT id FROM teams WHERE name = ?').get(name)) {
      throw httpError(409, `队伍「${name}」已存在`);
    }
    const info = db
      .prepare('INSERT INTO teams (name, color) VALUES (?, ?)')
      .run(name, req.body.color || null);
    res.status(201).json(db.prepare('SELECT * FROM teams WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw httpError(404, '队伍不存在');
    const name = req.body.name !== undefined ? normalizeTeamName(req.body.name) : team.name;
    if (!name) throw httpError(400, '队伍名不能为空');
    const dup = db.prepare('SELECT id FROM teams WHERE name = ? AND id <> ?').get(name, team.id);
    if (dup) throw httpError(409, `队伍「${name}」已存在`);
    const color = req.body.color !== undefined ? req.body.color || null : team.color;
    db.prepare('UPDATE teams SET name = ?, color = ? WHERE id = ?').run(name, color, team.id);
    res.json(db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw httpError(404, '队伍不存在');
    const matchCount = db
      .prepare('SELECT COUNT(*) c FROM matches WHERE team_a_id = ? OR team_b_id = ?')
      .get(team.id, team.id).c;
    if (matchCount > 0) {
      throw httpError(409, `队伍「${team.name}」已被 ${matchCount} 场比赛引用，请先删除或编辑这些比赛`, { matchCount });
    }
    db.prepare('DELETE FROM teams WHERE id = ?').run(team.id); // 队员级联删除
    res.json({ ok: true });
  })
);

// ---- 队员（挂在 /api/teams 下） ----

router.get(
  '/:id/players',
  asyncHandler(async (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw httpError(404, '队伍不存在');
    res.json(
      db.prepare(
        `SELECT id, name, student_no AS studentNo FROM players
         WHERE team_id = ? ORDER BY LENGTH(student_no), student_no`
      ).all(team.id)
    );
  })
);

router.post(
  '/:id/players',
  asyncHandler(async (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) throw httpError(404, '队伍不存在');
    const name = String(req.body.name ?? '').trim();
    const studentNo = String(req.body.studentNo ?? '').trim();
    if (!name || !studentNo) throw httpError(400, '姓名和学号不能为空');
    if (db.prepare('SELECT id FROM players WHERE team_id = ? AND student_no = ?').get(team.id, studentNo)) {
      throw httpError(409, `学号 ${studentNo} 已存在于队伍「${team.name}」`);
    }
    const info = db
      .prepare('INSERT INTO players (team_id, name, student_no) VALUES (?, ?, ?)')
      .run(team.id, name, studentNo);
    res.status(201).json({ id: Number(info.lastInsertRowid), name, studentNo });
  })
);

export default router;
