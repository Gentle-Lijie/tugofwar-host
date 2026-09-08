import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware.js';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, teams: db.prepare('SELECT COUNT(*) c FROM teams').get().c });
});

const { default: teamsRoutes } = await import('./routes/teams.js');
const { default: playersRoutes } = await import('./routes/players.js');
const { default: stagesRoutes } = await import('./routes/stages.js');
const { default: matchesRoutes } = await import('./routes/matches.js');
const { default: checkinRoutes } = await import('./routes/checkin.js');
const { default: resultsRoutes } = await import('./routes/results.js');
const { default: importRosterRoutes } = await import('./routes/importRoster.js');
const { default: importScheduleRoutes } = await import('./routes/importSchedule.js');
const { default: displayRoutes } = await import('./routes/display.js');
const { default: exportRoutes } = await import('./routes/export.js');

app.use('/api/teams', teamsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/stages', stagesRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/matches', checkinRoutes);
app.use('/api/matches', resultsRoutes);
app.use('/api/import/roster', importRosterRoutes);
app.use('/api/import/schedule', importScheduleRoutes);
app.use('/api/display', displayRoutes);
app.use('/api/export', exportRoutes);

// 生产环境：托管前端构建产物
const dist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`拔河比赛系统 API 已启动: http://localhost:${port}`);
});
