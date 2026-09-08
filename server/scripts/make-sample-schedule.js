// 生成测试用赛程 xlsx：node server/scripts/make-sample-schedule.js [输出路径]
// 含已有队伍、不存在的队伍（自动创建）、新赛段（自动创建）等场景
import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sample-schedule.xlsx');

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('赛程');
ws.columns = [
  { header: '班级A', key: 'a', width: 16 },
  { header: '班级B', key: 'b', width: 16 },
  { header: '开始时间', key: 't', width: 14 },
  { header: '赛段', key: 's', width: 16 },
];
const rows = [
  ['高一(1)班', '高一(2)班', '09:00', '循环赛'],
  ['高一(1)班', '高一(9)班', '09:10', '循环赛'],
  ['高一(2)班', '高一(9)班', '09:20', '循环赛'],
  ['高一(1)班', '高一(1)班', '09:30', '循环赛'], // 错误：两队相同
  ['高一(3)班', '高一(4)班', '10:00', '排位赛'], // 队伍与赛段都自动创建
];
for (const r of rows) ws.addRow({ a: r[0], b: r[1], t: r[2], s: r[3] });
ws.getRow(1).font = { bold: true };

await wb.xlsx.writeFile(out);
console.log('已生成测试赛程:', out);
