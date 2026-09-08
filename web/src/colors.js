// 队伍配色：优先 teams.color，否则按 id 从色板取模分配（不再按 id 区间硬编码）
const PALETTE = [
  '#33afcd', // 青
  '#e74c3c', // 红
  '#9be3a4', // 绿
  '#e9d26a', // 黄
  '#9b59b6', // 紫
  '#e67e22', // 橙
  '#1abc9c', // 蓝绿
  '#5d6975', // 灰蓝
];

export function teamColor(team) {
  if (!team) return '#9fa8b1';
  if (team.color) return team.color;
  return PALETTE[(team.id ?? 0) % PALETTE.length];
}

export { PALETTE };
