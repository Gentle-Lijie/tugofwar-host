<script setup>
import { ref, computed } from 'vue';
import { api } from '../api.js';

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

const STATUS_CLS = {
  ok: 'ok',
  team_new: 'warn',
  stage_new: 'warn',
  error: 'err',
};
</script>

<template>
  <h1 class="page-title">导入赛程</h1>

  <div class="card" v-if="step === 1">
    <p class="muted">
      上传 Excel（.xlsx），每行一场比赛：<b>班级A、班级B、开始时间、赛段</b>。
      不存在的班级与赛段会在导入时自动创建。
    </p>
    <div class="row">
      <input type="file" accept=".xlsx" @change="onFile" />
      <button class="primary" :disabled="!file || uploading" @click="preview">
        {{ uploading ? '解析中…' : '解析预览' }}
      </button>
    </div>
    <p v-if="error" style="color: var(--danger)">{{ error }}</p>
  </div>

  <template v-else>
    <div class="card row" v-if="result === null">
      <span>共 {{ rows.length }} 场</span>
      <span class="badge ok">导入 {{ summary.include }}</span>
      <span class="badge muted">跳过 {{ summary.skip }}</span>
      <span style="flex: 1"></span>
      <button @click="reset">返回重选</button>
    </div>

    <div class="card" v-if="result" style="border-color: #86efac; background: #f0fdf4">
      <b>导入完成</b>：新建队伍 {{ result.teamsCreated }} · 新建赛段 {{ result.stagesCreated }} ·
      导入比赛 {{ result.matchesCreated }} 场
      <div class="row" style="margin-top: 10px">
        <router-link to="/schedule"><button>查看赛程</button></router-link>
        <button class="primary" @click="reset">继续导入</button>
      </div>
    </div>

    <template v-if="result === null">
      <div class="card" v-if="newTeams.length || newStages.length">
        <div v-if="newTeams.length">将自动创建队伍：<b>{{ newTeams.join('、') }}</b></div>
        <div v-if="newStages.length" style="margin-top: 4px">
          将自动创建赛段：<b>{{ newStages.join('、') }}</b>（可在赛程页调整顺序）
        </div>
      </div>

      <div class="card">
        <table class="list">
          <thead>
            <tr>
              <th style="width: 36px"></th>
              <th style="width: 60px">行号</th>
              <th>班级A</th>
              <th>班级B</th>
              <th>开始时间</th>
              <th>赛段</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.rowNo" :class="{ excluded: !r.include }">
              <td><input type="checkbox" v-model="r.include" /></td>
              <td class="muted">{{ r.rowNo }}</td>
              <td><input v-model="r.teamA" style="width: 130px" :disabled="!r.include" /></td>
              <td><input v-model="r.teamB" style="width: 130px" :disabled="!r.include" /></td>
              <td><input v-model="r.startTime" style="width: 90px" :disabled="!r.include" /></td>
              <td><input v-model="r.stageName" style="width: 110px" :disabled="!r.include" :placeholder="r.defaultStage || '循环赛'" /></td>
              <td><span class="badge" :class="STATUS_CLS[r.status]">{{ r.message }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card row">
        <button class="primary" :disabled="committing || summary.include === 0" @click="commit">
          {{ committing ? '导入中…' : `确认导入 ${summary.include} 场` }}
        </button>
      </div>
    </template>
  </template>

  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>

<style scoped>
tr.excluded { opacity: 0.5; }
</style>
