import { Router } from 'express';
import multer from 'multer';
import { db, normalizeTeamName } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';
import { parseSchedule } from '../excel.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const STATUS_LABEL = {
  ok: '可导入',
  team_new: '将自动创建队伍',
  stage_new: '将自动创建赛段',
  error: '错误',
};

router.post(
  '/preview',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const rows = await parseSchedule(req.file.buffer);
    const teams = new Map(db.prepare('SELECT id, name FROM teams').all().map((t) => [t.name, t]));
    const stages = new Map(db.prepare('SELECT id, name FROM stages').all().map((s) => [s.name, s]));
    // 近似名提示：归一化后同名但原始名不同
    const normTeams = new Map([...teams.keys()].map((n) => [normalizeTeamName(n), n]));

    const outRows = [];
    const newTeams = new Set();
    const newStages = new Set();
    for (const r of rows) {
      const teamA = normalizeTeamName(r.teamA);
      const teamB = normalizeTeamName(r.teamB);
      const stageName = String(r.stageName ?? '').trim();
      const item = { ...r, teamA, teamB, stageName, statuses: [], messages: [] };

      if (!teamA || !teamB) {
        outRows.push({ ...item, status: 'error', message: '班级A或班级B为空', include: false });
        continue;
      }
      if (teamA === teamB) {
        outRows.push({ ...item, status: 'error', message: '两队不能相同', include: false });
        continue;
      }
      let ok = true;
      for (const name of [teamA, teamB]) {
        if (!teams.has(name)) {
          item.statuses.push('team_new');
          newTeams.add(name);
          const near = normTeams.get(name);
          if (near && near !== name) {
            item.messages.push(`「${name}」与已有队伍「${near}」名称接近，建议统一命名以免重复建队`);
          }
          ok = false;
        }
      }
      let defaultStage = '';
      if (!stageName) {
        defaultStage = '循环赛';
        item.messages.push(`赛段为空，将默认使用「${defaultStage}」`);
      } else if (!stages.has(stageName)) {
        item.statuses.push('stage_new');
        newStages.add(stageName);
        ok = false;
      }
      outRows.push({
        ...item,
        status: ok ? 'ok' : item.statuses[0],
        message: item.messages.join('；') || STATUS_LABEL[ok ? 'ok' : item.statuses[0]],
        include: true,
        defaultStage,
      });
    }
    res.json({
      rows: outRows,
      newTeams: [...newTeams],
      newStages: [...newStages],
    });
  })
);

router.post(
  '/commit',
  asyncHandler(async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) throw httpError(400, '缺少导入数据');

    const result = db.transaction(() => {
      let teamsCreated = 0, stagesCreated = 0, matchesCreated = 0;
      const teamCache = new Map(db.prepare('SELECT id, name FROM teams').all().map((t) => [t.name, t.id]));
      const stageCache = new Map(db.prepare('SELECT id, name FROM stages').all().map((s) => [s.name, s.id]));

      const getTeamId = (rawName) => {
        const name = normalizeTeamName(rawName);
        if (!name) throw httpError(400, '存在班级名为空的行');
        let id = teamCache.get(name);
        if (!id) {
          id = Number(db.prepare('INSERT INTO teams (name) VALUES (?)').run(name).lastInsertRowid);
          teamCache.set(name, id);
          teamsCreated++;
        }
        return id;
      };
      const getStageId = (rawName) => {
        const name = normalizeTeamName(rawName);
        if (!name) throw httpError(400, '存在赛段名为空的行');
        let id = stageCache.get(name);
        if (!id) {
          const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 10 s FROM stages').get().s;
          id = Number(db.prepare('INSERT INTO stages (name, sort) VALUES (?, ?)').run(name, sort).lastInsertRowid);
          stageCache.set(name, id);
          stagesCreated++;
        }
        return id;
      };

      // 每个赛段的起始 sort
      const sortBase = new Map();
      const nextSort = (stageId) => {
        let base = sortBase.get(stageId);
        if (base === undefined) {
          base = db
            .prepare('SELECT COALESCE(MAX(sort), 0) s FROM matches WHERE stage_id = ?')
            .get(stageId).s;
          sortBase.set(stageId, base);
        }
        base += 1;
        sortBase.set(stageId, base);
        return base;
      };

      const insertMatch = db.prepare(
        'INSERT INTO matches (stage_id, team_a_id, team_b_id, sort, start_time) VALUES (?, ?, ?, ?, ?)'
      );
      for (const r of rows) {
        if (r.include === false) continue;
        const teamAId = getTeamId(r.teamA);
        const teamBId = getTeamId(r.teamB);
        if (teamAId === teamBId) continue;
        const stageName = normalizeTeamName(r.stageName) || normalizeTeamName(r.defaultStage) || '循环赛';
        const stageId = getStageId(stageName);
        insertMatch.run(stageId, teamAId, teamBId, nextSort(stageId), r.startTime || null);
        matchesCreated++;
      }
      return { teamsCreated, stagesCreated, matchesCreated };
    });

    res.json(result());
  })
);

export default router;
