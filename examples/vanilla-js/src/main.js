/**
 * @file main.js
 * Pure JavaScript entry point for AI Avatar Bot consumer example.
 * Demonstrates consuming ai-avatar-bot-typescript in a non-TypeScript environment.
 */

import { 
  initAvatarBot, 
  AVATAR_MODE_MAP, 
  GENDER_MAP, 
  ENGINE_MODE_MAP 
} from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';
import './style.css';

async function bootstrap() {
  const container = document.getElementById('avatar-container');
  if (!container) {
    console.error('Target #avatar-container element not found');
    return;
  }

  // Pure JavaScript options object
  const options = {
    container,
    avatarMode: AVATAR_MODE_MAP.assistant,
    gender: GENDER_MAP.female,
    welcomeText: '您好！我是您的 AI 虛擬助手，已在純 JavaScript (Vanilla JS) 環境中成功載入。'
  };

  try {
    const widget = await initAvatarBot(options);
    if (!widget) {
      console.warn('Widget initialization returned empty result');
      return;
    }

    console.log('✓ AI Avatar Bot Widget initialized successfully in Pure JS:', widget);

    // Setup action buttons
    const waveBtn = document.getElementById('btn-wave');
    const toggleEngineBtn = document.getElementById('btn-toggle-engine');
    const destroyBtn = document.getElementById('btn-destroy');

    if (waveBtn) {
      waveBtn.addEventListener('click', async () => {
        console.log('Triggering wave motion (JS)...');
        await widget.skinEngine?.triggerMotion('wave');
      });
    }

    if (toggleEngineBtn) {
      toggleEngineBtn.addEventListener('click', async () => {
        const currentMode = widget.skinEngine?.currentMode;
        const nextMode = currentMode === ENGINE_MODE_MAP.twoDimensional 
          ? ENGINE_MODE_MAP.threeDimensional 
          : ENGINE_MODE_MAP.twoDimensional;
        console.log(`Switching engine mode from ${currentMode} to ${nextMode}...`);
        await widget.skinEngine?.switchEngineMode(nextMode);
      });
    }

    if (destroyBtn) {
      destroyBtn.addEventListener('click', () => {
        console.log('Destroying widget instance (JS)...');
        widget.skinEngine?.destroy?.();
        container.innerHTML = '<p class="app-container__notice">虛擬人已銷毀 (Widget Destroyed in Pure JS)</p>';
      });
    }
  } catch (error) {
    console.error('Failed to initialize AI Avatar Bot Widget in Pure JS:', error);
  }
}

void bootstrap();
