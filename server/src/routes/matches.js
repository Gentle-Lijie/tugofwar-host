import { Router } from 'express';
import { db, getState, setState, effectiveColor } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

const MATCH_SELECT = `
SELECT m.id, m.stage_id AS stageId, s.name AS stageName, s.sort AS stageSort,
  m.team_a_id AS teamAId, ta.name AS teamAName, ta.color AS teamAColor,
  m.team_b_id AS teamBId, tb.name AS teamBName, tb.color AS teamBColor,
  m.sort, m.start_time AS startTime, m.winner_side AS winnerSide, m.note
FROM matches m
JOIN stages s ON s.id = m.stage_id
JOIN teams ta ON ta.id = m.team_a_id
JOIN teams tb ON tb.id = m.team_b_id`;

/** 给比赛行的两侧队伍颜色套用配色规则（手动色 > 规则色） */
function applyColors(row) {
  if (!row) return row;
  row.teamAColor = effectiveColor(row.teamAName, row.teamAColor) ?? null;
  row.teamBColor = effectiveColor(row.teamBName, row.teamBColor) ?? null;
  return row;
}

function getMatch(id) {
  return applyColors(db.prepare(`${MATCH_SELECT} WHERE m.id = ?`).get(id));
}

function ensureTeam(id, label) {
  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(id);
  if (!team) throw httpError(400, `${label}队伍不存在（id=${id}）`);
  return team;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { stageId } = req.query;
    const rows = stageId
      ? db.prepare(`${MATCH_SELECT} WHERE m.stage_id = ? ORDER BY s.sort, m.sort, m.id`).all(stageId)
      : db.prepare(`${MATCH_SELECT} ORDER BY s.sort, m.sort, m.id`).all();
    res.json(rows.map(applyColors));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { stageId, teamAId, teamBId } = req.body;
    if (!stageId) throw httpError(400, '缺少赛段');
    if (!db.prepare('SELECT id FROM stages WHERE id = ?').get(stageId)) throw httpError(400, '赛段不存在');
    ensureTeam(teamAId, 'A');
    ensureTeam(teamBId, 'B');
    if (teamAId === teamBId) throw httpError(400, '两队不能相同');
    const startTime = req.body.startTime ? String(req.body.startTime) : null;
    const sort =
      req.body.sort ??
      db
        .prepare('SELECT COALESCE(MAX(sort), 0) + 1 s FROM matches WHERE stage_id = ?')
        .get(stageId).s;
    const info = db
      .prepare('INSERT INTO matches (stage_id, team_a_id, team_b_id, sort, start_time) VALUES (?, ?, ?, ?, ?)')
      .run(stageId, teamAId, teamBId, sort, startTime);
    res.status(201).json(getMatch(info.lastInsertRowid));
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    if (!match) throw httpError(404, '比赛不存在');

    const stageId = req.body.stageId ?? match.stage_id;
    if (!db.prepare('SELECT id FROM stages WHERE id = ?').get(stageId)) throw httpError(400, '赛段不存在');
    const teamAId = req.body.teamAId ?? match.team_a_id;
    const teamBId = req.body.teamBId ?? match.team_b_id;
    ensureTeam(teamAId, 'A');
    ensureTeam(teamBId, 'B');
    if (teamAId === teamBId) throw httpError(400, '两队不能相同');
    const sort = req.body.sort ?? match.sort;
    const startTime =
      req.body.startTime !== undefined
        ? req.body.startTime
          ? String(req.body.startTime)
          : null
        : match.start_time;

    // 已出结果的比赛更换任一队伍 → 结果作废
    let resultCleared = false;
    let winnerSide = match.winner_side;
    let note = match.note;
    if (winnerSide !== null && (teamAId !== match.team_a_id || teamBId !== match.team_b_id)) {
      winnerSide = null;
      note = null;
      resultCleared = true;
      db.prepare('DELETE FROM checkins WHERE match_id = ?').run(match.id); // 旧队检录记录一并清理
    }
    if (req.body.note !== undefined) note = req.body.note;

    db.prepare(
      'UPDATE matches SET stage_id = ?, team_a_id = ?, team_b_id = ?, sort = ?, start_time = ?, winner_side = ?, note = ? WHERE id = ?'
    ).run(stageId, teamAId, teamBId, sort, startTime, winnerSide, note, match.id);
    res.json({ ...getMatch(match.id), resultCleared });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(req.params.id);
    if (!match) throw httpError(404, '比赛不存在');
    db.prepare('DELETE FROM matches WHERE id = ?').run(match.id); // 检录级联删除
    if (getState('current_match_id') === String(match.id)) setState('current_match_id', 'null');
    res.json({ ok: true });
  })
);

export default router;
