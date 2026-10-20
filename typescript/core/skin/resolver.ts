import type { Gender } from '@/core/types';
import type {
  SkinCascadeMap,
  Skin2DMotionItem,
  Skin3DActionItem,
  Skin3DActionOption,
  Skin3DGestureOption
} from './types';
import {
  DEFAULT_VRMA_ROOT_PATH,
  DEFAULT_3D_GESTURE_MAP,
  DEFAULT_3D_POOLS
} from '@/core/constants';

/**
 * Resolved 2D motion item with extracted motion group name and pointerLook tracking flag.
 */
export interface Resolved2DMotion {
  motion: string;
  pointerLook: boolean;
}

/**
 * Resolved 3D animation action with normalized key name, absolute URL, and pointerLook flag.
 */
export interface Resolved3DAction {
  name: string;
  url: string;
  pointerLook: boolean;
}

/**
 * Resolves a dictionary value from a cascade inheritance structure (priority: gender override ➜ base dictionary).
 *
 * @param cascade - Dictionary optionally containing female/male overrides.
 * @param gender - Current avatar gender ('female' | 'male' | undefined).
 * @param key - The key name to look up.
 * @returns The resolved item if found, otherwise undefined.
 */
export function resolveCascadeValue<T>(
  cascade: SkinCascadeMap<T> | undefined,
  gender: Gender | string | undefined,
  key: string
): T | undefined {
  if (typeof cascade !== 'object' || cascade === null || typeof key !== 'string' || key === '') {
    return undefined;
  }

  // 1. Check gender-specific override
  if (gender === 'female' && typeof cascade.female === 'object' && cascade.female !== null) {
    if (key in cascade.female) {
      return cascade.female[key];
    }
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(cascade.female)) {
      if (k.toLowerCase() === lowerKey) {
        return v;
      }
    }
  } else if (gender === 'male' && typeof cascade.male === 'object' && cascade.male !== null) {
    if (key in cascade.male) {
      return cascade.male[key];
    }
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(cascade.male)) {
      if (k.toLowerCase() === lowerKey) {
        return v;
      }
    }
  }

  // 2. Fall back to base dictionary
  if (key in cascade) {
    const val = (cascade as Record<string, T>)[key];
    if (val !== undefined) {
      return val;
    }
  }
  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(cascade)) {
    if (k === 'female' || k === 'male') {
      continue;
    }
    if (k.toLowerCase() === lowerKey && v !== undefined) {
      return v as T;
    }
  }

  return undefined;
}

/**
 * Resolves a 2D motion configuration item into a normalized { motion, pointerLook } structure.
 *
 * @param cascade - 2D motion map supporting cascade gender overrides.
 * @param gender - Current avatar gender.
 * @param actionName - Name of the action / gesture.
 * @returns Resolved 2D motion object, or undefined if not found.
 */
export function resolve2DMotion(
  cascade: SkinCascadeMap<Skin2DMotionItem> | undefined,
  gender: Gender | string | undefined,
  actionName: string
): Resolved2DMotion | undefined {
  const item = resolveCascadeValue(cascade, gender, actionName);
  if (item === undefined) {
    return undefined;
  }
  if (typeof item === 'string') {
    return {
      motion: item,
      pointerLook: true
    };
  }
  if (typeof item === 'object' && item !== null && typeof (item as { motion?: unknown }).motion === 'string') {
    return {
      motion: (item as { motion: string }).motion,
      pointerLook: (item as { pointerLook?: boolean }).pointerLook !== false
    };
  }
  return undefined;
}

/**
 * Resolves a 2D expression name from a cascade expression map.
 *
 * @param cascade - 2D expression map supporting cascade gender overrides.
 * @param gender - Current avatar gender.
 * @param expressionName - Name of the semantic expression.
 * @returns Resolved expression name string, or undefined if not found.
 */
export function resolve2DExpression(
  cascade: SkinCascadeMap<string> | undefined,
  gender: Gender | string | undefined,
  expressionName: string
): string | undefined {
  const item = resolveCascadeValue(cascade, gender, expressionName);
  return typeof item === 'string' && item !== '' ? item : undefined;
}

