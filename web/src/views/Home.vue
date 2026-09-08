<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import MatchCard from '../components/MatchCard.vue';

const state = ref(null);
const stages = ref([]);
const teams = ref([]);
const announcement = ref('');
const savingAnn = ref(false);
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

async function saveAnnouncement() {
  savingAnn.value = true;
  try {
    await api.put('/display/announcement', { text: announcement.value });
    showToast('公告已更新');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    savingAnn.value = false;
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
        <button class="small" @click="toggleCalling">
          {{ state.calling ? '🔇 停止叫号横幅' : '📢 恢复叫号横幅' }}
        </button>
        <button class="small danger" @click="stopCalling">结束当前比赛</button>
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
        <button class="small primary" @click="callMatch(m)">开始叫号</button>
      </div>
      <p v-if="!callable.length" class="muted">当前赛段没有待赛的比赛（或未设置当前赛段）。</p>
    </div>
  </div>

  <!-- 公告 -->
  <div class="card" v-if="state">
    <b>大屏公告</b>
    <div class="row" style="margin-top: 10px">
      <input v-model="announcement" placeholder="滚动显示在大屏顶部（留空则不显示）" style="flex: 1" />
      <button class="primary" :disabled="savingAnn" @click="saveAnnouncement">保存</button>
    </div>
  </div>

  <div class="card">
    <b>快捷入口</b>
    <div class="quick row" style="margin-top: 10px">
      <router-link to="/import/roster"><button>导入名单</button></router-link>
      <router-link to="/import/schedule"><button>导入赛程</button></router-link>
      <router-link to="/teams"><button>队伍管理</button></router-link>
      <router-link to="/schedule"><button>赛程管理</button></router-link>
      <router-link to="/results"><button>赛段结果</button></router-link>
      <a href="/display" target="_blank"><button>打开大屏 ↗</button></a>
    </div>
  </div>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 16px; }
.stat { text-align: center; padding: 18px; }
.num { font-size: 28px; font-weight: 700; color: var(--primary); }
.lbl { color: var(--muted); margin-top: 4px; }
.call-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.call-item { display: flex; align-items: center; gap: 12px; }
.call-item > :first-child { flex: 1; }
</style>
