// 生成测试用名单 xlsx：node server/scripts/make-sample-roster.js [输出路径]
// 含正常行、空姓名、文件内重复学号、已有学号（第二次运行时）等场景
import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sample-roster.xlsx');

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('名单');
ws.columns = [
  { header: '班级', key: 'team', width: 16 },
  { header: '姓名', key: 'name', width: 12 },
  { header: '学号', key: 'no', width: 14 },
];
const rows = [
  ['高一(1)班', '张三', 2024001],
  ['高一(1)班', '李四', 2024002],
  ['高一(1)班', '王五', 2024003],
  ['高一(1)班', '', 2024004], // 错误：姓名为空
  ['高一(1)班', '赵六', 2024001], // 错误：与第2行学号重复
  ['高一(2)班', '孙七', 2025001],
  ['高一(2)班', '周八', 2025002],
  ['高一(9)班', '吴九', 2029001], // 队伍不存在 → 自动创建
];
for (const r of rows) ws.addRow({ team: r[0], name: r[1], no: r[2] });
ws.getRow(1).font = { bold: true };

await wb.xlsx.writeFile(out);
console.log('已生成测试名单:', out);
