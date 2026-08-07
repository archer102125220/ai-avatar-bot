export function setMic(speechEngine, isListening = false) {
  if (typeof speechEngine.onMicStateChanged === 'function') {
    speechEngine.onMicStateChanged(isListening, speechEngine.convoOn);
  }
}

export async function ensureMicMonitor(speechEngine) {
  if (
    typeof speechEngine.micStream === 'object' &&
    speechEngine.micStream !== null
  ) {
    return;
  }
  if (
    typeof navigator.mediaDevices !== 'object' ||
    navigator.mediaDevices === null ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new Error('media-not-supported');
  }

  speechEngine.micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });
  speechEngine.micAudioCtx = new (
    window.AudioContext || window.webkitAudioContext
  )();
  if (speechEngine.micAudioCtx.state === 'suspended') {
    try {
      await speechEngine.micAudioCtx.resume();
    } catch (_e) {}
  }

  speechEngine.micAnalyser = speechEngine.micAudioCtx.createAnalyser();
  speechEngine.micAnalyser.fftSize = 256;
  speechEngine.micAnalyser.smoothingTimeConstant = 0.35;
  speechEngine.micAudioCtx
    .createMediaStreamSource(speechEngine.micStream)
    .connect(speechEngine.micAnalyser);
  speechEngine.micData = new Uint8Array(speechEngine.micAnalyser.fftSize);

  speechEngine.micNoiseFloor = 0;
  speechEngine.voiceFrames = 0;
  speechEngine.lastBargeIn = 0;

  monitorMicLevel(speechEngine);
}

export function monitorMicLevel(speechEngine) {
  if (
    typeof speechEngine.micAnalyser !== 'object' ||
    speechEngine.micAnalyser === null ||
    typeof speechEngine.micData !== 'object' ||
    speechEngine.micData === null
  ) {
    return;
  }
  speechEngine.micAnalyser.getByteTimeDomainData(speechEngine.micData);
  let sum = 0;
  for (let i = 0; i < speechEngine.micData.length; i++) {
    const value = (speechEngine.micData[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / speechEngine.micData.length);

  const isSpeaking = speechEngine.isSpeaking || speechEngine.isSpeechPlaying;
  const isListening = speechEngine.isListening;
  const assistantActive = isSpeaking || speechEngine.isProcessing;

  if (!assistantActive && !isListening) {
    speechEngine.micNoiseFloor = speechEngine.micNoiseFloor * 0.96 + rms * 0.04;
  }

  const showVoiceUI = speechEngine.convoOn || isListening || assistantActive;

  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(
      showVoiceUI,
      undefined,
      isListening ? 'listening' : isSpeaking ? 'speaking' : 'thinking',
      rms * 650
    );
  }

  const threshold = Math.max(0.085, speechEngine.micNoiseFloor * 5.5);
  const speechDuration =
    performance.now() -
    (speechEngine.assistantSpeechStartedAt || performance.now());

  if (
    speechEngine.convoOn === true &&
    assistantActive === true &&
    speechDuration > 550 &&
    rms > threshold
  ) {
    speechEngine.voiceFrames++;
  } else {
    speechEngine.voiceFrames = Math.max(0, (speechEngine.voiceFrames || 0) - 2);
  }

  if (
    speechEngine.voiceFrames >= 9 &&
    performance.now() - speechEngine.lastBargeIn > 1400
  ) {
    interruptForVoice(speechEngine);
  }

  speechEngine.micRaf = requestAnimationFrame(() =>
    monitorMicLevel(speechEngine)
  );
}

export function stopMicMonitor(speechEngine) {
  if (typeof speechEngine.micRaf === 'number' && speechEngine.micRaf > 0) {
    cancelAnimationFrame(speechEngine.micRaf);
  }
  speechEngine.micRaf = 0;

  if (
    typeof speechEngine.micStream === 'object' &&
    speechEngine.micStream !== null
  ) {
    speechEngine.micStream.getTracks().forEach((track) => track.stop());
  }
  speechEngine.micStream = null;
  speechEngine.micAnalyser = null;
  speechEngine.micData = null;

  if (
    typeof speechEngine.micAudioCtx === 'object' &&
    speechEngine.micAudioCtx !== null
  ) {
    try {
      speechEngine.micAudioCtx.close();
    } catch (_e) {}
  }
  speechEngine.micAudioCtx = null;
  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(
      speechEngine.convoOn,
      undefined,
      undefined,
      0
    );
  }
}

export function stopVoiceSession(speechEngine, message) {
  speechEngine.convoOn = false;
  clearTimeout(speechEngine.recognitionSilenceTimer);
  speechEngine.recognitionText = '';
  speechEngine.recognitionSubmitted = true;
  speechEngine.recognitionError = 'aborted';
  try {
    if (typeof speechEngine?.recognition?.abort === 'function') {
      speechEngine.recognition.abort();
    }
  } catch (_error) {}
  speechEngine.recognition = null;
  speechEngine.isListening = false;
  speechEngine.isProcessing = false;
  speechEngine.stopSpeaking();
  setMic(speechEngine, false);
  stopMicMonitor(speechEngine);

  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(false, '', '', 0);
  }
  if (typeof message === 'string' && message !== '') {
    speechEngine.spokenDisplayText = message;
  }
}

export function interruptForVoice(speechEngine) {
  speechEngine.lastBargeIn = performance.now();
  speechEngine.voiceFrames = 0;

  speechEngine.speakSeq++;
  if (typeof speechEngine.brain?.llm?.controller?.abort === 'function') {
    try {
      speechEngine.brain.llm.controller.abort();
    } catch (_error) {}
  }

  speechEngine.stopSpeaking();
  speechEngine.isProcessing = false;

  if (typeof speechEngine.onVoiceStatusChanged === 'function') {
    speechEngine.onVoiceStatusChanged(
      speechEngine.convoOn,
      '已停止回答，請繼續說…',
      'listening',
      0
    );
  }

  setTimeout(() => {
    if (speechEngine.convoOn === true && speechEngine.isListening !== true) {
      startListening(speechEngine);
    }
  }, 100);
}

