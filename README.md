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

## 部署

要求 Node.js ≥ 20（建议 22）。单进程 + 单 SQLite 文件，无需数据库服务器。

```bash
git clone <repo> && cd tugofwar-host
npm install
npm run build
PORT=8080 npm start
```

服务监听所有网卡（`0.0.0.0:8080`），场馆局域网内任何设备直接访问：

- 管理端：`http://<主机IP>:8080/`
- 大屏：`http://<主机IP>:8080/display`（投影仪浏览器打开，点击页面任意处进入全屏）

环境变量：`PORT`（默认 8080）、`TOW_DB_PATH`（SQLite 路径，默认 `server/data/tugofwar.db`）。

**开机自启 / 崩溃重启（systemd 示例）** `/etc/systemd/system/tugofwar.service`：

```ini
[Unit]
Description=Tug of War host
After=network.target

[Service]
WorkingDirectory=/opt/tugofwar-host
ExecStart=/usr/bin/node server/src/index.js
Environment=PORT=8080
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now tugofwar
```

或用 pm2：`npm i -g pm2 && pm2 start server/src/index.js --name tugofwar && pm2 save`。

**数据与备份**：全部数据在 `server/data/tugofwar.db` 一个文件里。备份时先停服务（或复制 `tugofwar.db` + `tugofwar.db-wal` 两个文件）；换机器部署把文件拷到同样位置即可。赛前一空库、赛后留档一份。

** macOS 注意**：首次 `npm install` 编译 better-sqlite3 需要 Xcode Command Line Tools（`xcode-select --install`）。

数据保存在 `server/data/tugofwar.db`（Docker 下持久化在 `tugofwar-data` 卷）。环境变量：`PORT`（默认 8080）、`TOW_DB_PATH`。

## 功能与使用流程

1. **导入名单**（`/import/roster`）：上传 .xlsx，需含 `姓名`、`学号` 列；可选 `班级` 列（按班级分组，不存在的自动建队；无班级列时导入到指定队伍）。先解析预览（可编辑、逐行勾选，标记重复/错误行）再确认提交，支持追加/替换两种模式。
2. **导入赛程**（`/import/schedule`）：每行 `班级A`、`班级B`、`赛段`；不存在的班级与赛段自动创建，同样有预览。
3. **切换赛段**：导航栏「当前赛段」下拉全局切换，赛程/大屏/检录叫号默认聚焦当前赛段。
4. **检录**（赛程页 → 检录）：双栏名单，点击学生切换到场/未到场，显示进度（如 8/10）；中途补录的队员自动出现；可一键大屏叫号。
5. **标记正负**（赛程页 → 标记胜负）：每场一正一负，点选胜方即负方确定；支持改判与清除。
6. **大屏**（`/display`）：全屏比赛列表，3 秒轮询刷新——当前比赛高亮、检录叫号横幅、胜负标记、滚动公告、本地生成二维码。
7. **结果导出**（`/results`）：按赛段查看胜/负并导出 Excel（场次、班级A/B、胜方、负方、状态、备注）。

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
