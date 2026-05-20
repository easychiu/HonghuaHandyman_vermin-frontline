import Phaser from 'phaser';

// spritesheet 規格：
// 單一 frame 尺寸：62 × 88
// 每個動作 6 個 frame（含攀爬）
export const FRAME_WIDTH = 62;
export const FRAME_HEIGHT = 88;

const FRAME_RANGES = {
  walkRight: { start: 0, end: 5 },
  climb: { start: 6, end: 11 },
  attack: { start: 12, end: 17 },
  throw1: { start: 18, end: 23 },
  hurt: { start: 24, end: 29 },
  idle: { start: 30, end: 35 },
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

export function ensureHonghuaAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.walkRight, FRAME_RANGES.walkRight.start, FRAME_RANGES.walkRight.end, 12, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.climb, FRAME_RANGES.climb.start, FRAME_RANGES.climb.end, 12, -1);
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
