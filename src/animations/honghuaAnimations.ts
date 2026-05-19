import Phaser from 'phaser';

// spritesheet 規格：
// 單一 frame 尺寸：64 × 72
// 每個動作 8 個 frame，共 5 個動作
export const FRAME_WIDTH = 64;
export const FRAME_HEIGHT = 72;

const FRAME_RANGES = {
  walkRight: { start: 0, end: 7 },
  attack: { start: 8, end: 15 },
  throw1: { start: 16, end: 23 },
  hurt: { start: 24, end: 31 },
  idle: { start: 32, end: 39 },
} as const;

export const HONGHUA_TEXTURE_KEY = 'honghua';

export const HONGHUA_ANIMATION_KEYS = {
  walkRight: 'honghua-walk-right',
  climb: 'honghua-climb',
  attack: 'honghua-attack',
  throw1: 'honghua-throw-1',
  hurt: 'honghua-hurt',
  idle: 'honghua-idle',
} as const;

export type HonghuaThrowType = 'qingZai' | 'shuangZi' | 'hongHui' | 'baiHui' | 'baoYe';
export const HONGHUA_INITIAL_FRAME = FRAME_RANGES.idle.start;

const THROW_ANIMATION_KEYS: Record<HonghuaThrowType, string> = {
  qingZai: HONGHUA_ANIMATION_KEYS.throw1,
  shuangZi: HONGHUA_ANIMATION_KEYS.throw1,
  hongHui: HONGHUA_ANIMATION_KEYS.throw1,
  baiHui: HONGHUA_ANIMATION_KEYS.throw1,
  baoYe: HONGHUA_ANIMATION_KEYS.throw1,
};

// TODO: 有獨立攀爬素材後，改用專屬 climb frame range 取代暫代投擲動作
const CLIMB_PLACEHOLDER_RANGE = FRAME_RANGES.throw1;

export function ensureHonghuaAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.walkRight, FRAME_RANGES.walkRight.start, FRAME_RANGES.walkRight.end, 12, -1);
  // 目前素材只有 5 組動作，攀爬時暫用第 3 組「投擲」動作維持流程相容
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.climb, CLIMB_PLACEHOLDER_RANGE.start, CLIMB_PLACEHOLDER_RANGE.end, 12, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.attack, FRAME_RANGES.attack.start, FRAME_RANGES.attack.end, 14);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.throw1, FRAME_RANGES.throw1.start, FRAME_RANGES.throw1.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.hurt, FRAME_RANGES.hurt.start, FRAME_RANGES.hurt.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.idle, FRAME_RANGES.idle.start, FRAME_RANGES.idle.end, 8, -1);
}

export function getHonghuaWalkAnimationKey(): string {
  return HONGHUA_ANIMATION_KEYS.walkRight;
}

export function getHonghuaThrowAnimationKey(type: HonghuaThrowType): string {
  return THROW_ANIMATION_KEYS[type];
}

export function getHonghuaIdleAnimationKey(): string {
  return HONGHUA_ANIMATION_KEYS.idle;
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  start: number,
  end: number,
  frameRate: number,
  repeat = 0,
): void {
  if (scene.anims.exists(key)) {
    return;
  }

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(HONGHUA_TEXTURE_KEY, { start, end }),
    frameRate,
    repeat,
  });
}
