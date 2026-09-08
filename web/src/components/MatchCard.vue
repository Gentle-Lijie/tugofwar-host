<script setup>
import TeamBadge from './TeamBadge.vue';
import { computed } from 'vue';

const props = defineProps({
  match: { type: Object, required: true },
  showStage: { type: Boolean, default: false },
});

const done = computed(
  () => props.match.winnerSide === 0 || props.match.winnerSide === 1
);
const teamAWin = computed(() => done.value && props.match.winnerSide === 0);
const teamBWin = computed(() => done.value && props.match.winnerSide === 1);
</script>

<template>
  <div class="match-card">
    <div class="stage" v-if="showStage">{{ match.stageName }}</div>
    <div class="vs">
      <div class="side" :class="{ win: teamAWin, lose: teamBWin }">
        <TeamBadge :team="{ id: match.teamAId, name: match.teamAName, color: match.teamAColor }" />
        <span v-if="done" class="tag" :class="teamAWin ? 'pos' : 'neg'">{{ teamAWin ? '正' : '负' }}</span>
      </div>
      <span class="vs-mark">VS</span>
      <div class="side" :class="{ win: teamBWin, lose: teamAWin && done ? true : false }">
        <TeamBadge :team="{ id: match.teamBId, name: match.teamBName, color: match.teamBColor }" />
        <span v-if="done" class="tag" :class="teamBWin ? 'pos' : 'neg'">{{ teamBWin ? '正' : '负' }}</span>
      </div>
    </div>
    <div class="meta">
      <span>第 {{ match.sort }} 场</span>
      <span v-if="match.note" class="muted">{{ match.note }}</span>
    </div>
  </div>
</template>

<style scoped>
.match-card { padding: 10px 12px; border-radius: 8px; background: #f8fafc; }
.stage { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.vs { display: flex; align-items: center; gap: 12px; }
.side { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.side.win { font-weight: 600; }
.side.lose { opacity: 0.55; }
.vs-mark { color: var(--muted); font-size: 12px; font-weight: 700; }
.tag {
  font-size: 12px;
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 700;
}
.tag.pos { background: #dcfce7; color: var(--success); }
.tag.neg { background: #fee2e2; color: var(--danger); }
.meta { margin-top: 6px; font-size: 13px; color: var(--muted); display: flex; gap: 12px; }
</style>
