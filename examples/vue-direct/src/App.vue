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
const widgetRef = ref<AiAvatarWidget | null>(null);
const isMounted = ref<boolean>(true);
const statusMessage = ref<string>('Initializing Vue 3 Direct Example...');

async function setupAvatar(): Promise<void> {
  if (!containerRef.value) return;

  const options: AvatarBotOptions = {
    container: containerRef.value,
    avatarMode: AVATAR_MODE_MAP.assistant,
    gender: GENDER_MAP.female,
    welcomeText: '您好！我是您的 AI 虛擬助手，已在 Vue 3 Direct (<script setup>) 環境中成功載入。'
  };

  try {
    const widget = await initAvatarBot(options);
    if (widget) {
      widgetRef.value = widget;
      statusMessage.value = '✓ AI Avatar Bot Widget mounted successfully in Vue 3';
    }
  } catch (error) {
    console.error('Error initializing avatar in Vue 3:', error);
    statusMessage.value = 'Error initializing avatar bot';
  }
}

function cleanupAvatar(): void {
  if (widgetRef.value) {
    console.log('Cleaning up widget from Vue 3 lifecycle...');
    widgetRef.value.skinEngine?.destroy?.();
    widgetRef.value = null;
  }
}

onMounted(() => {
  void setupAvatar();
});

onBeforeUnmount(() => {
  cleanupAvatar();
});

const handleWave = async (): Promise<void> => {
  if (widgetRef.value) {
    await widgetRef.value.skinEngine?.triggerMotion('wave');
  }
};

const handleToggleEngine = async (): Promise<void> => {
  if (widgetRef.value?.skinEngine) {
    const current = widgetRef.value.skinEngine.currentMode;
    const next = current === ENGINE_MODE_MAP.twoDimensional 
      ? ENGINE_MODE_MAP.threeDimensional 
      : ENGINE_MODE_MAP.twoDimensional;
    await widgetRef.value.skinEngine.switchEngineMode(next);
  }
};

const handleToggleMount = async (): Promise<void> => {
  if (isMounted.value) {
    cleanupAvatar();
    isMounted.value = false;
  } else {
    isMounted.value = true;
    // Wait for DOM container to be rendered again
    setTimeout(() => {
      void setupAvatar();
    }, 50);
  }
};
</script>

<template>
  <div class="app-container">
    <header class="app-container__header">
      <h1 class="app-container__title">AI Avatar Bot - Vue 3 Direct Example</h1>
      <p class="app-container__desc">Direct integration testing with Vue 3 &lt;script setup&gt; lifecycle</p>
      <p class="app-container__status">{{ statusMessage }}</p>
    </header>

    <div class="app-container__controls">
      <button 
        type="button" 
        class="app-container__button" 
        :disabled="!isMounted"
        @click="handleWave"
      >
        揮手動作 (Wave)
      </button>
      <button 
        type="button" 
        class="app-container__button" 
        :disabled="!isMounted"
        @click="handleToggleEngine"
      >
        切換 2D / 3D 引擎
      </button>
      <button 
        type="button" 
        class="app-container__button app-container__button--danger" 
        @click="handleToggleMount"
      >
        {{ isMounted ? '卸載組件 (Unmount Component)' : '重新掛載 (Remount Component)' }}
      </button>
    </div>

    <main class="app-container__content">
      <div 
        v-if="isMounted" 
        id="avatar-container" 
        ref="containerRef" 
        class="app-container__avatar-box" 
      />
      <div v-else class="app-container__avatar-box">
        <p class="app-container__notice">組件已卸載，資源已乾淨釋放 (Component Unmounted &amp; Context Released)</p>
      </div>
    </main>
  </div>
</template>
