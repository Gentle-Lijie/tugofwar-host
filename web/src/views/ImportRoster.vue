<script setup>
import { ref, computed, h } from 'vue';
import { NDataTable, NButton, NInput, NSelect, NTag, NCheckbox } from 'naive-ui';
import { api, download } from '../api.js';

const STATUS_META = {
  ok: { label: '新增', type: 'success' },
  dup_existing: { label: '已存在', type: 'default' },
  dup_in_file: { label: '文件内重复', type: 'error' },
  warn_other_team: { label: '学号已在他队', type: 'warning' },
  error: { label: '错误', type: 'error' },
};

const step = ref(1); // 1 上传 → 2 预览
const file = ref(null);
const uploading = ref(false);
const error = ref('');
const groups = ref([]); // 服务端返回（含状态）
const warnings = ref([]);
const teams = ref([]); // 既有队伍（无班级列时选目标）
const targetTeam = ref('new'); // 'new' = 新建
const newTeamName = ref('');
const committing = ref(false);
const result = ref(null);
const toast = ref(null);

// 无班级列时：把唯一分组指到选定/新建的队伍
const singleGroup = computed(() => groups.value.length === 1 && groups.value[0].teamName === null);

const summary = computed(() => {
  const counts = { include: 0, skip: 0 };
  for (const g of groups.value) {
    for (const r of g.rows) {
      if (r.include) counts.include++;
      else counts.skip++;
    }
  }
  return counts;
});

const teamOptions = computed(() => [
  { label: '➕ 新建队伍…', value: 'new' },
  ...teams.value.map((t) => ({ label: t.name, value: t.id })),
]);

function rowStatus(r) {
  if (!r.name && !r.studentNo) return { label: '错误：空行', type: 'error' };
  if (!r.name) return { label: '错误：姓名为空', type: 'error' };
  if (!r.studentNo) return { label: '错误：学号为空', type: 'error' };
  if (r.status === 'dup_in_file' || r.status === 'error') {
    const meta = STATUS_META[r.status];
    return { label: `${meta.label}${r.message ? '：' + r.message : ''}`, type: meta.type };
  }
  if (r.status === 'dup_existing') return { label: '已存在（跳过）', type: 'default' };
  if (r.status === 'warn_other_team') return { label: '学号已注册', type: 'warning' };
  return { label: '新增', type: 'success' };
}

function makeColumns() {
  return [
    {
      title: '',
      key: 'include',
      width: 44,
      render: (r) =>
        h(NCheckbox, {
          checked: r.include,
          'onUpdate:checked': (v) => (r.include = v),
        }),
    },
    { title: '行号', key: 'rowNo', width: 64, render: (r) => h('span', { class: 'muted' }, r.rowNo) },
    {
      title: '姓名',
      key: 'name',
      render: (r) =>
        h(NInput, {
          size: 'small',
          value: r.name,
          disabled: !r.include,
          'onUpdate:value': (v) => (r.name = v),
          style: 'width: 120px',
        }),
    },
    {
      title: '学号',
      key: 'studentNo',
      render: (r) =>
        h(NInput, {
          size: 'small',
          value: r.studentNo,
          disabled: !r.include,
          'onUpdate:value': (v) => (r.studentNo = v),
          style: 'width: 150px',
        }),
    },
    {
      title: '状态',
      key: 'status',
      render: (r) => {
        const s = rowStatus(r);
        return h(NTag, { size: 'small', type: s.type, bordered: false }, { default: () => s.label });
      },
    },
  ];
}
const columns = makeColumns();