/**
 * Normalizes a single 3D action item into an option object with name and optional url/pointerLook.
 */
export function normalize3DActionItem(item: Skin3DActionItem): Skin3DActionOption {
  if (typeof item === 'string') {
    return {
      name: item,
      pointerLook: true
    };
  }
  return {
    name: item.name,
    url: item.url,
    pointerLook: item.pointerLook
  };
}

/**
 * Resolves a 3D animation gesture into a normalized Resolved3DAction object.
 * Priority order:
 * 1. User cascade gestures map: gestures[gender]?.[key] ➜ gestures?.[key]
 * 2. User direct top-level action property override (e.g. config.bow, config.salute)
 * 3. System built-in default mapping from DEFAULT_3D_GESTURE_MAP + vrmaRootPath
 *
 * @param key - Action or gesture identifier.
 * @param options - Configuration contexts including gestures cascade, custom overrides, and root path.
 */
export function resolve3DAction(
  key: string,
  options?: {
    gestures?: SkinCascadeMap<string | Skin3DGestureOption>;
    topLevelOverrides?: Record<string, unknown>;
    gender?: Gender | string;
    vrmaRootPath?: string;
  }
): Resolved3DAction {
  const safeRoot =
    typeof options?.vrmaRootPath === 'string' && options.vrmaRootPath !== ''
      ? options.vrmaRootPath.endsWith('/')
        ? options.vrmaRootPath
        : options.vrmaRootPath + '/'
      : DEFAULT_VRMA_ROOT_PATH;

  // 1. Check user custom gestures cascade
  const customGesture = resolveCascadeValue<string | Skin3DGestureOption | undefined>(
    options?.gestures,
    options?.gender,
    key
  );

  let customUrl: string | undefined;
  let customPointerLook: boolean | undefined;

  if (typeof customGesture === 'string' && customGesture !== '') {
    customUrl = customGesture;
  } else if (typeof customGesture === 'object' && customGesture !== null) {
    if (typeof customGesture.url === 'string' && customGesture.url !== '') {
      customUrl = customGesture.url;
    }
    if (typeof customGesture.pointerLook === 'boolean') {
      customPointerLook = customGesture.pointerLook;
    }
  }

  // 2. Check user top-level property override (e.g. config.bow)
  if (
    customUrl === undefined &&
    typeof options?.topLevelOverrides === 'object' &&
    options?.topLevelOverrides !== null
  ) {
    const topVal = options.topLevelOverrides[key];
    if (typeof topVal === 'string' && topVal !== '') {
      customUrl = topVal;
    } else if (typeof topVal === 'object' && topVal !== null) {
      const topObj = topVal as { female?: string; male?: string; url?: string; pointerLook?: boolean };
      if (options.gender === 'female' && typeof topObj.female === 'string' && topObj.female !== '') {
        customUrl = topObj.female;
      } else if (options.gender === 'male' && typeof topObj.male === 'string' && topObj.male !== '') {
        customUrl = topObj.male;
      } else if (typeof topObj.url === 'string' && topObj.url !== '') {
        customUrl = topObj.url;
      }
      if (typeof topObj.pointerLook === 'boolean') {
        customPointerLook = topObj.pointerLook;
      }
    }
  }

  // 3. System built-in default resolution
  const defaultMeta = (DEFAULT_3D_GESTURE_MAP as Record<string, { urlSuffix: string; pointerLook: boolean }>)[key];

  const resolvedUrl =
    customUrl !== undefined
      ? customUrl
      : defaultMeta !== undefined
        ? safeRoot + defaultMeta.urlSuffix
        : safeRoot + `common/${key}.vrma`;

  const resolvedPointerLook =
    customPointerLook !== undefined
      ? customPointerLook
      : defaultMeta !== undefined
        ? defaultMeta.pointerLook
        : true;

  return {
    name: key,
    url: resolvedUrl,
    pointerLook: resolvedPointerLook
  };
}

