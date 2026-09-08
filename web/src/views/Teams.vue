<script setup>
import { ref, h, onMounted } from 'vue';
import { NDataTable, NButton, NInput, NTag } from 'naive-ui';
import { api } from '../api.js';
import { PALETTE } from '../colors.js';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import RosterEditor from '../components/RosterEditor.vue';

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

const columns = [
  { type: 'expand', renderExpand: (row) => h(RosterEditor, { teamId: row.id, onChanged: load }) },
  {
    title: '队伍',
    key: 'name',
    render: (row) =>
      h(
        'span',
        {
          style: { fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px' },
        },
        [
          h('span', {
            style: {
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: row.color || PALETTE[(row.id ?? 0) % PALETTE.length],
              display: 'inline-block',
            },
          }),
          row.name,
        ]
      ),
  },
  {
    title: '队员',
    key: 'playerCount',
    width: 80,
    render: (row) => `${row.playerCount} 人`,
  },
  {
    title: '胜 / 负',
    key: 'record',
    width: 90,
    render: (row) => `${row.wins} / ${row.losses}`,
  },
  {
    title: '配色',
    key: 'color',
    render: (row) =>
      h(
        'div',
        { style: { display: 'flex', gap: '5px' } },
        PALETTE.map((c) =>
          h('span', {
            class: 'swatch' + (row.color === c ? ' active' : ''),
            style: { background: c },
            onClick: () => recolor(row, c),
          })
        )
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    render: (row) => [
      h(NButton, { size: 'tiny', secondary: true, onClick: () => rename(row) }, { default: () => '改名' }),
      h(
        NButton,
        {
          size: 'tiny',
          type: 'error',
          secondary: true,
          style: 'margin-left: 6px',
          onClick: () => (pendingDelete.value = row),
        },
        { default: () => '删除' }
      ),
    ],
  },
];
</script>

<template>
  <h1 class="page-title">队伍管理</h1>

  <div class="card row">
    <n-input v-model:value="newName" placeholder="新队伍名（班级）" style="width: 220px" @keyup.enter="create" />
    <n-button type="primary" :disabled="creating || !newName.trim()" @click="create">添加队伍</n-button>
    <n-tag v-if="teams.length" size="small" type="info" :bordered="false">共 {{ teams.length }} 支队伍</n-tag>
  </div>

  <div class="card" v-if="loading">加载中…</div>
  <div class="card" v-else-if="!teams.length">
    <span class="muted">还没有队伍。可以到 <router-link to="/import/roster">导入名单</router-link> 批量创建，或在此手动添加。</span>
  </div>

  <div class="card" v-else>
    <n-data-table :columns="columns" :data="teams" :row-key="(r) => r.id" size="small" />
    <p class="muted" style="font-size: 13px; margin: 8px 0 0">点击行首箭头展开队伍名单，可直接增改删队员。</p>
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

<style>
.swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  display: inline-block;
}
.swatch.active { border-color: #10263b; }
</style>
