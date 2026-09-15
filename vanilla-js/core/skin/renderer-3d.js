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
  DEFAULT_3D_POINTER_LOOK
} from '@/core/constants';
import { createCanvas } from './canvas';

/**
 * 3D VRM renderer controller instance.
 * @typedef {import('../../index.d.ts').Renderer3D} Renderer3D
 */

/**
 * Applies source coordinates onto a THREE.Vector3 target object.
 * @param {{ set: (x: number, y: number, z: number) => void }} target - Target Vector3 object.
 * @param {number[] | { x?: number, y?: number, z?: number } | null | undefined} source - Source coordinates (array or object).
 * @param {{ x: number, y: number, z: number }} defaultValues - Default coordinate values.
 * @returns {void}
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
 * Applies source scale onto a THREE.Vector3 target object.
 * @param {{ set: (x: number, y: number, z: number) => void }} target - Target Vector3 object.
 * @param {number | number[] | { x?: number, y?: number, z?: number } | null | undefined} source - Source scale (scalar number, array, or object).
 * @param {{ x: number, y: number, z: number }} defaultValues - Default scale values.
 * @returns {void}
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
 * VRM gesture and behavior settings.
 * @typedef {import('../../index.d.ts').VRMSettings} VRMSettings
 */

/**
 * Executes the default 3D body gesture animation.
 * @param {import('../../index.d.ts').SkinEngine | Record<string, any> | null} [skinEngine=null] - Skin engine instance.
 * @param {string} emotionName - Name of the gesture animation to play (e.g., 'wave', 'bow', 'thinking', 'surprised').
 * @returns {Promise<void>}
 */
export async function defaultGesture3D(skinEngine = null, emotionName) {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }
  if (typeof emotionName !== 'string' || emotionName === '') {
    return;
  }

  // Play 3D body gesture (VRMA animation)
  if (typeof skinEngine.renderer?.playGesture === 'function') {
    try {
      skinEngine.renderer.playGesture(emotionName);
    } catch (error) {
      console.error(error);
    }
  }
}

