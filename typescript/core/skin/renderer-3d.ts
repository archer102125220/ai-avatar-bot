import {
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  DEFAULT_VRMA_ROOT_PATH,
  DEFAULT_3D_HALF_CAMERA_FOV,
  DEFAULT_3D_FULL_CAMERA_FOV,
  DEFAULT_3D_CAMERA_NEAR,
  DEFAULT_3D_CAMERA_FAR,
  DEFAULT_3D_HALF_CAMERA_POSITION,
  DEFAULT_3D_FULL_CAMERA_POSITION,
  DEFAULT_3D_HALF_CAMERA_LOOK_AT,
  DEFAULT_3D_FULL_CAMERA_LOOK_AT,
  DEFAULT_3D_MODEL_POSITION,
  DEFAULT_3D_MODEL_SCALE,
  DEFAULT_3D_MODEL_ROTATION,
  DEFAULT_3D_POINTER_LOOK,
  DEFAULT_3D_CROSSFADE_DURATION,
  DEFAULT_3D_IDLE_VARIANT_INTERVAL,
  DEFAULT_3D_GESTURE_MAP,
  DEFAULT_3D_EXPRESSION_ALIASES
} from '@/core/constants';
import { createCanvas } from './canvas';
import {
  isRenderer3D,
  GestureNotFoundError,
  type Renderer3D,
  type SkinEngine,
  type VRMSettings,
  Skin3DConfig,
  Skin3DModelConfig,
  SkinEngineState,
  type Skin3DActionOption,
  type SkinCascadeMap
} from './types';
import type { Gender } from '@/core/types';
import {
  resolveAll3DPools,
  resolve3DAction,
  type Resolved3DAction
} from './resolver';
import type * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Filters animation clip tracks, ensuring only quaternion tracks are retained,
 * and optionally stripping head and neck rotation tracks to decouple cursor lookAt/head tracking.
 *
 * @param clip - THREE.AnimationClip to filter.
 * @param options - Filtering configuration.
 * @returns The filtered THREE.AnimationClip.
 */
function filterClipTracks(
  clip: THREE.AnimationClip,
  options?: { stripLookAtTracks?: boolean }
): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter((track: THREE.KeyframeTrack) => {
    if (!/\.quaternion$/.test(track.name)) {
      return false;
    }
    if (options?.stripLookAtTracks === true) {
      if (
        /(?:^|[._])(?:head|neck)(?:[._]|\.quaternion$)/i.test(track.name) ||
        /(?:^|\.)(?:head|neck)\.quaternion$/i.test(track.name)
      ) {
        return false;
      }
    }
    return true;
  });
  return clip;
}

/**
 * Helper to look up a string value from a dictionary map ignoring case.
 */
function findInMap(
  map: Record<string, string | unknown> | undefined,
  key: string
): string | undefined {
  if (
    typeof map !== 'object' ||
    map === null ||
    typeof key !== 'string' ||
    key === ''
  ) {
    return undefined;
  }
  if (typeof map[key] === 'string' && map[key] !== '') {
    return map[key];
  }
  const lowerKey = key.toLowerCase();
  if (typeof map[lowerKey] === 'string' && map[lowerKey] !== '') {
    return map[lowerKey];
  }
  const matchedKey = Object.keys(map).find(
    (mapKey) => mapKey.toLowerCase() === lowerKey
  );
  if (
    matchedKey !== undefined &&
    typeof map[matchedKey] === 'string' &&
    map[matchedKey] !== ''
  ) {
    return map[matchedKey];
  }
  return undefined;
}

/**
 * Applies source coordinates onto a Vector3 target object.
 *
 * @param target - Target Vector3 object.
 * @param source - Source coordinates (array or object).
 * @param defaultValues - Default coordinate values.
 */
function applyVector3(
  target: { set: (x: number, y: number, z: number) => void },
  source: number[] | { x?: number; y?: number; z?: number } | null | undefined,
  defaultValues: { x: number; y: number; z: number }
): void {
  if (Array.isArray(source) === true) {
    target.set(
      typeof source[0] === 'number' ? source[0] : defaultValues.x,
      typeof source[1] === 'number' ? source[1] : defaultValues.y,
      typeof source[2] === 'number' ? source[2] : defaultValues.z
    );
  } else if (typeof source === 'object' && source !== null) {
    target.set(
      typeof source.x === 'number' ? source.x : defaultValues.x,
      typeof source.y === 'number' ? source.y : defaultValues.y,
      typeof source.z === 'number' ? source.z : defaultValues.z
    );
  } else {
    target.set(defaultValues.x, defaultValues.y, defaultValues.z);
  }
}

/**
 * Applies source scale onto a Vector3 target object.
 *
 * @param target - Target Vector3 object.
 * @param source - Source scale (scalar number, array, or object).
 * @param defaultValues - Default scale values.
 */
function applyScale(
  target: { set: (x: number, y: number, z: number) => void },
  source:
    | number
    | number[]
    | { x?: number; y?: number; z?: number }
    | null
    | undefined,
  defaultValues: { x: number; y: number; z: number }
): void {
  if (typeof source === 'number' && Number.isFinite(source)) {
    target.set(source, source, source);
  } else if (Array.isArray(source) === true) {
    target.set(
      typeof source[0] === 'number' ? source[0] : defaultValues.x,
      typeof source[1] === 'number' ? source[1] : defaultValues.y,
      typeof source[2] === 'number' ? source[2] : defaultValues.z
    );
  } else if (typeof source === 'object' && source !== null) {
    target.set(
      typeof source.x === 'number' ? source.x : defaultValues.x,
      typeof source.y === 'number' ? source.y : defaultValues.y,
      typeof source.z === 'number' ? source.z : defaultValues.z
    );
  } else {
    target.set(defaultValues.x, defaultValues.y, defaultValues.z);
  }
}

/**
 * Executes the default 3D body gesture animation.
 *
 * @param skinEngine - Skin engine instance.
 * @param emotionName - Name of the gesture animation to play (e.g., 'goodbye', 'bow', 'thinking', 'surprised').
 */
