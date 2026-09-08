<script setup>
import { ref, computed, h, onMounted } from 'vue';
import { NDataTable, NButton, NInput, NTag, NModal, NSelect } from 'naive-ui';
import { api } from '../api.js';
import { PALETTE, teamColor } from '../colors.js';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import RosterEditor from '../components/RosterEditor.vue';

const teams = ref([]);
const loading = ref(true);
const newName = ref('');
const creating = ref(false);
const pendingDelete = ref(null);
const toast = ref(null);

// ---- 配色规则（批量配置） ----
const ruleModal = ref(false);
const ruleMode = ref('prefix');
const ruleText = ref(''); // 每行一条：`匹配串 #RRGGBB`
const ruleSaving = ref(false);

const MODE_OPTIONS = [
  { label: '前缀匹配（队伍名以匹配串开头）', value: 'prefix' },
  { label: '正则匹配（匹配串为正则表达式）', value: 'regex' },
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const parsedRules = computed(() => {
  const rules = [];
  const errors = [];
  const warnings = [];
  ruleText.value.split('\n').forEach((line, i) => {
    const s = line.trim();
    if (!s) return;
    const m = s.match(/^(\S+)\s+(#\S+)$/);
    if (!m) {
      errors.push(`第 ${i + 1} 行格式应为「匹配串 #RRGGBB」`);
      return;
    }
    const [, pattern, color] = m;
    if (!HEX_RE.test(color)) {
      errors.push(`第 ${i + 1} 行颜色「${color}」不是严格的 #RRGGBB`);
      return;
    }
    if (ruleMode.value === 'regex') {
      try { new RegExp(pattern); } catch (e) {
        errors.push(`第 ${i + 1} 行正则无效：${e.message}`);
        return;
      }
    } else if (/[|^$*+?()[\]{}\\]/.test(pattern)) {
      warnings.push(`第 ${i + 1} 行「${pattern}」含正则符号，前缀模式下按字面匹配可能命中不了，如需「或」请切换为正则匹配`);
    }
    rules.push({ pattern, color: color.toLowerCase() });
  });
  return { rules, errors, warnings };
});

/** 规则预览：当前规则下各队伍将命中的颜色（手动设过色的队伍除外） */
const rulePreview = computed(() => {
  const { rules } = parsedRules.value;
  if (!rules.length) return [];
  const hits = new Map();
  for (const t of teams.value) {
    if (t.manualColor) continue;
    const s = t.name;
    for (const r of rules) {
      const ok = ruleMode.value === 'regex'
        ? (() => { try { return new RegExp(r.pattern).test(s); } catch { return false; } })()
        : s.startsWith(r.pattern);
      if (ok) { hits.set(r.color + '｜' + r.pattern, (hits.get(r.color + '｜' + r.pattern) || []).concat(t.name)); break; }
    }
  }
  return [...hits.entries()].map(([key, names]) => {
    const [color, pattern] = key.split('｜');
    return { color, pattern, names };
  });
});

async function openRules() {
  try {
    const saved = await api.get('/teams/color-rules');
    ruleMode.value = saved.mode || 'prefix';
    ruleText.value = (saved.rules || []).map((r) => `${r.pattern} ${r.color}`).join('\n');
  } catch {
    ruleText.value = '';
  }
  ruleModal.value = true;
}

async function saveRules() {
  const { rules, errors } = parsedRules.value;
  if (errors.length) return showToast(errors[0], true);
  ruleSaving.value = true;
  try {
    await api.put('/teams/color-rules', { mode: ruleMode.value, rules });
    ruleModal.value = false;
    showToast('配色规则已保存');
    await load();
  } catch (e) {
    showToast(e.message, true);
  } finally {
    ruleSaving.value = false;
  }
}

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  loading.value = true;
  try {
    teams.value = await api.get('/teams');
    // color 字段已被服务端套过规则；再取一次原始手动色做优先级展示
  } catch (e) {
    showToast(e.message, true);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function create() {
  if (!newName.value.trim()) return;
  creating.value = true;
  try {
    await api.post('/teams', { name: newName.value.trim() });
    newName.value = '';
    await load();
  } catch (e) {
    showToast(e.message, true);
  } finally {
    creating.value = false;
  }
}

async function rename(team) {
  const name = prompt('新的队伍名', team.name);
  if (!name || name.trim() === team.name) return;
  try {
    await api.patch(`/teams/${team.id}`, { name: name.trim() });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function recolor(team, color) {
  try {
    await api.patch(`/teams/${team.id}`, { color });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function doDelete() {
  const team = pendingDelete.value;
  pendingDelete.value = null;
  try {
    await api.del(`/teams/${team.id}`);
    showToast(`已删除「${team.name}」`);
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

const columns = [
  { type: 'expand', renderExpand: (row) => h(RosterEditor, { teamId: row.id, onChanged: load }) },
  {
    title: '队伍',
    key: 'name',
    render: (row) =>
      h(
        'span',
        {
          style: { fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px' },
        },
        [
          h('span', {
            style: {
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: row.color || PALETTE[(row.id ?? 0) % PALETTE.length],
              display: 'inline-block',
            },
          }),
          row.name,
        ]
      ),
  },
  {
    title: '队员',
    key: 'playerCount',
    width: 80,
    render: (row) => `${row.playerCount} 人`,
  },
  {
    title: '胜 / 负',
    key: 'record',
    width: 90,
    render: (row) => `${row.wins} / ${row.losses}`,
  },
  {
    title: '配色',
    key: 'color',
    render: (row) =>
      h(
        'div',
        { style: { display: 'flex', gap: '5px', alignItems: 'center' } },
        [
          // 手动色（优先于规则）；无手动色时显示规则色/自动色的小圆点
          h('span', {
            class: 'swatch',
            style: {
              background: row.color || PALETTE[(row.id ?? 0) % PALETTE.length],
              cursor: 'default',
            },
            title: row.manualColor ? '手动设置' : '来自规则或自动分配',
          }),
          h('span', { style: { width: '6px' } }),
          ...PALETTE.map((c) =>
            h('span', {
              class: 'swatch' + (row.manualColor === c ? ' active' : ''),
              style: { background: c },
              onClick: () => recolor(row, c),
            })
          ),
        ]
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    render: (row) => [
      h(NButton, { size: 'tiny', secondary: true, onClick: () => rename(row) }, { default: () => '改名' }),
      h(
        NButton,
        {
          size: 'tiny',
          type: 'error',
          secondary: true,
          style: 'margin-left: 6px',
          onClick: () => (pendingDelete.value = row),
        },
        { default: () => '删除' }
      ),
    ],
  },
];
</script>

<template>
  <div class="row" style="justify-content: space-between; margin-bottom: 16px">
    <h1 class="page-title" style="margin: 0">队伍管理</h1>
    <n-button size="small" @click="openRules">🎨 配色规则</n-button>
  </div>

  <div class="card row">
    <n-input v-model:value="newName" placeholder="新队伍名（班级）" style="width: 220px" @keyup.enter="create" />
    <n-button type="primary" :disabled="creating || !newName.trim()" @click="create">添加队伍</n-button>
    <n-tag v-if="teams.length" size="small" type="info" :bordered="false">共 {{ teams.length }} 支队伍</n-tag>
  </div>

  <div class="card" v-if="loading">加载中…</div>
  <div class="card" v-else-if="!teams.length">
    <span class="muted">还没有队伍。可以到 <router-link to="/import/roster">导入名单</router-link> 批量创建，或在此手动添加。</span>
  </div>

  <div class="card" v-else>
    <n-data-table :columns="columns" :data="teams" :row-key="(r) => r.id" size="small" />
    <p class="muted" style="font-size: 13px; margin: 8px 0 0">点击行首箭头展开队伍名单，可直接增改删队员。</p>
  </div>

  <!-- 配色规则对话框 -->
  <n-modal v-model:show="ruleModal" preset="card" title="队伍配色规则（批量）" style="width: 640px">
    <p class="muted" style="margin: 0 0 10px; font-size: 13px">
      每行一条规则：<code>匹配串 #RRGGBB</code>（颜色为严格 RGB 十六进制）。
      从上到下依次匹配，命中即染色；手动为某队伍点选的颜色优先于规则。
    </p>
    <n-select v-model:value="ruleMode" :options="MODE_OPTIONS" size="small" style="margin-bottom: 10px" />
    <n-input
      v-model:value="ruleText"
      type="textarea"
      :rows="8"
      placeholder="EG #33afcd&#10;FAM #e74c3c&#10;IC|MAM #9be3a4（正则模式下）"
      style="font-family: monospace"
    />
    <div v-if="parsedRules.errors.length" style="color: #e74c3c; font-size: 13px; margin-top: 8px">
      <div v-for="(e, i) in parsedRules.errors" :key="i">{{ e }}</div>
    </div>
    <div v-if="parsedRules.warnings.length" style="color: #e67e22; font-size: 13px; margin-top: 8px">
      <div v-for="(w, i) in parsedRules.warnings" :key="i">⚠ {{ w }}</div>
    </div>
    <div v-if="rulePreview.length" style="margin-top: 12px">
      <b style="font-size: 13px">预览（{{ ruleMode === 'regex' ? '正则' : '前缀' }}）</b>
      <div v-for="(p, i) in rulePreview" :key="i" class="preview-row">
        <span class="dot" :style="{ background: p.color }"></span>
        <code>{{ p.pattern }}</code>
        <span class="muted">→ {{ p.color }} · {{ p.names.length }} 队</span>
      </div>
    </div>
    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button size="small" @click="ruleModal = false">取消</n-button>
        <n-button size="small" type="primary" :disabled="!!parsedRules.errors.length" :loading="ruleSaving" @click="saveRules">
          保存
        </n-button>
      </div>
    </template>
  </n-modal>

  <ConfirmDialog
    :visible="!!pendingDelete"
    title="删除队伍"
    :message="pendingDelete
      ? `确定删除「${pendingDelete.name}」？该队伍未被比赛引用时其队员名单将一并删除。`
      : ''"
    confirm-text="删除"
    danger
    @confirm="doDelete"
  />
  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style>
.swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  display: inline-block;
}
.swatch.active { border-color: #10263b; }
</style>

<style scoped>
.preview-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; }
.preview-row .dot { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
</style>
