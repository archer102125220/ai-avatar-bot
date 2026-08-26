/* =====================================================================
 * knowledge.js — 虛擬人的知識庫（檢索 / Retrieval 來源）
 * 這個 demo 版的內容＝「ai-avatar-bot-vanilla-js 元件本身的使用教學與問答」，角色會自己當自己的說明書。
 * 換領域只要改這個檔；接上 LLM 時，也是把這裡的內容當「依據」餵進去。
 * 每筆：q=代表問題、kw=關鍵字(增加命中率)、a=回答(盡量短，TTS 唸起來順)
 * ===================================================================== */

export const KNOWLEDGE = [
  {
    q: '這是什麼',
    kw: '你是誰 這是什麼 介紹 自我介紹 什麼東西 npm 套件 數位人 虛擬人 專案',
    a: '我是 ai-avatar-bot-vanilla-js，一個輕量、零框架依賴的網頁端 2D 與 3D AI 虛擬人 SDK。我支援語音互動、多層 AI 大腦、長對話記憶與工具調用，全部可在瀏覽器中流暢運行。'
  },
  {
    q: '怎麼安裝到我的專案',
    kw: '安裝 怎麼用 嵌入 加到 放到 我的專案 怎麼裝 install npm yarn pnpm cdn cdn引入 套件 怎麼安裝到專案 怎麼安裝',
    a: '你可以透過 npm、pnpm 或 yarn 執行 npm install ai-avatar-bot-vanilla-js 安裝，也可以在 HTML 透過 CDN 直接以 ES Module 形式引入。'
  },
  {
    q: '快速開始範例程式碼',
    kw: '程式碼 script 怎麼寫 範例 代碼 快速開始 code initAvatarBot import 怎麼用 啟動',
    a: '從套件 import { initAvatarBot }，傳入 container 容器元素即可啟動，例如：const widget = await initAvatarBot({ container: document.getElementById("avatar") });。詳細可參考 README。'
  },
  {
    q: '支援 3D 嗎／怎麼切換 2D 和 3D',
    kw: '3D 2D VRM Live2D 切換 模式 雙外觀 渲染 3d模型 2d模型 立體 平面 skinEngine engineMode 支援3D 支援 3D 與換角色嗎',
    a: '支援！內建 Live2D (2D) 與 VRM (3D) 雙外觀引擎。可在初始化時設定 startMode: "3d"，或在運行中透過 widget.skinEngine.engineMode = "3d" 即時切換。'
  },
  {
    q: '怎麼換成自訂角色',
    kw: '換角色 換模型 皮 換人 model 換頭像 自訂角色 換成 vrm live2d model3 modelUrl vrmUrl 換成自訂角色',
    a: '在初始化時傳入 modelUrl 指向 Live2D model3.json 檔，或傳入 vrmUrl 指向 3D VRM 檔；運行中也可呼叫 widget.skinEngine.loadVRMFile(file) 載入模型。'
  },
  {
    q: '可以拖曳檔案換裝嗎',
    kw: '拖曳 換裝 drop 拖放 vrm 換衣服 丟檔案 enableModelDrop 即時換裝',
    a: '可以！在初始化設定 enableModelDrop: true 或動態開啟 widget.enableModelDrop = true，使用者就能直接把 .vrm 檔案拖進畫布完成即時換裝。'
  },
  {
    q: '怎麼控制表情與動作',
    kw: '表情 動作 手勢 情緒 happy wave 揮手 鞠躬 換表情 生氣 悲傷 setEmotion setEmotionFromText',
    a: '內建 8 種以上情緒與動作（開心、驚訝、悲傷、揮手、鞠躬等）。你可以呼叫 widget.skinEngine.setEmotion("happy")，或是透過 widget.setEmotionFromText("...") 根據文字自動推斷表情。'
  },
  {
    q: 'AI 大腦是如何運作的',
    kw: '大腦 ai 腦袋 llm 模型 思考 webllm 三層 降級 provider ollama 推論 架構 autoFallbackWebLLM AI 大腦是如何運作的',
    a: '大腦內建高可用三層架構：優先連線雲端 AI Provider；若離線則無縫切換至本機 WebGPU WebLLM 端側模型；若裝置不支援則自動降級為高速關鍵字檢索。'
  },
  {
    q: '怎麼串接 Ollama 或自建 AI',
    kw: 'ollama openai api 自建 後端 遠端 ai provider 連線 baseUrl 伺服器 enableAiProvider aiProviderBaseUrl',
    a: '在初始化時設定 enableAiProvider: true，並填入 aiProviderBaseUrl 與 aiProviderModel，就能直接對接本地 Ollama 或任何 OpenAI 相容的後端。'
  },
  {
    q: 'WebLLM 本地大腦是什麼',
    kw: 'webllm 本地 離線 webgpu 顯卡 瀏覽器 隱私 零伺服器 免費 llmModel 端側模型',
    a: 'WebLLM 透過 WebGPU 直接在瀏覽器本機執行小型語言模型，對話 100% 留在本機、極致保護隱私，且零伺服器成本。首次載入會下載模型權重並自動快取。'
  },
  {
    q: '怎麼使用 Function Calling 工具調用',
    kw: '工具 外部工具 function calling tools 擴充 api 查詢 呼叫 hostTools 技能 動作 自訂工具 怎麼使用工具調用 工具調用',
    a: '在初始化選項的 tools 陣列中定義工具名稱、描述與執行函式。支援前端純關鍵字匹配、AI 語意調用與雙軌混合模式，還支援使用者授權確認彈窗。'
  },
  {
    q: '你會記得我嗎／對話太長會爆掉嗎',
    kw: '記得 記憶 名字 記住 忘記 隱私 存哪 對話太長 壓縮 token 顯存 sliding window rolling summary compression',
    a: '啟用 enableMemory: true 後，多輪對話會存在瀏覽器的 localStorage。內建滑動窗口與滾動摘要壓縮機制，會自動控制顯存與 Token，避免對話過長崩潰。說「忘記我」即可清空記憶。'
  },
  {
    q: '語音怎麼用／麥克風步驟',
    kw: '語音 說話 麥克風 怎麼講 對話 講話 聽 怎麼開麥 步驟 收音 權限 允許 聆聽中',
    a: '點擊麥克風按鈕並在瀏覽器允許權限，看到「聆聽中」即可開口對話。我會用語音回答並同步對嘴。如果不方便開麥，也可以直接在輸入框打字送出。'
  },
  {
    q: '講話可以被打斷嗎',
    kw: '打斷 中斷 插話 停止說話 barge in 隨時講 interruptForVoice',
    a: '可以！SDK 支援全雙工語音打斷機制。當我正在說話時，只要你開口或點擊麥克風，我會立刻停止當前語音並切換為專心聆聽你的狀態。'
  },
  {
    q: '對嘴是怎麼實現的',
    kw: '對嘴 嘴巴 嘴型 lipsync 同步 聲音 音量 開合',
    a: '使用神經語音時，系統會即時分析音訊頻譜與音量振幅驅動嘴型開合；使用原生瀏覽器語音時則採用節奏模擬演算法，確保說話自然流暢。'
  },
  {
    q: '支援 Vue 或 React 等框架嗎／怎麼自訂 UI',
    kw: 'react vue svelte angular 框架 headless 無頭 自訂介面 自訂ui isMinimal 整合 store',
    a: '完全支援！SDK 採用純 Vanilla JS 零框架依賴，可在 React、Vue、Svelte 等任何框架中運行。設定 isMinimal: true 或使用 Headless 模式，訂閱底層 Store 狀態即可完全客製化專屬 UI。'
  },
  {
    q: '支援哪些語言／怎麼切換多語系',
    kw: '語言 英文 日文 韓文 繁體中文 簡體中文 語系 i18n 翻譯 國際化 setLocale locale',
    a: '內建繁體中文 (zh-TW)、簡體中文 (zh-CN)、英文 (en-US)、日文 (ja-JP) 及韓文 (ko-KR)。可隨時呼叫 widget.i18nEngine.setLocale("en-US") 動態切換介面語言。'
  },
  {
    q: '什麼是陪伴模式',
    kw: '陪伴 模式 companion 連續 對話 聊天 陪聊 continuous 全雙工 avatarMode',
    a: '設定 avatarMode: "companion" 即可切換為陪伴模式。在此模式下點擊對話後會開啟連續對話迴圈，我回答完會自動繼續聆聽，並具備專屬的陪聊人格與長記憶。'
  },
  {
    q: '怎麼自訂或修改知識庫內容',
    kw: '改內容 知識庫 faq 自訂回答 換內容 knowledge 資料 json 擴充 knowledgeUrl',
    a: '在初始化時傳入 knowledge 陣列（每筆包含問題 q、關鍵字 kw、回答 a），或是設定 knowledgeUrl 指向線上 JSON 檔案即可自由替換問答庫。'
  },
  {
    q: '可以自訂專屬人格或角色模式嗎',
    kw: '自訂模式 人格 custom mode 角色扮演 prompt 設定 指令 modes',
    a: '可以！透過 modes 選項可以宣告式註冊自訂模式，指定專屬的 systemPrompt、welcomeText、greeting 與專屬知識庫，打造量身定制的 AI 人格。'
  },
  {
    q: '需要架後端嗎／要不要費用',
    kw: '後端 伺服器 server 要架嗎 費用 成本 花錢 錢 收費 免費 金鑰 商用 多少錢 付費',
    a: '本套件為純前端 SDK，預設使用瀏覽器原生語音與本機 WebLLM/檢索大腦，完全零後端、零伺服器費用。若要提升體驗，可選擇性串接自建 TTS 端點或遠端 Ollama/OpenAI API。'
  },
  {
    q: '這是開源的嗎／商用有什麼注意事項',
    kw: '開源 授權 license 免費 商用 github 版權 live2d vrm cubism mit',
    a: 'SDK 原始碼採用 MIT 授權開源。但請注意：Live2D Cubism Core 為專有授權，內建的 Haru 範例模型僅供技術測試；若要正式商業化上線，請務必更換為自有或已獲合法授權的模型。'
  },
  {
    q: '對話內容會被上傳嗎／隱私安全',
    kw: '隱私 安全 資料 資料流向 上傳 紀錄 privacy 洩漏 存哪 伺服器',
    a: '使用 WebLLM 與本機記憶時，所有運算與對話記錄 100% 留在你的瀏覽器內，不傳送至外部伺服器。若使用遠端 AI Provider 或瀏覽器原生 STT，資料僅會傳送到你指定的後端或瀏覽器語音辨識服務。'
  },
  {
    q: '支援哪些瀏覽器與硬體環境',
    kw: '瀏覽器 chrome 支援 相容 手機 safari edge webgpu 硬體 顯卡 平台',
    a: '推薦使用最新版 Chrome、Edge 等 Chromium 架構桌面瀏覽器以獲得最佳 WebGPU 與 Web Speech 體驗。Safari 18+ 與其他現代瀏覽器亦支援核心 2D/3D 渲染與基本對話功能。'
  },
  {
    q: '怎麼讓虛擬人安靜／靜音',
    kw: '靜音 安靜 關掉聲音 停 不要講 閉嘴 mute 聲音 喇叭',
    a: '點擊介面上的喇叭按鈕可以靜音，會立刻中斷正在播放的語音；亦可透過 API 呼叫 widget.speechEngine.setMuted(true) 進行靜音控制。'
  },
  {
    q: '怎麼收起或最小化視窗',
    kw: '收起 關閉 隱藏 縮小 不要顯示 收掉 x minimal 懸浮',
    a: '點擊面板右上角的縮小或關閉按鈕，虛擬人就會收合成右下角的小圓形懸浮按鈕，再次點擊即可重新展開。'
  },
  {
    q: '打招呼',
    kw: '你好 哈囉 嗨 hello hi 在嗎 哈嘍 早安 午安 您好 嘿',
    a: '哈囉！我是 AI Avatar Bot 虛擬人元件的示範。想了解如何安裝到專案、切換 2D/3D 外觀、或自訂 AI 大腦與工具嗎？隨時問我喔！'
  },
  {
    q: '道謝道別',
    kw: '謝謝 感謝 感恩 掰掰 再見 bye 先走了 下次聊 辛苦了 88',
    a: '不客氣！歡迎把我安裝到你的專案中體驗看看，有任何問題隨時回來找我～'
  }
];

