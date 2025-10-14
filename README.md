# 拔河比赛管理系统（Tug of War Host）

> 一个用于管理校园拔河比赛的轻量级 Web 应用，支持班级维护、参赛检录、比赛排程与结果展示。项目现已完成目录重构、Docker 化，并准备好对外开源。

## ✨ 功能亮点

- **集中式配置**：所有数据库连接统一由 `config/database.php` 管理，可通过环境变量覆盖。
- **一体化管理**：管理员可以新增班级、安排比赛、录入结果，检录台实时同步签到状态。
- **大屏显示**：为赛事现场提供全屏对阵视图和下一场提醒。
- **RESTful 接口**：关键操作（如更新检录、比赛结果）均采用更安全的预处理语句与 JSON 响应。
- **Docker 支持**：提供一键启动的 PHP + MySQL 开发环境，内置数据库初始化脚本。

## 📦 项目结构

```text
.
├── Dockerfile                 # PHP-Apache 应用容器镜像
├── docker-compose.yml         # 编排 PHP 与 MySQL 双服务
├── .env.example               # 环境变量示例
├── .dockerignore              # Docker 构建忽略列表
├── config/
│   └── database.php           # 数据库连接配置
├── database/
│   └── schema/
│       └── create_database.sql# 数据库初始化脚本
├── public/                    # Web 入口（DocumentRoot）
│   ├── index.php              # 系统首页
│   ├── assets/
│   │   ├── css/
│   │   │   ├── main.css       # 首页样式
│   │   │   └── display.css    # 备用展示样式
│   │   └── images/qr.png      # 示例二维码占位
│   ├── *.php                  # 业务页面与接口
├── storage/
│   └── backups/back_db.txt    # 数据库备份 / 记录
├── tools/
│   └── adminer/index.php      # 内置 Adminer 数据库管理工具
└── README.md                  # 本文件
```

> 生产环境建议将 Web 服务器的 DocumentRoot 指向 `public/` 目录，仓库根目录仅保留配置与文档文件，业务代码全部集中在 `public/` 下。

## 🚀 快速开始

### 方式一：使用 Docker（推荐）

1. 复制环境变量模板并按需修改：
   ```bash
   cp .env.example .env
   ```
2. 构建并启动服务（需 Docker 及 Docker Compose）：
   ```bash
   docker compose up --build
   ```
3. 打开浏览器访问 [http://localhost:8080](http://localhost:8080)。

镜像会自动加载 `database/schema/create_database.sql` 并初始化 MySQL 数据库。应用代码通过挂载当前目录，改动可即时生效。

### 方式二：本地手动部署

1. 安装 PHP ≥ 8.1 与 MySQL ≥ 8.0。
2. 导入 `database/schema/create_database.sql` 初始化数据库。
3. 配置 Web 服务器（Nginx/Apache）DocumentRoot 指向 `public/`。
4. 设置环境变量（或在系统中导出）：
   ```bash
   export DB_HOST=localhost
   export DB_USER=your_user
   export DB_PASSWORD=your_password
   export DB_NAME=rope
   ```
5. 浏览器访问部署地址即可。

如需快速预览，可在项目根目录执行 PHP 内建服务器（仅用于开发）：
```bash
php -S 0.0.0.0:8080 -t public/
```

## ⚙️ 环境变量

| 变量名     | 默认值   | 说明                         |
|------------|----------|------------------------------|
| `DB_HOST`  | `mysql`  | 数据库主机（Docker 中为 `mysql` 服务） |
| `DB_USER`  | `root`   | 数据库用户名                 |
| `DB_PASSWORD` | 空字符串 | 数据库密码（Docker 默认见 `.env.example`） |
| `DB_NAME`  | `rope`   | 数据库名称                   |

## 🗄️ 数据库概览

| 表名         | 说明                     |
|--------------|--------------------------|
| `classes`    | 参赛班级信息             |
| `students`   | 班级学生名单             |
| `matches`    | 比赛安排（对阵、时间、结果） |
| `attendance` | 检录记录（学生出勤状态） |

首次运行 Docker Compose 时，这些表会自动创建。可通过 `tools/adminer` 访问内置 Adminer（默认端口 8080 下的 `/tools/adminer/index.php`）。

## 🤝 贡献指南

1. Fork 本仓库并创建特性分支：`git checkout -b feature/your-feature`。
2. 提交前请确保 PHP 语法通过：`find public -name "*.php" -exec php -l {} \;`。
3. 提交 Pull Request 时请附上变更说明与测试截图/描述。
4. 欢迎提交 Issue 反馈漏洞、提出新功能或改进建议。

## 🛡️ 许可协议

本项目采用 [MIT License](LICENSE)。欢迎在遵守许可的前提下自由使用、修改与发布。

---

# Tug of War Host (English Version)

> A lightweight PHP web application for managing school tug-of-war tournaments. The project now features a cleaner layout, Docker support, and is ready for open-source collaboration.

## ✨ Highlights

- **Central configuration** with `config/database.php` and environment overrides.
- **All-in-one management** for classes, match scheduling, attendance, and result submission.
- **Large screen display** tailored for on-site presentation with live match status.
- **Safer endpoints** thanks to prepared statements and JSON responses for key updates.
- **Dockerized stack** delivering a one-command PHP + MySQL environment with auto seeding.

## 📂 Structure

Refer to the tree above for folder descriptions. The `public/` directory serves as the web root, while the repository root keeps only configuration and documentation assets.

## 🚀 Quick Start

### Option A: Docker (recommended)

1. Copy the sample env file and adjust values:
   ```bash
   cp .env.example .env
   ```
2. Build and launch the stack:
   ```bash
   docker compose up --build
   ```
3. Open [http://localhost:8080](http://localhost:8080) in your browser.

The MySQL service loads `database/schema/create_database.sql` on first run. Source code changes are reflected instantly thanks to the bind mount.

### Option B: Manual setup

1. Install PHP 8.1+ and MySQL 8.0+.
2. Import `database/schema/create_database.sql` into your database server.
3. Point your web server's document root to the `public/` directory.
4. Export the necessary environment variables or configure them in your runtime.
5. Visit the site via your chosen domain/port.

For quick prototyping you can rely on PHP's built-in server:
```bash
php -S 0.0.0.0:8080 -t public/
```

## ⚙️ Environment Variables

| Variable       | Default  | Description                          |
|----------------|----------|--------------------------------------|
| `DB_HOST`      | `mysql`  | Database host (service name in Docker) |
| `DB_USER`      | `root`   | Database user                         |
| `DB_PASSWORD`  | *(empty)*| Database password (see `.env.example`) |
| `DB_NAME`      | `rope`   | Database name                         |

## 🗄️ Database Tables

- `classes`: participating teams/classes
- `students`: student roster linked to classes
- `matches`: match schedule with start time and results
- `attendance`: attendance records for students per match

## 🤝 Contributing

1. Fork the repository and spin up a feature branch.
2. Run `php -l` across modified scripts before committing.
3. Submit a pull request with context, screenshots, or test notes.
4. Use GitHub Issues to report bugs or request new features.

## 🛡️ License

Distributed under the [MIT License](LICENSE). Feel free to use and adapt the code in compliance with the license terms.
