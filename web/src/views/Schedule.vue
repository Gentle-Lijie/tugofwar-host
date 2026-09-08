<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.vue';

const stages = ref([]);
const matches = ref([]);
const teams = ref([]);
const currentStageId = ref(null); // '' = 全部
const loading = ref(true);
const toast = ref(null);

const adding = ref(false);
const newMatch = ref({ stageId: '', teamAId: '', teamBId: '', startTime: '', sort: '' });
const editing = ref(null); // { ...match }
const resultFor = ref(null); // 标记正负的比赛
const deleting = ref(null);

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  loading.value = true;
  try {
    [stages.value, teams.value] = await Promise.all([api.get('/stages'), api.get('/teams')]);
    const cur = await api.get('/stages/current');
    currentStageId.value = cur.stageId ?? '';
    await loadMatches();
  } catch (e) {
    showToast(e.message, true);
  } finally {
    loading.value = false;
  }
}

async function loadMatches() {
  matches.value = await api.get('/matches');
}

async function switchStage() {
  try {
    await api.put('/stages/current', {
      stageId: currentStageId.value === '' ? null : Number(currentStageId.value),
    });
    showToast('已切换当前赛段');
  } catch (e) {
    showToast(e.message, true);
  }
}

const grouped = computed(() => {
  const byStage = new Map();
  for (const m of matches.value) {
    if (currentStageId.value !== '' && m.stageId !== Number(currentStageId.value)) continue;
    if (!byStage.has(m.stageId)) byStage.set(m.stageId, []);
    byStage.get(m.stageId).push(m);
  }
  return [...byStage.entries()].map(([stageId, ms]) => ({
    stage: stages.value.find((s) => s.id === stageId) || { id: stageId, name: ms[0].stageName },
    matches: ms,
  }));
});

