export const STATE_MAP = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
};

export const AVATAR_MODE_MAP = {
  companion: 'companion',
  assistant: 'assistant'
};

export const DEFAULT_AVATAR_MODE = AVATAR_MODE_MAP.assistant;

export const DEFAULT_LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const DEFAULT_AI_PROVIDER_MODEL = 'qwen2.5:latest';

export const EMO_TARGET_MAP = {
  happy: 0.65,
  surprised: 0.6,
  sad: 0.5
};

export const ENGINE_MODE_MAP = {
  twoDimensional: '2d',
  threeDimensional: '3d'
};

export const DEFALUT_START_MODE = ENGINE_MODE_MAP.twoDimensional;

export const FIT_MODE_MAP = {
  HALF: 'half',
  FULL: 'full'
};

export const DEFAULT_FIT_MODE = FIT_MODE_MAP.HALF;

export const GENDER_MAP = {
  female: 'female',
  male: 'male'
};

export const DEFAULT_GENDER = GENDER_MAP.female;

export const DEFAULT_FEMALE_MODEL_URL =
  '/avatar-skin/2d-model/female/haru_greeter_t03.model3.json';
export const DEFAULT_MALE_MODEL_URL =
  '/avatar-skin/2d-model/male/natori_pro_t06.model3.json';
export const DEFAULT_MODEL_URL =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_MODEL_URL
    : DEFAULT_MALE_MODEL_URL;

export const DEFAULT_TTS_ENDPOINT = 'api/tts';
export const DEFAULT_FEMALE_NEURAL_VOICE = 'zh-TW-HsiaoChenNeural'; // 微軟神經語音「曉臻」
export const DEFAULT_MALE_NEURAL_VOICE = 'zh-TW-YunJheNeural'; // 微軟神經語音「雲哲」

export const DEFAULT_NEURAL_VOICE =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;
