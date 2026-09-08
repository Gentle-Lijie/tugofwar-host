<script setup>
import { ref, watch } from 'vue';
import { NButton } from 'naive-ui';

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '确认' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  danger: { type: Boolean, default: false },
});
const emit = defineEmits(['confirm', 'cancel']);

const show = ref(props.visible);
watch(() => props.visible, (v) => (show.value = v));
watch(show, (v) => { if (!v) emit('cancel'); });
</script>

<template>
  <div v-if="show" class="overlay" @click.self="show = false">
    <div class="dialog">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="actions">
        <n-button size="small" @click="show = false">取消</n-button>
        <n-button size="small" :type="danger ? 'error' : 'primary'" @click="show = false; emit('confirm')">
          {{ confirmText }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(16, 38, 59, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  width: min(420px, 90vw);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.dialog h3 { margin: 0 0 10px; }
.dialog p { margin: 0 0 18px; color: #707d89; white-space: pre-line; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
