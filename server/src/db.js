import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src → 上两级即仓库根目录
const repoRoot = path.resolve(__dirname, '../..');

const dbPath = process.env.TOW_DB_PATH
  ? path.resolve(repoRoot, process.env.TOW_DB_PATH.replace(/^\.\//, ''))
  : path.join(repoRoot, 'server', 'data', 'tugofwar.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  student_no TEXT NOT NULL,
  UNIQUE (team_id, student_no)
);

CREATE TABLE IF NOT EXISTS stages (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id    INTEGER NOT NULL REFERENCES stages(id),
  team_a_id   INTEGER NOT NULL REFERENCES teams(id),
  team_b_id   INTEGER NOT NULL REFERENCES teams(id),
  sort        INTEGER NOT NULL DEFAULT 0,
  start_time  TEXT,
  winner_side INTEGER CHECK (winner_side IN (0, 1)),
  note        TEXT,
  CHECK (team_a_id <> team_b_id)
);

CREATE TABLE IF NOT EXISTS checkins (
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  present   INTEGER NOT NULL DEFAULT 0 CHECK (present IN (0, 1)),
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS app_state (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);

// 种子数据：默认赛段与全局状态
const seedStages = db.prepare(
  'INSERT OR IGNORE INTO stages (name, sort) VALUES (?, ?)'
);
seedStages.run('循环赛', 10);
seedStages.run('四分之一决赛', 20);
seedStages.run('半决赛', 30);
seedStages.run('决赛', 40);

const seedState = db.prepare('INSERT OR IGNORE INTO app_state (key, value) VALUES (?, ?)');
seedState.run('current_match_id', 'null');
seedState.run('calling', '0');
seedState.run('announcement', '');
seedState.run('current_stage_id', 'null');

/** 读取 app_state 键值（不存在返回 null） */
export function getState(key) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

/** 写入 app_state 键值 */
export function setState(key, value) {
  db.prepare(
    'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

/** 队伍名归一化：去首尾空白、全角空格转半角，用于按名匹配 */
export function normalizeTeamName(name) {
  return String(name ?? '')
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
