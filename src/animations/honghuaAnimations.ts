import Phaser from 'phaser';

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 48;

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

const TOTAL_FRAMES = FRAME_RANGES.hurt.end + 1;

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

interface FramePose {
  facing: HonghuaFacing;
  leftLegOffset: number;
  rightLegOffset: number;
  leftArmAngle: number;
  rightArmAngle: number;
  bodyLean: number;
  eyeOffsetX?: number;
  mouthOffsetY?: number;
  propColor?: string;
  propOffsetX?: number;
  propOffsetY?: number;
  propRadius?: number;
  effectColor?: string;
  effectSize?: number;
}

export function ensureHonghuaAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(HONGHUA_TEXTURE_KEY)) {
    const texture = scene.textures.createCanvas(HONGHUA_TEXTURE_KEY, FRAME_WIDTH * TOTAL_FRAMES, FRAME_HEIGHT);

    if (!texture) {
      throw new Error('Failed to create Honghua sprite sheet.');
    }

    const ctx = texture.context;
    ctx.clearRect(0, 0, texture.width, texture.height);

    const poses = buildFramePoses();
    poses.forEach((pose, frameIndex) => drawFrame(ctx, frameIndex, pose));

    texture.refresh();
    scene.textures.addSpriteSheet(HONGHUA_TEXTURE_KEY, texture, {
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
      endFrame: TOTAL_FRAMES - 1,
    });
  }

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

function buildFramePoses(): FramePose[] {
  return [
    ...buildWalkPoses('right'),
    ...buildWalkPoses('left'),
    ...buildClimbPoses(),
    ...buildAttackPoses(),
    ...buildThrowPoses('qingZai', '#63e6be', '#2f9e44'),
    ...buildThrowPoses('shuangZi', '#ffd43b', '#f08c00'),
    ...buildThrowPoses('hongHui', '#ff6b6b', '#c92a2a'),
    ...buildThrowPoses('baiHui', '#a5d8ff', '#1971c2'),
    ...buildThrowPoses('baoYe', '#69db7c', '#2b8a3e'),
    ...buildHurtPoses(),
  ];
}

function buildWalkPoses(facing: HonghuaFacing): FramePose[] {
  return [
    { facing, leftLegOffset: -2, rightLegOffset: 2, leftArmAngle: -18, rightArmAngle: 22, bodyLean: -1 },
    { facing, leftLegOffset: 0, rightLegOffset: 1, leftArmAngle: -8, rightArmAngle: 12, bodyLean: 0 },
    { facing, leftLegOffset: 2, rightLegOffset: -2, leftArmAngle: 20, rightArmAngle: -20, bodyLean: 1 },
    { facing, leftLegOffset: 0, rightLegOffset: -1, leftArmAngle: 10, rightArmAngle: -10, bodyLean: 0 },
  ];
}

function buildClimbPoses(): FramePose[] {
  return [
    { facing: 'right', leftLegOffset: -1, rightLegOffset: 1, leftArmAngle: -55, rightArmAngle: 60, bodyLean: 0 },
    { facing: 'right', leftLegOffset: 1, rightLegOffset: -1, leftArmAngle: -35, rightArmAngle: 40, bodyLean: 0 },
    { facing: 'right', leftLegOffset: -1, rightLegOffset: 1, leftArmAngle: -65, rightArmAngle: 55, bodyLean: 0 },
    { facing: 'right', leftLegOffset: 1, rightLegOffset: -1, leftArmAngle: -45, rightArmAngle: 35, bodyLean: 0 },
  ];
}

function buildAttackPoses(): FramePose[] {
  return [
    { facing: 'right', leftLegOffset: 0, rightLegOffset: 1, leftArmAngle: -10, rightArmAngle: -10, bodyLean: 0 },
    { facing: 'right', leftLegOffset: -1, rightLegOffset: 2, leftArmAngle: 0, rightArmAngle: -35, bodyLean: 1, effectColor: '#ffe066', effectSize: 4 },
    { facing: 'right', leftLegOffset: -2, rightLegOffset: 2, leftArmAngle: 10, rightArmAngle: -75, bodyLean: 2, effectColor: '#ffd43b', effectSize: 7 },
    { facing: 'right', leftLegOffset: 0, rightLegOffset: 0, leftArmAngle: 5, rightArmAngle: -35, bodyLean: 1, effectColor: '#fab005', effectSize: 5 },
  ];
}

