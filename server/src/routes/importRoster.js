import { Router } from 'express';
import multer from 'multer';
import { db, normalizeTeamName } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';
import { parseRoster, buildRosterTemplate } from '../excel.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** 下载名单导入模板 */
router.get('/template', async (req, res) => {
  const buf = await buildRosterTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('名单导入模板.xlsx')}`);
  res.send(buf);
});

/**
 * 校验一组名单行，产出逐行状态。
 * status: ok | dup_in_file | dup_existing | warn_other_team | error
 */
function validateGroup(teamName, rows, seenStudentNosCache) {
  const team = teamName
    ? db.prepare('SELECT id, name FROM teams WHERE name = ?').get(teamName)
    : null;

  // 库内学号 → 所属队伍名
  const allPlayerNos = seenStudentNosCache ?? (() => {
    const map = new Map();
    for (const r of db.prepare('SELECT student_no, name FROM players').all()) {
      map.set(r.student_no, r.name);
    }
    return map;
  })();

  const existingNos = new Set();
  if (team) {
    for (const r of db.prepare('SELECT student_no FROM players WHERE team_id = ?').all(team.id)) {
      existingNos.add(r.student_no);
    }
  }

  // 文件内学号 → 首次出现的行号
  const inFile = new Map();
  const out = rows.map((r) => {
    const { rowNo, name, studentNo } = r;
    if (!name && !studentNo) {
      return { ...r, status: 'error', message: '姓名和学号为空', include: false };
    }
    if (!name) return { ...r, status: 'error', message: '姓名为空', include: false };
    if (!studentNo) return { ...r, status: 'error', message: '学号为空', include: false };
    if (existingNos.has(studentNo)) {
      return { ...r, status: 'dup_existing', message: '学号已存在于该队伍', include: false };
    }
    const firstRow = inFile.get(studentNo);
    if (firstRow !== undefined) {
      return {
        ...r,
        status: 'dup_in_file',
        message: `学号与第 ${firstRow} 行重复`,
        include: false,
      };
    }
    inFile.set(studentNo, rowNo);
    if (allPlayerNos.has(studentNo)) {
      return {
        ...r,
        status: 'warn_other_team',
        message: `该学号已注册（可能重复报名）`,
        include: true,
      };
    }
    return { ...r, status: 'ok', message: null, include: true };
  });
  return { teamName, teamExists: !!team, teamId: team ? team.id : null, rows: out };
}

router.post(
  '/preview',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, '请上传 .xlsx 文件');
    const groups = await parseRoster(req.file.buffer);
    const warnings = [];
    const validated = groups.map((g) => {
      const v = validateGroup(g.teamName, g.rows);
      if (g.teamName && !v.teamExists) {
        warnings.push(`队伍「${g.teamName}」不存在，提交时将自动创建`);
      }
      return v;
    });
    res.json({ groups: validated, warnings });
  })
);

router.post(
  '/commit',
  asyncHandler(async (req, res) => {
    const { groups } = req.body;
    if (!Array.isArray(groups) || !groups.length) throw httpError(400, '缺少导入数据');

    const result = db.transaction(() => {
      let teamsCreated = 0, playersAdded = 0, playersSkipped = 0, playersRemoved = 0;

      for (const g of groups) {
        const teamName = normalizeTeamName(g.teamName);
        if (!teamName) throw httpError(400, '存在缺少队伍名的分组');
        let team = db.prepare('SELECT id FROM teams WHERE name = ?').get(teamName);
        if (!team) {
          const info = db
            .prepare('INSERT INTO teams (name) VALUES (?)')
            .run(teamName);
          team = { id: Number(info.lastInsertRowid) };
          teamsCreated++;
        }

        // 服务端重新校验（预览数据可能被前端编辑过）
        const revalidated = validateGroup(teamName, g.rows).rows;
        const included = [];
        for (let i = 0; i < g.rows.length; i++) {
          const userRow = g.rows[i];
          if (userRow.include === false) { playersSkipped++; continue; }
          const v = revalidated[i];
          if (v.status === 'error' || v.status === 'dup_in_file' || v.status === 'dup_existing') {
            playersSkipped++;
            continue;
          }
          included.push(v);
        }

        const insertPlayer = db.prepare(
          'INSERT OR IGNORE INTO players (team_id, name, student_no) VALUES (?, ?, ?)'
        );
        for (const r of included) {
          playersAdded += insertPlayer.run(team.id, r.name, r.studentNo).changes;
        }

        if (g.mode === 'replace' && included.length) {
          const keep = included.map((r) => r.studentNo);
          const placeholders = keep.map(() => '?').join(',');
          playersRemoved += db
            .prepare(
              `DELETE FROM players WHERE team_id = ? AND student_no NOT IN (${placeholders})`
            )
            .run(team.id, ...keep).changes;
        }
      }
      return { teamsCreated, playersAdded, playersSkipped, playersRemoved };
    });

    res.json(result());
  })
);

export default router;
