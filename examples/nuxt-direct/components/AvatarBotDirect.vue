<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  initAvatarBot,
  AVATAR_MODE_MAP,
  GENDER_MAP,
  ENGINE_MODE_MAP,
  type AiAvatarWidget,
  type AvatarBotOptions
} from 'ai-avatar-bot-typescript';

const containerRef = ref<HTMLDivElement | null>(null);
const widget = ref<AiAvatarWidget | null>(null);
const isMounted = ref<boolean>(true);
const status = ref<'loading' | 'ready' | 'error'>('loading');
const statusText = ref<string>('Initializing Nuxt 3 Client Component...');
const currentEngine = ref<string>(ENGINE_MODE_MAP.twoDimensional);

async function mountBot(): Promise<void> {
  if (containerRef.value === null) {
    return;
  }

  status.value = 'loading';
  statusText.value = 'Mounting AI Avatar Bot in Nuxt 3...';

  const options: AvatarBotOptions = {
    container: containerRef.value,
    avatarMode: AVATAR_MODE_MAP.assistant,
    gender: GENDER_MAP.female,
    welcomeText: '您好！我是您的 AI 虛擬助手，已在 Nuxt 3 (SSR ClientOnly) 環境中順暢載入。'
  };

  try {
    const instance = await initAvatarBot(options);
    if (instance) {
      widget.value = instance;
      status.value = 'ready';
      statusText.value = 'Ready - Nuxt 3 Widget active with Nitro publicAssets';
    }
  } catch (err) {
    console.error('[nuxt-direct] Failed to initialize avatar:', err);
    status.value = 'error';
    statusText.value = 'Error initializing AI Avatar Bot';
  }
}

function cleanupBot(): void {
  if (widget.value?.skinEngine) {
    widget.value.skinEngine.destroy();
    widget.value = null;
  }
}

onMounted(() => {
  if (isMounted.value === true) {
    void mountBot();
  }
});

onBeforeUnmount(() => {
  cleanupBot();
});

async function handleWave(): Promise<void> {
  if (widget.value?.skinEngine) {
    await widget.value.skinEngine.triggerMotion('wave');
  }
}

async function handleToggleEngine(): Promise<void> {
  if (widget.value?.skinEngine) {
    const current = widget.value.skinEngine.currentMode;
    const target =
      current === ENGINE_MODE_MAP.twoDimensional
        ? ENGINE_MODE_MAP.threeDimensional
        : ENGINE_MODE_MAP.twoDimensional;
    await widget.value.skinEngine.switchEngineMode(target);
    currentEngine.value = target;
  }
}

function handleToggleMount(): void {
  if (isMounted.value === true) {
    cleanupBot();
    isMounted.value = false;
  } else {
    isMounted.value = true;
    setTimeout(() => {
      void mountBot();
    }, 50);
  }
}
</script>

<template>
  <div class="avatar-bot-direct__workspace">
    <section class="avatar-bot-direct__stage-card">
      <div class="avatar-bot-direct__viewport">
        <div
          v-if="isMounted"
          id="avatar-container"
          ref="containerRef"
          class="avatar-bot-direct__container"
        />
        <div v-else class="avatar-bot-direct__placeholder">
          組件已卸載，WebGL 上下文與 DOM 資源已釋放 (Unmounted)
        </div>
      </div>
    </section>

    <aside class="avatar-bot-direct__control-card">
      <h2 class="avatar-bot-direct__card-title">互動控制面板</h2>

      <div class="avatar-bot-direct__group">
        <span class="avatar-bot-direct__group-label">狀態指示</span>
        <div class="avatar-bot-direct__status-row">
          <span class="avatar-bot-direct__status-indicator" :css-status="status" />
          <span>{{ statusText }}</span>
        </div>
      </div>

      <div class="avatar-bot-direct__group">
        <span class="avatar-bot-direct__group-label">動作控制</span>
        <div class="avatar-bot-direct__btn-row">
          <button
            type="button"
            class="avatar-bot-direct__btn avatar-bot-direct__btn--primary"
            :disabled="!isMounted || status !== 'ready'"
            @click="handleWave"
          >
            揮手打招呼 (Wave)
          </button>
          <button
            type="button"
            class="avatar-bot-direct__btn"
            :disabled="!isMounted || status !== 'ready'"
            @click="handleToggleEngine"
          >
            切換引擎 ({{ currentEngine.toUpperCase() }})
          </button>
        </div>
      </div>

      <div class="avatar-bot-direct__group">
        <span class="avatar-bot-direct__group-label">生命週期測試</span>
        <button
          type="button"
          class="avatar-bot-direct__btn avatar-bot-direct__btn--danger"
          @click="handleToggleMount"
        >
          {{ isMounted ? '銷毀與卸載 (Unmount)' : '重新掛載 (Remount)' }}
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.avatar-bot-direct__workspace {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 2rem;
  width: 100%;
}

@media (max-width: 900px) {
  .avatar-bot-direct__workspace {
    grid-template-columns: 1fr;
  }
}

.avatar-bot-direct__stage-card {
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--panel-border);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.avatar-bot-direct__viewport {
  position: relative;
  width: 100%;
  height: 520px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 0.75rem;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-bot-direct__container {
  width: 100%;
  height: 100%;
  position: relative;
}

.avatar-bot-direct__placeholder {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.avatar-bot-direct__control-card {
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--panel-border);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.avatar-bot-direct__card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--panel-border);
  padding-bottom: 0.75rem;
}

.avatar-bot-direct__group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.avatar-bot-direct__group-label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.avatar-bot-direct__btn-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.avatar-bot-direct__btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--panel-border);
  border-radius: 0.5rem;
  color: var(--text-primary);
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.avatar-bot-direct__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-cyan);
}

.avatar-bot-direct__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.avatar-bot-direct__btn--primary {
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  border: none;
}

.avatar-bot-direct__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
  filter: brightness(1.1);
}

.avatar-bot-direct__btn--danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.avatar-bot-direct__btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
  border-color: var(--status-error);
}

.avatar-bot-direct__status-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
}

.avatar-bot-direct__status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--text-secondary);
}

.avatar-bot-direct__status-indicator[css-status="loading"] {
  background-color: var(--status-loading);
  box-shadow: 0 0 8px var(--status-loading);
}

.avatar-bot-direct__status-indicator[css-status="ready"] {
  background-color: var(--status-ready);
  box-shadow: 0 0 8px var(--status-ready);
}

.avatar-bot-direct__status-indicator[css-status="error"] {
  background-color: var(--status-error);
  box-shadow: 0 0 8px var(--status-error);
}
</style>
