export type RatFaction = 'green' | 'blue' | 'red' | 'yellow' | 'purple' | 'white' | 'black' | 'orange' | 'cyan';

export interface RatProfile {
  maxHp: number;
  moveSpeed: number;
  panicThreshold: number;
  tint: number;
  scale: number;
  damage: number;
  colorR: number;
  colorG: number;
  colorB: number;
}

export const GAME_BALANCE = {
  world: {
    width: 960,
    height: 540,
    surfaceY: 250,
    surfacePlatformThickness: 20,
  },
  level: {
    durationSeconds: 75,
    bossTriggerTimeLeftSeconds: 30,
    bossDriveDurationMs: 15000,
    bossSpriteStartX: 120,
    bossSpriteY: 360,
    bossSpriteDepth: 30,
  },
  reputation: {
    startingScore: 100,
    ratKillReward: 1,
    humanSightPenalty: 8,
  },
  combat: {
    playerAttackRange: 40,
    playerAttackHeight: 48,
    playerAttackDamage: 1,
    trapDamage: 2,
  },
  rat: {
    spawnIntervalMs: 1800,
    blueSpawnIntervalMs: 3500,
    bossDriveSpeed: 320,
    bossDrivePulseMs: 450,
    climbTriggerDistance: 28,
    pipeExitOffset: 90,
    profiles: {
      green: {
        maxHp: 2,
        moveSpeed: 100,
        panicThreshold: 0.3,
        tint: 0x38b000,
        scale: 1,
        damage: 1,
        colorR: 30,
        colorG: 200,
        colorB: 30,
      },
      blue: {
        maxHp: 4,
        moveSpeed: 60,
        panicThreshold: 0.25,
        tint: 0x1d3557,
        scale: 1.2,
        damage: 2,
        colorR: 40,
        colorG: 80,
        colorB: 220,
      },
      red: {
        maxHp: 1,
        moveSpeed: 160,
        panicThreshold: 0.4,
        tint: 0xd90429,
        scale: 0.8,
        damage: 1,
        colorR: 220,
        colorG: 30,
        colorB: 30,
      },
      yellow: {
        maxHp: 3,
        moveSpeed: 90,
        panicThreshold: 0.3,
        tint: 0xffb703,
        scale: 1.0,
        damage: 1,
        colorR: 220,
        colorG: 180,
        colorB: 30,
      },
      purple: {
        maxHp: 7,
        moveSpeed: 45,
        panicThreshold: 0.2,
        tint: 0x7209b7,
        scale: 1.4,
        damage: 3,
        colorR: 160,
        colorG: 40,
        colorB: 220,
      },
      white: {
        maxHp: 2,
        moveSpeed: 180,
        panicThreshold: 0.45,
        tint: 0xffffff,
        scale: 0.9,
        damage: 1,
        colorR: 255,
        colorG: 255,
        colorB: 255,
      },
      black: {
        maxHp: 3,
        moveSpeed: 130,
        panicThreshold: 0.25,
        tint: 0x1f1f1f,
        scale: 1.0,
        damage: 2,
        colorR: 40,
        colorG: 40,
        colorB: 40,
      },
      orange: {
        maxHp: 8,
        moveSpeed: 55,
        panicThreshold: 0.15,
        tint: 0xff6600,
        scale: 1.3,
        damage: 3,
        colorR: 255,
        colorG: 110,
        colorB: 20,
      },
      cyan: {
        maxHp: 5,
        moveSpeed: 85,
        panicThreshold: 0.3,
        tint: 0x00d2ff,
        scale: 1.15,
        damage: 2,
        colorR: 20,
        colorG: 200,
        colorB: 255,
      },
    } satisfies Record<RatFaction, RatProfile>,
  },
  human: {
    sightRadius: 100,
  },
  player: {
    maxHp: 10,
    invincibilityMs: 600,
    flashIntervalMs: 100,
    oxygenMax: 100,
    oxygenUseRate: 6.67, // per second underground (15s duration)
    oxygenRestoreRate: 25.0, // per second on surface (4s recovery)
    oxygenDamage: 1,
    oxygenDamageIntervalMs: 1000,
  },
  skills: {
    qingZai:  { range: 120, damage: 3, throwDistance: 140, uses: 3 },
    shuangZi: { range: 200, damage: 4, throwDistance: 170, uses: 2 },
    hongHui:  { range: 120, damage: 2, burnDamage: 1, burnIntervalMs: 600, burnDurationMs: 3000, throwDistance: 150, uses: 1 },
    shiHui:   { range: 200, slowFactor: 0.3, durationMs: 4000, throwDistance: 170, uses: 1 },
    baoYe:    { shieldHits: 3, radius: 60, uses: 1 },
    anzo:     { uses: 2, speed: 240, damage: 10, flameRadius: 50 },
  },
  collision: {
    greenRatDamage: 1,
    blueRatDamage: 2,
    bossDamage: 10,
    bossContactRadius: 64,
  },
} as const;

