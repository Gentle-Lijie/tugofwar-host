<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import RosterEditor from '../components/RosterEditor.vue';

const route = useRoute();
// 组件会被复用（同一路由不同队伍 id），必须响应参数变化
const teamId = computed(() => Number(route.params.id));

const team = ref(null);
const toast = ref(null);

async function load() {
  try {
    const teams = await api.get('/teams');
    team.value = teams.find((t) => t.id === teamId.value) || null;
    if (!team.value) showToast('队伍不存在', true);
  } catch (e) {
    showToast(e.message, true);
  }
}
onMounted(load);
watch(teamId, load);
</script>

<template>
  <template v-if="team">
    <h1 class="page-title">
      <router-link to="/teams">队伍</router-link> / {{ team.name }}
      <span class="muted" style="font-size: 14px; font-weight: normal; margin-left: 10px">
        胜 {{ team.wins }} · 负 {{ team.losses }}
      </span>
    </h1>

    <div class="card">
      <RosterEditor :key="team.id" :team-id="team.id" @changed="load" />
    </div>
  </template>
  <div v-else class="card">加载中…</div>
  <div v-if="toast" class="toast" :class="{ error: toast.isError }">{{ toast.msg }}</div>
</template>
