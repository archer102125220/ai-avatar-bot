'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  initAvatarBot,
  AVATAR_MODE_MAP,
  GENDER_MAP,
  ENGINE_MODE_MAP,
  type AiAvatarWidget,
  type AvatarBotOptions
} from 'ai-avatar-bot-typescript';

export default function AvatarBotDirect() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<AiAvatarWidget | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusText, setStatusText] = useState<string>('Initializing SDK inside Next.js Client Component...');
  const [currentEngine, setCurrentEngine] = useState<string>(ENGINE_MODE_MAP.twoDimensional);

  useEffect(() => {
    let isCancelled = false;

    async function mountBot(): Promise<void> {
      if (containerRef.current === null) {
        return;
      }

      setStatus('loading');
      setStatusText('Mounting AI Avatar Bot...');

      const options: AvatarBotOptions = {
        container: containerRef.current,
        avatarMode: AVATAR_MODE_MAP.assistant,
        gender: GENDER_MAP.female,
        welcomeText: '您好！我是您的 AI 虛擬助手，已在 Next.js App Router (Client Component) 環境中順暢載入。'
      };

      try {
        const widget = await initAvatarBot(options);
        if (isCancelled) {
          widget?.skinEngine?.destroy?.();
          return;
        }

        if (widget) {
          widgetRef.current = widget;
          setStatus('ready');
          setStatusText('Ready - Widget active in Next.js SSR-guarded component');
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[next-direct] Failed to initialize avatar:', err);
          setStatus('error');
          setStatusText('Error initializing AI Avatar Bot');
        }
      }
    }

    if (isMounted) {
      void mountBot();
    }

    return () => {
      isCancelled = true;
      if (widgetRef.current) {
        widgetRef.current.skinEngine?.destroy?.();
        widgetRef.current = null;
      }
    };
  }, [isMounted]);

  const handleWave = useCallback(async (): Promise<void> => {
    if (widgetRef.current?.skinEngine) {
      await widgetRef.current.skinEngine.triggerMotion('wave');
    }
  }, []);

  const handleToggleEngine = useCallback(async (): Promise<void> => {
    if (widgetRef.current?.skinEngine) {
      const current = widgetRef.current.skinEngine.currentMode;
      const target =
        current === ENGINE_MODE_MAP.twoDimensional
          ? ENGINE_MODE_MAP.threeDimensional
          : ENGINE_MODE_MAP.twoDimensional;
      await widgetRef.current.skinEngine.switchEngineMode(target);
      setCurrentEngine(target);
    }
  }, []);

  const handleToggleMount = useCallback((): void => {
    setIsMounted((prev) => !prev);
  }, []);

  return (
    <div className="avatar-bot-direct__workspace">
      <section className="avatar-bot-direct__stage-card">
        <div className="avatar-bot-direct__viewport">
          {isMounted ? (
            <div ref={containerRef} id="avatar-container" className="avatar-bot-direct__container" />
          ) : (
            <div className="avatar-bot-direct__placeholder">
              組件已卸載，WebGL 上下文與 DOM 資源已釋放 (Unmounted)
            </div>
          )}
        </div>
      </section>

      <aside className="avatar-bot-direct__control-card">
        <h2 className="avatar-bot-direct__card-title">互動控制面板</h2>

        <div className="avatar-bot-direct__group">
          <span className="avatar-bot-direct__group-label">狀態指示</span>
          <div className="avatar-bot-direct__status-row">
            <span className="avatar-bot-direct__status-indicator" css-status={status} />
            <span>{statusText}</span>
          </div>
        </div>

        <div className="avatar-bot-direct__group">
          <span className="avatar-bot-direct__group-label">動作控制</span>
          <div className="avatar-bot-direct__btn-row">
            <button
              type="button"
              className="avatar-bot-direct__btn avatar-bot-direct__btn--primary"
              onClick={handleWave}
              disabled={!isMounted || status !== 'ready'}
            >
              揮手打招呼 (Wave)
            </button>
            <button
              type="button"
              className="avatar-bot-direct__btn"
              onClick={handleToggleEngine}
              disabled={!isMounted || status !== 'ready'}
            >
              切換引擎 ({currentEngine.toUpperCase()})
            </button>
          </div>
        </div>

        <div className="avatar-bot-direct__group">
          <span className="avatar-bot-direct__group-label">生命週期測試</span>
          <button
            type="button"
            className="avatar-bot-direct__btn avatar-bot-direct__btn--danger"
            onClick={handleToggleMount}
          >
            {isMounted ? '銷毀與卸載 (Unmount)' : '重新掛載 (Remount)'}
          </button>
        </div>
      </aside>
    </div>
  );
}