function buildThrowPoses(_type: HonghuaThrowType, propColor: string, effectColor: string): FramePose[] {
  return [
    {
      facing: 'right',
      leftLegOffset: 0,
      rightLegOffset: 0,
      leftArmAngle: -5,
      rightArmAngle: -5,
      bodyLean: 0,
      propColor,
      propOffsetX: 8,
      propOffsetY: 20,
      propRadius: 3,
    },
    {
      facing: 'right',
      leftLegOffset: -1,
      rightLegOffset: 1,
      leftArmAngle: 5,
      rightArmAngle: -25,
      bodyLean: 1,
      propColor,
      propOffsetX: 11,
      propOffsetY: 16,
      propRadius: 3,
    },
    {
      facing: 'right',
      leftLegOffset: -2,
      rightLegOffset: 2,
      leftArmAngle: 12,
      rightArmAngle: -60,
      bodyLean: 2,
      propColor,
      propOffsetX: 15,
      propOffsetY: 12,
      propRadius: 4,
      effectColor,
      effectSize: 5,
    },
    {
      facing: 'right',
      leftLegOffset: 0,
      rightLegOffset: 0,
      leftArmAngle: 0,
      rightArmAngle: -15,
      bodyLean: 1,
      effectColor,
      effectSize: 3,
    },
  ];
}

function buildHurtPoses(): FramePose[] {
  return [
    { facing: 'right', leftLegOffset: 0, rightLegOffset: 0, leftArmAngle: 18, rightArmAngle: -18, bodyLean: 0, eyeOffsetX: -1 },
    { facing: 'right', leftLegOffset: -1, rightLegOffset: 1, leftArmAngle: 30, rightArmAngle: -30, bodyLean: -2, eyeOffsetX: -1, mouthOffsetY: 1 },
    { facing: 'right', leftLegOffset: 1, rightLegOffset: -1, leftArmAngle: 25, rightArmAngle: -25, bodyLean: 2, eyeOffsetX: 1, mouthOffsetY: 1 },
    { facing: 'right', leftLegOffset: 0, rightLegOffset: 0, leftArmAngle: 15, rightArmAngle: -15, bodyLean: 0, mouthOffsetY: 1 },
  ];
}

function drawFrame(context: CanvasRenderingContext2D, frameIndex: number, pose: FramePose): void {
  const originX = frameIndex * FRAME_WIDTH;

  context.save();
  context.translate(originX, 0);

  if (pose.facing === 'left') {
    context.translate(FRAME_WIDTH, 0);
    context.scale(-1, 1);
  }

  context.translate(0, pose.bodyLean);

  if (pose.effectColor && pose.effectSize) {
    context.fillStyle = pose.effectColor;
    context.globalAlpha = 0.7;
    context.beginPath();
    context.arc(24, 20, pose.effectSize, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  drawLimb(context, 11, 21, pose.leftArmAngle, 12, '#f2c9a0', 4);
  drawLimb(context, 21, 21, pose.rightArmAngle, 12, '#f2c9a0', 4);

  context.fillStyle = '#d62828';
  context.fillRect(10, 17, 12, 14);
  context.fillStyle = '#f77f00';
  context.fillRect(10, 29, 12, 6);

  drawLimb(context, 13, 35, pose.leftLegOffset * 16, 10, '#2d3142', 4);
  drawLimb(context, 19, 35, pose.rightLegOffset * 16, 10, '#2d3142', 4);

  context.fillStyle = '#f2c9a0';
  context.beginPath();
  context.arc(16, 12, 6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#2b2d42';
  context.fillRect(11, 6, 10, 3);
  context.fillRect(9, 8, 4, 2);
  context.fillStyle = '#000000';
  context.fillRect(18 + (pose.eyeOffsetX ?? 0), 11, 2, 2);
  context.fillRect(14 + (pose.eyeOffsetX ?? 0), 11, 2, 2);
  context.fillRect(15, 15 + (pose.mouthOffsetY ?? 0), 3, 1);

  if (pose.propColor && pose.propOffsetX !== undefined && pose.propOffsetY !== undefined) {
    context.fillStyle = pose.propColor;
    context.beginPath();
    context.arc(pose.propOffsetX, pose.propOffsetY, pose.propRadius ?? 3, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawLimb(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  angleDeg: number,
  length: number,
  color: string,
  width: number,
): void {
  const angle = Phaser.Math.DegToRad(angleDeg);
  const endX = startX + Math.sin(angle) * length;
  const endY = startY + Math.cos(angle) * length;

  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
}
