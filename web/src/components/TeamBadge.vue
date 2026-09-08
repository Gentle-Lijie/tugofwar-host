<script setup>
import { computed } from 'vue';
import { teamColor } from '../colors.js';

const props = defineProps({
  team: { type: Object, required: true },
  size: { type: String, default: 'normal' }, // small | normal | large
});

const color = computed(() => teamColor(props.team));
</script>

<template>
  <span class="badge-dot" :class="size">
    <span class="dot" :style="{ background: color }"></span>
    <span class="name">{{ team.name }}</span>
  </span>
</template>

<style scoped>
.badge-dot { display: inline-flex; align-items: center; gap: 7px; }
.dot { border-radius: 50%; flex: none; }
.small .dot { width: 8px; height: 8px; }
.small .name { font-size: 13px; }
.normal .dot { width: 11px; height: 11px; }
.large .name { font-size: 22px; font-weight: 600; }
.large .dot { width: 16px; height: 16px; }
</style>
