import { Router } from 'express';
import { db, getState, setState, effectiveColor } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

/** 给查询行的两侧队伍颜色套用配色规则（手动色 > 规则色） */
function applyColors(row) {
  if (!row) return row;
  row.teamAColor = effectiveColor(row.teamAName, row.teamAColor) ?? null;
  row.teamBColor = effectiveColor(row.teamBName, row.teamBColor) ?? null;
  return row;
}

function matchBrief(id) {
  const row = db
    .prepare(
      `SELECT m.id, m.sort, m.start_time AS startTime, m.winner_side AS winnerSide, m.note,
        s.id AS stageId, s.name AS stageName,
        a.id AS teamAId, a.name AS teamAName, a.color AS teamAColor,
        b.id AS teamBId, b.name AS teamBName, b.color AS teamBColor,
        (SELECT COUNT(*) FROM checkins c JOIN players p ON p.id = c.player_id
          WHERE c.match_id = m.id AND p.team_id = m.team_a_id AND c.present = 1) AS teamAPresent,
        (SELECT COUNT(*) FROM players p WHERE p.team_id = m.team_a_id) AS teamATotal,
        (SELECT COUNT(*) FROM checkins c JOIN players p ON p.id = c.player_id
          WHERE c.match_id = m.id AND p.team_id = m.team_b_id AND c.present = 1) AS teamBPresent,
        (SELECT COUNT(*) FROM players p WHERE p.team_id = m.team_b_id) AS teamBTotal
      FROM matches m
      JOIN stages s ON s.id = m.stage_id
      JOIN teams a ON a.id = m.team_a_id
      JOIN teams b ON b.id = m.team_b_id
      WHERE m.id = ?`
    )
    .get(id);
  return applyColors(row);
}

router.get(
  '/state',
  asyncHandler(async (req, res) => {
    const stageRaw = getState('current_stage_id');
    const currentStageId = stageRaw && stageRaw !== 'null' ? Number(stageRaw) : null;
    const currentStage = currentStageId
      ? db.prepare('SELECT id, name, sort FROM stages WHERE id = ?').get(currentStageId)
      : null;
    const stageFilter = currentStageId ? 'AND m.stage_id = ?' : '';

    const matchRaw = getState('current_match_id');
    let currentMatch = null;
    if (matchRaw && matchRaw !== 'null') {
      currentMatch = matchBrief(Number(matchRaw));
      // 当前比赛若被删除则自愈
      if (!currentMatch) setState('current_match_id', 'null');
    }

    const upcoming = db
      .prepare(
        `SELECT m.id, m.sort, m.start_time AS startTime,
          s.id AS stageId, s.name AS stageName,
          a.id AS teamAId, a.name AS teamAName, a.color AS teamAColor,
          b.id AS teamBId, b.name AS teamBName, b.color AS teamBColor
        FROM matches m
        JOIN stages s ON s.id = m.stage_id
        JOIN teams a ON a.id = m.team_a_id
        JOIN teams b ON b.id = m.team_b_id
        WHERE m.winner_side IS NULL ${stageFilter}
        ORDER BY s.sort, m.sort, m.id LIMIT 6`
      )
      .all(...(currentStageId ? [currentStageId] : []))
      .filter((m) => !currentMatch || m.id !== currentMatch.id)
      .slice(0, 5)
      .map(applyColors);

    const recentResults = db
      .prepare(
        `SELECT m.id, m.sort, m.start_time AS startTime, m.winner_side AS winnerSide, m.note,
          s.id AS stageId, s.name AS stageName,
          a.id AS teamAId, a.name AS teamAName, a.color AS teamAColor,
          b.id AS teamBId, b.name AS teamBName, b.color AS teamBColor
        FROM matches m
        JOIN stages s ON s.id = m.stage_id
        JOIN teams a ON a.id = m.team_a_id
        JOIN teams b ON b.id = m.team_b_id
        WHERE m.winner_side IS NOT NULL ${stageFilter}
        ORDER BY m.id DESC LIMIT 8`
      )
      .all(...(currentStageId ? [currentStageId] : []))
      .map(applyColors);

    // 大屏列表：当前赛段（未设置则全部）的完整比赛列表
    const matches = db
      .prepare(
        `SELECT m.id, m.sort, m.start_time AS startTime, m.winner_side AS winnerSide,
          s.id AS stageId, s.name AS stageName,
          a.id AS teamAId, a.name AS teamAName, a.color AS teamAColor,
          b.id AS teamBId, b.name AS teamBName, b.color AS teamBColor
        FROM matches m
        JOIN stages s ON s.id = m.stage_id
        JOIN teams a ON a.id = m.team_a_id
        JOIN teams b ON b.id = m.team_b_id
        WHERE 1=1 ${stageFilter}
        ORDER BY s.sort, m.sort, m.id`
      )
      .all(...(currentStageId ? [currentStageId] : []))
      .map(applyColors);

    res.json({
      generatedAt: new Date().toISOString(),
      currentStage,
      currentMatch,
      calling: getState('calling') === '1',
      announcement: getState('announcement') || '',
      imageLiveUrl: getState('image_live_url') || '',
      upcoming,
      recentResults,
      matches,
    });
  })
);

router.put(
  '/current',
  asyncHandler(async (req, res) => {
    const { matchId, calling } = req.body;
    if (matchId == null) {
      setState('current_match_id', 'null');
      setState('calling', '0');
    } else {
      const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(matchId);
      if (!match) throw httpError(404, '比赛不存在');
      setState('current_match_id', String(matchId));
    }
    if (calling !== undefined && matchId != null) setState('calling', calling ? '1' : '0');
    res.json({ ok: true });
  })
);

router.put(
  '/announcement',
  asyncHandler(async (req, res) => {
    setState('announcement', String(req.body.text ?? '').slice(0, 500));
    res.json({ ok: true });
  })
);

/** 配置图片直播二维码指向的链接（留空则大屏显示占位框） */
router.put(
  '/image-live',
  asyncHandler(async (req, res) => {
    const url = String(req.body.url ?? '').trim().slice(0, 500);
    if (url && !/^https?:\/\//i.test(url)) throw httpError(400, '链接需要以 http:// 或 https:// 开头');
    setState('image_live_url', url);
    res.json({ ok: true, url });
  })
);

/** 仅切换叫号开关（保持当前比赛不变） */
router.put(
  '/calling',
  asyncHandler(async (req, res) => {
    setState('calling', req.body.calling ? '1' : '0');
    res.json({ ok: true });
  })
);

export default router;
