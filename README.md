# 拔河比赛管理系统

面向校园拔河赛事的现场管理工具：名单/赛程 Excel 导入、检录、胜负（正/负）标记、赛段管理、实时大屏展示与结果导出。无用户系统，开箱即用。

## 技术栈

- **后端**：Node.js + Express + better-sqlite3（单文件 SQLite，零配置）
- **前端**：Vite + Vue 3，生产环境由后端直接托管
- **Excel**：exceljs（导入解析 + 结果导出）

## 快速开始

```bash
npm install
npm run dev        # 同时启动 API(:8080) 与前端开发服务(:5173)
```

生产模式：

```bash
npm run build      # 构建前端到 web/dist
npm start          # 单端口 :8080 托管 API + 前端
```

Docker：

```bash
docker compose up --build   # http://localhost:8080
```

数据保存在 `server/data/tugofwar.db`（Docker 下持久化在 `tugofwar-data` 卷）。环境变量：`PORT`（默认 8080）、`TOW_DB_PATH`。

## 功能与使用流程

1. **导入名单**（`/import/roster`）：上传 .xlsx，需含 `姓名`、`学号` 列；可选 `班级` 列（按班级分组，不存在的自动建队；无班级列时导入到指定队伍）。先解析预览（可编辑、逐行勾选，标记重复/错误行）再确认提交，支持追加/替换两种模式。
2. **导入赛程**（`/import/schedule`）：每行 `班级A`、`班级B`、`开始时间`、`赛段`；不存在的班级与赛段自动创建，同样有预览。
3. **切换赛段**：导航栏「当前赛段」下拉全局切换，赛程/大屏/检录叫号默认聚焦当前赛段。
4. **检录**（赛程页 → 检录）：双栏名单，点击学生切换到场/未到场，显示进度（如 8/10）；中途补录的队员自动出现；可一键大屏叫号。
5. **标记正负**（赛程页 → 标记胜负）：每场一正一负，点选胜方即负方确定；支持改判与清除。
6. **大屏**（`/display`）：深色全屏，3 秒轮询刷新——当前比赛与检录进度、检录叫号横幅、即将开始、已结束结果、滚动公告、本地生成二维码。
7. **结果导出**（`/results`）：按赛段查看胜/负并导出 Excel（场次、班级A/B、时间、胜方、负方、状态、备注）。

## 生成测试用 Excel

```bash
node server/scripts/make-sample-roster.js     # 测试名单（含重复学号、空姓名等场景）
node server/scripts/make-sample-schedule.js   # 测试赛程（含自动建队/建赛段场景）
```

## API 概览

| 分组 | 端点 |
|---|---|
| 队伍/队员 | `GET/POST /api/teams`、`PATCH/DELETE /api/teams/:id`、`GET/POST /api/teams/:id/players`、`PATCH/DELETE /api/players/:id` |
| 赛段 | `GET/POST /api/stages`、`PATCH/DELETE /api/stages/:id`、`GET/PUT /api/stages/current`（当前赛段） |
| 比赛 | `GET/POST /api/matches`、`PATCH/DELETE /api/matches/:id` |
| 检录 | `GET /api/matches/:id/checkin`、`PUT /api/matches/:id/checkin/:playerId`、`POST /api/matches/:id/checkin/reset` |
| 结果 | `PUT /api/matches/:id/result`（`winnerSide`: 0/1/null） |
| 导入 | `POST /api/import/roster/preview|commit`、`POST /api/import/schedule/preview|commit` |
| 大屏 | `GET /api/display/state`、`PUT /api/display/current|calling|announcement` |
| 导出 | `GET /api/export/stage/:id` |

## 目录结构

```
server/   Express API + SQLite（src/routes/ 按资源分文件）
web/      Vite + Vue 3 前端
legacy/   v1 旧版（纯 PHP + MySQL），已废弃，仅作参考
```

## License

MIT