async function addMatch() {
  const m = newMatch.value;
  if (!m.stageId || !m.teamAId || !m.teamBId) return showToast('请选择赛段和两队', true);
  try {
    await api.post('/matches', {
      stageId: Number(m.stageId),
      teamAId: Number(m.teamAId),
      teamBId: Number(m.teamBId),
      startTime: m.startTime || null,
      ...(m.sort ? { sort: Number(m.sort) } : {}),
    });
    adding.value = false;
    newMatch.value = { stageId: '', teamAId: '', teamBId: '', startTime: '', sort: '' };
    await loadMatches();
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function saveEdit() {
  const e = editing.value;
  try {
    const res = await api.patch(`/matches/${e.id}`, {
      stageId: Number(e.stageId),
      teamAId: Number(e.teamAId),
      teamBId: Number(e.teamBId),
      startTime: e.startTime || null,
      sort: Number(e.sort),
    });
    editing.value = null;
    if (res.resultCleared) showToast('该场已有结果，更换队伍后结果已清除');
    await loadMatches();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function setResult(winnerSide) {
  const m = resultFor.value;
  resultFor.value = null;
  try {
    await api.put(`/matches/${m.id}/result`, { winnerSide });
    await loadMatches();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function clearResult(m) {
  if (!confirm(`确定清除「${m.teamAName} vs ${m.teamBName}」的结果？`)) return;
  try {
    await api.put(`/matches/${m.id}/result`, { winnerSide: null });
    await loadMatches();
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
    await loadMatches();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function addStage() {
  const name = prompt('新赛段名称（如：复活赛）');
  if (!name || !name.trim()) return;
  try {
    await api.post('/stages', { name: name.trim() });
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

onMounted(load);
</script>

<template>
  <div class="row" style="justify-content: space-between; margin-bottom: 16px">
    <h1 class="page-title" style="margin: 0">赛程管理</h1>
    <div class="row">
      <select v-model="currentStageId" @change="switchStage">
        <option value="">全部赛段</option>
        <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}（{{ s.doneCount }}/{{ s.matchCount }}）</option>
      </select>
      <button @click="addStage">＋ 赛段</button>
      <button class="primary" @click="adding = !adding">＋ 比赛</button>
    </div>
  </div>

  <!-- 新增比赛 -->
  <div class="card" v-if="adding">
    <div class="row">
      <select v-model="newMatch.stageId">
        <option value="" disabled>赛段</option>
        <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <select v-model="newMatch.teamAId">
        <option value="" disabled>班级 A</option>
        <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <span>VS</span>
      <select v-model="newMatch.teamBId">
        <option value="" disabled>班级 B</option>
        <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <input v-model="newMatch.startTime" placeholder="时间（如 09:30）" style="width: 130px" />
      <input v-model="newMatch.sort" placeholder="场次（可空）" style="width: 100px" />
      <button class="primary" @click="addMatch">保存</button>
      <button @click="adding = false">取消</button>
    </div>
  </div>

  <div class="card" v-if="loading">加载中…</div>
  <div class="card" v-else-if="!grouped.length">
    <span class="muted">暂无比赛。可以到 <router-link to="/import/schedule">导入赛程</router-link> 批量创建。</span>
  </div>

  <div v-for="g in grouped" :key="g.stage.id" class="card">
    <div class="row" style="margin-bottom: 10px">
      <b style="font-size: 17px">{{ g.stage.name }}</b>
      <span class="muted">{{ g.matches.filter((m) => m.winnerSide !== null).length }} / {{ g.matches.length }} 已完成</span>
    </div>
    <table class="list">
      <thead>
        <tr>
          <th style="width: 44px">场次</th>
          <th>班级A</th>
          <th style="width: 36px"></th>
          <th>班级B</th>
          <th style="width: 80px">时间</th>
          <th style="width: 110px">结果</th>
          <th style="width: 330px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in g.matches" :key="m.id">
          <td class="muted">{{ m.sort }}</td>
          <template v-if="editing && editing.id === m.id">
            <td><select v-model="editing.teamAId">
              <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select></td>
            <td>VS</td>
            <td><select v-model="editing.teamBId">
              <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select></td>
            <td><input v-model="editing.startTime" style="width: 70px" /></td>
            <td></td>
            <td class="row">
              <select v-model="editing.stageId" style="width: 100px">
                <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <input v-model="editing.sort" style="width: 46px" />
              <button class="small primary" @click="saveEdit">保存</button>
              <button class="small" @click="editing = null">取消</button>
            </td>
          </template>
          <template v-else>
            <td :class="{ win: m.winnerSide === 0, lose: m.winnerSide === 1 }">{{ m.teamAName }}</td>
            <td class="muted">VS</td>
            <td :class="{ win: m.winnerSide === 1, lose: m.winnerSide === 0 }">{{ m.teamBName }}</td>
            <td class="muted">{{ m.startTime || '—' }}</td>
            <td>
              <span v-if="m.winnerSide === 0" class="badge ok">A 正</span>
              <span v-else-if="m.winnerSide === 1" class="badge ok">B 正</span>
              <span v-else class="badge muted">未赛</span>
            </td>
            <td>
              <router-link :to="`/matches/${m.id}/checkin`"><button class="small">检录</button></router-link>
              <button class="small primary" @click="resultFor = m">
                {{ m.winnerSide === null ? '标记胜负' : '改判' }}
              </button>
              <button v-if="m.winnerSide !== null" class="small" @click="clearResult(m)">清除</button>
              <button class="small" @click="editing = { ...m }">编辑</button>
              <button class="small" @click="setCalling(m)">叫号</button>
              <button class="small danger" @click="deleting = m">删除</button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 标记正负对话框 -->
  <div v-if="resultFor" class="overlay" @click.self="resultFor = null">
    <div class="dialog">
      <h3>标记胜负（一正一负）</h3>
      <p class="muted">{{ resultFor.teamAName }} vs {{ resultFor.teamBName }}</p>
      <div class="pick">
        <button class="pick-btn" @click="setResult(0)">{{ resultFor.teamAName }} 胜（正）</button>
        <button class="pick-btn" @click="setResult(1)">{{ resultFor.teamBName }} 胜（正）</button>
      </div>
    </div>
  </div>

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
td.win { color: var(--success); font-weight: 600; }
td.lose { color: var(--muted); }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  width: min(480px, 90vw);
}
.pick { display: flex; gap: 14px; margin-top: 14px; }
.pick-btn {
  flex: 1;
  padding: 22px 10px;
  font-size: 17px;
  font-weight: 600;
  border-radius: 10px;
  border: 2px solid var(--border);
}
.pick-btn:hover { border-color: var(--primary); color: var(--primary); }
</style>