export async function defaultGesture3D(
  skinEngine: SkinEngine | null = null,
  emotionName?: string
): Promise<void> {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }
  if (typeof emotionName !== 'string' || emotionName === '') {
    return;
  }

  // Play 3D body gesture (VRMA animation)
  const renderer = skinEngine.renderer;
  if (isRenderer3D(renderer) && typeof renderer.playGesture === 'function') {
    try {
      await renderer.playGesture(emotionName);
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * Initializes and boots the 3D VRM avatar model using Three.js and @pixiv/three-vrm.
 *
 * @param skinEngine - Skin engine instance.
 * @param setting - VRM gesture and behavior configuration object.
 * @returns Initialized 3D renderer instance, or void on error.
 */
export async function bootVRM(
  skinEngine: SkinEngine,
  setting: VRMSettings = {}
): Promise<Renderer3D | void> {
  const stageEl = skinEngine?.stageEl;
  const {
    bow = '',
    goodbye = '',
    thinking = '',
    look = '',
    relax = '',
    surprised = '',
    appearing = '',
    liked = '',
    waiting = '',
    vrmaRootPath = ''
  } = setting;
  try {
    if (stageEl instanceof HTMLElement === false) {
      throw new Error('[aiAvatar bootVRM] stageEl is not an HTMLElement');
    }
    const THREE = await import('three');
    const { GLTFLoader } =
      await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
    const { VRMAnimationLoaderPlugin, createVRMAnimationClip } =
      await import('@pixiv/three-vrm-animation');

    const safeVrmaRootPath =
      typeof vrmaRootPath === 'string' && vrmaRootPath !== ''
        ? vrmaRootPath
        : DEFAULT_VRMA_ROOT_PATH;

    const currentGender: Gender =
      skinEngine.gender === 'female' || skinEngine.gender === 'male'
        ? skinEngine.gender
        : 'common';

    const defaultCrossfadeDuration =
      typeof setting.crossfadeDuration === 'number' &&
      Number.isFinite(setting.crossfadeDuration)
        ? setting.crossfadeDuration
        : typeof skinEngine?.skin3d?.crossfadeDuration === 'number' &&
            Number.isFinite(skinEngine.skin3d.crossfadeDuration)
          ? skinEngine.skin3d.crossfadeDuration
          : DEFAULT_3D_CROSSFADE_DURATION;

    const rawCustomGestures: Record<string, unknown> = {
      ...(typeof skinEngine?.skin3d?.gestures === 'object' &&
      skinEngine.skin3d.gestures !== null
        ? skinEngine.skin3d.gestures
        : {}),
      ...(typeof setting.gestures === 'object' && setting.gestures !== null
        ? setting.gestures
        : {})
    };
    if (typeof bow === 'string' && bow !== '') rawCustomGestures.bow = bow;
    if (typeof goodbye === 'string' && goodbye !== '')
      rawCustomGestures.goodbye = goodbye;
    if (typeof thinking === 'string' && thinking !== '')
      rawCustomGestures.thinking = thinking;
    if (typeof look === 'string' && look !== '') rawCustomGestures.look = look;
    if (typeof relax === 'string' && relax !== '')
      rawCustomGestures.relax = relax;
    if (typeof surprised === 'string' && surprised !== '')
      rawCustomGestures.surprised = surprised;
    if (typeof appearing === 'string' && appearing !== '')
      rawCustomGestures.appearing = appearing;
    if (typeof liked === 'string' && liked !== '')
      rawCustomGestures.liked = liked;
    if (
      (typeof waiting === 'string' && waiting !== '') ||
      (typeof waiting === 'object' && waiting !== null)
    ) {
      rawCustomGestures.waiting = waiting;
    }

    const pools = resolveAll3DPools(
      {
        ...skinEngine?.skin3d,
        ...setting,
        vrmaRootPath: safeVrmaRootPath,
        gestures:
          rawCustomGestures as SkinCascadeMap<string | Skin3DActionOption>
      },
      currentGender
    );

    function findActionInPools(
      actionName: string
    ): Resolved3DAction | undefined {
      if (typeof actionName !== 'string' || actionName === '') {
        return undefined;
      }
      const lower = actionName.toLowerCase();
      if (pools.greeting?.name?.toLowerCase() === lower) {
        return pools.greeting;
      }
      const inVariants = pools.idleVariants.find(
        (item) => item.name.toLowerCase() === lower
      );
      if (inVariants !== undefined) {
        return inVariants;
      }
      const inTalking = pools.talkingPool.find(
        (item) => item.name.toLowerCase() === lower
      );
      if (inTalking !== undefined) {
        return inTalking;
      }
      const inIdle = pools.idlePool.find(
        (item) => item.name.toLowerCase() === lower
      );
      if (inIdle !== undefined) {
        return inIdle;
      }
      const inTap = pools.tapGestures.find(
        (item) => item.name.toLowerCase() === lower
      );
      if (inTap !== undefined) {
        return inTap;
      }
      return undefined;
    }

    const userCustomGestures: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawCustomGestures)) {
      if (typeof value === 'string' && value !== '') {
        userCustomGestures[key] = value;
      } else if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { url?: string }).url === 'string'
      ) {
        userCustomGestures[key] = (value as { url: string }).url;
      }
    }

    const waitingUrl =
      typeof waiting === 'string' && waiting !== ''
        ? waiting
        : typeof waiting === 'object' && waiting !== null
          ? (skinEngine.gender === 'female' ? waiting.female : waiting.male) ||
            safeVrmaRootPath + 'common/waiting.vrma'
          : safeVrmaRootPath + 'common/waiting.vrma';

    const GESTURES: Record<string, string> = {
      goodbye: goodbye || safeVrmaRootPath + 'common/goodbye.vrma', // 雙手向斜前方伸直並揮動，接近道別的動作
      bow: bow || safeVrmaRootPath + 'common/bow.vrma', // 彎腰90度的鞠躬
      thinking: thinking || safeVrmaRootPath + 'common/thinking.vrma', // 單手托下巴，另一隻手叉腰，類似思考的動作
      look: look || safeVrmaRootPath + 'common/look-around.vrma', // 左右環顧
      'look-around': look || safeVrmaRootPath + 'common/look-around.vrma', // 左右環顧 (kebab-case)
      relax: relax || safeVrmaRootPath + 'common/relax.vrma', // 雙手往外伸展的伸懶腰姿勢
      surprised: surprised || safeVrmaRootPath + 'common/surprised.vrma', // 雙手往臉的旁邊靠，擺出驚訝的動作
      appearing: appearing || safeVrmaRootPath + 'common/appearing.vrma', // 走路後轉身面向到鏡頭
      liked: liked || safeVrmaRootPath + 'common/liked.vrma', // 單手握拳的類似表達「太好了」的動作
      waiting: waitingUrl, // 環顧四周，然後單手用手背做出類似擦嘴的動作
      'idle-1': safeVrmaRootPath + 'common/idle-1.vrma', // 自動調整站姿，頭往斜上放看，並保持呼吸起伏的動作
      'idle-2': safeVrmaRootPath + 'common/idle-2.vrma', // 頭往斜前方看，並保持呼吸起伏的動作
      'idle-female-1': safeVrmaRootPath + 'female/idle-female-1.vrma', // 右手抬起，並作出檢視自己指甲的動作
      'idle-female-2': safeVrmaRootPath + 'female/idle-female-2.vrma', // 雙手在臀部後方交叉，雙腳交替輕微往前踢
      'idle-male-1': safeVrmaRootPath + 'male/idle-male-1.vrma', // 舒展左手臂的動作
      'idle-male-2': safeVrmaRootPath + 'male/idle-male-2.vrma', // 左右舒展脖子的動作
      salute: safeVrmaRootPath + 'male/salute.vrma', // 將右手舉起與頭部齊高，手掌張開呈現敬禮的姿勢後帥氣揮下
      'standing-greeting': safeVrmaRootPath + 'female/standing-greeting.vrma', // 單手舉起左右揮動打招呼
      'talking-1': safeVrmaRootPath + 'common/talking/talking-1.vrma', // 頭部輕微點一次頭
      'talking-2': safeVrmaRootPath + 'common/talking/talking-2.vrma', // 頭往前看微點頭四次
      'talking-3': safeVrmaRootPath + 'common/talking/talking-3.vrma', // 單手向前晃傾斜點頭
      'talking-4': safeVrmaRootPath + 'common/talking/talking-4.vrma', // 頭部傾斜後回正微點頭兩次
      thankful: safeVrmaRootPath + 'common/thankful.vrma', // 單手放胸，微點頭表示感謝
      // Legacy alias keys backwards compatibility
      idle_v01: safeVrmaRootPath + 'common/idle-1.vrma',
      idle_v02: safeVrmaRootPath + 'common/idle-2.vrma',
      idleFemale1: safeVrmaRootPath + 'female/idle-female-1.vrma',
      idleFemale2: safeVrmaRootPath + 'female/idle-female-2.vrma',
      idleMale1: safeVrmaRootPath + 'male/idle-male-1.vrma',
      idleMale2: safeVrmaRootPath + 'male/idle-male-2.vrma',
      standingGreeting: safeVrmaRootPath + 'female/standing-greeting.vrma',
      talking_v01: safeVrmaRootPath + 'common/talking/talking-1.vrma',
      talking_v02: safeVrmaRootPath + 'common/talking/talking-2.vrma',
      talking_v03: safeVrmaRootPath + 'common/talking/talking-3.vrma',
      talking_v04: safeVrmaRootPath + 'common/talking/talking-4.vrma',
      ...userCustomGestures
    };
    const TAP_GESTURES: string[] = pools.tapGestures.map((item) =>
      typeof item === 'string' ? item : item.name
    );

    const canvas = createCanvas(skinEngine);
    const webGLRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    webGLRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    webGLRenderer.setClearColor(0x000000, 0);

    const initialFitMode =
      typeof skinEngine?.getState === 'function'
        ? skinEngine.getState()?.fitMode ||
          skinEngine.fitMode ||
          DEFAULT_FIT_MODE
        : DEFAULT_FIT_MODE;
    const initialSkin3d: Skin3DConfig =
      typeof skinEngine?.getState === 'function'
        ? skinEngine.getState()?.skin3d || {}
        : {};

    const isInitialHalf = initialFitMode === FIT_MODE_MAP.HALF;
    const initialModeConfig = isInitialHalf
      ? initialSkin3d.half
      : initialSkin3d.full;
    const initialDefaultFov = isInitialHalf
      ? DEFAULT_3D_HALF_CAMERA_FOV
      : DEFAULT_3D_FULL_CAMERA_FOV;
    const initialDefaultPos = isInitialHalf
      ? DEFAULT_3D_HALF_CAMERA_POSITION
      : DEFAULT_3D_FULL_CAMERA_POSITION;
    const initialDefaultLookAt = isInitialHalf
      ? DEFAULT_3D_HALF_CAMERA_LOOK_AT
      : DEFAULT_3D_FULL_CAMERA_LOOK_AT;

    const cameraConfig =
      initialModeConfig?.camera || initialSkin3d.camera || {};
    const fov =
      typeof cameraConfig.fov === 'number' && Number.isFinite(cameraConfig.fov)
        ? cameraConfig.fov
        : initialDefaultFov;
    const near =
      typeof cameraConfig.near === 'number' &&
      Number.isFinite(cameraConfig.near)
        ? cameraConfig.near
        : DEFAULT_3D_CAMERA_NEAR;
    const far =
      typeof cameraConfig.far === 'number' && Number.isFinite(cameraConfig.far)
        ? cameraConfig.far
        : DEFAULT_3D_CAMERA_FAR;

    const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
    applyVector3(camera.position, cameraConfig.position, initialDefaultPos);
    const currentLookAt = new THREE.Vector3();
    applyVector3(currentLookAt, cameraConfig.lookAt, initialDefaultLookAt);
    camera.lookAt(currentLookAt);

    const resize = (): void => {
      const stageElClientWidth = stageEl.clientWidth;
      const stageElClientHeight = stageEl.clientHeight;
      webGLRenderer.setSize(stageElClientWidth, stageElClientHeight, false);
      camera.aspect = stageElClientWidth / stageElClientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xfff0e8, Math.PI * 0.2);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.38));
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget);
    let cursorX = 0;
    let cursorY = 0;
    const onMove = (event: PointerEvent): void => {
      const stageElClientRect = stageEl.getBoundingClientRect();
      if (stageElClientRect.width === 0 || stageElClientRect.height === 0) {
        return;
      }
      const centerX = stageElClientRect.left + stageElClientRect.width / 2;
      const centerY = stageElClientRect.top + stageElClientRect.height / 2;
      const halfWidth = Math.max(
        window.innerWidth / 2,
        stageElClientRect.width / 2
      );
      const halfHeight = Math.max(
        window.innerHeight / 2,
        stageElClientRect.height / 2
      );
      cursorX = Math.max(
        -1,
        Math.min(1, (event.clientX - centerX) / halfWidth)
      );
      cursorY = Math.max(
        -1,
        Math.min(1, (event.clientY - centerY) / halfHeight)
      );
    };
    window.addEventListener('pointermove', onMove);

    let nextBlink = 2 + Math.random() * 3;
    let blinkTime = -1;
    let mixer: THREE.AnimationMixer | null = null;
    let baseIdleAction: THREE.AnimationAction | null = null;
    let currentAction: THREE.AnimationAction | null = null;
    let isGestureSuspendedPointerLook = false;
    let waving = false;
    const BLINK = 0.12;
    const gestureActions: Record<string, THREE.AnimationAction | null> = {};
    let currentGesture: THREE.AnimationAction | null = null;
    let currentGestureName: string | null = null;
    let alive = true;
    let paused = false;
    let renderRaf = 0;
    let lastMouthValue = 0;
    let isComputingMouth = false;
    let idleVariantTimeout: ReturnType<typeof setTimeout> | number = 0;
    let greetingTimeout: ReturnType<typeof setTimeout> | number = 0;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    const gltf: GLTF = await new Promise<GLTF>((resolve, reject) =>
      loader.load(
        skinEngine.vrmUrl,
        (loadedGltf) => {
          resolve(loadedGltf);
        },
        undefined,
        (error) => {
          reject(error);
        }
      )
    ).catch((error: unknown) => {
      console.error(error);
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      if (typeof skinEngine.VRMFileChangeFail === 'function') {
        skinEngine.VRMFileChangeFail(normalizedError);
      }
      throw normalizedError;
    });

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);

    let vrm: VRM | null = gltf.userData.vrm as VRM;

    VRMUtils.combineMorphs(vrm);
    VRMUtils.rotateVRM0(vrm);

    const armSign = String(vrm.meta && vrm.meta.metaVersion) === '1' ? -1 : 1;
    vrm.scene.traverse((sceneObject: THREE.Object3D) => {
      sceneObject.frustumCulled = false;
    });
    scene.add(vrm.scene);

    function applyModelTransform(
      modelConfig: Partial<Skin3DModelConfig> = {}
    ): void {
      if (
        vrm === null ||
        typeof vrm !== 'object' ||
        vrm.scene === null ||
        typeof vrm.scene !== 'object'
      ) {
        return;
      }
      applyVector3(
        vrm.scene.position,
        modelConfig.position,
        DEFAULT_3D_MODEL_POSITION
      );
      applyScale(vrm.scene.scale, modelConfig.scale, DEFAULT_3D_MODEL_SCALE);
      if (
        Array.isArray(modelConfig.rotation) === true &&
        modelConfig.rotation.length >= 3
      ) {
        vrm.scene.rotation.set(
          typeof modelConfig.rotation[0] === 'number'
            ? modelConfig.rotation[0]
            : DEFAULT_3D_MODEL_ROTATION.x,
          typeof modelConfig.rotation[1] === 'number'
            ? modelConfig.rotation[1]
            : DEFAULT_3D_MODEL_ROTATION.y,
          typeof modelConfig.rotation[2] === 'number'
            ? modelConfig.rotation[2]
            : DEFAULT_3D_MODEL_ROTATION.z
        );
      } else if (
        typeof modelConfig.rotation === 'object' &&
        modelConfig.rotation !== null &&
        'x' in modelConfig.rotation
      ) {
        vrm.scene.rotation.set(
          typeof modelConfig.rotation.x === 'number'
            ? modelConfig.rotation.x
            : DEFAULT_3D_MODEL_ROTATION.x,
          typeof modelConfig.rotation.y === 'number'
            ? modelConfig.rotation.y
            : DEFAULT_3D_MODEL_ROTATION.y,
          typeof modelConfig.rotation.z === 'number'
            ? modelConfig.rotation.z
            : DEFAULT_3D_MODEL_ROTATION.z
        );
      } else {
        vrm.scene.rotation.set(
          DEFAULT_3D_MODEL_ROTATION.x,
          DEFAULT_3D_MODEL_ROTATION.y,
          DEFAULT_3D_MODEL_ROTATION.z
        );
      }
    }

    function applySkin3dConfig(
      skin3d: Skin3DConfig = {},
      currentFitMode: string = DEFAULT_FIT_MODE
    ): void {
      const isHalf = currentFitMode === FIT_MODE_MAP.HALF;
      const modeConfig = isHalf ? skin3d.half : skin3d.full;
      const defaultCameraFov = isHalf
        ? DEFAULT_3D_HALF_CAMERA_FOV
        : DEFAULT_3D_FULL_CAMERA_FOV;
      const defaultCameraPos = isHalf
        ? DEFAULT_3D_HALF_CAMERA_POSITION
        : DEFAULT_3D_FULL_CAMERA_POSITION;
      const defaultCameraLookAt = isHalf
        ? DEFAULT_3D_HALF_CAMERA_LOOK_AT
        : DEFAULT_3D_FULL_CAMERA_LOOK_AT;

      const modelConfig = modeConfig?.model || skin3d.model || {};

      let needMatrixUpdate = false;
      const calculatedFov =
        typeof modeConfig?.camera?.fov === 'number' &&
        Number.isFinite(modeConfig.camera.fov)
          ? modeConfig.camera.fov
          : typeof skin3d.camera?.fov === 'number' &&
              Number.isFinite(skin3d.camera.fov)
            ? skin3d.camera.fov
            : defaultCameraFov;

      if (camera.fov !== calculatedFov) {
        camera.fov = calculatedFov;
        needMatrixUpdate = true;
      }

      const calculatedNear =
        typeof modeConfig?.camera?.near === 'number' &&
        Number.isFinite(modeConfig.camera.near)
          ? modeConfig.camera.near
          : typeof skin3d.camera?.near === 'number' &&
              Number.isFinite(skin3d.camera.near)
            ? skin3d.camera.near
            : DEFAULT_3D_CAMERA_NEAR;

      if (camera.near !== calculatedNear) {
        camera.near = calculatedNear;
        needMatrixUpdate = true;
      }

      const calculatedFar =
        typeof modeConfig?.camera?.far === 'number' &&
        Number.isFinite(modeConfig.camera.far)
          ? modeConfig.camera.far
          : typeof skin3d.camera?.far === 'number' &&
              Number.isFinite(skin3d.camera.far)
            ? skin3d.camera.far
            : DEFAULT_3D_CAMERA_FAR;

      if (camera.far !== calculatedFar) {
        camera.far = calculatedFar;
        needMatrixUpdate = true;
      }

      if (needMatrixUpdate === true) {
        camera.updateProjectionMatrix();
      }

      const posSource = modeConfig?.camera?.position ?? skin3d.camera?.position;
      applyVector3(camera.position, posSource, defaultCameraPos);

      const lookAtSource = modeConfig?.camera?.lookAt ?? skin3d.camera?.lookAt;
      applyVector3(currentLookAt, lookAtSource, defaultCameraLookAt);
      camera.lookAt(currentLookAt);

      applyModelTransform(modelConfig);
    }

    applySkin3dConfig(initialSkin3d, initialFitMode);

    let unsubscribeSkin3d: (() => void) | null = null;
    let unsubscribeFitMode: (() => void) | null = null;
    let unsubscribeSpeaking: (() => void) | null = null;
    if (typeof skinEngine.subscribe === 'function') {
      unsubscribeSkin3d = skinEngine.subscribe(
        (state: SkinEngineState) => state.skin3d,
        (currentSkin3d: Skin3DConfig) => {
          const currentFitMode =
            skinEngine.getState().fitMode || DEFAULT_FIT_MODE;
          applySkin3dConfig(currentSkin3d, currentFitMode);
        }
      );
      unsubscribeFitMode = skinEngine.subscribe(
        (state: SkinEngineState) => state.fitMode,
        (fitMode: string) => {
          const currentSkin3d = skinEngine.getState().skin3d || {};
          applySkin3dConfig(currentSkin3d, fitMode);
        }
      );
      unsubscribeSpeaking = skinEngine.subscribe(
        (state: SkinEngineState) => state.isSpeaking,
        (isSpeaking: boolean) => {
          if (isSpeaking === true) {
            if (waving === false && pools.talkingPool.length > 0) {
              playNextTalkingAction();
            }
          } else {
            const isCurrentTalking =
              currentGestureName !== null &&
              pools.talkingPool.some(
                (item) =>
                  item.name.toLowerCase() ===
                  currentGestureName?.toLowerCase()
              );
            if (isCurrentTalking === true) {
              crossfadeToBaseIdle();
            }
          }
        }
      );
    }

    try {
      if (typeof vrm.lookAt === 'object' && vrm.lookAt !== null) {
        vrm.lookAt.target = lookTarget;
      }
    } catch (_error) {}

    await (async () => {
      try {
        mixer = new THREE.AnimationMixer(vrm.scene);

        // 1. Preload and start base idle animation with decoupled lookAt tracks
        const primaryIdleItem = pools.idlePool[0] ?? {
          name: 'idle-1',
          url: safeVrmaRootPath + 'common/idle-1.vrma',
          pointerLook: true
        };
        try {
          const idleGltf = await loader.loadAsync(primaryIdleItem.url);
          const idleAnimation =
            idleGltf.userData.vrmAnimations &&
            idleGltf.userData.vrmAnimations[0];
          if (idleAnimation !== undefined && idleAnimation !== null) {
            const idleClip = filterClipTracks(
              createVRMAnimationClip(idleAnimation, vrm),
              { stripLookAtTracks: true }
            );
            baseIdleAction = mixer.clipAction(idleClip);
            baseIdleAction.setLoop(THREE.LoopRepeat ?? 2201, Infinity);
            baseIdleAction.play();
            currentAction = baseIdleAction;
          }
        } catch (error: unknown) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          console.warn(
            `Base idle VRMA ${primaryIdleItem.name} load failed:`,
            normalizedError.message
          );
        }

        // 2. Preload full body gesture animations
        for (const [gestureName, gestureFilePath] of Object.entries(GESTURES)) {
          try {
            const gestureGltf = await loader.loadAsync(gestureFilePath);
            const vrmAnimation =
              gestureGltf.userData.vrmAnimations &&
              gestureGltf.userData.vrmAnimations[0];
            if (vrmAnimation === undefined || vrmAnimation === null) {
              continue;
            }
            const poolAction = findActionInPools(gestureName);
            const actionOption =
              poolAction ??
              resolve3DAction(gestureName, {
                gestures:
                  rawCustomGestures as SkinCascadeMap<string | Skin3DActionOption>,
                gender: currentGender,
                vrmaRootPath: safeVrmaRootPath
              });
            const shouldStripLookAt = actionOption?.pointerLook !== false;
            const clipAction = mixer.clipAction(
              filterClipTracks(createVRMAnimationClip(vrmAnimation, vrm), {
                stripLookAtTracks: shouldStripLookAt
              })
            );
            clipAction.setLoop(THREE.LoopOnce, 1);
            clipAction.clampWhenFinished = true;
            gestureActions[gestureName] = clipAction;
          } catch (error: unknown) {
            const normalizedError =
              error instanceof Error ? error : new Error(String(error));
            console.warn(
              'VRMA ' + gestureName + ' load failed:',
              normalizedError.message
            );
          }
        }

        // 3. Listen for animation completion and crossfade back to base idle or next talking motion
        mixer.addEventListener('finished', (event: { action?: unknown }) => {
          if (event.action === currentGesture) {
            isGestureSuspendedPointerLook = false;
            currentGesture = null;
            currentGestureName = null;
            waving = false;

            // If speaking is active, continue cycling talking motions
            if (
              skinEngine.getState()?.isSpeaking === true &&
              pools.talkingPool.length > 0
            ) {
              playNextTalkingAction();
              return;
            }

            crossfadeToBaseIdle();
          }
        });

        // 4. Initial model greeting action
        const greetingItem = pools.greeting;
        const initialGreetingName =
          typeof greetingItem?.name === 'string' && greetingItem.name !== ''
            ? greetingItem.name
            : typeof gestureActions.goodbye !== 'undefined'
              ? 'goodbye'
              : undefined;

        if (
          typeof initialGreetingName === 'string' &&
          initialGreetingName !== ''
        ) {
          greetingTimeout = setTimeout(() => {
            if (alive === true) {
              playGesture(initialGreetingName, greetingItem).catch(() => {});
            }
          }, 800);
        }

        // 5. Schedule occasional idle variants (10~20s dynamic random timer)
        scheduleNextIdleVariant();
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        console.warn(
          'VRMA gesture library load failed:',
          normalizedError.message
        );
      }
    })();

    if (typeof skinEngine.onMounted === 'function') {
      skinEngine.onMounted();
    }

    function getSkin3dConfig(): Skin3DConfig {
      const state =
        typeof skinEngine.getState === 'function'
          ? skinEngine.getState()
          : null;
      return typeof state?.skin3d === 'object' && state.skin3d !== null
        ? state.skin3d
        : typeof skinEngine.skin3d === 'object' && skinEngine.skin3d !== null
          ? skinEngine.skin3d
          : {};
    }

    async function playGesture(
      gestureName: string,
      optionOverride?: Skin3DActionOption
    ): Promise<void> {
      if (typeof gestureName !== 'string' || gestureName === '') {
        throw new GestureNotFoundError(String(gestureName), '3d');
      }

      const skin3d = getSkin3dConfig();

      // 1. VRMA 動作庫匹配 (包含 setting.gestures 與內建動作，大小寫不拘)
      const actionKeys = Object.keys(gestureActions);
      const isCustomGesture =
        typeof rawCustomGestures === 'object' &&
        rawCustomGestures !== null &&
        Object.keys(rawCustomGestures).some(
          (k) => k.toLowerCase() === gestureName.toLowerCase()
        );
      const isDefault3D = Object.keys(DEFAULT_3D_GESTURE_MAP).some(
        (k) => k.toLowerCase() === gestureName.toLowerCase()
      );
      const poolAction = optionOverride ?? findActionInPools(gestureName);
      const isPoolGesture = poolAction !== undefined;
      const matchedActionKey = actionKeys.find(
        (actionKey) => actionKey.toLowerCase() === gestureName.toLowerCase()
      );

      if (
        matchedActionKey !== undefined ||
        isCustomGesture === true ||
        isDefault3D === true ||
        isPoolGesture === true
      ) {
        const resolvedAction =
          poolAction ??
          resolve3DAction(gestureName, {
            gestures:
              rawCustomGestures as SkinCascadeMap<string | Skin3DActionOption>,
            gender: currentGender,
            vrmaRootPath: safeVrmaRootPath
          });

        let targetAction: THREE.AnimationAction | null = null;
        const actionOption: Skin3DActionOption | null = resolvedAction;

        if (
          matchedActionKey !== undefined &&
          gestureActions[matchedActionKey] !== null
        ) {
          targetAction = gestureActions[matchedActionKey];
        } else if (
          resolvedAction !== null &&
          typeof resolvedAction.url === 'string' &&
          resolvedAction.url !== ''
        ) {
          try {
            const loadedGltf = await loader.loadAsync(resolvedAction.url);
            const vrmAnimation =
              loadedGltf.userData.vrmAnimations &&
              loadedGltf.userData.vrmAnimations[0];
            if (
              vrmAnimation !== undefined &&
              vrmAnimation !== null &&
              typeof mixer === 'object' &&
              mixer !== null &&
              typeof vrm === 'object' &&
              vrm !== null
            ) {
              const shouldStripLookAt = resolvedAction?.pointerLook !== false;
              const clipAction = mixer.clipAction(
                filterClipTracks(createVRMAnimationClip(vrmAnimation, vrm), {
                  stripLookAtTracks: shouldStripLookAt
                })
              );
              clipAction.setLoop(THREE.LoopOnce, 1);
              clipAction.clampWhenFinished = true;
              gestureActions[resolvedAction.name] = clipAction;
              targetAction = clipAction;
            }
          } catch (error: unknown) {
            const normalizedError =
              error instanceof Error ? error : new Error(String(error));
            console.warn(
              'VRMA ' + resolvedAction.name + ' lazy load failed:',
              normalizedError.message
            );
          }
        }

      if (targetAction !== null && targetAction !== undefined) {
        const fadeDuration =
          typeof actionOption?.crossfadeDuration === 'number' &&
          Number.isFinite(actionOption.crossfadeDuration)
            ? actionOption.crossfadeDuration
            : defaultCrossfadeDuration;

        if (actionOption?.pointerLook === false) {
          isGestureSuspendedPointerLook = true;
        } else {
          isGestureSuspendedPointerLook = false;
        }

        waving = true;
        currentGesture = targetAction;
        currentGestureName = actionOption?.name ?? gestureName;

        targetAction.reset();
        if (typeof targetAction.setEffectiveTimeScale === 'function') {
          targetAction.setEffectiveTimeScale(1);
        }
        targetAction.setEffectiveWeight(1);
        targetAction.play();

        if (currentAction !== null && currentAction !== targetAction) {
          if (typeof currentAction.crossFadeTo === 'function') {
            currentAction.crossFadeTo(targetAction, fadeDuration, false);
          } else if (typeof currentAction.stop === 'function') {
            currentAction.stop();
          }
        }

        currentAction = targetAction;
        scheduleNextIdleVariant();
        return;
      }
    }

      // 2. 表情 Fallback (Expression Fallback)
      const customExpression = findInMap(skin3d.expressionMap, gestureName);
      const defaultAliases =
        DEFAULT_3D_EXPRESSION_ALIASES[gestureName.toLowerCase()];
      const candidateExpressions: string[] =
        typeof customExpression === 'string' && customExpression !== ''
          ? [customExpression]
          : Array.isArray(defaultAliases)
            ? defaultAliases
            : [];

      if (candidateExpressions.length > 0) {
        const targetExpression = candidateExpressions[0];
        if (typeof skinEngine.emo === 'object' && skinEngine.emo !== null) {
          skinEngine.emo.name = targetExpression;
          skinEngine.emo.target = 1;
        }
        if (
          typeof vrm === 'object' &&
          vrm !== null &&
          typeof vrm.expressionManager === 'object' &&
          vrm.expressionManager !== null &&
          typeof vrm.expressionManager.setValue === 'function'
        ) {
          try {
            vrm.expressionManager.setValue(targetExpression, 1);
            if (typeof vrm.expressionManager.update === 'function') {
              vrm.expressionManager.update();
            }
          } catch (error) {
            console.warn('[AvatarBot] Failed to set VRM expression:', error);
          }
        }
        scheduleNextIdleVariant();
        return;
      }

      // 3. 完全未命中
      throw new GestureNotFoundError(gestureName, '3d');
    }

    function crossfadeToBaseIdle(): void {
      isGestureSuspendedPointerLook = false;
      currentGesture = null;
      currentGestureName = null;
      waving = false;

      if (baseIdleAction !== null && currentAction !== baseIdleAction) {
        baseIdleAction.reset();
        if (typeof baseIdleAction.setEffectiveTimeScale === 'function') {
          baseIdleAction.setEffectiveTimeScale(1);
        }
        baseIdleAction.setEffectiveWeight(1);
        baseIdleAction.play();

        if (typeof currentAction?.crossFadeTo === 'function') {
          currentAction.crossFadeTo(
            baseIdleAction,
            defaultCrossfadeDuration,
            false
          );
        } else if (typeof currentAction?.stop === 'function') {
          currentAction.stop();
        }
        currentAction = baseIdleAction;
      }
    }

    function playNextTalkingAction(): void {
      if (pools.talkingPool.length === 0 || alive !== true || paused === true) {
        return;
      }
      const randomIndex = Math.floor(Math.random() * pools.talkingPool.length);
      const chosenTalking = pools.talkingPool[randomIndex];
      if (typeof chosenTalking?.name === 'string' && chosenTalking.name !== '') {
        playGesture(chosenTalking.name, chosenTalking).catch(() => {});
      }
    }

    function scheduleNextIdleVariant(): void {
      if (idleVariantTimeout !== 0) {
        clearTimeout(idleVariantTimeout);
        idleVariantTimeout = 0;
      }
      if (alive !== true || pools.idleVariants.length === 0) {
        return;
      }

      const [minInterval, maxInterval] = DEFAULT_3D_IDLE_VARIANT_INTERVAL;
      const randomInterval =
        minInterval + Math.random() * (maxInterval - minInterval);

      idleVariantTimeout = setTimeout(() => {
        if (
          alive === true &&
          paused === false &&
          waving === false &&
          skinEngine.getState()?.isSpeaking !== true &&
          pools.idleVariants.length > 0
        ) {
          const randomIndex = Math.floor(
            Math.random() * pools.idleVariants.length
          );
          const chosenVariant = pools.idleVariants[randomIndex];
          if (
            typeof chosenVariant?.name === 'string' &&
            chosenVariant.name !== ''
          ) {
            playGesture(chosenVariant.name, chosenVariant)
              .catch(() => {})
              .finally(() => {
                scheduleNextIdleVariant();
              });
            return;
          }
        }
        scheduleNextIdleVariant();
      }, randomInterval);
    }

    function animationLoop(): void {
      if (alive !== true || paused === true) {
        renderRaf = 0;
        return;
      }
      renderRaf = requestAnimationFrame(animationLoop);

      const delta = clock.getDelta();
      const elapsedTime = clock.elapsedTime;
      if (typeof vrm === 'object' && vrm !== null) {
        if (typeof mixer === 'object' && mixer !== null) {
          mixer.update(delta);
        }
        const expressionManager = vrm.expressionManager;
        if (
          typeof skinEngine.computeMouth === 'function' &&
          isComputingMouth === false
        ) {
          const result = skinEngine.computeMouth(skinEngine);

          if (result instanceof Promise) {
            isComputingMouth = true;
            result
              .then((mouthValue: number | undefined) => {
                if (typeof mouthValue === 'number') {
                  lastMouthValue = mouthValue;
                }
              })
              .catch(() => {})
              .finally(() => {
                isComputingMouth = false;
              });
          } else if (typeof result === 'number') {
            lastMouthValue = result;
          }
        }

        if (
          typeof expressionManager === 'object' &&
          expressionManager !== null
        ) {
          expressionManager.setValue('aa', lastMouthValue);
          if (blinkTime < 0) {
            nextBlink -= delta;
            if (nextBlink <= 0) {
              blinkTime = 0;
              nextBlink = 2 + Math.random() * 4;
            }
          } else {
            blinkTime += delta / BLINK;
            expressionManager.setValue(
              'blink',
              Math.sin(Math.min(blinkTime, 1) * Math.PI)
            );
            if (blinkTime >= 1) {
              blinkTime = -1;
              expressionManager.setValue('blink', 0);
            }
          }

          if (
            skinEngine.emo.target > 0 ||
            skinEngine.emo.weight > 0.005 ||
            (typeof skinEngine.emo.applied === 'string' &&
              skinEngine.emo.applied !== '')
          ) {
            if (
              typeof skinEngine.emo.applied === 'string' &&
              skinEngine.emo.applied !== '' &&
              skinEngine.emo.applied !== skinEngine.emo.name
            ) {
              try {
                expressionManager.setValue(skinEngine.emo.applied, 0);
              } catch (_error) {}
              skinEngine.emo.applied = '';
            }
            skinEngine.emo.weight +=
              (skinEngine.emo.target - skinEngine.emo.weight) *
              Math.min(1, delta * 4);
            if (skinEngine.emo.weight <= 0.005 && skinEngine.emo.target === 0) {
              skinEngine.emo.weight = 0;
              if (
                typeof skinEngine.emo.applied === 'string' &&
                skinEngine.emo.applied !== ''
              ) {
                try {
                  expressionManager.setValue(skinEngine.emo.applied, 0);
                } catch (_error) {}
                skinEngine.emo.applied = '';
              }
            } else if (skinEngine.emo.name !== 'neutral') {
              try {
                const expression = expressionManager.getExpression
                  ? expressionManager.getExpression(skinEngine.emo.name)
                  : null;
                const weight =
                  expression?.overrideMouth &&
                  String(expression.overrideMouth) !== 'none'
                    ? Math.min(skinEngine.emo.weight, 0.4)
                    : skinEngine.emo.weight;
                expressionManager.setValue(skinEngine.emo.name, weight);
                skinEngine.emo.applied = skinEngine.emo.name;
              } catch (_error) {}
            }
          }
        }

        const isPointerLookEnabled =
          typeof skinEngine.getState === 'function'
            ? skinEngine.getState()?.skin3d?.pointerLook !== false
            : DEFAULT_3D_POINTER_LOOK;

        if (
          isPointerLookEnabled === true &&
          isGestureSuspendedPointerLook === false
        ) {
          lookTarget.position.set(cursorX * 0.9, 1.42 - cursorY * 0.55, 1.6);
        } else if (isGestureSuspendedPointerLook === true) {
          lookTarget.position.set(0, 1.42, 1.6);
        }

        if (typeof vrm.humanoid === 'object' && vrm.humanoid !== null) {
          const humanoid = vrm.humanoid;
          const headNode = humanoid.getNormalizedBoneNode('head');

          if (typeof headNode === 'object' && headNode !== null) {
            if (isGestureSuspendedPointerLook === false) {
              let headRotationY =
                isPointerLookEnabled === true
                  ? cursorX * 0.35
                  : Math.sin(elapsedTime * 0.5) * 0.02;
              let headRotationX =
                (isPointerLookEnabled === true ? cursorY * 0.15 : 0) +
                Math.sin(elapsedTime * 0.5) * 0.01;

              if (skinEngine.getState().isSpeaking === true) {
                const speechTime = elapsedTime * 3.0;
                headRotationX += Math.abs(Math.sin(speechTime * 0.9)) * 0.045;
                headRotationY += Math.sin(speechTime * 0.55) * 0.05;
              }

              headNode.rotation.y = headRotationY;
              headNode.rotation.x = headRotationX;
            }
          }

          if (baseIdleAction === null && waving === false) {
            const leftUpperArmNode =
              humanoid.getNormalizedBoneNode('leftUpperArm');
            const rightUpperArmNode =
              humanoid.getNormalizedBoneNode('rightUpperArm');
            const spineNode = humanoid.getNormalizedBoneNode('spine');
            let leftArmRotationZ = 1.15 * armSign;
            let rightArmRotationZ = -1.15 * armSign;
            const spineRotationX = Math.sin(elapsedTime * 0.9) * 0.018;
            let spineRotationY = Math.sin(elapsedTime * 0.5) * 0.012;

            if (skinEngine.getState().isSpeaking === true) {
              const speechTime = elapsedTime * 3.0;
              spineRotationY += Math.sin(speechTime) * 0.03;
              leftArmRotationZ += Math.sin(speechTime * 0.7) * 0.06;
              rightArmRotationZ -= Math.sin(speechTime * 0.62) * 0.06;
            }
            if (
              typeof leftUpperArmNode === 'object' &&
              leftUpperArmNode !== null
            ) {
              leftUpperArmNode.rotation.z = leftArmRotationZ;
            }
            if (
              typeof rightUpperArmNode === 'object' &&
              rightUpperArmNode !== null
            ) {
              rightUpperArmNode.rotation.z = rightArmRotationZ;
            }
            if (typeof spineNode === 'object' && spineNode !== null) {
              spineNode.rotation.x = spineRotationX;
              spineNode.rotation.y = spineRotationY;
            }
          }
        }
        vrm.update(delta);
      }
      webGLRenderer.render(scene, camera);
    }
    renderRaf = requestAnimationFrame(animationLoop);

    return {
      get gltf(): unknown {
        return gltf;
      },
      get vrm(): unknown {
        return vrm;
      },
      get TAP_GESTURES(): string[] {
        const config = getSkin3dConfig();
        if (
          Array.isArray(config.tapGestures) &&
          config.tapGestures.length > 0
        ) {
          return config.tapGestures.map((item) =>
            typeof item === 'string' ? item : item.name
          );
        }
        return TAP_GESTURES;
      },
      get canvas(): HTMLCanvasElement {
        return canvas;
      },
      get camera(): unknown {
        return camera;
      },
      get scene(): unknown {
        return scene;
      },
      get playGesture(): (
        gestureName: string,
        optionOverride?: Skin3DActionOption
      ) => Promise<void> {
        return playGesture;
      },
      setPaused(isPaused: boolean): void {
        paused = Boolean(isPaused);
        if (paused === false && alive === true && renderRaf === 0) {
          clock.getDelta();
          animationLoop();
        }
      },
      updateTransform(config: Partial<Skin3DConfig>): void {
        if (typeof skinEngine.setSkin3d === 'function') {
          skinEngine.setSkin3d(config);
        }
      },
      dispose(): void {
        alive = false;
        if (typeof unsubscribeSkin3d === 'function') {
          unsubscribeSkin3d();
          unsubscribeSkin3d = null;
        }
        if (typeof unsubscribeFitMode === 'function') {
          unsubscribeFitMode();
          unsubscribeFitMode = null;
        }
        if (typeof unsubscribeSpeaking === 'function') {
          unsubscribeSpeaking();
          unsubscribeSpeaking = null;
        }
        if (idleVariantTimeout !== 0) {
          clearTimeout(idleVariantTimeout);
          idleVariantTimeout = 0;
        }
        if (greetingTimeout !== 0) {
          clearTimeout(greetingTimeout);
          greetingTimeout = 0;
        }
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onMove);
        try {
          if (typeof mixer?.stopAllAction === 'function') {
            mixer.stopAllAction();
          }
        } catch (_error) {}
        baseIdleAction = null;
        currentAction = null;
        currentGesture = null;
        currentGestureName = null;
        try {
          if (typeof vrm === 'object' && vrm !== null) {
            VRMUtils.deepDispose(vrm.scene);
          }
        } catch (_error) {}
        try {
          webGLRenderer.dispose();
        } catch (_error) {}
        try {
          webGLRenderer.forceContextLoss();
        } catch (_error) {}
        canvas.remove();
        vrm = null;
      }
    };
  } catch (error: unknown) {
    console.error(error);
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    if (typeof skinEngine?.onThreeDimensionalError === 'function') {
      skinEngine.onThreeDimensionalError(normalizedError, skinEngine);
    }
  }
}

