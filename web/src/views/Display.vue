<script setup>
// 旧版 PHP display.php 的布局与配色：米色背景、队伍灰块、胜者青色 + 🎉、黑底叫号框、3s 轮询
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import QRCode from 'qrcode';
import { api } from '../api.js';

const state = ref(null);
const qrDataUrl = ref('');
let timer = null;
let inFlight = false;
let scrolledOnce = false;

async function load() {
  if (inFlight) return;
  inFlight = true;
  try {
    state.value = await api.get('/display/state');
    // 首次加载后自动滚动到当前比赛（旧版行为）
    if (!scrolledOnce) {
      scrolledOnce = true;
      await nextTick();
      document.querySelector('.highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch {
    /* 网络抖动时保持上一帧 */
  } finally {
    inFlight = false;
  }
}

// 叫号框：优先当前叫号比赛，否则下一场未赛
const callingMatch = computed(() => {
  if (!state.value) return null;
  if (state.value.currentMatch) return state.value.currentMatch;
  return state.value.upcoming[0] ?? null;
});

const showCalling = computed(
  () => state.value?.calling && callingMatch.value
);

// 列表中每场的状态
function statusOf(m) {
  if (m.winnerSide === 0 || m.winnerSide === 1) return 'completed';
  if (state.value?.currentMatch?.id === m.id) return 'in-progress';
  return 'pending';
}

function statusText(m) {
  const s = statusOf(m);
  if (s === 'completed') {
    return (m.winnerSide === 0 ? m.teamAName : m.teamBName) + '胜利';
  }
  if (s === 'in-progress') return '进行中';
  return '未开始';
}

onMounted(async () => {
  await load();
  timer = setInterval(() => {
    if (!document.hidden) load();
  }, 3000);
  try {
    qrDataUrl.value = await QRCode.toDataURL(window.location.origin, {
      width: 200,
      margin: 1,
    });
  } catch {
    /* 二维码生成失败不影响主界面 */
  }
  document.documentElement.addEventListener('click', requestFs, { once: true });
});
function requestFs() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
}
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="screen" v-if="state">
    <!-- 二维码 -->
    <div class="qr-code left" v-if="qrDataUrl">
      <img :src="qrDataUrl" alt="二维码" />
      <div class="qr-text">扫码访问</div>
    </div>

    <!-- 头部 -->
    <div class="header">
      <div class="page-title">比赛大屏<span v-if="state.currentStage" class="stage-name"> · {{ state.currentStage.name }}</span></div>
      <div class="announcement" v-if="state.announcement">{{ state.announcement }}</div>
      <div class="next-match-box" v-if="showCalling">
        {{ callingMatch.teamAName }} 和 {{ callingMatch.teamBName }} 请前往检录台
      </div>
    </div>

    <!-- 比赛列表 -->
    <div class="match-list">
      <div
        v-for="m in state.matches"
        :key="m.id"
        class="match"
        :class="statusOf(m)"
      >
        <div class="team" :class="{ winner: m.winnerSide === 0 }">
          {{ m.winnerSide === 0 ? '🎉 ' : '' }}{{ m.teamAName }}
        </div>
        <div class="time">
          {{ m.startTime || `第${m.sort}场` }}
          <div class="status" :class="statusOf(m)">{{ statusText(m) }}</div>
        </div>
        <div class="team" :class="{ winner: m.winnerSide === 1 }">
          {{ m.winnerSide === 1 ? '🎉 ' : '' }}{{ m.teamBName }}
        </div>
      </div>
      <div class="empty" v-if="!state.matches.length">暂无比赛</div>
    </div>
  </div>
</template>

<style scoped>
.screen {
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background: #faf6ef;
  color: #10263b;
  margin: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 二维码 */
.qr-code {
  position: fixed;
  top: 20px;
  width: 16vh;
  padding: 8px;
  z-index: 1000;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-align: center;
}
.qr-code.left { left: 20px; }
.qr-code img { width: 100%; height: auto; display: block; }
.qr-text { font-size: 2vh; color: #10263b; }

/* 头部 */
.header {
  width: 100%;
  text-align: center;
  padding: 16px 0;
  z-index: 10;
}
.page-title {
  font-size: 6vh;
  font-weight: bold;
  margin-bottom: 8px;
  color: #10263b;
}
.stage-name { font-size: 3.5vh; font-weight: normal; color: #707d89; }
.announcement {
  font-size: 2.4vh;
  color: #2980b9;
  margin-bottom: 8px;
}
.next-match-box {
  background: #10263b;
  color: #fff;
  padding: 1.2vh 3vh;
  border-radius: 12px;
  font-size: 5vh;
  font-weight: bold;
  display: inline-block;
}

/* 比赛列表 */
.match-list {
  width: 80%;
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.match {
  display: flex;
  align-items: center;
  margin: 0.8vh 0;
  padding: 1vh;
  border-radius: 10px;
  transition: background-color 0.3s;
}
.match.pending { background: #e0e0e0; }
.match.highlight, .match.in-progress { background: #99d7e6; }
.match.completed { background: #d0d0d0; }

.team {
  flex: 1;
  text-align: center;
  padding: 2.2vh;
  border-radius: 20px;
  font-size: 3.4vh;
  font-weight: bold;
  color: #10263b;
  margin: 0 1vh;
  background: #9fa8b1;
}
.team.winner {
  background: #33afcd;
  color: #fff;
}

.time {
  flex: 0 0 14%;
  text-align: center;
  font-size: 2.2vh;
  font-weight: bold;
  color: #10263b;
}
.status { font-size: 1.9vh; margin-top: 4px; }
.status.completed { color: #e74c3c; }
.empty { text-align: center; color: #707d89; font-size: 3vh; padding: 6vh 0; }
</style>
