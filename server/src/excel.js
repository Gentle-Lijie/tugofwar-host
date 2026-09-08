import ExcelJS from 'exceljs';

// ---------- 通用工具 ----------

/** 单元格值转字符串：数字学号避免 2024001.0，日期转时间文本 */
export function cellToString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : String(v);
  }
  if (v instanceof Date) return formatDate(v);
  if (typeof v === 'object' && v.result !== undefined) return cellToString(v.result); // 公式单元格
  if (typeof v === 'object' && v.text) return String(v.text).trim(); // 富文本
  return String(v);
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(d) {
  const hasDate = d.getFullYear() > 1900 || d.getMonth() > 0 || d.getDate() > 1;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return hasDate ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}` : hm;
}

/** Excel 序列号转时间文本（无日期部分时只返回 HH:MM） */
function excelSerialToString(n) {
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const totalMinutes = Math.round((n % 1) * 24 * 60);
  const dateOnly = n >= 1;
  if (!dateOnly) return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
  return formatDate(d);
}

/** 开始时间列专用：兼容字符串/Date/Excel 序列号，解析失败返回空 */
export function cellToTime(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return formatDate(v);
  if (typeof v === 'number') return excelSerialToString(v);
  if (typeof v === 'object' && v.result !== undefined) return cellToTime(v.result);
  const s = String(v).trim();
  return s;
}

/** 表头同义词匹配 */
const HEADER_SYNONYMS = {
  name: ['姓名', '名字', '学生姓名'],
  studentNo: ['学号', '学生id', '学号号码', '学生编号'],
  team: ['班级', '队伍', '班级名称', '队名'],
  teamA: ['班级a', '队伍a', 'a队', '班级1', 'a', '甲方'],
  teamB: ['班级b', '队伍b', 'b队', '班级2', 'b', '乙方'],
  startTime: ['开始时间', '时间', '比赛时间', '开赛时间'],
  stage: ['赛段', '阶段', '轮次', '组别'],
};

function matchHeader(text, keys) {
  const s = String(text ?? '')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (!s) return false;
  return keys.some((k) => k.toLowerCase() === s);
}

/** 读取第一个工作表并定位表头行（第一个非空行），返回 {sheet, headers: Map<field→col>, headerRow} */
async function readSheet(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw Object.assign(new Error('Excel 中没有工作表'), { status: 400 });
  let headerRow = null;
  const headers = new Map();
  sheet.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (headerRow) return;
    const found = {};
    row.eachCell({ includeEmpty: false }, (cell, colNo) => {
      for (const [field, keys] of Object.entries(HEADER_SYNONYMS)) {
        if (!found[field] && matchHeader(cell.value, keys)) {
          found[field] = colNo;
        }
      }
    });
    if (found.name || found.teamA) {
      headerRow = rowNo;
      for (const [field, colNo] of Object.entries(found)) headers.set(field, colNo);
    }
  });
  if (!headerRow) {
    throw Object.assign(
      new Error('未找到表头行：需要包含 姓名/学号（名单）或 班级A/班级B（赛程）等列'),
      { status: 400 }
    );
  }
  return { sheet, headers, headerRow };
}

// ---------- 名单解析 ----------

/**
 * 解析名单 xlsx。要求 姓名+学号 列；若有 班级/队伍 列则按其分组。
 * 返回 groups: [{ teamName: string|null, rows: [{rowNo, name, studentNo}] }]
 */
export async function parseRoster(buffer) {
  const { sheet, headers, headerRow } = await readSheet(buffer);
  if (!headers.has('name') || !headers.has('studentNo')) {
    throw Object.assign(new Error('名单表缺少「姓名」或「学号」列'), { status: 400 });
  }
  const nameCol = headers.get('name');
  const noCol = headers.get('studentNo');
  const teamCol = headers.get('team') ?? null;

  const groups = [];
  const groupIndex = new Map(); // teamName(null 表示无班级列时的单组) → group
  sheet.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo <= headerRow) return;
    const name = cellToString(row.getCell(nameCol).value);
    const studentNo = cellToString(row.getCell(noCol).value);
    const teamName = teamCol ? cellToString(row.getCell(teamCol).value) : null;
    if (!name && !studentNo) return; // 空行
    if (teamCol && !teamName) return; // 有班级列但班级为空，跳过（会在 commit 前由预览提示）
    let g = groupIndex.get(teamName);
    if (!g) {
      g = { teamName, rows: [] };
      groupIndex.set(teamName, g);
      groups.push(g);
    }
    g.rows.push({ rowNo, name, studentNo });
  });
  if (!groups.length || groups.every((g) => !g.rows.length)) {
    throw Object.assign(new Error('名单表中没有数据行'), { status: 400 });
  }
  return groups;
}

// ---------- 赛程解析 ----------

/**
 * 解析赛程 xlsx。要求 班级A+班级B；开始时间/赛段 可选（赛段缺省用当前赛段或「循环赛」）。
 * 返回 rows: [{rowNo, teamA, teamB, startTime, stageName}]
 */
export async function parseSchedule(buffer) {
  const { sheet, headers, headerRow } = await readSheet(buffer);
  if (!headers.has('teamA') || !headers.has('teamB')) {
    throw Object.assign(new Error('赛程表缺少「班级A」或「班级B」列'), { status: 400 });
  }
  const aCol = headers.get('teamA');
  const bCol = headers.get('teamB');
  const tCol = headers.get('startTime') ?? null;
  const sCol = headers.get('stage') ?? null;

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo <= headerRow) return;
    const teamA = cellToString(row.getCell(aCol).value);
    const teamB = cellToString(row.getCell(bCol).value);
    if (!teamA && !teamB) return;
    rows.push({
      rowNo,
      teamA,
      teamB,
      startTime: tCol ? cellToTime(row.getCell(tCol).value) : '',
      stageName: sCol ? cellToString(row.getCell(sCol).value) : '',
    });
  });
  if (!rows.length) {
    throw Object.assign(new Error('赛程表中没有数据行'), { status: 400 });
  }
  return rows;
}

// ---------- 导入模板 ----------

/** 名单导入模板（班级列可选：删除该列则导入到指定队伍） */
export async function buildRosterTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('名单');
  ws.columns = [
    { header: '班级', key: 'team', width: 18 },
    { header: '姓名', key: 'name', width: 12 },
    { header: '学号', key: 'no', width: 14 },
  ];
  ws.addRow({ team: '高一(1)班', name: '张三', no: 2024001 });
  ws.addRow({ team: '高一(1)班', name: '李四', no: 2024002 });
  ws.addRow({ team: '高一(2)班', name: '王五', no: 2025001 });
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 赛程导入模板 */
export async function buildScheduleTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('赛程');
  ws.columns = [
    { header: '班级A', key: 'a', width: 18 },
    { header: '班级B', key: 'b', width: 18 },
    { header: '开始时间', key: 't', width: 12 },
    { header: '赛段', key: 's', width: 16 },
  ];
  ws.addRow({ a: '高一(1)班', b: '高一(2)班', t: '09:00', s: '循环赛' });
  ws.addRow({ a: '高一(3)班', b: '高一(4)班', t: '09:10', s: '循环赛' });
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- 结果导出 ----------

/**
 * 生成赛段结果 xlsx。matches: [{sort, teamA, teamB, startTime, winnerSide, note}]
 * 返回 Buffer。
 */
export async function buildStageExport(stageName, matches) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('比赛结果');
  ws.columns = [
    { header: '场次', key: 'sort', width: 8 },
    { header: '班级A', key: 'teamA', width: 22 },
    { header: '班级B', key: 'teamB', width: 22 },
    { header: '开始时间', key: 'startTime', width: 18 },
    { header: '胜方（正）', key: 'winner', width: 22 },
    { header: '负方（负）', key: 'loser', width: 22 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'note', width: 24 },
  ];
  for (const m of matches) {
    const done = m.winnerSide === 0 || m.winnerSide === 1;
    ws.addRow({
      sort: m.sort,
      teamA: m.teamA,
      teamB: m.teamB,
      startTime: m.startTime ?? '',
      winner: done ? (m.winnerSide === 0 ? m.teamA : m.teamB) : '',
      loser: done ? (m.winnerSide === 0 ? m.teamB : m.teamA) : '',
      status: done ? '已完成' : '未开始',
      note: m.note ?? '',
    });
  }
  // 表头加粗、冻结首行
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
