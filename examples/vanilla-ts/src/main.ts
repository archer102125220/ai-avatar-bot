import { 
  initAvatarBot, 
  AVATAR_MODE_MAP, 
  GENDER_MAP, 
  ENGINE_MODE_MAP,
  type AiAvatarWidget,
  type AvatarBotOptions
} from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';
import './style.css';

async function bootstrap() {
  const container = document.getElementById('avatar-container');
  if (!container) {
    console.error('Target #avatar-container element not found');
    return;
  }

  const options: AvatarBotOptions = {
    container,
    avatarMode: AVATAR_MODE_MAP.assistant,
    gender: GENDER_MAP.female,
    welcomeText: '您好！我是您的 AI 虛擬助手，已在 Vanilla TS 環境中成功載入。'
  };

  try {
    const widget: AiAvatarWidget | void = await initAvatarBot(options);
    if (!widget) {
      console.warn('Widget initialization returned empty result');
      return;
    }

    console.log('✓ AI Avatar Bot Widget initialized successfully in Vanilla TS:', widget);

    // Setup action buttons for testing interactive capabilities
    const waveBtn = document.getElementById('btn-wave');
    const toggleEngineBtn = document.getElementById('btn-toggle-engine');
    const destroyBtn = document.getElementById('btn-destroy');

    if (waveBtn) {
      waveBtn.addEventListener('click', async () => {
        console.log('Triggering wave motion...');
        await widget.skinEngine?.triggerMotion('wave');
      });
    }

    if (toggleEngineBtn) {
      toggleEngineBtn.addEventListener('click', async () => {
        const currentMode = widget.skinEngine?.currentMode;
        const nextMode = currentMode === ENGINE_MODE_MAP.twoDimensional 
          ? ENGINE_MODE_MAP.threeDimensional 
          : ENGINE_MODE_MAP.twoDimensional;
        console.log(`Switching engine mode from ${String(currentMode)} to ${String(nextMode)}...`);
        await widget.skinEngine?.switchEngineMode(nextMode);
      });
    }

    if (destroyBtn) {
      destroyBtn.addEventListener('click', () => {
        console.log('Destroying widget instance...');
        widget.skinEngine?.destroy?.();
        container.innerHTML = '<p class="app-container__notice">虛擬人已銷毀 (Widget Destroyed)</p>';
      });
    }
  } catch (error) {
    console.error('Failed to initialize AI Avatar Bot Widget:', error);
  }
}

void bootstrap();
