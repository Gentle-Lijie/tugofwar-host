<script setup>
import { ref, onMounted } from 'vue';
import { api, download } from '../api.js';

const stages = ref([]);
const stageId = ref('');
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
  if (stageId.value === '' && cur.stageId) stageId.value = String(cur.stageId);
  await loadMatches();
}

async function loadMatches() {
  if (stageId.value === '') {
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

async function exportStage() {
  if (!stageId.value) return;
  exporting.value = true;
  const stage = stages.value.find((s) => s.id === Number(stageId.value));
  try {
    await download(`/export/stage/${stageId.value}`, `${stage?.name || '赛段'}-比赛结果.xlsx`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    exporting.value = false;
  }
}

onMounted(() => load().catch((e) => showToast(e.message, true)));
</script>

<template>
  <div class="row" style="justify-content: space-between; margin-bottom: 16px">
    <h1 class="page-title" style="margin: 0">赛段结果</h1>
    <div class="row">
      <select v-model="stageId" @change="loadMatches">
        <option value="" disabled>选择赛段</option>
        <option v-for="s in stages" :key="s.id" :value="s.id">
          {{ s.name }}（{{ s.doneCount }}/{{ s.matchCount }}）
        </option>
      </select>
      <button class="primary" :disabled="!stageId || exporting" @click="exportStage">
        {{ exporting ? '导出中…' : '⬇ 导出 Excel' }}
      </button>
    </div>
  </div>

  <div class="card" v-if="!stageId"><span class="muted">请选择要查看/导出的赛段。</span></div>
  <div class="card" v-else-if="loading">加载中…</div>
  <div class="card" v-else-if="!matches.length"><span class="muted">该赛段暂无比赛。</span></div>

  <div class="card" v-else>
    <table class="list">
      <thead>
        <tr>
          <th style="width: 50px">场次</th>
          <th>胜方（正）</th>
          <th>负方（负）</th>
          <th style="width: 110px">时间</th>
          <th style="width: 90px">状态</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in matches" :key="m.id">
          <td class="muted">{{ m.sort }}</td>
          <template v-if="m.winnerSide !== null">
            <td class="win">{{ m.winnerSide === 0 ? m.teamAName : m.teamBName }}</td>
            <td class="lose">{{ m.winnerSide === 0 ? m.teamBName : m.teamAName }}</td>
          </template>
          <template v-else>
            <td>{{ m.teamAName }}</td>
            <td>{{ m.teamBName }}</td>
          </template>
          <td class="muted">{{ m.startTime || '—' }}</td>
          <td>
            <span v-if="m.winnerSide !== null" class="badge ok">已完成</span>
            <span v-else class="badge muted">未开始</span>
          </td>
          <td class="muted">{{ m.note || '' }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
td.win { color: var(--success); font-weight: 600; }
td.lose { color: var(--muted); }
</style>
