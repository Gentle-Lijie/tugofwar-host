FROM node:22-slim

WORKDIR /app

# 先装依赖以利用层缓存
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci --include=dev

# 拷贝源码并构建前端
COPY server server
COPY web web
RUN npm run build

ENV PORT=8080
ENV TOW_DB_PATH=./server/data/tugofwar.db
EXPOSE 8080

CMD ["node", "server/src/index.js"]
