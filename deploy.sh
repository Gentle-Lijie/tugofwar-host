#!/usr/bin/env bash
# 一键部署：拉代码 → 装依赖 → 构建前端 → 启动/重启服务
# 用法：在仓库根目录执行 ./deploy.sh
# 要求：Node.js >= 20.6（使用内置 --env-file 读取 .env，无需额外依赖）
set -euo pipefail
cd "$(dirname "$0")"

# 1. .env 不存在则从模板生成（.env 已被 gitignore，不会入库）
if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> 已生成 .env（默认 PORT=8080，可按需修改）"
fi

# 2. 拉取最新代码
echo "==> git pull"
git pull --ff-only

# 3. 依赖
echo "==> npm install"
npm ci || npm install

# 4. 构建前端
echo "==> 构建前端"
npm run build

# 5. 启动（有 pm2 用 pm2，否则 nohup 后台）
echo "==> 启动服务"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete tugofwar >/dev/null 2>&1 || true
  pm2 start server/src/index.js --name tugofwar --node-args="--env-file=.env"
  pm2 save
  echo "==> pm2 已启动 tugofwar（开机自启请执行：pm2 startup）"
else
  pkill -f "node.*server/src/index.js" 2>/dev/null || true
  sleep 0.5
  nohup node --env-file=.env server/src/index.js > server.log 2>&1 &
  echo "==> 已后台启动（日志：server.log；建议安装 pm2 获得崩溃自愈：npm i -g pm2）"
fi

PORT_VAL=$(sed -n 's/^PORT=//p' .env | tail -1)
echo "==> 完成：http://localhost:${PORT_VAL:-8080}"
