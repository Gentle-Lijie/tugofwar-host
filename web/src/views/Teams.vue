<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';
import { PALETTE } from '../colors.js';
import ConfirmDialog from '../components/ConfirmDialog.vue';

const teams = ref([]);
const loading = ref(true);
const newName = ref('');
const creating = ref(false);
const pendingDelete = ref(null);
const toast = ref(null);

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  loading.value = true;
  try {
    teams.value = await api.get('/teams');
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
</script>

<template>
  <h1 class="page-title">队伍管理</h1>

  <div class="card row">
    <input v-model="newName" placeholder="新队伍名（班级）" @keyup.enter="create" />
    <button class="primary" :disabled="creating || !newName.trim()" @click="create">添加队伍</button>
    <span class="muted" v-if="teams.length">共 {{ teams.length }} 支队伍</span>
  </div>

  <div class="card" v-if="loading">加载中…</div>
  <div class="card" v-else-if="!teams.length">
    <span class="muted">还没有队伍。可以到 <router-link to="/import/roster">导入名单</router-link> 批量创建，或在此手动添加。</span>
  </div>

  <div class="card" v-else>
    <table class="list">
      <thead>
        <tr>
          <th>队伍</th>
          <th>队员</th>
          <th>胜 / 负</th>
          <th>配色</th>
          <th style="width: 200px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in teams" :key="t.id">
          <td><router-link :to="`/teams/${t.id}`">{{ t.name }}</router-link></td>
          <td>{{ t.playerCount }} 人</td>
          <td>{{ t.wins }} / {{ t.losses }}</td>
          <td>
            <div class="palette">
              <span
                v-for="c in PALETTE"
                :key="c"
                class="swatch"
                :class="{ active: t.color === c }"
                :style="{ background: c }"
                @click="recolor(t, c)"
              ></span>
            </div>
          </td>
          <td>
            <button class="small" @click="rename(t)">改名</button>
            <button class="small danger" @click="pendingDelete = t">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

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

<style scoped>
.palette { display: flex; gap: 5px; }
.swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
}
.swatch.active { border-color: var(--text); }
</style>