// ===== 3D Skin: VRM (three + three-vrm, dynamic ESM import) =====
/**
 * Initializes and boots the 3D VRM avatar model using Three.js and @pixiv/three-vrm.
 * @param {import('../../index.d.ts').SkinEngine | Record<string, any>} skinEngine - Skin engine instance.
 * @param {import('../../index.d.ts').VRMSettings} [setting={}] - VRM gesture and behavior configuration object.
 * @returns {Promise<import('../../index.d.ts').Renderer3D | void>} Initialized 3D renderer instance, or void on error.
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
      // Context gestures + idle variations (body-only, no mouth manipulation)
      wave: wave || safeVrmaRootPath + 'Goodbye.vrma',
      // bow:
      //   bow ||
      //   'https://cdn.jsdelivr.net/gh/hirokazuniimoto/virtual-avatar-sdk@main/assets/animations/quick_formal_bow.vrma',
      bow: bow || safeVrmaRootPath + 'quick_formal_bow.vrma',
      thinking: thinking || safeVrmaRootPath + 'Thinking.vrma',
      look: look || safeVrmaRootPath + 'LookAround.vrma',
      relax: relax || safeVrmaRootPath + 'Relax.vrma',
      surprised: surprised || safeVrmaRootPath + 'Surprised.vrma' // Emotion reaction (not in click-greeting pool)
    };
    const TAP_GESTURES = ['wave', 'bow']; // Random click greetings: wave / bow

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
    const initialSkin3d =
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
    // Balanced lighting setup for MToon shader to prevent overexposure
    const key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xfff0e8, Math.PI * 0.2);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.38));
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget); // lookAt target follows cursor
    let cursorX = 0;
    let cursorY = 0; // Cursor relative position -1..1
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
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser)); // Loader also supports reading .vrma
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
    VRMUtils.rotateVRM0(vrm); // VRM0.x orient upright; VRM1 is safe no-op

    // VRM0 is rotated 180° by rotateVRM0, inverting arm Z rotation; VRM1 is not -> use version to determine sign
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

    function applySkin3dConfig(skin3d = {}, currentFitMode = DEFAULT_FIT_MODE) {
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
      const fov =
        typeof modeConfig?.camera?.fov === 'number' &&
        Number.isFinite(modeConfig.camera.fov)
          ? modeConfig.camera.fov
          : typeof skin3d.camera?.fov === 'number' &&
              Number.isFinite(skin3d.camera.fov)
            ? skin3d.camera.fov
            : defaultCameraFov;

      if (camera.fov !== fov) {
        camera.fov = fov;
        needMatrixUpdate = true;
      }

      const near =
        typeof modeConfig?.camera?.near === 'number' &&
        Number.isFinite(modeConfig.camera.near)
          ? modeConfig.camera.near
          : typeof skin3d.camera?.near === 'number' &&
              Number.isFinite(skin3d.camera.near)
            ? skin3d.camera.near
            : DEFAULT_3D_CAMERA_NEAR;

      if (camera.near !== near) {
        camera.near = near;
        needMatrixUpdate = true;
      }

      const far =
        typeof modeConfig?.camera?.far === 'number' &&
        Number.isFinite(modeConfig.camera.far)
          ? modeConfig.camera.far
          : typeof skin3d.camera?.far === 'number' &&
              Number.isFinite(skin3d.camera.far)
            ? skin3d.camera.far
            : DEFAULT_3D_CAMERA_FAR;

      if (camera.far !== far) {
        camera.far = far;
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

    let unsubscribeSkin3d = null;
    let unsubscribeFitMode = null;
    if (typeof skinEngine.subscribe === 'function') {
      unsubscribeSkin3d = skinEngine.subscribe(
        (state) => state.skin3d,
        (skin3d) => {
          const currentFitMode =
            skinEngine.getState().fitMode || DEFAULT_FIT_MODE;
          applySkin3dConfig(skin3d, currentFitMode);
        }
      );
      unsubscribeFitMode = skinEngine.subscribe(
        (state) => state.fitMode,
        (fitMode) => {
          const currentSkin3d = skinEngine.getState().skin3d || {};
          applySkin3dConfig(currentSkin3d, fitMode);
        }
      );
    }

    try {
      if (typeof vrm.lookAt === 'object' && vrm.lookAt !== null) {
        vrm.lookAt.target = lookTarget;
      }
    } catch (_error) {} // Eye gaze tracking towards mouse

    // VRMA gesture library (body-only): greetings, thinking, idle variations
    await (async () => {
      /**
       * Filters animation tracks to retain only bone quaternion rotations, stripping blend shapes and position tracks.
       * @param {any} clip - Source THREE.AnimationClip.
       * @returns {any} Filtered AnimationClip containing only rotation tracks.
       */
      const bodyOnly = (clip) => {
        clip.tracks = clip.tracks.filter((track) =>
          /\.quaternion$/.test(track.name)
        );
        return clip;
      }; // Keep only bone quaternion rotation; strip facial expressions and translations
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
            console.warn('VRMA ' + gestureName + ' load failed:', error?.message);
          }
        }
        mixer.addEventListener('finished', (event) => {
          // Gesture playback finished: stop immediately and return to procedural posture (avoid fade-out revealing T-pose)
          if (event.action === currentGesture) {
            try {
              event.action.stop();
            } catch (_error) {}
            currentGesture = null;
            waving = false;
          }
        });
        if (typeof gestureActions.wave !== 'undefined') {
          setTimeout(() => playGesture('wave'), 800); // Entrance greeting
        }
        idleBreak = setInterval(() => {
          // Idle variation: occasional look-around or relax motion
          if (
            waving === false &&
            skinEngine.getState().isSpeaking !== true &&
            Math.random() < 0.65
          ) {
            playGesture(Math.random() < 0.5 ? 'look' : 'relax');
          }
        }, 15000);
      } catch (error) {
        console.warn('VRMA gesture library load failed:', error?.message);
      }
    })();

    if (typeof skinEngine.onMounted === 'function') {
      skinEngine.onMounted();
    }

    /**
     * Plays a specific 3D gesture animation (e.g., 'wave', 'bow').
     * Sets waving flag to true during playback to avoid interruption by procedural idle motions.
     * @param {string} gestureName - Name key of the gesture animation to play.
     * @returns {void}
     */
    function playGesture(gestureName) {
      // Play a gesture (mixer controls body during gesture; procedural posture otherwise)
      const clipAction = gestureActions[gestureName];
      if (clipAction === undefined || clipAction === null || waving === true) {
        return; // Play one gesture at a time without interruption
      }
      waving = true;
      currentGesture = clipAction;
      clipAction.reset();
      clipAction.setEffectiveWeight(1);
      clipAction.play(); // Play directly without fadeIn to avoid low-weight T-pose artifact
    }

    let alive = true;
    let paused = false;
    let renderRaf = 0;
    let lastMouthValue = 0;
    let isComputingMouth = false;
    /**
     * 3D avatar core rendering and animation loop.
     * Calculates delta time, updates AnimationMixer (gestures), expressions (lip sync/blink/emotion),
     * and procedural subtle motions (breathing, head tracking, arm gestures) before invoking WebGLRenderer.
     * @returns {void}
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
          mixer.update(delta); // Mixer controls body during gestures
        }
        const expressionManager = vrm.expressionManager;
        // Lip sync + blink (applied before vrm.update)
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

        // Emotion blend shapes: smoothly ease in/out; reset previous emotion on switch
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
                  : skinEngine.emo.weight; // Limit weight to avoid blocking mouth lip sync
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
          lookTarget.position.set(cursorX * 0.9, 1.42 - cursorY * 0.55, 1.6); // Eye gaze tracking towards cursor
        }

        if (waving === false) {
          // Idle stance: upright, resting arms, gentle breathing, head tracks cursor
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
            // Speech animation: procedural nodding, head turning, and arm gestures
            const speechTime = elapsedTime * 3.0;
            spineRotationY += Math.sin(speechTime) * 0.03;
            headRotationX += Math.abs(Math.sin(speechTime * 0.9)) * 0.045; // Nod
            headRotationY += Math.sin(speechTime * 0.55) * 0.05; // Head turn
            leftArmRotationZ += Math.sin(speechTime * 0.7) * 0.06; // Arm gestures
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
        vrm.update(delta); // Apply skeleton, expressions, and spring bones
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
        if (typeof unsubscribeFitMode === 'function') {
          unsubscribeFitMode();
          unsubscribeFitMode = null;
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
        } catch (_error) {} // Deep dispose 3D geometries and textures to prevent memory leaks
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

// ===== Drag & Drop Custom VRM File Loading =====
/**
 * Loads a user-provided custom VRM File object and switches engine to 3D mode.
 * @param {import('../../index.d.ts').SkinEngine | Record<string, any> | null} [skinEngine=null] - Skin engine instance.
 * @param {File} vrmFile - Custom VRM file object to load.
 * @returns {void}
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
  skinEngine._engineMode = null; // Force reboot even if already in 3D
  skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
}
