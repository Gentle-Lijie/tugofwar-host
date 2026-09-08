<script setup>
// 队伍名单展示 + 编辑（增/改/删），供队伍管理页展开行与队伍详情页复用
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const props = defineProps({
  teamId: { type: [Number, String], required: true },
});
const emit = defineEmits(['changed']);

const players = ref([]);
const loading = ref(true);
const newName = ref('');
const newNo = ref('');
const adding = ref(false);
const editing = ref(null); // { id, name, studentNo }
const toast = ref(null);

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2000);
}

async function load() {
  loading.value = true;
  try {
    players.value = await api.get(`/teams/${props.teamId}/players`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function add() {
  if (!newName.value.trim() || !newNo.value.trim()) return;
  adding.value = true;
  try {
    await api.post(`/teams/${props.teamId}/players`, {
      name: newName.value.trim(),
      studentNo: newNo.value.trim(),
    });
    newName.value = '';
    newNo.value = '';
    await load();
    emit('changed');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    adding.value = false;
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
    emit('changed');
  } catch (e) {
    showToast(e.message, true);
  }
}

async function remove(p) {
  if (!confirm(`确定删除队员「${p.name}」（${p.studentNo}）？其检录记录将一并删除。`)) return;
  try {
    await api.del(`/players/${p.id}`);
    await load();
    emit('changed');
  } catch (e) {
    showToast(e.message, true);
  }
}
</script>

<template>
  <div class="roster">
    <div class="row add-row">
      <input v-model="newName" placeholder="姓名" style="width: 130px" @keyup.enter="add" />
      <input v-model="newNo" placeholder="学号" style="width: 150px" @keyup.enter="add" />
      <button class="small" :disabled="adding || !newName.trim() || !newNo.trim()" @click="add">添加队员</button>
      <span class="muted">共 {{ players.length }} 人</span>
    </div>

    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="!players.length" class="muted">
      暂无队员。可在此手动添加，或到 <router-link to="/import/roster">导入名单</router-link> 上传 Excel。
    </p>

    <table class="list" v-else>
      <thead>
        <tr><th style="width: 44px">#</th><th>姓名</th><th>学号</th><th style="width: 150px">操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="(p, i) in players" :key="p.id">
          <template v-if="editing && editing.id === p.id">
            <td>{{ i + 1 }}</td>
            <td><input v-model="editing.name" style="width: 110px" @keyup.enter="saveEdit" /></td>
            <td><input v-model="editing.studentNo" style="width: 130px" @keyup.enter="saveEdit" /></td>
            <td class="row">
              <button class="small" @click="saveEdit">保存</button>
              <button class="small subtle" @click="editing = null">取消</button>
            </td>
          </template>
          <template v-else>
            <td class="muted">{{ i + 1 }}</td>
            <td>{{ p.name }}</td>
            <td class="muted">{{ p.studentNo }}</td>
            <td>
              <button class="small subtle" @click="editing = { ...p }">编辑</button>
              <button class="small danger" @click="remove(p)">删除</button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
    <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
  </div>
</template>

<style scoped>
.roster { padding: 6px 0; }
.add-row { margin-bottom: 10px; }
</style>
