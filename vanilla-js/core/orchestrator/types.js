/**
 * @typedef {Object} CustomEnginesConfig
 * @property {Function|Object} [skin] - 自訂 Skin Engine 的建構函式或實例。
 * @property {Function|Object} [tools] - 自訂 Tools Engine 的建構函式或實例。
 * @property {Function|Object} [brain] - 自訂 Brain Engine 的建構函式或實例。
 * @property {Function|Object} [stt] - 自訂 STT (語音辨識) 引擎的建構函式或實例。
 * @property {Function|Object} [tts] - 自訂 TTS (語音合成) 引擎的建構函式或實例。
 * @property {Function|Object} [i18n] - 自訂 i18n 多語系引擎的建構函式或實例。
 */

/**
 * 記憶資料結構 (MemoryData)
 * @typedef {Object} MemoryData
 * @property {number} version - 結構版本號
 * @property {string} name - 訪客/使用者名稱
 * @property {number} visits - 訪問次數
 * @property {number} last - 最後訪問時間戳 (ms)
 * @property {Array<{role: 'user'|'assistant', content: string}>} history - 對話歷史
 * @property {string} [summary] - 滾動對話摘要
 * @property {number} [lastSummarizedTurnIndex] - 上次摘要時的輪次索引
 * @property {Record<string, any>} [metadata] - 開發者自訂擴充資料槽位
 */

/**
 * 自訂儲存轉接器介面 (MemoryAdapter)
 * @typedef {Object} MemoryAdapter
 * @property {(key: string) => (MemoryData | null)} load - 載入資料
 * @property {(key: string, data: MemoryData) => void} save - 儲存資料
 * @property {(key: string) => void} clear - 清除資料
 */

/**
 * 角色模式型別：提供內建模式自動補全，同時允許自訂字串
 * @typedef {'assistant' | 'companion' | (string & {})} AvatarMode
 */

