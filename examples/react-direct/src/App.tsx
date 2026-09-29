import { useState, useRef, useEffect } from 'react';
import { 
  initAvatarBot, 
  AVATAR_MODE_MAP, 
  GENDER_MAP, 
  ENGINE_MODE_MAP,
  type AiAvatarWidget,
  type AvatarBotOptions
} from 'ai-avatar-bot-typescript';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<AiAvatarWidget | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing React 19 Direct Example...');

  useEffect(() => {
    let isCancelled = false;

    async function setupAvatar() {
      if (!containerRef.current) return;

      const options: AvatarBotOptions = {
        container: containerRef.current,
        avatarMode: AVATAR_MODE_MAP.assistant,
        gender: GENDER_MAP.female,
        welcomeText: '您好！我是您的 AI 虛擬助手，已在 React 19 Direct (StrictMode) 環境中成功載入。'
      };

      try {
        const widget = await initAvatarBot(options);
        if (isCancelled) {
          // If cancelled during strict mode second mount, clean up immediately
          widget?.skinEngine?.destroy?.();
          return;
        }

        if (widget) {
          widgetRef.current = widget;
          setStatusMessage('✓ AI Avatar Bot Widget mounted successfully in React 19');
        }
      } catch (error) {
        console.error('Error initializing avatar in React 19:', error);
        setStatusMessage('Error initializing avatar bot');
      }
    }

    if (isMounted) {
      void setupAvatar();
    }

    return () => {
      isCancelled = true;
      if (widgetRef.current) {
        console.log('Cleaning up widget from React 19 useEffect...');
        widgetRef.current.skinEngine?.destroy?.();
        widgetRef.current = null;
      }
    };
  }, [isMounted]);

  const handleWave = async () => {
    if (widgetRef.current) {
      await widgetRef.current.skinEngine?.triggerMotion('wave');
    }
  };

  const handleToggleEngine = async () => {
    if (widgetRef.current?.skinEngine) {
      const current = widgetRef.current.skinEngine.currentMode;
      const next = current === ENGINE_MODE_MAP.twoDimensional 
        ? ENGINE_MODE_MAP.threeDimensional 
        : ENGINE_MODE_MAP.twoDimensional;
      await widgetRef.current.skinEngine.switchEngineMode(next);
    }
  };

  const handleToggleMount = () => {
    setIsMounted(prev => !prev);
  };

  return (
    <div className="app-container">
      <header className="app-container__header">
        <h1 className="app-container__title">AI Avatar Bot - React 19 Direct Example</h1>
        <p className="app-container__desc">Direct integration testing under React 19 StrictMode</p>
        <p className="app-container__status">{statusMessage}</p>
      </header>

      <div className="app-container__controls">
        <button type="button" className="app-container__button" onClick={handleWave} disabled={!isMounted}>
          揮手動作 (Wave)
        </button>
        <button type="button" className="app-container__button" onClick={handleToggleEngine} disabled={!isMounted}>
          切換 2D / 3D 引擎
        </button>
        <button 
          type="button" 
          className="app-container__button app-container__button--danger" 
          onClick={handleToggleMount}
        >
          {isMounted ? '卸載組件 (Unmount Component)' : '重新掛載 (Remount Component)'}
        </button>
      </div>

      <main className="app-container__content">
        {isMounted ? (
          <div ref={containerRef} id="avatar-container" className="app-container__avatar-box" />
        ) : (
          <div className="app-container__avatar-box">
            <p className="app-container__notice">組件已卸載，資源已乾淨釋放 (Component Unmounted & Context Released)</p>
          </div>
        )}
      </main>
    </div>
  );
}
