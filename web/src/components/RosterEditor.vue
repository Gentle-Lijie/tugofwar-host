<script setup>
// 队伍名单展示 + 编辑（增/改/删），供队伍管理页展开行与队伍详情页复用
import { ref, h, onMounted } from 'vue';
import { NDataTable, NButton, NInput, NTag } from 'naive-ui';
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

const columns = [
  {
    title: '#',
    key: 'idx',
    width: 50,
    render: (row, i) => i + 1,
  },
  {
    title: '姓名',
    key: 'name',
    render: (row) =>
      editing.value && editing.value.id === row.id
        ? h(NInput, {
            size: 'small',
            value: editing.value.name,
            'onUpdate:value': (v) => (editing.value.name = v),
            onKeyup: (e) => e.key === 'Enter' && saveEdit(),
            style: 'width: 120px',
          })
        : row.name,
  },
  {
    title: '学号',
    key: 'studentNo',
    render: (row) =>
      editing.value && editing.value.id === row.id
        ? h(NInput, {
            size: 'small',
            value: editing.value.studentNo,
            'onUpdate:value': (v) => (editing.value.studentNo = v),
            onKeyup: (e) => e.key === 'Enter' && saveEdit(),
            style: 'width: 140px',
          })
        : h('span', { class: 'muted' }, row.studentNo),
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render: (row) =>
      editing.value && editing.value.id === row.id
        ? [
            h(
              NButton,
              { size: 'tiny', type: 'primary', onClick: saveEdit },
              { default: () => '保存' }
            ),
            h(
              NButton,
              { size: 'tiny', style: 'margin-left: 6px', onClick: () => (editing.value = null) },
              { default: () => '取消' }
            ),
          ]
        : [
            h(
              NButton,
              {
                size: 'tiny',
                secondary: true,
                onClick: () => (editing.value = { ...row }),
              },
              { default: () => '编辑' }
            ),
            h(
              NButton,
              {
                size: 'tiny',
                type: 'error',
                secondary: true,
                style: 'margin-left: 6px',
                onClick: () => remove(row),
              },
              { default: () => '删除' }
            ),
          ],
  },
];
</script>

<template>
  <div class="roster">
    <div class="row add-row">
      <n-input v-model:value="newName" placeholder="姓名" size="small" style="width: 130px" @keyup.enter="add" />
      <n-input v-model:value="newNo" placeholder="学号" size="small" style="width: 150px" @keyup.enter="add" />
      <n-button size="small" :disabled="adding || !newName.trim() || !newNo.trim()" @click="add">
        添加队员
      </n-button>
      <n-tag v-if="!loading" size="small" type="info" :bordered="false">共 {{ players.length }} 人</n-tag>
    </div>

    <n-data-table
      :columns="columns"
      :data="players"
      :loading="loading"
      :row-key="(r) => r.id"
      size="small"
      :bordered="false"
    />
    <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
  </div>
</template>

<style scoped>
.roster { padding: 4px 0; }
.add-row { margin-bottom: 10px; }
</style>