export async function startListening(speechEngine) {
  const rootContainer = speechEngine.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar startListening] rootContainer is not an HTMLElement'
    );
    return;
  }

  const SafeSpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SafeSpeechRecognition == null) {
    speechEngine.spokenAudioText =
      '你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。';
    speechEngine.convoOn = false;
    return;
  }
  if (
    speechEngine.isListening === true &&
    typeof speechEngine.recognition === 'object' &&
    speechEngine.recognition !== null
  ) {
    speechEngine.recognition.stop();
    return;
  }

  if (
    typeof speechEngine.micStream !== 'object' ||
    speechEngine.micStream === null
  ) {
    setMic(speechEngine, false);
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        true,
        '正在取得麥克風權限…',
        'thinking',
        0
      );
    }
  }
  try {
    await ensureMicMonitor(speechEngine);
    if (
      speechEngine.isSpeechPlaying === true ||
      speechEngine.isProcessing === true
    ) {
      speechEngine.stopSpeaking();
    }
  } catch (e) {
    speechEngine.convoOn = false;
    setMic(speechEngine, false);
    const message = '無法啟動語音功能，請檢查麥克風與瀏覽器設定。';
    speechEngine.spokenAudioText = message;
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(true, message, '', 0);
    }
    console.warn('mic monitor error', e);
    return;
  }

  try {
    speechEngine.recognition = new SafeSpeechRecognition();
  } catch (error) {
    speechEngine.spokenAudioText = '語音辨識啟動失敗：' + error.message;
    speechEngine.convoOn = false;
    return;
  }

  speechEngine.recognitionSilenceTimer = null;
  speechEngine.recognition.lang = 'zh-TW';
  speechEngine.recognition.interimResults = true;
  speechEngine.recognition.continuous = true;
  speechEngine.recognition.maxAlternatives = 1;
  speechEngine.recognition.onstart = () => {
    speechEngine.isListening = true;
    setMic(speechEngine, true);
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        true,
        '請說話，可以隨時插話…',
        'listening',
        0
      );
    }
  };
  speechEngine.recognition.onresult = (event) => {
    let finalText = '',
      interimText = '';
    for (const result of event.results) {
      if (result.isFinal === true) {
        finalText += result[0].transcript + ' ';
      } else {
        interimText += result[0].transcript + ' ';
      }
    }
    const txt = (finalText + interimText).trim();
    if (txt === '') {
      return;
    }

    speechEngine.noSpeechRuns = 0;
    speechEngine.spokenDisplayText =
      '你：' + txt + (interimText !== '' ? '…' : '');
    if (typeof speechEngine.onVoiceStatusChanged === 'function') {
      speechEngine.onVoiceStatusChanged(
        speechEngine.convoOn,
        interimText !== '' ? '正在辨識：' + txt : '收到語音，準備送出…',
        'listening',
        0
      );
    }

    clearTimeout(speechEngine.recognitionSilenceTimer);
    speechEngine.recognitionSilenceTimer = setTimeout(
      () => {
        try {
          if (
            typeof speechEngine.recognition === 'object' &&
            speechEngine.recognition !== null
          ) {
            speechEngine.recognition.stop();
          }
        } catch (_error) {}
      },
      interimText !== '' ? 900 : 420
    );

    const last = event.results[event.results.length - 1];
    if (last.isFinal === true) {
      speechEngine.handleUser(txt);
    }
  };
  speechEngine.recognition.onerror = (event) => {
    speechEngine.isListening = false;
    setMic(speechEngine, false);
    if (event.error === 'not-allowed') {
      speechEngine.convoOn = false;
      speechEngine.spokenDisplayText = '我需要麥克風權限才能聽你說話喔。';
      stopMicMonitor(speechEngine);
      if (typeof speechEngine.onVoiceStatusChanged === 'function') {
        speechEngine.onVoiceStatusChanged(
          speechEngine.convoOn,
          '麥克風權限被拒絕',
          '',
          0
        );
      }
      return;
    }
    if (event.error === 'aborted') {
      return; // 手動中止不需顯示錯誤，保留 stopVoiceSession 寫入的文字
    }
    if (speechEngine.convoOn === true && event.error === 'no-speech') {
      return; // 交給 onend 的續聽邏輯
    }

    speechEngine.spokenDisplayText =
      '沒聽清楚（' + event.error + '），再試一次。';
  };
  speechEngine.recognition.onend = () => {
    speechEngine.isListening = false;
    setMic(speechEngine, false);
    // 連續對話：靜默結束（沒觸發回答）→ 自動再聽；連 3 次沒聲音就休息，避免無限開麥
    if (
      speechEngine.convoOn === true &&
      speechEngine.isProcessing !== true &&
      speechEngine.isSpeaking !== true &&
      speechEngine.isSpeechPlaying !== true
    ) {
      if (++speechEngine.noSpeechRuns >= 3) {
        speechEngine.stopVoiceSession(
          '連續幾次沒有聽到聲音，即時對話已暫停。'
        );
        return;
      }
      setTimeout(() => {
        if (
          speechEngine.convoOn === true &&
          speechEngine.isListening !== true &&
          speechEngine.isSpeaking !== true &&
          speechEngine.isSpeechPlaying !== true &&
          speechEngine.isProcessing !== true
        ) {
          startListening(speechEngine);
        }
      }, 350);
    }
  };
  try {
    speechEngine.recognition.start();
  } catch (_error) {}
}