/**
 * Loads a user-provided custom VRM File object and switches engine to 3D mode.
 *
 * @param skinEngine - Skin engine instance.
 * @param vrmFile - Custom VRM file object to load.
 */
export function loadVRMFile(
  skinEngine: SkinEngine | null = null,
  vrmFile?: File
): void {
  if (!skinEngine || skinEngine.stageEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar loadVRMFile] skinEngine.stageEl is not an HTMLElement'
    );
    return;
  }

  if (
    vrmFile instanceof window.File === false ||
    /\.vrm$/i.test(vrmFile?.name || '') === false
  ) {
    if (typeof skinEngine?.VRMFileChangeFail === 'function') {
      skinEngine.VRMFileChangeFail(new Error('請拖一個 .vrm 檔喔'));
    }
    return;
  }
  try {
    if (
      typeof skinEngine.vrmUrl === 'string' &&
      skinEngine.vrmUrl.indexOf('blob:') === 0
    ) {
      URL.revokeObjectURL(skinEngine.vrmUrl);
    }
  } catch (_error) {}
  skinEngine.vrmUrl = URL.createObjectURL(vrmFile);

  if (typeof skinEngine.VRMFileChangeSuccess === 'function') {
    skinEngine.VRMFileChangeSuccess(skinEngine.vrmUrl);
  }
  skinEngine._engineMode = null; // Force reboot even if already in 3D
  skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
}
