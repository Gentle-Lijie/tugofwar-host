<script setup>
import { ref, h, onMounted } from 'vue';
import { NDataTable, NButton, NSelect, NTag } from 'naive-ui';
import { api, download } from '../api.js';

const stages = ref([]);
const stageId = ref(null);
const matches = ref([]);
const loading = ref(false);
const exporting = ref(false);
const toast = ref(null);

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  const [list, cur] = await Promise.all([api.get('/stages'), api.get('/stages/current')]);
  stages.value = list;
  if (stageId.value === null && cur.stageId) stageId.value = cur.stageId;
  await loadMatches();
}

async function loadMatches() {
  if (stageId.value === null) {
    matches.value = [];
    return;
  }
  loading.value = true;
  try {
    matches.value = await api.get(`/matches?stageId=${stageId.value}`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    loading.value = false;
  }
}

const stageOptions = () => stages.value.map((s) => ({
  label: `${s.name}（${s.doneCount}/${s.matchCount}）`,
  value: s.id,
}));

async function exportStage() {
  if (stageId.value === null) return;
  exporting.value = true;
  const stage = stages.value.find((s) => s.id === stageId.value);
  try {
    await download(`/export/stage/${stageId.value}`, `${stage?.name || '赛段'}-比赛结果.xlsx`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    exporting.value = false;
  }
}

const columns = [
  { title: '场次', key: 'sort', width: 60, render: (m) => h('span', { class: 'muted' }, m.sort) },
  {
    title: '胜方（正）',
    key: 'winner',
    render: (m) =>
      m.winnerSide === null
        ? h('span', { class: 'muted' }, m.teamAName)
        : h('span', { style: { color: '#33afcd', fontWeight: '700' } },
            m.winnerSide === 0 ? m.teamAName : m.teamBName),
  },
  {
    title: '负方（负）',
    key: 'loser',
    render: (m) =>
      m.winnerSide === null
        ? h('span', { class: 'muted' }, m.teamBName)
        : h('span', { style: { color: '#9aa5b1' } },
            m.winnerSide === 0 ? m.teamBName : m.teamAName),
  },
  { title: '时间', key: 'startTime', width: 100, render: (m) => h('span', { class: 'muted' }, m.startTime || '—') },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (m) =>
      m.winnerSide === null
        ? h(NTag, { size: 'small', bordered: false }, { default: () => '未开始' })
        : h(NTag, { size: 'small', type: 'success', bordered: false }, { default: () => '已完成' }),
  },
  { title: '备注', key: 'note', render: (m) => h('span', { class: 'muted' }, m.note || '') },
];

onMounted(() => load().catch((e) => showToast(e.message, true)));
</script>

<template>
  <div class="row" style="justify-content: space-between; margin-bottom: 16px">
    <h1 class="page-title" style="margin: 0">赛段结果</h1>
    <div class="row">
      <n-select
        v-model:value="stageId"
        :options="stageOptions()"
        size="small"
        style="width: 220px"
        placeholder="选择赛段"
        @update:value="loadMatches"
      />
      <n-button size="small" type="primary" :disabled="stageId === null || exporting" @click="exportStage">
        {{ exporting ? '导出中…' : '⬇ 导出 Excel' }}
      </n-button>
    </div>
  </div>

  <div class="card" v-if="stageId === null"><span class="muted">请选择要查看/导出的赛段。</span></div>
  <div class="card" v-else-if="loading">加载中…</div>
  <div class="card" v-else-if="!matches.length"><span class="muted">该赛段暂无比赛。</span></div>
  <div class="card" v-else>
    <n-data-table :columns="columns" :data="matches" :row-key="(m) => m.id" size="small" />
  </div>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>
