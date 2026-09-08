<script setup>
import { ref, computed, h } from 'vue';
import { NDataTable, NButton, NInput, NTag, NCheckbox } from 'naive-ui';
import { api, download } from '../api.js';

const step = ref(1);
const file = ref(null);
const uploading = ref(false);
const error = ref('');
const rows = ref([]);
const newTeams = ref([]);
const newStages = ref([]);
const committing = ref(false);
const result = ref(null);
const toast = ref(null);

const summary = computed(() => {
  const include = rows.value.filter((r) => r.include).length;
  return { include, skip: rows.value.length - include };
});

async function downloadTemplate() {
  try {
    await download('/import/schedule/template', '赛程导入模板.xlsx');
  } catch (e) {
    toast.value = { msg: e.message, isError: true };
    setTimeout(() => (toast.value = null), 2500);
  }
}

const STATUS_TYPE = { ok: 'success', team_new: 'warning', stage_new: 'warning', error: 'error' };

const columns = [
  {
    title: '',
    key: 'include',
    width: 44,
    render: (r) => h(NCheckbox, { checked: r.include, 'onUpdate:checked': (v) => (r.include = v) }),
  },
  { title: '行号', key: 'rowNo', width: 64, render: (r) => h('span', { class: 'muted' }, r.rowNo) },
  {
    title: '班级A',
    key: 'teamA',
    render: (r) => h(NInput, { size: 'small', value: r.teamA, disabled: !r.include, 'onUpdate:value': (v) => (r.teamA = v), style: 'width: 130px' }),
  },
  {
    title: '班级B',
    key: 'teamB',
    render: (r) => h(NInput, { size: 'small', value: r.teamB, disabled: !r.include, 'onUpdate:value': (v) => (r.teamB = v), style: 'width: 130px' }),
  },
  {
    title: '开始时间',
    key: 'startTime',
    width: 110,
    render: (r) => h(NInput, { size: 'small', value: r.startTime, disabled: !r.include, 'onUpdate:value': (v) => (r.startTime = v), style: 'width: 90px' }),
  },
  {
    title: '赛段',
    key: 'stageName',
    width: 130,
    render: (r) => h(NInput, {
      size: 'small',
      value: r.stageName,
      disabled: !r.include,
      placeholder: r.defaultStage || '循环赛',
      'onUpdate:value': (v) => (r.stageName = v),
      style: 'width: 110px',
    }),
  },
  {
    title: '状态',
    key: 'status',
    render: (r) => h(NTag, { size: 'small', type: STATUS_TYPE[r.status] || 'default', bordered: false }, { default: () => r.message }),
  },
];

async function preview() {
  if (!file.value) return;
  uploading.value = true;
  error.value = '';
  result.value = null;
  try {
    const fd = new FormData();
    fd.append('file', file.value);
    const data = await api.upload('/import/schedule/preview', fd);
    rows.value = data.rows;
    newTeams.value = data.newTeams;
    newStages.value = data.newStages;
    step.value = 2;
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}

async function commit() {
  committing.value = true;
  try {
    result.value = await api.post('/import/schedule/commit', {
      rows: rows.value.map((r) => ({
        teamA: r.teamA,
        teamB: r.teamB,
        startTime: r.startTime,
        stageName: r.stageName || r.defaultStage,
        include: !!r.include,
      })),
    });
  } catch (e) {
    toast.value = { msg: e.message, isError: true };
    setTimeout(() => (toast.value = null), 2500);
  } finally {
    committing.value = false;
  }
}

function reset() {
  step.value = 1;
  file.value = null;
  rows.value = [];
  result.value = null;
}
</script>

<template>
  <h1 class="page-title">导入赛程</h1>

  <div class="card" v-if="step === 1">
    <p class="muted">
      上传 Excel（.xlsx），每行一场比赛：<b>班级A、班级B、开始时间、赛段</b>。
      不存在的班级与赛段会在导入时自动创建。
    </p>
    <div class="row">
      <input type="file" accept=".xlsx" @change="(e) => (file = e.target.files[0] || null)" />
      <n-button type="primary" :disabled="!file || uploading" @click="preview">
        {{ uploading ? '解析中…' : '解析预览' }}
      </n-button>
      <n-button size="small" @click="downloadTemplate">⬇ 下载模板</n-button>
    </div>
    <p v-if="error" style="color: #e74c3c">{{ error }}</p>
  </div>

  <template v-else>
    <div class="card row" v-if="result === null">
      <span>共 {{ rows.length }} 场</span>
      <n-tag type="success" :bordered="false">导入 {{ summary.include }}</n-tag>
      <n-tag :bordered="false">跳过 {{ summary.skip }}</n-tag>
      <span style="flex: 1"></span>
      <n-button size="small" @click="reset">返回重选</n-button>
    </div>

    <div class="card" v-if="result" style="border: 1px solid #86efac; background: #f0fdf4">
      <b>导入完成</b>：新建队伍 {{ result.teamsCreated }} · 新建赛段 {{ result.stagesCreated }} ·
      导入比赛 {{ result.matchesCreated }} 场
      <div class="row" style="margin-top: 10px">
        <router-link to="/schedule"><n-button size="small">查看赛程</n-button></router-link>
        <n-button size="small" type="primary" @click="reset">继续导入</n-button>
      </div>
    </div>

    <template v-if="result === null">
      <div class="card" v-if="newTeams.length || newStages.length">
        <div v-if="newTeams.length">将自动创建队伍：<b>{{ newTeams.join('、') }}</b></div>
        <div v-if="newStages.length" style="margin-top: 4px">
          将自动创建赛段：<b>{{ newStages.join('、') }}</b>（可在赛程页调整）
        </div>
      </div>

      <div class="card">
        <n-data-table :columns="columns" :data="rows" :row-key="(r) => r.rowNo" size="small" />
      </div>

      <div class="card row">
        <n-button type="primary" :disabled="committing || summary.include === 0" @click="commit">
          {{ committing ? '导入中…' : `确认导入 ${summary.include} 场` }}
        </n-button>
      </div>
    </template>
  </template>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>