/**
 * @typedef {Object} AvatarBotOptions
 * @property {HTMLElement} [container=null] - 綁定 Widget 的 HTML 容器元素
 * @property {boolean} [enableAiProvider] - 是否啟用 AI 服務提供商
 * @property {string} [aiProviderBaseUrl=''] - AI 服務提供商的 API 基礎 URL
 * @property {string} [aiProviderModel] - 使用的 AI 服務模型名稱
 * @property {Function|RequestInit} [aiProviderCreateFetchSetting] - 自訂 Fetch 設定的處理函式或設定物件
 * @property {Function|Record<string, any>} [aiProviderCreateFetchPayload] - 自訂 Fetch 負載 (Payload) 的處理函式或負載物件
 * @property {string|Object} [aiProviderResponseFormat] - 自訂 AI 服務回應格式 (如 'sse', 'json', 或包含 processLine 等物件)
 * @property {number} [aiProviderMaxTokens] - AI 服務回應的最大 Token 數
 * @property {boolean} [aiProviderStream] - 是否啟用 AI 服務的串流 (Streaming) 回應
 * @property {Function} [aiProviderExtractToolCalls] - AI 服務提供商自訂提取 Tool Calls 的回呼函式
 * @property {string} [neuralVoice=''] - 指定使用的神經網路語音 (Neural Voice)
 * @property {string} [knowledgeUrl=''] - 助理模式知識庫資料的 URL
 * @property {string} [companionKnowledgeUrl=''] - 陪伴模式知識庫資料的 URL
 * @property {string} [modelUrl] - 3D 或 2D 模型的 URL
 * @property {string} [ttsEndpoint] - 語音合成 (TTS) 服務端點 URL (沒設會試同站相對路徑)
 * @property {string} [llmModel] - 預設的本地/遠端語言模型 (LLM) 類型
 * @property {number} [llmMaxTokens] - WebLLM 本地模型回應的最大 Token 數
 * @property {boolean} [preloadWebLLM=false] - 是否在初始化時預先載入 WebLLM 模型
 * @property {boolean} [autoFallbackWebLLM=true] - 當 AI Provider 故障時是否自動在背景載入 WebLLM 備援
 * @property {boolean} [enableAutoContinue] - 是否在模型回答達到 Token 上限被截斷時啟用自動接續機制
 * @property {number} [maxAutoContinuations] - 最大自動接續次數上限（防止無限接續）
 * @property {'stream'|'buffered'} [autoContinueMode] - 自動接續輸出模式 ('stream' 即時串流接續 | 'buffered' 全生成完再輸出)
 * @property {string|Function} [autoContinuePrompt] - 自訂自動接續提示詞或生成函式
 * @property {AvatarMode} [avatarMode] - Avatar 模式（例如：assistant, companion 或自訂模式）
 * @property {boolean} [enableMemory] - 是否啟用記憶體模組（多輪對話與上下文歷史）
 * @property {number} [maxHistoryTurns] - 保留最大歷史對話輪數
 * @property {string} [memoryKey] - 本機儲存或識別鍵名
 * @property {MemoryAdapter} [memoryAdapter] - 自訂儲存轉接器實例（需實作 load, save, clear）
 * @property {Record<string, Object>} [modes] - 宣告式自訂模式註冊表
 * @property {Record<string, any>|string} [knowledge=null] - 預載的助理模式知識庫資料，可以是 JSON 物件或字串
 * @property {Record<string, any>|string} [companionKnowledge=null] - 預載的陪伴模式知識庫資料，可以是 JSON 物件或字串
 * @property {string} [startMode] - 初始啟動的模型模式 (2D 或 3D)
 * @property {string} [fitMode] - 模型適應容器的模式 (Fit Mode)
 * @property {string} [vrmUrl] - VRM 3D 模型檔案的 URL
 * @property {boolean} [enableModelDrop] - 是否允許使用者拖曳 VRM 模型檔案至畫布即時換裝（預設 false 關閉）
 * @property {boolean} [allowModelDrop] - 是否允許使用者拖曳 VRM 模型檔案至畫布即時換裝（enableModelDrop 的別名）
 * @property {Record<string, any>} [gesture3D] - 3D 模型使用的姿態/手勢設定資料
 * @property {Record<string, any>} [gesture2D] - 2D 模型使用的姿態資料
 * @property {boolean} [isMinimal=false] - 是否以極簡模式 (Minimal UI) 啟動
 * @property {boolean} [isIframe=false] - 是否在 Iframe 中執行
 * @property {string} [locale='zh-TW'] - 語系設定 (例如 'zh-TW', 'en-US', 'ja-JP', 'ko-KR')
 * @property {Record<string, Record<string, string>>} [i18nMessages] - 自訂的多語系翻譯字典訊息
 * @property {string} [gender=''] - 預設性別設定
 * @property {string} [brainGender=null] - 專屬大腦引擎（用語）的性別設定
 * @property {string} [speechGender=null] - 專屬語音引擎（音色）的性別設定
 * @property {string} [skinGender=null] - 專屬外觀引擎（模型外表）的性別設定
 * @property {Array<string|Record<string, any>>} [companionFallback=[]] - 陪伴模式的備用對話回覆 (Fallback) 清單
 * @property {CustomEnginesConfig} [customEngines={}] - 自訂引擎 (例如自訂 skin 引擎) 的設定物件
 * @property {Object} [compression={}] - 上下文壓縮設定 (包含 strategy, maxTurns, maxTotalChars, webLlm, aiProvider, customCompressor)
 * @property {string|Function} [systemContextTemplate] - 助理模式系統提示詞模板
 * @property {string|Function} [companionSystemContextTemplate] - 陪伴模式系統提示詞模板
 * @property {string|Function} [ragTemplate] - RAG 參考資料模板
 * @property {Record<string, any>} [customContext] - 附加自訂上下文資訊物件 (例如使用者資料、品牌背景等)
 * @property {string|Function} [languageRule] - 多語系回答規則提示詞
 * @property {string|Function} [genderRule] - 針對性別的額外系統提示詞規則
 * @property {Array<Object>} [tools] - 註冊至 Host 的工具清單 (與 hostTools 相同)
 * @property {Array<Object>} [hostTools] - 註冊至 Host 的工具清單
 * @property {boolean} [enableEmotionTools=true] - 是否啟用內建的情緒動作工具插件
 * @property {Object} [emotionToolsOptions] - 內建情緒工具插件的自訂選項
 * @property {number} [confirmationTimeoutMs] - 工具確認超時毫秒數
 * @property {number} [toolConfirmationTimeoutMs] - 工具確認超時毫秒數 (別名)
 * @property {Function} [buildLLMMessages] - 自訂組裝 LLM 訊息格式的函式
 * @property {string} [welcomeText] - 通用歡迎詞文字
 * @property {string} [companionWelcomeText] - 陪伴模式專用歡迎詞文字
 * @property {string} [assistantWelcomeText] - 助理模式專用歡迎詞文字
 * @property {string} [greeting] - 通用問候語音文字
 * @property {string} [companionGreeting] - 陪伴模式專用問候語音文字
 * @property {string} [assistantGreeting] - 助理模式專用問候語音文字
 * @property {Function} [onReady] - Bot 初始化完成且掛載後的回呼函式
 * @property {Function} [onMinimalTrigger] - 切換極簡模式時的回呼函式
 * @property {Function} [onError] - 發生錯誤時的回呼函式
 * @property {Function} [onLlmLoading] - LLM 模型開始載入時的回呼函式
 * @property {Function} [onLlmLoadProgress] - LLM 模型載入進度更新時的回呼函式
 * @property {Function} [onLlmLoaded] - LLM 模型載入完成時的回呼函式
 * @property {Function} [onLlmLoadError] - LLM 模型載入失敗時的回呼函式
 * @property {Function} [onAiProviderConnecting] - 遠端 AI 服務連線中回呼函式
 * @property {Function} [onAiProviderConnected] - 遠端 AI 服務連線成功回呼函式
 * @property {Function} [onAddChatMessage] - 新增對話訊息時的回呼函式
 * @property {Function} [onUpdateChatMessage] - 更新對話訊息時的回呼函式
 * @property {Function} [onChatHistoryChanged] - 對話歷史紀錄變更時的回呼函式
 * @property {Function} [onSpokenDisplayTextChange] - 語音文字氣泡內容變更時的回呼函式
 * @property {Function} [onSpokenDisplayTextTimeout] - 語音文字氣泡顯示逾時的回呼函式
 * @property {Function} [onMicStateChanged] - 麥克風狀態變更時的回呼函式
 * @property {Function} [onVoiceStatusChanged] - 語音對話狀態變更時的回呼函式
 * @property {Function} [onLanguageChanged] - 介面語言變更時的回呼函式
 * @property {Function} [onSpeaking] - 開始播放語音時的回呼函式
 * @property {Function} [onSpeakingEnd] - 語音播放結束時的回呼函式
 * @property {(fullText: string) => void} [onStreamEnd] - 大腦 LLM 串流文字回答生成完畢時的回呼函式 (fullText)
 * @property {Function} [onAutoContinueStart] - 自動接續開始時的回呼函式 (info: { continuationIndex: number, maxContinuations: number, accumulatedText: string })
 * @property {Function} [onAutoContinueWait] - 語音播完但接續內容仍在生成中（空窗期）時的回呼函式 (info: { continuationIndex: number, maxContinuations: number, accumulatedText: string })
 * @property {Function} [onAutoContinueResume] - 接續內容已抵達並恢復播放時的回呼函式 (info: { continuationIndex: number, maxContinuations: number, accumulatedText: string, chunk: string })
 * @property {Function} [onAutoContinueEnd] - 自動接續流程結束時的回呼函式 (info: { totalContinuations: number, maxContinuations: number, accumulatedText: string, reason: string })
 * @property {Function} [onSummaryUpdated] - 滾動對話摘要更新時的回呼函式 (summary)
 * @property {Function} [onBrainFallback] - 大腦引擎降級時觸發的回呼函式 (fromEngine, toEngine, error)
 * @property {Function} [onToolCall] - 觸發外部工具 (Tool Call) 時的回呼函式
 * @property {(info: { toolName: string, args: Object, toolCall: Object }, widget: AiAvatarWidget) => any} [onToolNotFound] - 當 AI 請求呼叫未註冊的工具時觸發的回呼函式（可回傳自訂結果供模型第二輪生成回答）
 * @property {(info: { tool: Object, toolName: string, args: Object, toolCall: Object, error: Error }, widget: AiAvatarWidget) => any} [onToolError] - 當工具執行發生錯誤時觸發的回呼函式（可回傳自訂錯誤結果供模型生成回答）
 * @property {Function} [onSetHistoryOpen] - 開關歷史紀錄面板時的回呼函式
 * @property {Function} [onRenderHistory] - 歷史紀錄渲染更新時的回呼函式
 * @property {Function} [onSpokenAudioPlayNow] - 觸發發音時的回呼函式
 * @property {Function} [onThreeDimensionalError] - 3D 引擎發生錯誤時的回呼函式
 * @property {Function} [onTwoDimensionalError] - 2D 引擎發生錯誤時的回呼函式
 * @property {Function} [VRMFileChangeFail] - 替換 VRM 模型檔案失敗時的回呼函式
 * @property {Function} [VRMFileChangeSuccess] - 替換 VRM 模型檔案成功時的回呼函式
 * @property {Function} [onModelChangeStart] - 2D/3D 模型切換開始時的回呼函式
 * @property {Function} [onModelChangeEnd] - 2D/3D 模型切換結束時的回呼函式
 */

