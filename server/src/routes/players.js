import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../middleware.js';

const router = Router();

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
    if (!player) throw httpError(404, '队员不存在');
    const name = req.body.name !== undefined ? String(req.body.name).trim() : player.name;
    const studentNo =
      req.body.studentNo !== undefined ? String(req.body.studentNo).trim() : player.student_no;
    if (!name || !studentNo) throw httpError(400, '姓名和学号不能为空');
    const dup = db
      .prepare('SELECT id FROM players WHERE team_id = ? AND student_no = ? AND id <> ?')
      .get(player.team_id, studentNo, player.id);
    if (dup) throw httpError(409, `学号 ${studentNo} 已存在于该队伍`);
    db.prepare('UPDATE players SET name = ?, student_no = ? WHERE id = ?').run(name, studentNo, player.id);
    res.json({ id: player.id, name, studentNo });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const player = db.prepare('SELECT id FROM players WHERE id = ?').get(req.params.id);
    if (!player) throw httpError(404, '队员不存在');
    db.prepare('DELETE FROM players WHERE id = ?').run(player.id); // 检录记录级联删除
    res.json({ ok: true });
  })
);

export default router;
