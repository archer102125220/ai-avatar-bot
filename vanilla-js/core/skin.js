import { createBaseStore } from './store';
import {
  EMO_TARGET_MAP,
  ENGINE_MODE_MAP,
  DEFALUT_START_MODE,
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_FEMALE_MODEL_URL,
  DEFAULT_MALE_MODEL_URL
} from './constants';

// 2D 引擎相依（pixi + live2d）改成「用到才載」，3D 模式就不會下載 Live2D
export function loadUMD() {
  const cdnDependencieUrlArray = [
    {
      id: 'live2dcubismcore',
      src: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
    },
    {
      id: 'pixi.js@6.5.10',
      src: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js'
    },
    {
      id: 'pixi-live2d-display@0.4.0',
      src: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js'
    }
  ];

  if (window.__cdnDependenciePromise__ instanceof Promise === true) {
    return window.__cdnDependenciePromise__;
  }

  window.__cdnDependenciePromise__ = cdnDependencieUrlArray.reduce(
    (cdnDependenciePromise, cdnDependencie) =>
      cdnDependenciePromise.then(
        () =>
          new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = cdnDependencie.src;
            if (
              typeof cdnDependencie.id === 'string' &&
              cdnDependencie.id !== ''
            ) {
              script.id = cdnDependencie.id;
            }
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          })
      ),
    Promise.resolve()
  );

  return window.__cdnDependenciePromise__;
}

export async function defaultGesture2D(skinEngine = null, emotionName) {
  // f00 微笑眨眼
  // f01 （與f00很像）
  // f02 困惑
  // f03 難過
  // f04 開心
  // f05 驚訝
  // f06 害羞
  // f07 傻眼
  const emotionFemaleNameMap = {
    neutral: 'f00',
    happy: 'f04',
    sad: 'f03',
    surprised: 'f05'
  };

  const emotionMaleNameMap = {
    neutral: 'Normal',
    happy: 'Smile',
    sad: 'Sad',
    surprised: 'Surprised'
  };

  const emotionNameMap =
    skinEngine.gender === GENDER_MAP.female
      ? emotionFemaleNameMap
      : emotionMaleNameMap;

  const emotionCode = emotionNameMap[emotionName];

  if (
    Object.values(emotionNameMap).includes(emotionCode) &&
    typeof skinEngine?.avatarModel?.expression === 'function'
  ) {
    try {
      await skinEngine.avatarModel.expression(emotionCode);
    } catch (error) {
      console.error(error);
    }
  }
}

