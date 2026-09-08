// 队伍配色：优先 teams.color，否则按 id 从色板取模分配（不再按 id 区间硬编码）
const PALETTE = [
  '#4f8fef', // 蓝
  '#f5a623', // 橙
  '#50b86e', // 绿
  '#e05a6d', // 红
  '#9b6df0', // 紫
  '#25b8c4', // 青
  '#d97ab0', // 粉
  '#8a9a3a', // 橄榄
  '#c4762a', // 褐
  '#5a6acf', // 靛
];

export function teamColor(team) {
  if (!team) return '#888';
  if (team.color) return team.color;
  return PALETTE[(team.id ?? 0) % PALETTE.length];
}

export { PALETTE };
