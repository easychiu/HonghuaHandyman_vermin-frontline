import Phaser from 'phaser';

export const FRAME_WIDTH = 32;
export const FRAME_HEIGHT = 48;

const FRAME_RANGES = {
  walkRight: { start: 0, end: 3 },
  walkLeft: { start: 4, end: 7 },
  climb: { start: 8, end: 11 },
  attack: { start: 12, end: 15 },
  qingZai: { start: 16, end: 19 },
  shuangZi: { start: 20, end: 23 },
  hongHui: { start: 24, end: 27 },
  baiHui: { start: 28, end: 31 },
  baoYe: { start: 32, end: 35 },
  hurt: { start: 36, end: 39 },
} as const;

export const HONGHUA_TEXTURE_KEY = 'honghua';

export const HONGHUA_ANIMATION_KEYS = {
  walkRight: 'honghua-walk-right',
  walkLeft: 'honghua-walk-left',
  climb: 'honghua-climb',
  attack: 'honghua-attack',
  qingZai: 'honghua-throw-qing-zai',
  shuangZi: 'honghua-throw-shuang-zi',
  hongHui: 'honghua-throw-hong-hui',
  baiHui: 'honghua-throw-bai-hui',
  baoYe: 'honghua-throw-bao-ye',
  hurt: 'honghua-hurt',
} as const;

export type HonghuaThrowType = 'qingZai' | 'shuangZi' | 'hongHui' | 'baiHui' | 'baoYe';
export type HonghuaFacing = 'left' | 'right';

export const HONGHUA_IDLE_FRAMES: Record<HonghuaFacing, number> = {
  right: FRAME_RANGES.walkRight.start,
  left: FRAME_RANGES.walkLeft.start,
};

const THROW_ANIMATION_KEYS: Record<HonghuaThrowType, string> = {
  qingZai: HONGHUA_ANIMATION_KEYS.qingZai,
  shuangZi: HONGHUA_ANIMATION_KEYS.shuangZi,
  hongHui: HONGHUA_ANIMATION_KEYS.hongHui,
  baiHui: HONGHUA_ANIMATION_KEYS.baiHui,
  baoYe: HONGHUA_ANIMATION_KEYS.baoYe,
};

export function ensureHonghuaAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.walkRight, FRAME_RANGES.walkRight.start, FRAME_RANGES.walkRight.end, 8, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.walkLeft, FRAME_RANGES.walkLeft.start, FRAME_RANGES.walkLeft.end, 8, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.climb, FRAME_RANGES.climb.start, FRAME_RANGES.climb.end, 8, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.attack, FRAME_RANGES.attack.start, FRAME_RANGES.attack.end, 14);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.qingZai, FRAME_RANGES.qingZai.start, FRAME_RANGES.qingZai.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.shuangZi, FRAME_RANGES.shuangZi.start, FRAME_RANGES.shuangZi.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.hongHui, FRAME_RANGES.hongHui.start, FRAME_RANGES.hongHui.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.baiHui, FRAME_RANGES.baiHui.start, FRAME_RANGES.baiHui.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.baoYe, FRAME_RANGES.baoYe.start, FRAME_RANGES.baoYe.end, 12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.hurt, FRAME_RANGES.hurt.start, FRAME_RANGES.hurt.end, 12);
}

export function getHonghuaWalkAnimationKey(facing: HonghuaFacing): string {
  return facing === 'left' ? HONGHUA_ANIMATION_KEYS.walkLeft : HONGHUA_ANIMATION_KEYS.walkRight;
}

export function getHonghuaThrowAnimationKey(type: HonghuaThrowType): string {
  return THROW_ANIMATION_KEYS[type];
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