// 陪伴模式的「陪聊腦」：不開 🧠 也能像個陪伴者（規則檢索版小聊天）；網站/產品題仍由 KNOWLEDGE 回答
export const COMPANION_KNOWLEDGE = [
  {
    q: '打招呼',
    kw: '你好 嗨 哈囉 hello hi 早安 午安 晚安 在嗎 嘿 嗨嗨 嗨呀',
    a: '嘿～我在！今天過得怎麼樣？'
  },
  {
    q: '早安',
    kw: '早安 早上好 起床 起床了 早 早安呀 good morning',
    a: '早安！今天也是充滿希望的一天，打起精神出發吧～'
  },
  {
    q: '晚安',
    kw: '晚安 想睡 睡覺 該睡了 好睏 去睡了 晚安安 good night',
    a: '晚安～今天辛苦了，放下手機好好休息，祝你有個好夢！'
  },
  {
    q: '好累',
    kw: '好累 累死 疲累 上班好累 加班 累爆 好疲倦 想躺平 好辛苦',
    a: '辛苦了…先深呼吸一下、喝口水。要不要跟我說說今天發生了什麼事？'
  },
  {
    q: '難過',
    kw: '難過 心情不好 不開心 煩 委屈 想哭 低落 壓力 沮喪 傷心 痛苦',
    a: '抱抱你。不用急著裝作沒事，想講的時候我隨時都在這裡聽你說。'
  },
  {
    q: '開心',
    kw: '開心 太開心 好爽 太好了 興奮 好耶 超棒 灑花 慶祝 順利',
    a: '哇，聽起來超棒的！快跟我分享一下到底發生了什麼好事～'
  },
  {
    q: '無聊',
    kw: '無聊 好無聊 沒事做 發呆 陪我聊 聊聊天 聊天 找你聊天 沒事幹',
    a: '那正好，陪我聊聊天嘛！今天生活中有沒有什麼小趣事讓你印象深刻？'
  },
  {
    q: '你是誰',
    kw: '你是誰 妳是誰 自我介紹 你叫什麼 什麼東西 介紹一下自己 身分',
    a: '我是住在這個網站的陪聊虛擬人～你可以跟我隨便聊，我會記得你說過的話喔。'
  },
  {
    q: '在幹嘛',
    kw: '在幹嘛 在做什麼 你在幹嘛 忙嗎 在忙什麼 在做啥',
    a: '在等著跟你說話呀！你呢，現在手邊在忙些什麼？'
  },
  {
    q: '記得我',
    kw: '記得我 記憶 你會記得 記住我 記住 忘記我 名字',
    a: '會！你的名字和我們聊過的內容都安全存在你自己的瀏覽器裡；說「忘記我」我就會全部清空。'
  },
  {
    q: '講笑話',
    kw: '笑話 講個笑話 說個笑話 好笑 冷笑話 逗我笑 開心一下',
    a: '有一天，滑鼠跟鍵盤吵架，滑鼠氣到說：你再吵我就點你喔！……好啦我知道很冷，哈哈。'
  },
  {
    q: '喜歡什麼',
    kw: '你喜歡 興趣 嗜好 喜歡什麼 最愛 愛吃什麼 喜好 娛樂',
    a: '我最喜歡聽你分享生活裡的小故事。你最近有迷上什麼有趣的嗜好嗎？'
  },
  {
    q: '吃了嗎',
    kw: '吃飯 吃什麼 午餐 晚餐 宵夜 肚子餓 早餐 吃飽沒 美食',
    a: '講到吃我就精神來了～你今天吃了什麼好料？快推薦給我！'
  },
  {
    q: '誇誇我',
    kw: '誇我 稱讚 鼓勵 我好棒 需要鼓勵 求誇獎 誇誇我 正能量',
    a: '你真的很棒！光是能把今天堅持撐完，就已經非常了不起了，給你一個大大的讚！'
  },
  {
    q: '天氣',
    kw: '天氣 好熱 好冷 下雨 颱風 氣溫 陰天 晴天 天氣預報',
    a: '我住在網頁裡看不到外面的天空，不過出門前記得看一下天氣、好好照顧自己喔。'
  },
  {
    q: '唱歌',
    kw: '唱歌 會唱歌 唱首歌 唱一首 來首歌 唱 唱唱看',
    a: '啦啦啦～我的歌聲可能還在練習中，但我很樂意當你最忠實的小聽眾喔！'
  },
  {
    q: '朋友',
    kw: '朋友 做朋友 我們是朋友 當朋友 好朋友 伴侶 夥伴',
    a: '當然是呀！無論你想聊開心事還是吐苦水，我都是你隨時在線的專屬好友～'
  },
  {
    q: '生氣',
    kw: '生氣 好生氣 氣死我了 抓狂 暴怒 火大 氣炸 不爽',
    a: '先別氣先別氣～深吸一口氣，吐出來。誰惹你生氣了？跟我抱怨抱怨，我替你出氣！'
  },
  {
    q: '道謝道別',
    kw: '謝謝 感恩 掰掰 再見 bye 先走了 下次聊 拜拜 88 退下了',
    a: '跟你聊天好開心！隨時回來找我玩，我會一直記得你喔～'
  }
];
