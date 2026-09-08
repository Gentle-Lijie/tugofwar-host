<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NConfigProvider, NSelect } from 'naive-ui';
import { api } from './api.js';
import { themeOverrides } from './theme.js';

const route = useRoute();
const bare = computed(() => route.meta.bare);

const currentStage = ref(null);
const stages = ref([]);
const stagesLoaded = ref(false);

const stageOptions = computed(() => [
  { label: '（未设置）', value: '__none__' },
  ...stages.value.map((s) => ({
    label: `${s.name}（${s.doneCount}/${s.matchCount}）`,
    value: s.id,
  })),
]);
const stageValue = computed(() =>
  currentStage.value ? currentStage.value.id : '__none__'
);

async function loadStages() {
  try {
    stages.value = await api.get('/stages');
    const cur = await api.get('/stages/current');
    currentStage.value = cur.stageId ? stages.value.find((s) => s.id === cur.stageId) : null;
    stagesLoaded.value = true;
  } catch {
    /* 网络异常时静默，下次切换页面再试 */
  }
}
loadStages();

async function switchStage(value) {
  const stageId = value === '__none__' ? null : value;
  try {
    await api.put('/stages/current', { stageId });
    currentStage.value = stageId ? stages.value.find((s) => s.id === stageId) : null;
  } catch (err) {
    alert(err.message);
  }
}

// 路由变化时重新加载（导入可能新建了赛段）
watch(() => route.path, loadStages);
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div v-if="!bare" class="shell">
      <header class="topbar">
        <router-link to="/" class="brand">拔河比赛管理系统</router-link>
        <nav>
          <router-link to="/import/roster">导入名单</router-link>
          <router-link to="/import/schedule">导入赛程</router-link>
          <router-link to="/teams">队伍</router-link>
          <router-link to="/schedule">赛程</router-link>
          <router-link to="/results">结果</router-link>
          <a href="/display" target="_blank">大屏 ↗</a>
        </nav>
        <div class="stage-switch" v-if="stagesLoaded">
          <span class="muted">当前赛段</span>
          <n-select
            :value="stageValue"
            :options="stageOptions"
            size="small"
            style="width: 200px"
            @update:value="switchStage"
          />
        </div>
      </header>
      <main class="main">
        <router-view />
      </main>
    </div>
    <router-view v-else />
  </n-config-provider>
</template>

<style scoped>
.shell { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  background: #fff;
  border-top: 4px solid #33afcd;
  border-bottom: 1px solid #e0e6ed;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.08);
  padding: 0 24px;
  height: 54px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand { font-weight: bold; font-size: 17px; color: #2980b9; }
nav { display: flex; gap: 18px; flex: 1; }
nav a { color: #10263b; font-weight: 500; }
nav a:hover { color: #2980b9; text-decoration: underline; }
nav a.router-link-active { color: #2980b9; font-weight: bold; }
.stage-switch { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.main { max-width: 1100px; margin: 0 auto; padding: 24px; }
</style>