/**
 * @typedef {Object} AiAvatarWidget
 * @property {AvatarBotOptions} options - 傳入的初始化設定選項
 * @property {string} DEFAULT_LLM_MODEL - 預設的 LLM 模型名稱
 * @property {Record<string, string>} STATE_MAP - 狀態映射表
 * @property {Record<string, string>} ENGINE_MODE_MAP - 引擎模式映射表
 * @property {Record<string, string>} AVATAR_MODE_MAP - Avatar 模式映射表
 * @property {Record<string, string>} FIT_MODE_MAP - Fit 模式映射表
 * @property {Record<string, string>} BRAIN_ENGINE_TYPE_MAP - 大腦引擎類型映射表
 * @property {Record<string, string>} BRAIN_FALLBACK_TYPE_MAP - 大腦備援模式映射表
 * @property {Record<string, string>} AUTO_CONTINUE_MODE_MAP - 自動接續模式映射表
 * @property {Record<string, string>} LLM_FINISH_REASON_MAP - LLM 結束原因映射表
 * @property {Record<string, string>} FINISH_REASON_MAP - 結束原因映射表
 * @property {Array<string>} availableModes - 目前可用角色模式清單
 * @property {boolean} enableMemory - 目前是否啟用記憶體
 * @property {boolean} enableAiProvider - 目前是否啟用 AI 服務提供商
 * @property {boolean} preloadWebLLM - 是否預先載入 WebLLM 模型
 * @property {boolean} autoFallbackWebLLM - 是否自動在背景載入 WebLLM 備援
 * @property {boolean} enableAutoContinue - 當前是否啟用自動接續
 * @property {number} maxAutoContinuations - 當前最大自動接續次數
 * @property {'stream'|'buffered'} autoContinueMode - 當前自動接續輸出模式
 * @property {string|Function|null} autoContinuePrompt - 當前自動接續提示詞或生成函式
 * @property {boolean} enableModelDrop - 當前是否啟用模型拖曳換裝
 *
 * @property {HTMLElement} container - 綁定 Widget 的 HTML 容器元素
 * @property {any} uiDom - UI 相關的 DOM 元素與控制方法
 * @property {any} i18nEngine - i18n 多語系引擎實例
 * @property {any} toolsEngine - 外部工具 (Tools) 引擎實例
 * @property {Function} buildLLMMessages - 組裝 LLM 訊息的函式
 * @property {Function} classifyEmotion - 情感分類函式
 * @property {Function} applyEmotionFromText - 根據文字設定情感的函式
 * @property {Function} answerQuestion - 處理回答使用者問題的方法
 * @property {(text: string) => Promise<void>|void} handleUser - 處理使用者輸入文字的主方法
 * @property {boolean} isIframe - 是否在 Iframe 內
 * @property {boolean} isMinimal - 是否處於極簡模式
 * @property {string} gender - 目前性別
 * @property {string|null} brainGender - 大腦引擎性別設定
 * @property {string|null} speechGender - 語音引擎性別設定
 * @property {string|null} skinGender - 外觀引擎性別設定
 * @property {string} locale - 當前語系代碼
 * @property {AvatarMode} avatarMode - 目前 Avatar 模式
 * @property {Function} showMinimalEl - 顯示極簡模式元素的函式
 * @property {Function} hiddenMinimalEl - 隱藏極簡模式元素的函式
 * @property {any} brainEngine - AI 大腦引擎實例
 * @property {any} speechEngine - 語音引擎實例
 * @property {any} skinEngine - Skin (模型與畫面) 引擎實例
 * @property {Function} [onReady] - Bot 初始化完成後掛載的回呼函式
 * @property {Function} [onMinimalTrigger] - 切換極簡模式的回呼函式
 * @property {Function} [onError] - 發生錯誤時的回呼函式
 */

export {};

