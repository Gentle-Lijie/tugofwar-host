<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { teamColor } from '../colors.js';

const state = ref(null);
const qrDataUrl = ref('');
let timer = null;
let inFlight = false;

async function load() {
  if (inFlight) return;
  inFlight = true;
  try {
    state.value = await api.get('/display/state');
  } catch {
    /* 网络抖动时保持上一帧 */
  } finally {
    inFlight = false;
  }
}

function color(m, side) {
  return teamColor({
    id: side === 'a' ? m.teamAId : m.teamBId,
    color: side === 'a' ? m.teamAColor : m.teamBColor,
  });
}

const current = computed(() => state.value?.currentMatch);
const cm = computed(() => state.value?.currentMatch);

onMounted(async () => {
  await load();
  timer = setInterval(() => {
    if (!document.hidden) load();
  }, 3000);
  try {
    qrDataUrl.value = await QRCode.toDataURL(window.location.origin, {
      width: 140,
      margin: 1,
      color: { dark: '#ffffffdd', light: '#00000000' },
    });
  } catch {
    /* 二维码生成失败不影响主界面 */
  }
  // 进入即全屏（需用户先交互一次；点击页面任意处补请求）
  document.documentElement.addEventListener('click', requestFs, { once: true });
});
function requestFs() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
}
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="screen" v-if="state">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="title">拔河比赛<span v-if="state.currentStage" class="stage"> · {{ state.currentStage.name }}</span></div>
      <div class="announcement" v-if="state.announcement">{{ state.announcement }}</div>
    </header>

    <div class="body">
      <!-- 主卡：当前比赛 / 叫号 -->
      <section class="hero">
        <template v-if="cm">
          <div v-if="state.calling" class="calling">
            🔔 请前往检录台检录
          </div>
          <div class="versus">
            <div class="side" :style="{ '--tc': color(cm, 'a') }">
              <div class="team-name">{{ cm.teamAName }}</div>
              <div class="checkin" v-if="cm.teamATotal">
                检录 {{ cm.teamAPresent }}/{{ cm.teamATotal }}
              </div>
            </div>
            <div class="vs">VS</div>
            <div class="side" :style="{ '--tc': color(cm, 'b') }">
              <div class="team-name">{{ cm.teamBName }}</div>
              <div class="checkin" v-if="cm.teamBTotal">
                检录 {{ cm.teamBPresent }}/{{ cm.teamBTotal }}
              </div>
            </div>
          </div>
          <div v-if="cm.winnerSide !== null" class="result-banner">
            <span class="winner" :style="{ color: cm.winnerSide === 0 ? color(cm, 'a') : color(cm, 'b') }">
              {{ cm.winnerSide === 0 ? cm.teamAName : cm.teamBName }}
            </span>
            获胜（正）
          </div>
          <div class="meta" v-else>第 {{ cm.sort }} 场<template v-if="cm.startTime"> · {{ cm.startTime }}</template></div>
        </template>
        <template v-else>
          <div class="idle">
            <div class="idle-title">{{ state.currentStage ? `${state.currentStage.name}` : '比赛' }}进行中</div>
            <div class="idle-sub" v-if="state.upcoming.length">下一场：{{ state.upcoming[0].teamAName }} vs {{ state.upcoming[0].teamBName }}</div>
            <div class="idle-sub" v-else>暂无待赛比赛</div>
          </div>
        </template>
      </section>

      <!-- 右栏 -->
      <aside class="rail">
        <div class="panel">
          <h2>即将开始</h2>
          <div v-for="m in state.upcoming" :key="m.id" class="up-item">
            <span class="stage-tag">{{ m.stageName }}</span>
            <span class="up-vs">
              <b :style="{ color: color(m, 'a') }">{{ m.teamAName }}</b>
              <i>vs</i>
              <b :style="{ color: color(m, 'b') }">{{ m.teamBName }}</b>
            </span>
            <span class="up-time">{{ m.startTime || `第${m.sort}场` }}</span>
          </div>
          <p v-if="!state.upcoming.length" class="empty">（暂无）</p>
        </div>
        <div class="panel">
          <h2>比赛结果</h2>
          <div v-for="m in state.recentResults" :key="m.id" class="res-item">
            <span class="winner" :style="{ color: m.winnerSide === 0 ? color(m, 'a') : color(m, 'b') }">
              {{ m.winnerSide === 0 ? m.teamAName : m.teamBName }}
            </span>
            <span class="beat">胜</span>
            <span class="loser">{{ m.winnerSide === 0 ? m.teamBName : m.teamAName }}</span>
          </div>
          <p v-if="!state.recentResults.length" class="empty">（暂无）</p>
        </div>
        <img v-if="qrDataUrl" class="qr" :src="qrDataUrl" alt="扫码访问" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.screen {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0b1220;
  color: #e6edf7;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

/* 顶栏 */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 36px;
  border-bottom: 1px solid #1c2a44;
}
.title { font-size: 30px; font-weight: 800; }
.title .stage { font-weight: 500; color: #7fa4e0; font-size: 24px; }
.announcement {
  font-size: 20px;
  color: #ffd166;
  max-width: 55%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 主体 */
.body { flex: 1; display: flex; min-height: 0; }

/* 主卡 */
.hero {
  flex: 1.6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26px;
  padding: 30px;
}
.calling {
  background: linear-gradient(90deg, #b45309, #d97706, #b45309);
  color: #fff;
  font-size: 34px;
  font-weight: 800;
  padding: 14px 46px;
  border-radius: 14px;
  animation: pulse 1.6s ease-in-out infinite;
  letter-spacing: 2px;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.5); }
  50% { transform: scale(1.03); box-shadow: 0 0 34px 6px rgba(217, 119, 6, 0.45); }
}
.versus { display: flex; align-items: center; gap: 44px; }
.side { text-align: center; }
.team-name {
  font-size: 52px;
  font-weight: 800;
  color: var(--tc, #e6edf7);
  text-shadow: 0 0 26px color-mix(in srgb, var(--tc, #fff) 45%, transparent);
}
.checkin { margin-top: 12px; font-size: 22px; color: #93a6c8; }
.vs { font-size: 30px; font-weight: 800; color: #4c5f85; }
.result-banner { font-size: 30px; color: #b7c6e4; }
.result-banner .winner { font-size: 40px; font-weight: 800; margin-right: 10px; }
.meta { font-size: 22px; color: #7d8fb3; }
.idle { text-align: center; }
.idle-title { font-size: 44px; font-weight: 800; color: #7fa4e0; }
.idle-sub { font-size: 24px; color: #93a6c8; margin-top: 14px; }

/* 右栏 */
.rail {
  flex: 1;
  max-width: 40%;
  border-left: 1px solid #1c2a44;
  display: flex;
  flex-direction: column;
  padding: 20px 28px;
  gap: 18px;
  min-height: 0;
}
.panel h2 {
  font-size: 20px;
  color: #7fa4e0;
  margin: 0 0 12px;
  font-weight: 700;
  letter-spacing: 2px;
}
.panel { flex: 1; min-height: 0; overflow: hidden; }
.up-item { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px dashed #1c2a44; }
.stage-tag {
  font-size: 12px;
  background: #1c2a44;
  color: #7fa4e0;
  padding: 2px 8px;
  border-radius: 4px;
  flex: none;
}
.up-vs { flex: 1; font-size: 19px; display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.up-vs i { color: #4c5f85; font-style: normal; font-size: 14px; }
.up-time { color: #7d8fb3; font-size: 15px; flex: none; }
.res-item { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; font-size: 20px; }
.winner { font-weight: 700; }
.beat { color: #34d399; font-size: 15px; }
.loser { color: #5f7195; text-decoration: line-through; text-decoration-color: #3a4c70; }
.empty { color: #4c5f85; font-size: 16px; }
.qr { position: absolute; right: 24px; bottom: 20px; width: 110px; height: 110px; opacity: 0.85; }
.rail { position: relative; }
</style>
