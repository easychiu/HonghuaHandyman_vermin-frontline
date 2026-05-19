import Phaser from 'phaser';

// 新 spritesheet 資訊：
// 圖檔尺寸：288 × 488
// 排列方式：橫向 4 個 frame，縱向 8 個動作
// 單一 frame 尺寸：72 × 61
export const FRAME_WIDTH = 72;
export const FRAME_HEIGHT = 61;

const FRAME_RANGES = {
  walkRight: { start: 0,  end: 3  },
  walkLeft:  { start: 4,  end: 7  },
  climb:     { start: 8,  end: 11 },
  attack:    { start: 12, end: 15 },
  throw1:    { start: 16, end: 19 }, // qingZai / 丟道具1
  throw2:    { start: 20, end: 23 }, // shuangZi
  throw3:    { start: 24, end: 27 },
  hurt:      { start: 28, end: 31 },
} as const;

export const HONGHUA_TEXTURE_KEY = 'honghua';

export const HONGHUA_ANIMATION_KEYS = {
  walkRight: 'honghua-walk-right',
  walkLeft:  'honghua-walk-left',
  climb:     'honghua-climb',
  attack:    'honghua-attack',
  throw1:    'honghua-throw-1',
  throw2:    'honghua-throw-2',
  throw3:    'honghua-throw-3',
  hurt:      'honghua-hurt',
} as const;

export type HonghuaThrowType = 'qingZai' | 'shuangZi' | 'hongHui' | 'baiHui' | 'baoYe';
export type HonghuaFacing = 'left' | 'right';

export const HONGHUA_IDLE_FRAMES: Record<HonghuaFacing, number> = {
  right: FRAME_RANGES.walkRight.start,
  left: FRAME_RANGES.walkLeft.start,
};

const THROW_ANIMATION_KEYS: Record<HonghuaThrowType, string> = {
  qingZai:  HONGHUA_ANIMATION_KEYS.throw1,
  shuangZi: HONGHUA_ANIMATION_KEYS.throw2,
  hongHui:  HONGHUA_ANIMATION_KEYS.throw3,
  baiHui:   HONGHUA_ANIMATION_KEYS.throw3,
  baoYe:    HONGHUA_ANIMATION_KEYS.throw1,
};

export function ensureHonghuaAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.walkRight, FRAME_RANGES.walkRight.start, FRAME_RANGES.walkRight.end, 8, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.walkLeft,  FRAME_RANGES.walkLeft.start,  FRAME_RANGES.walkLeft.end,  8, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.climb,     FRAME_RANGES.climb.start,     FRAME_RANGES.climb.end,     8, -1);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.attack,    FRAME_RANGES.attack.start,    FRAME_RANGES.attack.end,    14);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.throw1,    FRAME_RANGES.throw1.start,    FRAME_RANGES.throw1.end,    12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.throw2,    FRAME_RANGES.throw2.start,    FRAME_RANGES.throw2.end,    12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.throw3,    FRAME_RANGES.throw3.start,    FRAME_RANGES.throw3.end,    12);
  createAnimation(scene, HONGHUA_ANIMATION_KEYS.hurt,      FRAME_RANGES.hurt.start,      FRAME_RANGES.hurt.end,      12);
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