// ===== 2D 皮：Live2D 載入 + 對嘴 =====
async function bootAvatar(skinEngine, modelUrl) {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar bootAvatar] stageEl is not an HTMLElement');
    return;
  }
  try {
    await loadUMD(); // 用到才載 pixi + live2d
    const Live2DModel = window.PIXI.live2d.Live2DModel;
    try {
      Live2DModel.registerTicker(window.PIXI.Ticker);
    } catch (_error) {}

    const canvas = createCanvas(skinEngine);
    let pixiApp = new window.PIXI.Application({
      view: canvas,
      autoStart: true,
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: stageEl
    });

    skinEngine.avatarModel = await Live2DModel.from(modelUrl);
    pixiApp.stage.addChild(skinEngine.avatarModel);
    skinEngine.avatarModel.anchor.set(0.5, 1.0);

    // 關掉 Live2D 模型自帶的（日文）動作語音 — 只保留我們自己的 TTS（兩者來源不同，互不影響）
    try {
      if (
        typeof window.PIXI.live2d.SoundManager === 'object' &&
        window.PIXI.live2d.SoundManager !== null
      ) {
        window.PIXI.live2d.SoundManager.volume = 0;
      }
    } catch (_error) {}
    try {
      const motions =
        (skinEngine.avatarModel.internalModel.settings &&
          skinEngine.avatarModel.internalModel.settings.motions) ||
        {};
      for (const groupName of Object.keys(motions)) {
        (motions[groupName] || []).forEach((data) => {
          delete data.Sound;
          delete data.sound;
        });
      }
    } catch (_error) {}

    const safeFitMode = skinEngine.fitMode || DEFAULT_FIT_MODE;
    function fit() {
      const width = pixiApp.renderer.width;
      const height = pixiApp.renderer.height;
      const nativeH = skinEngine.avatarModel?.internalModel?.height || 1000;
      if (safeFitMode === FIT_MODE_MAP.HALF) {
        const ZOOM = 1.9; // 放大倍率：越大越近（半身越緊）
        const scale = (height / nativeH) * 0.95 * ZOOM;
        skinEngine.avatarModel.scale.set(scale);
        skinEngine.avatarModel.x = width / 2;
        skinEngine.avatarModel.y = nativeH * scale + height * 0.04; // 腳推到畫面外、頭留 4% 上緣
      } else {
        skinEngine.avatarModel.scale.set((height / nativeH) * 0.95);
        skinEngine.avatarModel.x = width / 2;
        skinEngine.avatarModel.y = height;
      }
    }
    fit();
    window.addEventListener('resize', fit);

    try {
      const groups = skinEngine.avatarModel.internalModel.settings.groups || [];
      const lipsyncGroup = groups.find(
        (x) => (x.Name || '').toLowerCase() === 'lipsync'
      );
      if (Array.isArray(lipsyncGroup?.Ids) && lipsyncGroup.Ids.length > 0) {
        skinEngine.lipIds = lipsyncGroup.Ids;
      }
    } catch (_error) {}

    // 對嘴：攔截 coreModel.update（計算頂點前的最後一刻寫入嘴巴，保證不被 motion/loadParameters 洗掉）
    try {
      const core = skinEngine.avatarModel.internalModel.coreModel;
      const origUpdate = core.update.bind(core);
      core.update = function () {
        if (typeof skinEngine.computeMouth === 'function') {
          (async function () {
            const mouthValue = await skinEngine.computeMouth(skinEngine); // 共用嘴型計算（與 3D 同一套）

            if (typeof mouthValue !== 'number') {
              console.error(
                '[AiAvatar] skinEngine.computeMouth must return a number'
              );
            } else {
              for (const id of skinEngine.lipIds) {
                try {
                  core.setParameterValueById(id, mouthValue);
                } catch (_error) {}
              }
            }
          })();
        }
        return origUpdate();
      };
    } catch (_error) {}

    if (typeof skinEngine.onMounted === 'function') {
      skinEngine.onMounted();
    }

    return {
      get canvas() {
        return canvas;
      },
      get avatarModel() {
        return skinEngine.avatarModel;
      },
      get pixiApp() {
        return pixiApp;
      },
      dispose() {
        try {
          window.removeEventListener('resize', fit);
        } catch (_error) {}
        try {
          if (typeof pixiApp?.destroy === 'function') {
            pixiApp.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true
            });
          }
        } catch (_error) {}
        pixiApp = null;
        skinEngine.avatarModel = null;
        canvas.remove();
      }
    };
  } catch (error) {
    console.error(error);

    if (typeof skinEngine?.onTwoDimensionalError === 'function') {
      skinEngine.onTwoDimensionalError(error, skinEngine);
    }
  }
}

