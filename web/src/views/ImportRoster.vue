<script setup>
import { ref, computed } from 'vue';
import { api } from '../api.js';

const STATUS_META = {
  ok: { label: '新增', cls: 'ok' },
  dup_existing: { label: '已存在', cls: 'muted' },
  dup_in_file: { label: '文件内重复', cls: 'err' },
  warn_other_team: { label: '学号已在他队', cls: 'warn' },
  error: { label: '错误', cls: 'err' },
};

const step = ref(1); // 1 上传 → 2 预览
const file = ref(null);
const uploading = ref(false);
const error = ref('');
const groups = ref([]); // 服务端返回（含状态）
const warnings = ref([]);
const teams = ref([]); // 既有队伍（无班级列时选目标）
const targetTeam = ref(''); // '' = 新建
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

function onFile(e) {
  file.value = e.target.files[0] || null;
}

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

/** 重新计算某组某行状态（编辑姓名/学号后本地判断，提交时服务端还会再校验） */
function rowStatus(g, r) {
  if (!r.name && !r.studentNo) return { label: '错误：空行', cls: 'err' };
  if (!r.name) return { label: '错误：姓名为空', cls: 'err' };
  if (!r.studentNo) return { label: '错误：学号为空', cls: 'err' };
  if (r.status === 'dup_in_file' || r.status === 'error') {
    const meta = STATUS_META[r.status];
    return { label: `${meta.label}${r.message ? '：' + r.message : ''}`, cls: meta.cls };
  }
  if (r.status === 'dup_existing') return { label: '已存在（跳过）', cls: 'muted' };
  if (r.status === 'warn_other_team') return { label: '学号已注册', cls: 'warn' };
  return { label: '新增', cls: 'ok' };
}

/** 编辑后判断该行当前是否仍冲突 */
function rowConflicting(g, r) {
  if (!r.name || !r.studentNo) return true;
  const nos = g.rows.filter((x) => x.include && x !== r).map((x) => x.studentNo);
  if (nos.includes(r.studentNo)) return true;
  if (r.status === 'dup_existing' && r.studentNo === r._origNo) return true;
  return false;
}

function effectiveTeamName(g) {
  if (!singleGroup.value) return g.teamName;
  return targetTeam.value === '' ? newTeamName.value.trim() : targetTeam.value;
}

async function commit() {
  committing.value = true;
  try {
    const payload = {
      groups: groups.value.map((g) => ({
        teamName: effectiveTeamName(g),
        mode: g.mode || 'merge',
        rows: g.rows.map((r) => ({
          name: r.name,
          studentNo: r.studentNo,
          include: !!r.include,
        })),
      })),
    };
    result.value = await api.post('/import/roster/commit', payload);
    showToast('导入完成');
  } catch (e) {
    showToast(e.message, true);
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

function showToast(msg, isError = false) {
  toast.value = { msg, isError };
  setTimeout(() => (toast.value = null), 2500);
}
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
      <input type="file" accept=".xlsx" @change="onFile" />
      <button class="primary" :disabled="!file || uploading" @click="preview">
        {{ uploading ? '解析中…' : '解析预览' }}
      </button>
    </div>
    <p v-if="error" style="color: var(--danger)">{{ error }}</p>
  </div>

  <!-- 第 2 步：预览 -->
  <template v-else>
    <div class="card row" v-if="result === null">
      <span>共 {{ summary.include + summary.skip }} 行</span>
      <span class="badge ok">导入 {{ summary.include }}</span>
      <span class="badge muted">跳过 {{ summary.skip }}</span>
      <span style="flex: 1"></span>
      <button @click="reset">返回重选</button>
    </div>

    <div class="card" v-for="(warning, i) in warnings" :key="'w' + i" style="border-color: #fcd34d; background: #fffbeb">
      ⚠ {{ warning }}
    </div>

    <!-- 导入结果 -->
    <div class="card" v-if="result" style="border-color: #86efac; background: #f0fdf4">
      <b>导入完成</b>：新建队伍 {{ result.teamsCreated }} · 新增队员 {{ result.playersAdded }} ·
      跳过 {{ result.playersSkipped }} · 移除 {{ result.playersRemoved }}
      <div class="row" style="margin-top: 10px">
        <router-link to="/teams"><button>查看队伍</button></router-link>
        <button class="primary" @click="reset">继续导入</button>
      </div>
    </div>

    <!-- 无班级列：选择目标队伍 -->
    <div class="card row" v-if="singleGroup && result === null">
      <span>目标队伍：</span>
      <select v-model="targetTeam">
        <option value="">➕ 新建队伍…</option>
        <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <input
        v-if="targetTeam === ''"
        v-model="newTeamName"
        placeholder="新队伍名（班级）"
      />
    </div>

    <div
      class="card"
      v-for="(g, gi) in groups"
      :key="gi"
      v-show="result === null"
    >
      <div class="row" style="margin-bottom: 10px">
        <b>{{ singleGroup ? '名单预览' : `队伍：${g.teamName}` }}</b>
        <span v-if="g.teamExists === false && g.teamName" class="badge warn">提交时自动创建</span>
        <span style="flex: 1"></span>
        <label class="muted">
          模式：
          <select v-model="g.mode">
            <option value="merge">追加（保留现有队员）</option>
            <option value="replace">替换（删除文件外的队员）</option>
          </select>
        </label>
      </div>
      <table class="list">
        <thead>
          <tr>
            <th style="width: 36px"></th>
            <th style="width: 60px">行号</th>
            <th>姓名</th>
            <th>学号</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in g.rows" :key="r.rowNo" :class="{ excluded: !r.include }">
            <td><input type="checkbox" v-model="r.include" /></td>
            <td class="muted">{{ r.rowNo }}</td>
            <td><input v-model="r.name" style="width: 120px" :disabled="!r.include" /></td>
            <td><input v-model="r.studentNo" style="width: 150px" :disabled="!r.include" /></td>
            <td><span class="badge" :class="rowStatus(g, r).cls">{{ rowStatus(g, r).label }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card row" v-if="result === null">
      <button
        class="primary"
        :disabled="committing || summary.include === 0"
        @click="commit"
      >
        {{ committing ? '导入中…' : `确认导入 ${summary.include} 人` }}
      </button>
      <span v-if="singleGroup && targetTeam === '' && !newTeamName.trim()" class="muted">
        请先填写新队伍名
      </span>
    </div>
  </template>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
tr.excluded { opacity: 0.5; }
</style>
