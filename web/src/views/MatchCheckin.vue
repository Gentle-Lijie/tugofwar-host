<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const matchId = route.params.id;

const data = ref(null);
const toast = ref(null);
let timer = null;
let inFlight = false;

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2000);
}

async function load() {
  if (inFlight) return;
  inFlight = true;
  try {
    data.value = await api.get(`/matches/${matchId}/checkin`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    inFlight = false;
  }
}

async function toggle(team, p) {
  // 乐观 UI
  p.present = p.present ? 0 : 1;
  team.present += p.present ? 1 : -1;
  try {
    await api.put(`/matches/${matchId}/checkin/${p.playerId}`, { present: !!p.present });
  } catch (e) {
    p.present = p.present ? 0 : 1; // 回滚
    team.present += p.present ? 1 : -1;
    showToast(e.message, true);
  }
}

async function resetAll() {
  if (!confirm('确定把本场比赛全部队员重置为未到场？')) return;
  try {
    await api.post(`/matches/${matchId}/checkin/reset`);
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function setCalling() {
  try {
    await api.put('/display/current', { matchId: Number(matchId), calling: true });
    showToast('已在大屏叫号');
  } catch (e) {
    showToast(e.message, true);
  }
}

onMounted(() => {
  load();
  timer = setInterval(load, 5000); // 多检录员屏幕同步
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <template v-if="data">
    <div class="row" style="justify-content: space-between; margin-bottom: 16px">
      <h1 class="page-title" style="margin: 0">
        检录 · {{ data.match.stageName }} 第 {{ data.match.sort }} 场
        <span class="muted" style="font-size: 14px; font-weight: 400">
          {{ data.match.startTime || '' }}
        </span>
      </h1>
      <div class="row">
        <button @click="setCalling">📢 大屏叫号</button>
        <button class="danger" @click="resetAll">全部重置</button>
      </div>
    </div>

    <div class="two-col">
      <div class="card team" v-for="team in [data.teamA, data.teamB]" :key="team.id">
        <div class="row" style="justify-content: space-between; margin-bottom: 12px">
          <b style="font-size: 17px">{{ team.name }}</b>
          <div class="progress" :class="{ full: team.present === team.total && team.total > 0 }">
            到场 {{ team.present }}/{{ team.total }}
            <div class="bar">
              <div class="fill" :style="{ width: team.total ? (team.present / team.total) * 100 + '%' : '0%' }"></div>
            </div>
          </div>
        </div>
        <div class="players">
          <div
            v-for="p in team.players"
            :key="p.playerId"
            class="player"
            :class="{ present: !!p.present }"
            @click="toggle(team, p)"
          >
            <span class="mark">{{ p.present ? '●' : '○' }}</span>
            <span class="pname">{{ p.name }}</span>
            <span class="pno muted">{{ p.studentNo }}</span>
          </div>
          <p v-if="!team.players.length" class="muted">该队伍暂无队员名单</p>
        </div>
      </div>
    </div>
    <p class="muted" style="text-align: center">点击学生行切换 到场 / 未到场</p>
  </template>
  <div v-else class="card">加载中…</div>
  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }
.progress { min-width: 180px; font-size: 14px; font-weight: 600; }
.progress.full { color: var(--success); }
.bar { height: 6px; background: #e5e7eb; border-radius: 3px; margin-top: 4px; overflow: hidden; }
.fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.2s; }
.progress.full .fill { background: var(--success); }
.players { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  background: #fff;
}
.player:hover { border-color: var(--primary); }
.player.present { background: #f0fdf4; border-color: #86efac; }
.mark { color: var(--muted); }
.player.present .mark { color: var(--success); }
.pname { font-weight: 500; flex: 1; }
.pno { font-size: 12px; }
</style>