/**
 * Resolves a 3D animation pool (e.g. idlePool, talkingPool, idleVariants) into a list of normalized actions.
 * Supports partial override and automatic fallback to default pools.
 *
 * @param userPool - Custom action pool provided by the user.
 * @param defaultPool - Fallback default pool from DEFAULT_3D_POOLS.
 * @param options - Configuration contexts for resolving URLs and pointerLook flags.
 */
export function resolve3DActionPool(
  userPool: Skin3DActionItem[] | undefined,
  defaultPool: readonly (string | Skin3DActionOption)[],
  options?: {
    gestures?: SkinCascadeMap<string | Skin3DGestureOption>;
    topLevelOverrides?: Record<string, unknown>;
    gender?: Gender | string;
    vrmaRootPath?: string;
  }
): Resolved3DAction[] {
  const sourcePool: (string | Skin3DActionOption)[] =
    Array.isArray(userPool) && userPool.length > 0
      ? userPool
      : Array.from(defaultPool);

  return sourcePool.map((item) => {
    const normalized = normalize3DActionItem(item);
    const resolved = resolve3DAction(normalized.name, options);
    return {
      name: normalized.name,
      url: normalized.url !== undefined && normalized.url !== '' ? normalized.url : resolved.url,
      pointerLook:
        normalized.pointerLook !== undefined
          ? normalized.pointerLook
          : resolved.pointerLook
    };
  });
}

/**
 * Resolves all 3D animation pools and actions for the current avatar configuration.
 */
export function resolveAll3DPools(
  config: {
    idlePool?: Skin3DActionItem[];
    talkingPool?: Skin3DActionItem[];
    idleVariants?: { female?: Skin3DActionItem[]; male?: Skin3DActionItem[] };
    greetings?: { female?: Skin3DActionItem; male?: Skin3DActionItem };
    tapGestures?: Skin3DActionItem[];
    gestures?: SkinCascadeMap<string | Skin3DGestureOption>;
    vrmaRootPath?: string;
    [key: string]: unknown;
  },
  gender?: Gender | string
): {
  idlePool: Resolved3DAction[];
  talkingPool: Resolved3DAction[];
  idleVariants: Resolved3DAction[];
  greeting: Resolved3DAction;
  tapGestures: Resolved3DAction[];
} {
  const options = {
    gestures: config.gestures,
    topLevelOverrides: config,
    gender,
    vrmaRootPath: config.vrmaRootPath
  };

  const idlePool = resolve3DActionPool(config.idlePool, DEFAULT_3D_POOLS.idlePool, options);
  const talkingPool = resolve3DActionPool(config.talkingPool, DEFAULT_3D_POOLS.talkingPool, options);

  const defaultVariants =
    gender === 'female'
      ? DEFAULT_3D_POOLS.idleVariants.female
      : DEFAULT_3D_POOLS.idleVariants.male;

  const userVariants =
    gender === 'female'
      ? config.idleVariants?.female
      : config.idleVariants?.male;

  const idleVariants = resolve3DActionPool(userVariants, defaultVariants, options);

  const defaultGreetingKey =
    gender === 'female'
      ? DEFAULT_3D_POOLS.greetings.female
      : DEFAULT_3D_POOLS.greetings.male;

  const userGreeting =
    gender === 'female'
      ? config.greetings?.female
      : config.greetings?.male;

  const normalizedGreeting =
    userGreeting !== undefined
      ? normalize3DActionItem(userGreeting)
      : { name: defaultGreetingKey };

  const resolvedGreetingMeta = resolve3DAction(normalizedGreeting.name, options);

  const greeting: Resolved3DAction = {
    name: normalizedGreeting.name,
    url:
      normalizedGreeting.url !== undefined && normalizedGreeting.url !== ''
        ? normalizedGreeting.url
        : resolvedGreetingMeta.url,
    pointerLook:
      normalizedGreeting.pointerLook !== undefined
        ? normalizedGreeting.pointerLook
        : resolvedGreetingMeta.pointerLook
  };

  const tapGestures = resolve3DActionPool(
    config.tapGestures,
    DEFAULT_3D_POOLS.tapGestures,
    options
  );

  return {
    idlePool,
    talkingPool,
    idleVariants,
    greeting,
    tapGestures
  };
}
