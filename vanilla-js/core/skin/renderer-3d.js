import {
  ENGINE_MODE_MAP,
  DEFAULT_VRMA_ROOT_PATH,
  DEFAULT_3D_CAMERA_FOV,
  DEFAULT_3D_CAMERA_NEAR,
  DEFAULT_3D_CAMERA_FAR,
  DEFAULT_3D_CAMERA_POSITION,
  DEFAULT_3D_CAMERA_LOOK_AT,
  DEFAULT_3D_MODEL_POSITION,
  DEFAULT_3D_MODEL_SCALE,
  DEFAULT_3D_MODEL_ROTATION,
  DEFAULT_3D_POINTER_LOOK
} from '../constants';
import { createCanvas } from './canvas';

/**
 * 3D 渲染器實例
 * @typedef {Object} Renderer3D
 * @property {Object} gltf - 載入的 GLTF 物件
 * @property {Object} vrm - 建立的 VRM 模型物件
 * @property {string[]} TAP_GESTURES - 支援的點擊手勢清單
 * @property {HTMLCanvasElement} canvas - 渲染用畫布
 * @property {Object} camera - THREE.PerspectiveCamera 實例
 * @property {Object} scene - THREE.Scene 實例
 * @property {(gestureName: string) => void} playGesture - 播放指定手勢的方法
 * @property {(paused: boolean) => void} setPaused - 暫停或恢復渲染的方法
 * @property {(config: import('./index').Skin3DConfig) => void} updateTransform - 更新 3D 變換設定的方法
 * @property {() => void} dispose - 清除並釋放記憶體的方法
 */

/**
 * 將來源座標套用至 THREE.Vector3 或具有 set 方法的物件中。
 * @param {{set: (x: number, y: number, z: number) => void}} target - 目標 Vector3 物件
 * @param {Array<number>|{x?: number, y?: number, z?: number}|null|undefined} source - 來源座標 (陣列或物件)
 * @param {{x: number, y: number, z: number}} defaultValues - 預設座標
 */
