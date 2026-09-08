<script setup>
import { ref, computed, h, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { NDataTable, NButton, NInput, NSelect, NTag, NModal } from 'naive-ui';
import { api } from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.vue';

const stages = ref([]);
const matches = ref([]);
const teams = ref([]);
const currentStageId = ref('__all__'); // '__all__' = 全部；NSelect 值为 null 时会主动 emit null，故用哨兵值
const loading = ref(true);
const toast = ref(null);

const adding = ref(false);
const newMatch = ref({});
const editing = ref(null);
const resultFor = ref(null);
const deleting = ref(null);

// 赛段管理（改名/新增）与搜索
const stageManager = ref(false);
const stageRename = ref(null); // { id, name, sort }
const newStageName = ref('');
const search = ref('');

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  loading.value = true;
  try {
    [stages.value, teams.value] = await Promise.all([api.get('/stages'), api.get('/teams')]);
    const cur = await api.get('/stages/current');
    currentStageId.value = cur.stageId ?? '__all__';
    matches.value = await api.get('/matches');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const stageOptions = computed(() => [
  { label: '全部赛段', value: '__all__' },
  ...stages.value.map((s) => ({
    label: `${s.name}（${s.doneCount}/${s.matchCount}）`,
    value: s.id,
  })),
]);
const teamOptions = computed(() => teams.value.map((t) => ({ label: t.name, value: t.id })));
const editStageOptions = computed(() => stages.value.map((s) => ({ label: s.name, value: s.id })));

async function switchStage(value) {
  currentStageId.value = value;
  if (loading.value) return; // 选项未加载完成时 NSelect 可能误报 null
  try {
    await api.put('/stages/current', { stageId: value === '__all__' ? null : value });
    showToast('已切换当前赛段');
  } catch (e) {
    showToast(e.message, true);
  }
}

const grouped = computed(() => {
  const kw = search.value.trim();
  const byStage = new Map();
  for (const m of matches.value) {
    if (currentStageId.value !== '__all__' && m.stageId !== currentStageId.value) continue;
    if (kw && !m.teamAName.includes(kw) && !m.teamBName.includes(kw)) continue;
    if (!byStage.has(m.stageId)) byStage.set(m.stageId, []);
    byStage.get(m.stageId).push(m);
  }
  return [...byStage.entries()].map(([stageId, ms]) => ({
    stage: stages.value.find((s) => s.id === stageId) || { id: stageId, name: ms[0].stageName },
    matches: ms,
  }));
});

function teamCell(m, side) {
  const isA = side === 'a';
  const win = m.winnerSide !== null && (isA ? m.winnerSide === 0 : m.winnerSide === 1);
  const lose = m.winnerSide !== null && !win;
  return h(
    'span',
    {
      style: {
        fontWeight: win ? '700' : '400',
        color: win ? '#33afcd' : lose ? '#9aa5b1' : '#10263b',
      },
    },
    (win ? '🎉 ' : '') + (isA ? m.teamAName : m.teamBName)
  );
}

const columns = [
  { title: '场次', key: 'sort', width: 60, render: (m) => h('span', { class: 'muted' }, m.sort) },
  { title: '班级A', key: 'teamA', render: (m) => teamCell(m, 'a') },
  { title: '班级B', key: 'teamB', render: (m) => teamCell(m, 'b') },
  {
    title: '时间',
    key: 'startTime',
    width: 90,
    render: (m) => h('span', { class: 'muted' }, m.startTime || '—'),
  },
  {
    title: '结果',
    key: 'result',
    width: 80,
    render: (m) =>
      m.winnerSide === null
        ? h(NTag, { size: 'small', bordered: false }, { default: () => '未赛' })
        : h(
            NTag,
            { size: 'small', type: 'success', bordered: false },
            { default: () => (m.winnerSide === 0 ? 'A 正' : 'B 正') }
          ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    render: (m) => {
      const btn = (label, props, margin = true) =>
        h(
          NButton,
          { size: 'tiny', style: margin ? 'margin-right: 6px' : '', ...props },
          { default: () => label }
        );
      return [
        h(RouterLink, { to: `/matches/${m.id}/checkin` }, { default: () => btn('检录', { secondary: true }) }),
        btn(m.winnerSide === null ? '标记胜负' : '改判', { type: 'primary', secondary: true, onClick: () => (resultFor.value = m) }),
        m.winnerSide !== null
          ? btn('清除', { secondary: true, onClick: () => clearResult(m) })
          : null,
        btn('编辑', { secondary: true, onClick: () => (editing.value = { ...m }) }),
        btn('叫号', { secondary: true, onClick: () => setCalling(m) }),
        btn('删除', { type: 'error', secondary: true, onClick: () => (deleting.value = m) }, false),
      ];
    },
  },
];

function openAdd() {
  const defaultStage = currentStageId.value !== '__all__' ? currentStageId.value : stages.value[0]?.id ?? null;
  newMatch.value = { stageId: defaultStage, teamAId: null, teamBId: null, startTime: '', sort: '' };
  adding.value = true;
}

async function addMatch() {
  const m = newMatch.value;
  if (!m.stageId || !m.teamAId || !m.teamBId) return showToast('请选择赛段和两队', true);
  try {
    await api.post('/matches', {
      stageId: m.stageId,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      startTime: m.startTime || null,
      ...(m.sort ? { sort: Number(m.sort) } : {}),
    });
    adding.value = false;
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function saveEdit() {
  const e = editing.value;
  try {
    const res = await api.patch(`/matches/${e.id}`, {
      stageId: e.stageId,
      teamAId: e.teamAId,
      teamBId: e.teamBId,
      startTime: e.startTime || null,
      sort: Number(e.sort),
    });
    editing.value = null;
    if (res.resultCleared) showToast('该场已有结果，更换队伍后结果已清除');
    await load();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function setResult(winnerSide) {
  const m = resultFor.value;
  resultFor.value = null;
  try {
    await api.put(`/matches/${m.id}/result`, { winnerSide });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function clearResult(m) {
  if (!confirm(`确定清除「${m.teamAName} vs ${m.teamBName}」的结果？`)) return;
  try {
    await api.put(`/matches/${m.id}/result`, { winnerSide: null });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function setCalling(m) {
  try {
    await api.put('/display/current', { matchId: m.id, calling: true });
    showToast(`已在叫号「${m.teamAName} vs ${m.teamBName}」`);
  } catch (e) {
    showToast(e.message, true);
  }
}

async function doDelete() {
  const m = deleting.value;
  deleting.value = null;
  try {
    await api.del(`/matches/${m.id}`);
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function saveStageRename() {
  const s = stageRename.value;
  if (!s.name.trim()) return showToast('赛段名不能为空', true);
  try {
    await api.patch(`/stages/${s.id}`, { name: s.name.trim() });
    stageRename.value = null;
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function addStage() {
  if (!newStageName.value.trim()) return;
  try {
    await api.post('/stages', { name: newStageName.value.trim() });
    newStageName.value = '';
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function deleteStage(s) {
  if (!confirm(`确定删除赛段「${s.name}」？（其下有比赛时会拒绝删除）`)) return;
  try {
    await api.del(`/stages/${s.id}`);
    if (currentStageId.value === s.id) currentStageId.value = null;
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}
</script>

<template>
  <div class="row" style="justify-content: space-between; margin-bottom: 16px">
    <h1 class="page-title" style="margin: 0">赛程管理</h1>
    <div class="row">
      <n-input v-model:value="search" placeholder="🔍 搜索班级" size="small" clearable style="width: 140px" />
      <n-select
        :value="currentStageId"
        :options="stageOptions"
        size="small"
        style="width: 200px"
        @update:value="switchStage"
      />
      <n-button size="small" @click="stageManager = true">赛段管理</n-button>
      <n-button size="small" type="primary" @click="openAdd">＋ 比赛</n-button>
    </div>
  </div>

  <div class="card" v-if="loading">加载中…</div>
  <div class="card" v-else-if="!grouped.length">
    <span class="muted">暂无比赛。可以到 <router-link to="/import/schedule">导入赛程</router-link> 批量创建。</span>
  </div>

  <div v-for="g in grouped" :key="g.stage.id" class="card">
    <div class="row" style="margin-bottom: 10px">
      <b style="font-size: 17px">{{ g.stage.name }}</b>
      <n-tag size="small" :bordered="false">
        {{ g.matches.filter((m) => m.winnerSide !== null).length }} / {{ g.matches.length }} 已完成
      </n-tag>
    </div>
    <n-data-table :columns="columns" :data="g.matches" :row-key="(m) => m.id" size="small" />
  </div>

  <!-- 新增/编辑比赛对话框 -->
  <n-modal v-model:show="adding" preset="card" title="新增比赛" style="width: 440px">
    <div class="form">
      <div class="field"><span>赛段</span>
        <n-select v-model:value="newMatch.stageId" :options="editStageOptions" /></div>
      <div class="field"><span>班级 A</span>
        <n-select v-model:value="newMatch.teamAId" :options="teamOptions" filterable /></div>
      <div class="field"><span>班级 B</span>
        <n-select v-model:value="newMatch.teamBId" :options="teamOptions" filterable /></div>
      <div class="field"><span>时间</span>
        <n-input v-model:value="newMatch.startTime" placeholder="如 09:30" /></div>
      <div class="field"><span>场次</span>
        <n-input v-model:value="newMatch.sort" placeholder="可空，自动排到最后" /></div>
    </div>
    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button size="small" @click="adding = false">取消</n-button>
        <n-button size="small" type="primary" @click="addMatch">保存</n-button>
      </div>
    </template>
  </n-modal>

  <n-modal v-model:show="editing" preset="card" :title="editing ? `编辑比赛（第 ${editing.sort} 场）` : ''" style="width: 440px">
    <div class="form" v-if="editing">
      <div class="field"><span>赛段</span>
        <n-select v-model:value="editing.stageId" :options="editStageOptions" /></div>
      <div class="field"><span>班级 A</span>
        <n-select v-model:value="editing.teamAId" :options="teamOptions" filterable /></div>
      <div class="field"><span>班级 B</span>
        <n-select v-model:value="editing.teamBId" :options="teamOptions" filterable /></div>
      <div class="field"><span>时间</span>
        <n-input v-model:value="editing.startTime" /></div>
      <div class="field"><span>场次</span>
        <n-input v-model:value="editing.sort" /></div>
    </div>
    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button size="small" @click="editing = null">取消</n-button>
        <n-button size="small" type="primary" @click="saveEdit">保存</n-button>
      </div>
    </template>
  </n-modal>

  <!-- 赛段管理对话框 -->
  <n-modal v-model:show="stageManager" preset="card" title="赛段管理" style="width: 520px">
    <div class="stage-list">
      <div v-for="s in stages" :key="s.id" class="stage-item">
        <template v-if="stageRename && stageRename.id === s.id">
          <n-input v-model:value="stageRename.name" size="small" style="width: 160px" @keyup.enter="saveStageRename" />
          <n-button size="tiny" type="primary" @click="saveStageRename">保存</n-button>
          <n-button size="tiny" @click="stageRename = null">取消</n-button>
        </template>
        <template v-else>
          <span class="stage-name-text">{{ s.name }}</span>
          <n-tag size="small" :bordered="false">{{ s.doneCount }}/{{ s.matchCount }} 场</n-tag>
          <span style="flex: 1"></span>
          <n-button size="tiny" secondary @click="stageRename = { ...s }">改名</n-button>
          <n-button size="tiny" type="error" secondary @click="deleteStage(s)">删除</n-button>
        </template>
      </div>
    </div>
    <div class="row" style="margin-top: 14px">
      <n-input v-model:value="newStageName" placeholder="新赛段名称（如：复活赛）" size="small" style="width: 220px" @keyup.enter="addStage" />
      <n-button size="small" @click="addStage">新增</n-button>
    </div>
  </n-modal>

  <!-- 标记正负对话框 -->
  <n-modal :show="!!resultFor" preset="card" title="标记胜负（一正一负）" style="width: 480px"
    @update:show="(v) => !v && (resultFor = null)">
    <p class="muted" v-if="resultFor">{{ resultFor.teamAName }} vs {{ resultFor.teamBName }}</p>
    <div class="pick" v-if="resultFor">
      <n-button size="large" @click="setResult(0)">{{ resultFor.teamAName }} 胜（正）</n-button>
      <n-button size="large" @click="setResult(1)">{{ resultFor.teamBName }} 胜（正）</n-button>
    </div>
  </n-modal>

  <ConfirmDialog
    :visible="!!deleting"
    title="删除比赛"
    :message="deleting ? `确定删除第 ${deleting.sort} 场「${deleting.teamAName} vs ${deleting.teamBName}」？检录记录将一并删除。` : ''"
    confirm-text="删除"
    danger
    @confirm="doDelete"
  />
  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; }
.field { display: grid; grid-template-columns: 70px 1fr; align-items: center; gap: 10px; }
.pick { display: flex; gap: 14px; margin-top: 6px; }
.pick > * { flex: 1; height: 64px; font-size: 16px; font-weight: 600; }
.stage-list { display: flex; flex-direction: column; gap: 8px; }
.stage-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.stage-name-text { font-weight: 600; min-width: 120px; }
</style>
