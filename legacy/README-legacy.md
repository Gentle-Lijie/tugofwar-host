# Legacy (v1)

这是本项目的旧版实现（纯 PHP 8 + MySQL，无框架），已被 v2 完全取代，仅作参考保留。

已知问题（重建原因）：

- 无任何 Excel/文件导入功能，全部手工录入
- 无赛段（循环赛/淘汰赛）概念
- 大屏 `display.php` 静态渲染，无实时刷新；"当前比赛"靠扫描结果顺序推断，跳场即失效
- `database/schema/create_database.sql` 中 `attendance` 表结构与检录代码读写的列不一致，检录功能实际不可用
- 班级配色按 id 区间硬编码；二维码为外部热链
- 无删除操作，无统一 API 层

新版见仓库根目录 `server/`（Express + better-sqlite3）与 `web/`（Vite + Vue 3）。
