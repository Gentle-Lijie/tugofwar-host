<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { api } from './api.js';

const route = useRoute();
const bare = computed(() => route.meta.bare);

const currentStage = ref(null);
const stages = ref([]);
const stagesLoaded = ref(false);

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

async function switchStage(e) {
  const id = e.target.value ? Number(e.target.value) : null;
  try {
    await api.put('/stages/current', { stageId: id });
    currentStage.value = id ? stages.value.find((s) => s.id === id) : null;
  } catch (err) {
    alert(err.message);
  }
}

// 路由变化时重新加载（导入可能新建了赛段）
import { watch } from 'vue';
watch(() => route.path, loadStages);
</script>

<template>
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
        <select :value="currentStage ? currentStage.id : ''" @change="switchStage">
          <option value="">（未设置）</option>
          <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
  <router-view v-else />
</template>

<style scoped>
.shell { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  background: #fff;
  border-top: 4px solid var(--accent);
  border-bottom: 1px solid #e0e6ed;
  box-shadow: 0 -2px 8px rgba(52, 152, 219, 0.08), 0 2px 8px rgba(52, 152, 219, 0.08);
  padding: 0 24px;
  height: 54px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand { font-weight: bold; font-size: 17px; color: #2980b9; }
nav { display: flex; gap: 18px; flex: 1; }
nav a { color: var(--text); font-weight: 500; }
nav a:hover { color: #2980b9; text-decoration: underline; }
nav a.router-link-active { color: #2980b9; font-weight: bold; }
.stage-switch { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.main { max-width: 1100px; margin: 0 auto; padding: 24px; }
</style>
