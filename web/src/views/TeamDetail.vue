<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const teamId = route.params.id;

const team = ref(null);
const players = ref([]);
const newName = ref('');
const newNo = ref('');
const toast = ref(null);
const editing = ref(null); // { id, name, studentNo }

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  const teams = await api.get('/teams');
  team.value = teams.find((t) => t.id === Number(teamId));
  players.value = await api.get(`/teams/${teamId}/players`);
}
onMounted(() => load().catch((e) => showToast(e.message, true)));

async function add() {
  if (!newName.value.trim() || !newNo.value.trim()) return;
  try {
    await api.post(`/teams/${teamId}/players`, {
      name: newName.value.trim(),
      studentNo: newNo.value.trim(),
    });
    newName.value = '';
    newNo.value = '';
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function saveEdit() {
  try {
    await api.patch(`/players/${editing.value.id}`, {
      name: editing.value.name,
      studentNo: editing.value.studentNo,
    });
    editing.value = null;
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function remove(p) {
  if (!confirm(`确定删除队员「${p.name}」（${p.studentNo}）？其检录记录将一并删除。`)) return;
  try {
    await api.del(`/players/${p.id}`);
    await load();
  } catch (e) {
    showToast(e.message, true);
  }
}
</script>

<template>
  <template v-if="team">
    <h1 class="page-title">
      <router-link to="/teams">队伍</router-link> / {{ team.name }}
      <span class="muted" style="font-size: 14px; font-weight: 400; margin-left: 10px">
        胜 {{ team.wins }} · 负 {{ team.losses }}
      </span>
    </h1>

    <div class="card row">
      <input v-model="newName" placeholder="姓名" style="width: 140px" @keyup.enter="add" />
      <input v-model="newNo" placeholder="学号" style="width: 160px" @keyup.enter="add" />
      <button class="primary" @click="add">添加队员</button>
      <span class="muted">共 {{ players.length }} 人</span>
    </div>

    <div class="card">
      <table class="list" v-if="players.length">
        <thead>
          <tr><th>#</th><th>姓名</th><th>学号</th><th style="width: 150px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in players" :key="p.id">
            <template v-if="editing && editing.id === p.id">
              <td>{{ i + 1 }}</td>
              <td><input v-model="editing.name" style="width: 110px" /></td>
              <td><input v-model="editing.studentNo" style="width: 130px" /></td>
              <td class="row">
                <button class="small primary" @click="saveEdit">保存</button>
                <button class="small" @click="editing = null">取消</button>
              </td>
            </template>
            <template v-else>
              <td>{{ i + 1 }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.studentNo }}</td>
              <td>
                <button class="small" @click="editing = { ...p }">编辑</button>
                <button class="small danger" @click="remove(p)">删除</button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
      <span v-else class="muted">暂无队员。可在 <router-link to="/import/roster">导入名单</router-link> 中上传该队伍的 Excel。</span>
    </div>
  </template>
  <div v-else class="card">加载中…</div>
  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>
