<script setup>
// 旧版 PHP attendance.php 风格：双栏表格、已签到(青)/未签到(红)、上一场/下一场
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { api } from '../api.js';

const route = useRoute();
const router = useRouter();
// 组件会被复用（同一路由不同比赛 id），必须响应参数变化
const matchId = computed(() => Number(route.params.id));

const data = ref(null);
const allMatches = ref([]);
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
    data.value = await api.get(`/matches/${matchId.value}/checkin`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    inFlight = false;
  }
}

watch(matchId, () => {
  window.scrollTo({ top: 0 });
  load();
});

async function loadNeighbors() {
  try {
    allMatches.value = await api.get('/matches');
  } catch {
    /* 导航按钮退化为不可用 */
  }
}

const neighbors = computed(() => {
  const idx = allMatches.value.findIndex((m) => m.id === matchId.value);
  if (idx === -1) return {};
  return {
    prev: allMatches.value[idx - 1] || null,
    next: allMatches.value[idx + 1] || null,
  };
});

function goto(m) {
  if (!m) return;
  router.push(`/matches/${m.id}/checkin`);
}

async function toggle(team, p) {
  // 乐观 UI
  p.present = p.present ? 0 : 1;
  team.present += p.present ? 1 : -1;
  try {
    await api.put(`/matches/${matchId.value}/checkin/${p.playerId}`, { present: !!p.present });
  } catch (e) {
    p.present = p.present ? 0 : 1; // 回滚
    team.present += p.present ? 1 : -1;
    showToast(e.message, true);
  }
}

async function resetAll() {
  if (!confirm('确定把本场比赛全部队员重置为未到场？')) return;
  try {
    await api.post(`/matches/${matchId.value}/checkin/reset`);
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function setCalling() {
  try {
    await api.put('/display/current', { matchId: matchId.value, calling: true });
    showToast('已在大屏叫号');
  } catch (e) {
    showToast(e.message, true);
  }
}

onMounted(() => {
  load();
  loadNeighbors();
  timer = setInterval(load, 5000); // 多检录员屏幕同步
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <template v-if="data">
    <h1 class="page-title" style="text-align: center">
      检录：{{ data.match.teamAName }} VS {{ data.match.teamBName }}
      <span class="muted" style="font-size: 15px; font-weight: normal">
        {{ data.match.stageName }} 第 {{ data.match.sort }} 场{{ data.match.startTime ? ' · ' + data.match.startTime : '' }}
      </span>
    </h1>

    <div class="row" style="justify-content: center; margin-bottom: 16px">
      <n-button type="primary" @click="setCalling">📢 大屏叫号</n-button>
      <n-button type="error" secondary @click="resetAll">全部重置</n-button>
    </div>

    <table class="checkin-table">
      <tr>
        <th class="class-column">
          {{ data.match.teamAName }} 学生
          <span class="count">到场 {{ data.teamA.present }}/{{ data.teamA.total }}</span>
        </th>
        <th class="class-column">
          {{ data.match.teamBName }} 学生
          <span class="count">到场 {{ data.teamB.present }}/{{ data.teamB.total }}</span>
        </th>
      </tr>
      <tr>
        <td v-for="team in [data.teamA, data.teamB]" :key="team.id" class="class-cell">
          <table class="inner">
            <tr
              v-for="p in team.players"
              :key="p.playerId"
              class="student-row"
              @click="toggle(team, p)"
            >
              <td class="sname">{{ p.name }}</td>
              <td class="sno">{{ p.studentNo }}</td>
              <td class="status" :class="p.present ? 'checked-in' : 'not-checked-in'">
                {{ p.present ? '已签到' : '未签到' }}
              </td>
            </tr>
          </table>
          <p v-if="!team.players.length" class="muted" style="text-align: center">该队伍暂无队员名单</p>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin: 20px 0">
      <n-button v-if="neighbors.prev" secondary style="margin-right: 10px" @click="goto(neighbors.prev)">
        上一场（{{ neighbors.prev.teamAName }} VS {{ neighbors.prev.teamBName }}）
      </n-button>
      <n-button v-if="neighbors.next" secondary @click="goto(neighbors.next)">
        下一场（{{ neighbors.next.teamAName }} VS {{ neighbors.next.teamBName }}）
      </n-button>
    </div>
    <p class="muted" style="text-align: center">点击学生行切换 已签到 / 未签到</p>
  </template>
  <div v-else class="card">加载中…</div>
  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
.checkin-table {
  width: 90%;
  max-width: 1100px;
  margin: 0 auto 10px;
  border-collapse: collapse;
}
.checkin-table > tr > th,
.checkin-table > tr > td {
  border: 1px solid #cfd4d8;
  padding: 0;
  vertical-align: top;
  width: 50%;
  background: #fff;
}
/* 需要比上面的 background: #fff 优先级高，否则白字落在白底上 */
.checkin-table > tr > th.class-column {
  background: #10263b;
  color: #fff;
  padding: 10px;
  font-size: 17px;
  text-align: center;
}
.class-column .count { font-size: 14px; font-weight: normal; margin-left: 10px; color: #99d7e6; }
.class-cell { padding: 6px; }
.inner { width: 100%; border-collapse: collapse; }
.inner td { padding: 8px 12px; border-bottom: 1px solid #eee; }
.student-row { cursor: pointer; }
.student-row:hover { background: #f0f4f8; }
.sname { font-weight: bold; }
.sno { color: #707d89; font-size: 13px; }
.status { font-weight: bold; text-align: center; width: 90px; }
.checked-in { color: #33afcd; }
.not-checked-in { color: #e74c3c; }
</style>