function applyVector3(target, source, defaultValues) {
  if (Array.isArray(source) === true && source.length >= 3) {
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
 * 將來源縮放套用至 THREE.Vector3 物件中。
 * @param {{set: (x: number, y: number, z: number) => void}} target - 目標 Vector3 物件
 * @param {number|Array<number>|{x?: number, y?: number, z?: number}|null|undefined} source - 來源縮放
 * @param {{x: number, y: number, z: number}} defaultValues - 預設縮放
 */
function applyScale(target, source, defaultValues) {
  if (typeof source === 'number' && Number.isFinite(source)) {
    target.set(source, source, source);
  } else if (Array.isArray(source) === true && source.length >= 3) {
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
 * VRM 手勢與行為設定
 * @typedef {Object} VRMSettings
 * @property {import('./index').Skin3DCameraConfig} [camera] - 攝影機設定
 * @property {import('./index').Skin3DModelConfig} [model] - 模型變換設定
 * @property {boolean} [pointerLook] - 是否啟用眼睛跟隨滑鼠游標
 * @property {string} [bow] - 鞠躬動畫 URL
 * @property {string} [wave] - 揮手動畫 URL
 * @property {string} [thinking] - 思考動畫 URL
 * @property {string} [look] - 環顧動畫 URL
 * @property {string} [relax] - 放鬆動畫 URL
 * @property {string} [surprised] - 驚訝動畫 URL
 * @property {string} [vrmaRootPath] - VRMA 動畫根目錄 URL
 */

/**
 * 執行預設的 3D 肢體手勢動作。
 * @param {Object|null} [skinEngine=null] - 引擎實例。
 * @param {string} emotionName - 準備表達的手勢動作名稱（例如：'wave'、'bow'、'thinking'、'surprised'）。
 * @returns {Promise<void>}
 */
export async function defaultGesture3D(skinEngine = null, emotionName) {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }
  if (typeof emotionName !== 'string' || emotionName === '') {
    return;
  }

  // 播放 3D 肢體手勢 (VRMA 動畫)
  if (typeof skinEngine.renderer?.playGesture === 'function') {
    try {
      skinEngine.renderer.playGesture(emotionName);
    } catch (error) {
      console.error(error);
    }
  }
}

// ===== 3D 皮：VRM（three + three-vrm，ESM 動態 import）=====
/**
 * 初始化並啟動 3D VRM 虛擬人物模型。
 * @param {Object} skinEngine - 引擎實例。
 * @param {VRMSettings} [setting={}] - VRM 手勢與行為的設定物件。
 * @returns {Promise<Renderer3D|void>} 初始化後的 3D 渲染器實例，發生錯誤時則為 void。
 */
export async function bootVRM(skinEngine, setting = {}) {
  const stageEl = skinEngine?.stageEl;
  const {
    bow = '',
    wave = '',
    thinking = '',
    look = '',
    relax = '',
    surprised = '',
    vrmaRootPath = ''
  } = setting;
  try {
    if (stageEl instanceof HTMLElement === false) {
      throw new Error('[aiAvatar bootVRM] stageEl is not an HTMLElement');
    }
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
    const { VRMAnimationLoaderPlugin, createVRMAnimationClip } =
      await import('@pixiv/three-vrm-animation');
    // const vrmaRootPath = 'https://cdn.jsdelivr.net/gh/tk256ailab/vrm-viewer@main/VRMA/';
    const safeVrmaRootPath =
      typeof vrmaRootPath === 'string' && vrmaRootPath !== ''
        ? vrmaRootPath
        : DEFAULT_VRMA_ROOT_PATH;

    const GESTURES = {
      // 情境手勢 + 待機變化（body-only，不碰嘴）`
      wave: wave || safeVrmaRootPath + 'Goodbye.vrma',
      // bow:
      //   bow ||
      //   'https://cdn.jsdelivr.net/gh/hirokazuniimoto/virtual-avatar-sdk@main/assets/animations/quick_formal_bow.vrma',
      bow: bow || safeVrmaRootPath + 'quick_formal_bow.vrma',
      thinking: thinking || safeVrmaRootPath + 'Thinking.vrma',
      look: look || safeVrmaRootPath + 'LookAround.vrma',
      relax: relax || safeVrmaRootPath + 'Relax.vrma',
      surprised: surprised || safeVrmaRootPath + 'Surprised.vrma' // ①情緒用：驚訝的小反應（不在點擊問候清單裡）
    };
    const TAP_GESTURES = ['wave', 'bow']; // 點一下隨機：揮手/鞠躬問候（歡迎感）

    const canvas = createCanvas(skinEngine);
    const webGLRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    webGLRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    webGLRenderer.setClearColor(0x000000, 0);

    const initialSkin3d =
      typeof skinEngine?.getState === 'function'
        ? skinEngine.getState()?.skin3d || {}
        : {};
    const cameraConfig = initialSkin3d.camera || {};
    const fov =
      typeof cameraConfig.fov === 'number' && Number.isFinite(cameraConfig.fov)
        ? cameraConfig.fov
        : DEFAULT_3D_CAMERA_FOV;
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
    applyVector3(
      camera.position,
      cameraConfig.position,
      DEFAULT_3D_CAMERA_POSITION
    );
    const currentLookAt = new THREE.Vector3();
    applyVector3(currentLookAt, cameraConfig.lookAt, DEFAULT_3D_CAMERA_LOOK_AT);
    camera.lookAt(currentLookAt);

    const resize = () => {
      const stageElClientWidth = stageEl.clientWidth;
      const stageElClientHeight = stageEl.clientHeight;
      webGLRenderer.setSize(stageElClientWidth, stageElClientHeight, false);
      camera.aspect = stageElClientWidth / stageElClientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const scene = new THREE.Scene();
    // 調暗：原本 key=π / fill=π*0.35 / ambient=0.6 太亮（MToon 易過曝），整體降約 4 成
    const key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xfff0e8, Math.PI * 0.2);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.38));
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget); // lookAt 目標：跟著滑鼠
    let cursorX = 0;
    let cursorY = 0; // 游標相對位置 -1..1
    const onMove = (event) => {
      const stageElClientRect = stageEl.getBoundingClientRect();
      if (stageElClientRect.width === 0) {
        return;
      }
      cursorX = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientX - stageElClientRect.left) / stageElClientRect.width) *
            2 -
            1
        )
      );
      cursorY = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientY - stageElClientRect.top) / stageElClientRect.height) *
            2 -
            1
        )
      );
    };
    stageEl.addEventListener('pointermove', onMove);

    let nextBlink = 2 + Math.random() * 3;
    let blinkTime = -1;
    let mixer = null;
    let waving = false;
    const BLINK = 0.12;
    const gestureActions = {};
    let currentGesture = null;
    let idleBreak = 0;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser)); // 同一個 loader 也能讀 .vrma
    const gltf = await new Promise((resolve, reject) =>
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
    ).catch((error) => {
      console.error(error);
      if (typeof skinEngine.VRMFileChangeFail === 'function') {
        skinEngine.VRMFileChangeFail(error);
      }
    });

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);

    let vrm = gltf.userData.vrm;

    VRMUtils.combineMorphs(vrm);
    VRMUtils.rotateVRM0(vrm); // VRM0.x 轉正；VRM1 為安全 no-op

    // VRM0 被 rotateVRM0 轉 180°，手臂 z 旋轉方向會相反；VRM1 不轉 → 用版本決定正負號
    const armSign = String(vrm.meta && vrm.meta.metaVersion) === '1' ? -1 : 1;
    vrm.scene.traverse((sceneObject) => {
      sceneObject.frustumCulled = false;
    });
    scene.add(vrm.scene);

    function applyModelTransform(modelConfig = {}) {
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
        modelConfig.rotation !== null
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

    applyModelTransform(initialSkin3d.model || {});

    function applySkin3dConfig(skin3d = {}) {
      if (typeof skin3d.camera === 'object' && skin3d.camera !== null) {
        let needMatrixUpdate = false;
        if (
          typeof skin3d.camera.fov === 'number' &&
          Number.isFinite(skin3d.camera.fov)
        ) {
          camera.fov = skin3d.camera.fov;
          needMatrixUpdate = true;
        }
        if (
          typeof skin3d.camera.near === 'number' &&
          Number.isFinite(skin3d.camera.near)
        ) {
          camera.near = skin3d.camera.near;
          needMatrixUpdate = true;
        }
        if (
          typeof skin3d.camera.far === 'number' &&
          Number.isFinite(skin3d.camera.far)
        ) {
          camera.far = skin3d.camera.far;
          needMatrixUpdate = true;
        }
        if (needMatrixUpdate === true) {
          camera.updateProjectionMatrix();
        }
        if (skin3d.camera.position !== undefined) {
          applyVector3(
            camera.position,
            skin3d.camera.position,
            DEFAULT_3D_CAMERA_POSITION
          );
        }
        if (skin3d.camera.lookAt !== undefined) {
          applyVector3(
            currentLookAt,
            skin3d.camera.lookAt,
            DEFAULT_3D_CAMERA_LOOK_AT
          );
          camera.lookAt(currentLookAt);
        }
      }
      if (typeof skin3d.model === 'object' && skin3d.model !== null) {
        applyModelTransform(skin3d.model);
      }
    }

    let unsubscribeSkin3d = null;
    if (typeof skinEngine.subscribe === 'function') {
      unsubscribeSkin3d = skinEngine.subscribe(
        (state) => state.skin3d,
        (skin3d) => {
          applySkin3dConfig(skin3d);
        }
      );
    }

    try {
      if (typeof vrm.lookAt === 'object' && vrm.lookAt !== null) {
        vrm.lookAt.target = lookTarget;
      }
    } catch (_error) {} // 眼睛跟著滑鼠

    // VRMA 情境手勢庫（body-only，不碰嘴）：點擊/出場揮手、思考托腮、待機變化(環顧/放鬆)
    await (async () => {
      /**
       * 過濾動畫軌道，僅保留骨架旋轉 (quaternion)，過濾掉位移與表情軌道，避免與程序化動畫衝突。
       * @param {THREE.AnimationClip} clip - 原始的 AnimationClip。
       * @returns {THREE.AnimationClip} 過濾後只剩旋轉軌道的 AnimationClip。
       */
      const bodyOnly = (clip) => {
        clip.tracks = clip.tracks.filter((track) =>
          /\.quaternion$/.test(track.name)
        );
        return clip;
      }; // 只留骨架旋轉、剝臉部表情與位移
      try {
        mixer = new THREE.AnimationMixer(vrm.scene);
        for (const [gestureName, gestureFilePath] of Object.entries(GESTURES)) {
          try {
            const gestureGltf = await loader.loadAsync(gestureFilePath);
            const vrmAnimation =
              gestureGltf.userData.vrmAnimations &&
              gestureGltf.userData.vrmAnimations[0];
            if (vrmAnimation === undefined || vrmAnimation === null) {
              continue;
            }
            const clipAction = mixer.clipAction(
              bodyOnly(createVRMAnimationClip(vrmAnimation, vrm))
            );
            clipAction.setLoop(THREE.LoopOnce, 1);
            clipAction.clampWhenFinished = true;
            gestureActions[gestureName] = clipAction;
          } catch (error) {
            console.warn('VRMA ' + gestureName + ' 載入失敗：', error?.message);
          }
        }
        mixer.addEventListener('finished', (event) => {
          // 手勢播完 → 立刻停、交回程序化站姿（不 fadeOut，避免露出 bind T-pose）
          if (event.action === currentGesture) {
            try {
              event.action.stop();
            } catch (_error) {}
            currentGesture = null;
            waving = false;
          }
        });
        if (typeof gestureActions.wave !== 'undefined') {
          setTimeout(() => playGesture('wave'), 800); // 出場招呼
        }
        idleBreak = setInterval(() => {
          // 待機變化：偶爾環顧/放鬆，不死板
          if (
            waving === false &&
            skinEngine.getState().isSpeaking !== true &&
            Math.random() < 0.65
          ) {
            playGesture(Math.random() < 0.5 ? 'look' : 'relax');
          }
        }, 15000);
      } catch (error) {
        console.warn('VRMA 手勢庫載入失敗：', error?.message);
      }
    })();

    if (typeof skinEngine.onMounted === 'function') {
      skinEngine.onMounted();
    }

    /**
     * 播放指定的 3D 手勢動畫 (例如揮手、鞠躬)。
     * 播放期間會將 waving 設為 true 避免被程序化站姿打斷。
     * @param {string} gestureName - 要播放的手勢動作名稱對應鍵值。
     */
    function playGesture(gestureName) {
      // 播一個手勢（期間 mixer 控身體），平時用程序化站姿
      const clipAction = gestureActions[gestureName];
      if (clipAction === undefined || clipAction === null || waving === true) {
        return; // 一次一個，播放中不打斷
      }
      waving = true;
      currentGesture = clipAction;
      clipAction.reset();
      clipAction.setEffectiveWeight(1);
      clipAction.play(); // 硬切，不 fadeIn（fade 低權重會露出 bind T-pose）
    }

    let alive = true;
    let paused = false;
    let renderRaf = 0;
    let lastMouthValue = 0;
    let isComputingMouth = false;
    /**
     * 3D 虛擬人的核心渲染與動畫更新迴圈 (Animation Loop)。
     * 負責計算 delta time，更新 AnimationMixer (手勢)、表情 (對嘴/眨眼/情緒)，
     * 以及待機/說話時的程序化細微動作 (呼吸、轉頭、手部擺動)，最後呼叫 render 重繪畫面。
     */
    function animationLoop() {
      if (alive !== true || paused === true) {
        renderRaf = 0;
        return;
      }
      renderRaf = requestAnimationFrame(animationLoop);

      const delta = clock.getDelta();
      const elapsedTime = clock.elapsedTime;
      if (typeof vrm === 'object' && vrm !== null) {
        if (typeof mixer === 'object' && mixer !== null) {
          mixer.update(delta); // 揮手時 mixer 控身體
        }
        const expressionManager = vrm.expressionManager;
        // 對嘴 + 眨眼（永遠歸我們，mixer 之後 vrm.update 之前）
        if (
          typeof skinEngine.computeMouth === 'function' &&
          isComputingMouth === false
        ) {
          const result = skinEngine.computeMouth(skinEngine);

          if (result instanceof Promise) {
            isComputingMouth = true;
            result
              .then((mouthValue) => {
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

        // ①情緒表情：慢慢 ease 進／出；換情緒時把舊的歸零，缺這個 preset 的模型自動 no-op
        if (
          typeof expressionManager === 'object' &&
          expressionManager !== null &&
          (skinEngine.emo.target > 0 ||
            skinEngine.emo.weight > 0.005 ||
            (typeof skinEngine.emo.applied === 'string' &&
              skinEngine.emo.applied !== ''))
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
                  : skinEngine.emo.weight; // 別把對嘴蓋死
              expressionManager.setValue(skinEngine.emo.name, weight);
              skinEngine.emo.applied = skinEngine.emo.name;
            } catch (_error) {}
          }
        }

        const isPointerLookEnabled =
          typeof skinEngine.getState === 'function'
            ? skinEngine.getState()?.skin3d?.pointerLook !== false
            : DEFAULT_3D_POINTER_LOOK;

        if (isPointerLookEnabled === true) {
          lookTarget.position.set(cursorX * 0.9, 1.42 - cursorY * 0.55, 1.6); // 眼睛 lookAt 目標跟游標（永遠更新）
        }

        if (waving === false) {
          // 待機：直立、手放下、輕呼吸、頭跟游標
          const humanoid = vrm.humanoid;
          const leftUpperArmNode =
            humanoid.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArmNode =
            humanoid.getNormalizedBoneNode('rightUpperArm');
          const spineNode = humanoid.getNormalizedBoneNode('spine');
          const headNode = humanoid.getNormalizedBoneNode('head');
          let leftArmRotationZ = 1.15 * armSign;
          let rightArmRotationZ = -1.15 * armSign;
          const spineRotationX = Math.sin(elapsedTime * 0.9) * 0.018;
          let spineRotationY = Math.sin(elapsedTime * 0.5) * 0.012;
          let headRotationY =
            isPointerLookEnabled === true
              ? cursorX * 0.3
              : Math.sin(elapsedTime * 0.5) * 0.02;
          let headRotationX =
            (isPointerLookEnabled === true ? cursorY * 0.12 : 0) +
            Math.sin(elapsedTime * 0.5) * 0.01;
          if (skinEngine.getState().isSpeaking === true) {
            // 講話時：身體/頭/手持續小動作（疊在站姿上）
            const speechTime = elapsedTime * 3.0;
            spineRotationY += Math.sin(speechTime) * 0.03;
            headRotationX += Math.abs(Math.sin(speechTime * 0.9)) * 0.045; // 點頭
            headRotationY += Math.sin(speechTime * 0.55) * 0.05; // 轉頭
            leftArmRotationZ += Math.sin(speechTime * 0.7) * 0.06; // 手臂比劃
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
          if (typeof headNode === 'object' && headNode !== null) {
            headNode.rotation.y = headRotationY;
            headNode.rotation.x = headRotationX;
          }
        }
        vrm.update(delta); // 套用骨架/表情/springbone
      }
      webGLRenderer.render(scene, camera);
    }
    renderRaf = requestAnimationFrame(animationLoop);

    return {
      get gltf() {
        return gltf;
      },
      get vrm() {
        return vrm;
      },
      get TAP_GESTURES() {
        return TAP_GESTURES;
      },
      get canvas() {
        return canvas;
      },
      get camera() {
        return camera;
      },
      get scene() {
        return scene;
      },
      get playGesture() {
        return playGesture;
      },
      setPaused(isPaused) {
        paused = Boolean(isPaused);
        if (paused === false && alive === true && renderRaf === 0) {
          clock.getDelta();
          animationLoop();
        }
      },
      updateTransform(config) {
        if (typeof skinEngine.setSkin3d === 'function') {
          skinEngine.setSkin3d(config);
        }
      },
      dispose() {
        alive = false;
        skinEngine.gesture3D = null;
        skinEngine.gesture2D = null;
        if (typeof unsubscribeSkin3d === 'function') {
          unsubscribeSkin3d();
          unsubscribeSkin3d = null;
        }
        try {
          clearInterval(idleBreak);
        } catch (_error) {}
        window.removeEventListener('resize', resize);
        stageEl.removeEventListener('pointermove', onMove);
        try {
          if (typeof mixer?.stopAllAction === 'function') {
            mixer.stopAllAction();
          }
        } catch (_error) {}
        try {
          if (typeof vrm === 'object' && vrm !== null) {
            VRMUtils.deepDispose(vrm.scene);
          }
        } catch (_error) {} // 釋放 3D 幾何/材質，避免殘骸與 WebGL context 累積
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
  } catch (error) {
    console.error(error);
    if (typeof skinEngine?.onThreeDimensionalError === 'function') {
      skinEngine.onThreeDimensionalError(error, skinEngine);
    }
  }
}

// ===== 拖放自己的 VRM：把 .vrm 拖到角色上就直接換成你的 3D 角色（零改 code）=====
/**
 * 載入使用者自行提供的自訂 VRM 檔案。
 * @param {Object|null} [skinEngine=null] - 引擎實例。
 * @param {File} vrmFile - 準備載入的 VRM 檔案。
 */
export function loadVRMFile(skinEngine = null, vrmFile) {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
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
  skinEngine.engineMode = null; // 強制重 boot（即使已在 3D）
  skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
}
