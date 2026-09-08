<script setup>
import { ref, computed, onMounted } from 'vue';
import { NButton, NInput, NTag } from 'naive-ui';
import { api } from '../api.js';
import MatchCard from '../components/MatchCard.vue';

const state = ref(null);
const stages = ref([]);
const teams = ref([]);
const announcement = ref('');
const imageLiveUrl = ref('');
const saving = ref(false);
const toast = ref(null);

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  try {
    [state.value, stages.value, teams.value] = await Promise.all([
      api.get('/display/state'),
      api.get('/stages'),
      api.get('/teams'),
    ]);
    announcement.value = state.value.announcement || '';
    imageLiveUrl.value = state.value.imageLiveUrl || '';
  } catch (e) {
    showToast(e.message, true);
  }
}
onMounted(load);

const stats = computed(() => {
  const total = teams.value.length;
  const players = teams.value.reduce((s, t) => s + t.playerCount, 0);
  const done = stages.value.reduce((s, st) => s + st.doneCount, 0);
  const all = stages.value.reduce((s, st) => s + st.matchCount, 0);
  return { total, players, done, all };
});

// 可设为当前比赛的未赛比赛（当前赛段优先）
const callable = computed(() => {
  if (!state.value) return [];
  const stageId = state.value.currentStage?.id;
  const all = state.value.upcoming;
  return stageId ? all.filter((m) => m.stageId === stageId) : all;
});

async function callMatch(m) {
  try {
    await api.put('/display/current', { matchId: m.id, calling: true });
    showToast(`已在叫号「${m.teamAName} vs ${m.teamBName}」`);
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function stopCalling() {
  try {
    await api.put('/display/current', { matchId: null });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function toggleCalling() {
  try {
    await api.put('/display/calling', { calling: !state.value.calling });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await Promise.all([
      api.put('/display/announcement', { text: announcement.value }),
      api.put('/display/image-live', { url: imageLiveUrl.value.trim() }),
    ]);
    showToast('大屏设置已更新');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <h1 class="page-title">总览</h1>

  <div class="stats">
    <div class="card stat"><div class="num">{{ stats.total }}</div><div class="lbl">队伍</div></div>
    <div class="card stat"><div class="num">{{ stats.players }}</div><div class="lbl">队员</div></div>
    <div class="card stat"><div class="num">{{ stats.done }}/{{ stats.all }}</div><div class="lbl">已完成比赛</div></div>
    <div class="card stat">
      <div class="num">{{ state?.currentStage ? state.currentStage.name : '—' }}</div>
      <div class="lbl">当前赛段</div>
    </div>
  </div>

  <!-- 当前比赛 / 叫号控制 -->
  <div class="card" v-if="state">
    <div class="row" style="justify-content: space-between; margin-bottom: 12px">
      <b>大屏叫号控制</b>
      <div class="row" v-if="state.currentMatch">
        <n-button size="small" @click="toggleCalling">
          {{ state.calling ? '🔇 停止叫号横幅' : '📢 恢复叫号横幅' }}
        </n-button>
        <n-button size="small" type="error" secondary @click="stopCalling">结束当前比赛</n-button>
      </div>
    </div>

    <template v-if="state.currentMatch">
      <MatchCard :match="state.currentMatch" show-stage />
      <p v-if="state.calling" class="muted" style="margin: 8px 0 0">
        📢 大屏正在叫号：「{{ state.currentMatch.teamAName }}」和「{{ state.currentMatch.teamBName }}」请前往检录台
      </p>
    </template>
    <p v-else class="muted">当前没有指定比赛。从下面的即将开始列表选择一场开始叫号：</p>

    <div class="call-list" v-if="!state.currentMatch">
      <div v-for="m in callable" :key="m.id" class="call-item">
        <MatchCard :match="m" show-stage />
        <n-button size="small" type="primary" @click="callMatch(m)">开始叫号</n-button>
      </div>
      <p v-if="!callable.length" class="muted">当前赛段没有待赛的比赛（或未设置当前赛段）。</p>
    </div>
  </div>

  <!-- 大屏设置 -->
  <div class="card" v-if="state">
    <b>大屏设置</b>
    <div class="form">
      <div class="field">
        <span>公告</span>
        <n-input v-model:value="announcement" placeholder="滚动显示在大屏标题下方（留空则不显示）" />
      </div>
      <div class="field">
        <span>图片直播二维码</span>
        <n-input v-model:value="imageLiveUrl" placeholder="图片直播链接（http(s)://…，留空显示占位框）" />
      </div>
    </div>
    <div class="row" style="justify-content: flex-end; margin-top: 12px">
      <n-button size="small" type="primary" :disabled="saving" @click="saveSettings">
        {{ saving ? '保存中…' : '保存' }}
      </n-button>
    </div>
  </div>

  <div class="card">
    <b>快捷入口</b>
    <div class="quick row" style="margin-top: 10px">
      <router-link to="/import/roster"><n-button size="small">导入名单</n-button></router-link>
      <router-link to="/import/schedule"><n-button size="small">导入赛程</n-button></router-link>
      <router-link to="/teams"><n-button size="small">队伍管理</n-button></router-link>
      <router-link to="/schedule"><n-button size="small">赛程管理</n-button></router-link>
      <router-link to="/results"><n-button size="small">赛段结果</n-button></router-link>
      <a href="/display" target="_blank"><n-button size="small">打开大屏 ↗</n-button></a>
    </div>
  </div>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 16px; }
.stat { text-align: center; padding: 18px; }
.num { font-size: 28px; font-weight: 700; color: #2980b9; }
.lbl { color: #707d89; margin-top: 4px; }
.call-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.call-item { display: flex; align-items: center; gap: 12px; }
.call-item > :first-child { flex: 1; }
.form { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.field { display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 10px; }
</style>