// TODO: 深入研究怎麼移除 aiAvatarWidget ，讓 function 更乾淨
// ===== 3D 皮：VRM（three + three-vrm，ESM 動態 import）=====
async function bootVRM(skinEngine, setting = {}) {
  const stageEl = skinEngine?.stageEl;
  const {
    bow = '',
    wave = '',
    thinking = '',
    look = '',
    relax = '',
    surprised = ''
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
    const vrmaRootPath = '/avatar-skin/3d-model/vrma/';
    const GESTURES = {
      // 情境手勢 + 待機變化（body-only，不碰嘴）`
      wave: wave || vrmaRootPath + 'Goodbye.vrma',
      // bow:
      //   bow ||
      //   'https://cdn.jsdelivr.net/gh/hirokazuniimoto/virtual-avatar-sdk@main/assets/animations/quick_formal_bow.vrma',
      bow: bow || vrmaRootPath + 'quick_formal_bow.vrma',
      thinking: thinking || vrmaRootPath + 'Thinking.vrma',
      look: look || vrmaRootPath + 'LookAround.vrma',
      relax: relax || vrmaRootPath + 'Relax.vrma',
      surprised: surprised || vrmaRootPath + 'Surprised.vrma' // ①情緒用：驚訝的小反應（不在點擊問候清單裡）
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

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0, 1.4, 1.6);
    camera.lookAt(0, 1.3, 0);
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
    let mx = 0;
    let my = 0; // 游標相對位置 -1..1
    const onMove = (event) => {
      const stageElClientRect = stageEl.getBoundingClientRect();
      if (stageElClientRect.width === 0) {
        return;
      }
      mx = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientX - stageElClientRect.left) / stageElClientRect.width) *
            2 -
            1
        )
      );
      my = Math.max(
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
    let blinkT = -1;
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
        (gltf) => {
          resolve(gltf);
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
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });
    scene.add(vrm.scene);

    try {
      if (typeof vrm.lookAt === 'object' && vrm.lookAt !== null) {
        vrm.lookAt.target = lookTarget;
      }
    } catch (_e) {} // 眼睛跟著滑鼠

    // VRMA 情境手勢庫（body-only，不碰嘴）：點擊/出場揮手、思考托腮、待機變化(環顧/放鬆)
    await (async () => {
      const bodyOnly = (cl) => {
        cl.tracks = cl.tracks.filter((tr) => /\.quaternion$/.test(tr.name));
        return cl;
      }; // 只留骨架旋轉、剝臉部表情與位移
      try {
        mixer = new THREE.AnimationMixer(vrm.scene);
        for (const [name, file] of Object.entries(GESTURES)) {
          try {
            const gg = await loader.loadAsync(file);
            const anim =
              gg.userData.vrmAnimations && gg.userData.vrmAnimations[0];
            if (anim === undefined || anim === null) {
              continue;
            }
            const act = mixer.clipAction(
              bodyOnly(createVRMAnimationClip(anim, vrm))
            );
            act.setLoop(THREE.LoopOnce, 1);
            act.clampWhenFinished = true;
            gestureActions[name] = act;
          } catch (error) {
            console.warn('VRMA ' + name + ' 載入失敗：', error?.message);
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
        skinEngine.gesture3D = playGesture; // 對外 hook：思考等時機可從對話流程觸發
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

    function playGesture(name) {
      // 播一個手勢（期間 mixer 控身體），平時用程序化站姿
      const act = gestureActions[name];
      if (act === undefined || act === null || waving === true) {
        return; // 一次一個，播放中不打斷
      }
      waving = true;
      currentGesture = act;
      act.reset();
      act.setEffectiveWeight(1);
      act.play(); // 硬切，不 fadeIn（fade 低權重會露出 bind T-pose）
    }

    let alive = true;
    let paused = false;
    let renderRaf = 0;
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
        if (typeof skinEngine.computeMouth === 'function') {
          (async function () {
            const mouthValue = await skinEngine.computeMouth(skinEngine);

            if (typeof mouthValue !== 'number') {
              console.error(
                '[AiAvatar] skinEngine.computeMouth must return a number'
              );
            } else {
              expressionManager.setValue('aa', mouthValue);
            }
          })();
        }
        if (blinkT < 0) {
          nextBlink -= delta;
          if (nextBlink <= 0) {
            blinkT = 0;
            nextBlink = 2 + Math.random() * 4;
          }
        } else {
          blinkT += delta / BLINK;
          expressionManager.setValue(
            'blink',
            Math.sin(Math.min(blinkT, 1) * Math.PI)
          );
          if (blinkT >= 1) {
            blinkT = -1;
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
              const ex = expressionManager.getExpression
                ? expressionManager.getExpression(skinEngine.emo.name)
                : null;
              const weight =
                ex?.overrideMouth && String(ex.overrideMouth) !== 'none'
                  ? Math.min(skinEngine.emo.weight, 0.4)
                  : skinEngine.emo.weight; // 別把對嘴蓋死
              expressionManager.setValue(skinEngine.emo.name, weight);
              skinEngine.emo.applied = skinEngine.emo.name;
            } catch (_error) {}
          }
        }

        lookTarget.position.set(mx * 0.9, 1.42 - my * 0.55, 1.6); // 眼睛 lookAt 目標跟游標（永遠更新）
        if (!waving) {
          // 待機：直立、手放下、輕呼吸、頭跟游標
          const humanoid = vrm.humanoid;
          const lUA = humanoid.getNormalizedBoneNode('leftUpperArm');
          const rUA = humanoid.getNormalizedBoneNode('rightUpperArm');
          const sp = humanoid.getNormalizedBoneNode('spine');
          const hd = humanoid.getNormalizedBoneNode('head');
          let armL = 1.15 * armSign;
          let armR = -1.15 * armSign;
          const spX = Math.sin(elapsedTime * 0.9) * 0.018;
          let spY = Math.sin(elapsedTime * 0.5) * 0.012;
          let hdY = mx * 0.3;
          let hdX = my * 0.12 + Math.sin(elapsedTime * 0.5) * 0.01;
          if (skinEngine.getState().isSpeaking === true) {
            // 講話時：身體/頭/手持續小動作（疊在站姿上）
            const ts = elapsedTime * 3.0;
            spY += Math.sin(ts) * 0.03;
            hdX += Math.abs(Math.sin(ts * 0.9)) * 0.045; // 點頭
            hdY += Math.sin(ts * 0.55) * 0.05; // 轉頭
            armL += Math.sin(ts * 0.7) * 0.06; // 手臂比劃
            armR -= Math.sin(ts * 0.62) * 0.06;
          }
          if (lUA) lUA.rotation.z = armL;
          if (rUA) rUA.rotation.z = armR;
          if (typeof sp === 'object' && sp !== null) {
            sp.rotation.x = spX;
            sp.rotation.y = spY;
          }
          if (typeof hd === 'object' && hd !== null) {
            hd.rotation.y = hdY;
            hd.rotation.x = hdX;
          }
        }
        vrm.update(delta); // 套用骨架/表情/springbone
      }
      webGLRenderer.render(scene, camera);
    }
    renderRaf = requestAnimationFrame(animationLoop);

    return {
      get skinEngine() {
        return skinEngine;
      },
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
      get playGesture() {
        return playGesture;
      },
      setPaused(value) {
        paused = !!value;
        if (paused === false && alive === true && renderRaf === 0) {
          clock.getDelta();
          animationLoop();
        }
      },
      dispose() {
        alive = false;
        skinEngine.gesture3D = null;
        skinEngine.gesture2D = null;
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

// ===== 引擎切換外殼：每個引擎建自己的 canvas、回傳 dispose；切換＝dispose 舊的再 boot 新的 =====
function createCanvas(skinEngine = null) {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    throw new Error('[aiAvatar createCanvas] stageEl is not an HTMLElement');
  }

  stageEl
    .querySelectorAll('canvas.avatar-canvas')
    .forEach((old) => old.remove()); // 切換時保證不留舊 canvas（殘骸）
  const newCanvas = document.createElement('canvas');
  newCanvas.classList.add('avatar-canvas');
  stageEl.insertBefore(newCanvas, stageEl.firstChild); // 放最底層，UI 疊在上面
  return newCanvas;
}

function initSkinMode(skinEngine = null) {
  const startMode =
    skinEngine.startMode ||
    (skinEngine.has2D === true
      ? ENGINE_MODE_MAP.twoDimensional
      : skinEngine.has3D === true
        ? ENGINE_MODE_MAP.threeDimensional
        : ENGINE_MODE_MAP.twoDimensional);

  skinEngine.startMode = startMode;
  skinEngine.engineMode = startMode;
}

// ===== 拖放自己的 VRM：把 .vrm 拖到角色上就直接換成你的 3D 角色（零改 code）=====
function loadVRMFile(skinEngine = null, file) {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar loadVRMFile] skinEngine.stageEl is not an HTMLElement'
    );
    return;
  }

  if (
    file instanceof window.File === false ||
    /\.vrm$/i.test(file?.name || '') === false
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
  skinEngine.vrmUrl = URL.createObjectURL(file);

  if (typeof skinEngine.VRMFileChangeSuccess === 'function') {
    skinEngine.VRMFileChangeSuccess(skinEngine.vrmUrl);
  }
  skinEngine.engineMode = null; // 強制重 boot（即使已在 3D）
  skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional;
}

export function initSkinEngine(setting = {}) {
  const {
    stageEl,
    modelUrl = '',
    startMode = DEFALUT_START_MODE,
    fitMode = DEFAULT_FIT_MODE,
    vrmUrl = '',
    gesture2D = null,
    computeMouth = null,
    onThreeDimensionalError,
    onTwoDimensionalError,
    VRMFileChangeFail,
    VRMFileChangeSuccess,
    onMounted
  } = setting;

  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar initSkinMode] stageEl is not an HTMLElement');
    return;
  }

  const safeModelUrl =
    typeof modelUrl === 'string' && modelUrl !== ''
      ? modelUrl
      : setting.gender === GENDER_MAP.female
        ? DEFAULT_FEMALE_MODEL_URL
        : DEFAULT_MALE_MODEL_URL;

  const safeGesture2D =
    typeof gesture2D === 'function'
      ? gesture2D
      : [DEFAULT_FEMALE_MODEL_URL, DEFAULT_MALE_MODEL_URL].includes(
            safeModelUrl
          )
        ? defaultGesture2D
        : null;

  const safeVrmUrl =
    typeof vrmUrl === 'string' && vrmUrl !== ''
      ? vrmUrl
      : /\.vrm($|\?)/i.test(safeModelUrl)
        ? safeModelUrl
        : '';

  const store = createBaseStore({
    gender: setting.gender || DEFAULT_GENDER,
    emotion: 'neutral',
    isSpeaking: false
  });

  const skinEngine = {
    // --- Store Pattern Methods ---
    getState: store.getState,
    subscribe: store.subscribe,
    setGender: (val) => {
      store.setState({ gender: val });
      // Sync internal logic
      if (val === GENDER_MAP.female) {
        skinEngine.modelUrl = DEFAULT_FEMALE_MODEL_URL;
      } else if (val === GENDER_MAP.male) {
        skinEngine.modelUrl = DEFAULT_MALE_MODEL_URL;
      }
    },
    setEmotion: (val) => {
      store.setState({ emotion: val });
      skinEngine.gestureName = val;
    },
    setIsSpeaking: (val) => {
      store.setState({ isSpeaking: val });
    },
    // ----------------------------

    get stageEl() {
      return stageEl;
    },

    get gender() {
      return setting.gender;
    },

    _modelUrl: safeModelUrl,
    get modelUrl() {
      return this._modelUrl;
    },
    set modelUrl(newModelUrl = '') {
      if (typeof newModelUrl === 'string' && newModelUrl !== '') {
        this._modelUrl = newModelUrl;
      }
    },

    get loadVRMFile() {
      return function _loadVRMFile() {
        return loadVRMFile(skinEngine, ...arguments);
      };
    },

    get computeMouth() {
      return function _computeMouth() {
        return computeMouth(...arguments);
      };
    },

    get onMounted() {
      return function _onMounted(...arg) {
        if (typeof onMounted === 'function') {
          return onMounted(...arg);
        }
      };
    },

    get onThreeDimensionalError() {
      return function _onThreeDimensionalError(...arg) {
        if (typeof onThreeDimensionalError === 'function') {
          return onThreeDimensionalError(...arg);
        }
      };
    },
    get onTwoDimensionalError() {
      return function _onTwoDimensionalError(...arg) {
        if (typeof onTwoDimensionalError === 'function') {
          return onTwoDimensionalError(...arg);
        }
      };
    },

    get VRMFileChangeFail() {
      return function _VRMFileChangeFail(...arg) {
        if (typeof VRMFileChangeFail === 'function') {
          return VRMFileChangeFail(...arg);
        }
      };
    },

    get VRMFileChangeSuccess() {
      return function _VRMFileChangeSuccess(...arg) {
        if (typeof VRMFileChangeSuccess === 'function') {
          return VRMFileChangeSuccess(...arg);
        }
      };
    },

    // 主要是 animationLoop 時使用
    // ①情緒表情狀態：speak 時從文字判斷 → 3D 表情 preset 慢慢 ease 進、講完 ease 回中性（2D 模型表情規格不一，先不套）
    emo: {
      _name: 'neutral',
      get name() {
        return this._name;
      },
      set name(newName) {
        const newTarget = EMO_TARGET_MAP[newName];

        if (
          (typeof newTarget !== 'number' && newName !== 'neutral') ||
          this._name === newName
        ) {
          return;
        }

        this._name = newName;
        this.target = newTarget || 0;
      },
      target: 0,
      weight: 0,
      applied: ''
    },

    get has2D() {
      return !!this.modelUrl;
    },

    get has3D() {
      return !!this.vrmUrl;
    },

    _renderer: null,
    get renderer() {
      return this._renderer;
    },
    set renderer(newRenderer = null) {
      this._renderer = newRenderer;
    },

    get onGesture() {
      return function () {
        if (typeof setting.onGesture === 'function') {
          return setting.onGesture(...arguments);
        }
      };
    },
    get onGestureError() {
      return function () {
        if (typeof setting.onGestureError === 'function') {
          return setting.onGestureError(...arguments);
        }
      };
    },
    get onGestureEnd() {
      return function () {
        if (typeof setting.onGestureEnd === 'function') {
          return setting.onGestureEnd(...arguments);
        }
      };
    },

    get onModelChange() {
      return function () {
        if (typeof setting.onModelChange === 'function') {
          return setting.onModelChange(...arguments);
        }
      };
    },
    get onModelChangeEnd() {
      return function () {
        if (typeof setting.onModelChangeEnd === 'function') {
          return setting.onModelChangeEnd(...arguments);
        }
      };
    },
    get onModelChangeError() {
      return function () {
        if (typeof setting.onModelChangeError === 'function') {
          return setting.onModelChangeError(...arguments);
        }
      };
    },

    _engineMode: null,
    get engineMode() {
      return this._engineMode;
    },
    set engineMode(newEngineMode = '') {
      if (this.switching === true || newEngineMode === this.engineMode) {
        return;
      }

      if (
        (typeof newEngineMode === 'string' && newEngineMode !== '') ||
        newEngineMode === null
      ) {
        this._engineMode = newEngineMode;

        if (typeof this.onModelChange === 'function') {
          this.onModelChange(newEngineMode);
        }

        (async () => {
          this.switching = true;

          if (typeof this.renderer?.dispose === 'function') {
            try {
              this.renderer.dispose();
            } catch (_error) {}
            this.renderer = null;
          }
          try {
            this.renderer =
              newEngineMode === ENGINE_MODE_MAP.threeDimensional
                ? await bootVRM(this, setting)
                : await bootAvatar(this, this.modelUrl);
          } catch (error) {
            console.error(error);

            if (typeof this.onModelChangeError === 'function') {
              this.onModelChangeError(error);
            }
          }

          if (typeof this.onModelChangeEnd === 'function') {
            this.onModelChangeEnd(this.renderer, newEngineMode);
          }
          this.switching = false;
        })();
      }
    },

    // 3D 手勢觸發 hook（bootVRM 設定；2D 模式為 null → 自動 no-op）
    _gesture3D: null,
    get gesture3D() {
      return this._gesture3D;
    },
    set gesture3D(newGesture3D) {
      if (typeof newGesture3D === 'function' || newGesture3D === null) {
        this._gesture3D = newGesture3D;
      }
    },

    get gesture2D() {
      return function _gesture2D(emotionName) {
        return safeGesture2D.call(this, this, emotionName);
      };
    },
    get gesture() {
      if (this.engineMode === ENGINE_MODE_MAP.threeDimensional) {
        return this.gesture3D;
      } else if (this.engineMode === ENGINE_MODE_MAP.twoDimensional) {
        return this.gesture2D;
      }
      return null;
    },

    _gestureName: 'neutral',
    get gestureName() {
      return this._gestureName;
    },
    set gestureName(newGestureName = null) {
      if (typeof newGestureName === 'string' && newGestureName !== '') {
        this.emo.name = newGestureName;
        this._gestureName = newGestureName;

        (async () => {
          try {
            if (typeof this.onGesture === 'function') {
              this.onGesture(newGestureName, this);
            }

            await this.gesture(newGestureName);
          } catch (error) {
            console.error(error);
            if (typeof this.onGestureError === 'function') {
              this.onGestureError(error, newGestureName, this);
            }
          } finally {
            if (typeof this.onGestureEnd === 'function') {
              this.onGestureEnd(newGestureName, this);
            }
          }
        })();
      }
    },

    // 狀態
    // 皮的引擎判斷：data-vrm 指向 .vrm → 走 3D(VRM)；否則 data-model(.model3.json) → 走 2D(Live2D)
    _vrmUrl: safeVrmUrl, // let：拖放自己的 VRM 時可換,
    get vrmUrl() {
      return this._vrmUrl;
    },
    set vrmUrl(newVrmUrl = '') {
      if (typeof newVrmUrl === 'string' && newVrmUrl !== '') {
        this._vrmUrl = newVrmUrl;
      }
    },

    _switching: null,
    get switching() {
      return this._switching;
    },
    set switching(newSwitching = null) {
      if (typeof newSwitching === 'boolean') {
        this._switching = newSwitching;
      }
    },

    _lipIds: ['ParamMouthOpenY'],
    get lipIds() {
      return this._lipIds;
    },
    set lipIds(newLipIds) {
      if (Array.isArray(newLipIds) || newLipIds === null) {
        this._lipIds = newLipIds;
      }
    },

    _startMode: startMode || DEFALUT_START_MODE,
    get startMode() {
      return this._startMode;
    },
    set startMode(newStartMode = '') {
      if (typeof newStartMode === 'string' && newStartMode !== '') {
        this._startMode = newStartMode;
      }
    },

    _fitMode: fitMode || DEFAULT_FIT_MODE,
    get fitMode() {
      return this._fitMode;
    },
    set fitMode(newFitMode = '') {
      if (typeof newFitMode === 'string' && newFitMode !== '') {
        if (Object.values(this.FIT_MODE_MAP).includes(newFitMode)) {
          this._fitMode = newFitMode;
        } else {
          this._fitMode = DEFAULT_FIT_MODE;
        }
      }
    }
  };

  initSkinMode(skinEngine);

  return skinEngine;
}