async function preview() {
  if (!file.value) return;
  uploading.value = true;
  error.value = '';
  result.value = null;
  try {
    const fd = new FormData();
    fd.append('file', file.value);
    const data = await api.upload('/import/roster/preview', fd);
    groups.value = data.groups;
    warnings.value = data.warnings;
    teams.value = await api.get('/teams');
    step.value = 2;
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}

function effectiveTeamName(g) {
  if (!singleGroup.value) return g.teamName;
  return targetTeam.value === 'new' ? newTeamName.value.trim() : targetTeam.value;
}

async function commit() {
  committing.value = true;
  try {
    const payload = {
      groups: groups.value.map((g) => ({
        teamName: effectiveTeamName(g),
        mode: g.mode || 'merge',
        rows: g.rows.map((r) => ({ name: r.name, studentNo: r.studentNo, include: !!r.include })),
      })),
    };
    result.value = await api.post('/import/roster/commit', payload);
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
  groups.value = [];
  warnings.value = [];
  result.value = null;
}

const modeOptions = [
  { label: '追加（保留现有队员）', value: 'merge' },
  { label: '替换（删除文件外的队员）', value: 'replace' },
];
</script>

<template>
  <h1 class="page-title">导入名单</h1>

  <!-- 第 1 步：上传 -->
  <div class="card" v-if="step === 1">
    <p class="muted">
      上传 Excel（.xlsx），需包含 <b>姓名</b>、<b>学号</b> 两列；
      若有 <b>班级</b> 列则按班级分组导入（不存在的班级自动创建），否则导入到指定队伍。
    </p>
    <div class="row">
      <input type="file" accept=".xlsx" @change="(e) => (file = e.target.files[0] || null)" />
      <n-button type="primary" :disabled="!file || uploading" @click="preview">
        {{ uploading ? '解析中…' : '解析预览' }}
      </n-button>
      <n-button size="small" @click="download('/import/roster/template', '名单导入模板.xlsx')">⬇ 下载模板</n-button>
    </div>
    <p v-if="error" style="color: #e74c3c">{{ error }}</p>
  </div>

  <!-- 第 2 步：预览 -->
  <template v-else>
    <div class="card row" v-if="result === null">
      <span>共 {{ summary.include + summary.skip }} 行</span>
      <n-tag type="success" :bordered="false">导入 {{ summary.include }}</n-tag>
      <n-tag :bordered="false">跳过 {{ summary.skip }}</n-tag>
      <span style="flex: 1"></span>
      <n-button size="small" @click="reset">返回重选</n-button>
    </div>

    <div class="card" v-for="(warning, i) in warnings" :key="'w' + i" style="border: 1px solid #f5c882; background: #fdf6ec">
      ⚠ {{ warning }}
    </div>

    <!-- 导入结果 -->
    <div class="card" v-if="result" style="border: 1px solid #86efac; background: #f0fdf4">
      <b>导入完成</b>：新建队伍 {{ result.teamsCreated }} · 新增队员 {{ result.playersAdded }} ·
      跳过 {{ result.playersSkipped }} · 移除 {{ result.playersRemoved }}
      <div class="row" style="margin-top: 10px">
        <router-link to="/teams"><n-button size="small">查看队伍</n-button></router-link>
        <n-button size="small" type="primary" @click="reset">继续导入</n-button>
      </div>
    </div>

    <!-- 无班级列：选择目标队伍 -->
    <div class="card row" v-if="singleGroup && result === null">
      <span>目标队伍：</span>
      <n-select v-model:value="targetTeam" :options="teamOptions" style="width: 220px" />
      <n-input v-if="targetTeam === 'new'" v-model:value="newTeamName" placeholder="新队伍名（班级）" style="width: 220px" />
    </div>

    <div class="card" v-for="(g, gi) in groups" :key="gi" v-show="result === null">
      <div class="row" style="margin-bottom: 10px">
        <b>{{ singleGroup ? '名单预览' : `队伍：${g.teamName}` }}</b>
        <n-tag v-if="g.teamExists === false && g.teamName" type="warning" size="small" :bordered="false">
          提交时自动创建
        </n-tag>
        <span style="flex: 1"></span>
        <span class="muted">模式</span>
        <n-select v-model:value="g.mode" :options="modeOptions" size="small" style="width: 210px" />
      </div>
      <n-data-table :columns="columns" :data="g.rows" :row-key="(r) => r.rowNo" size="small" />
    </div>

    <div class="card row" v-if="result === null">
      <n-button
        type="primary"
        :disabled="committing || summary.include === 0"
        @click="commit"
      >
        {{ committing ? '导入中…' : `确认导入 ${summary.include} 人` }}
      </n-button>
      <span v-if="singleGroup && targetTeam === 'new' && !newTeamName.trim()" class="muted">
        请先填写新队伍名
      </span>
    </div>
  </template>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>
