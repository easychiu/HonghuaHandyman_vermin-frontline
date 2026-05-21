export type RatFaction = 'green' | 'blue';

export interface RatProfile {
  maxHp: number;
  moveSpeed: number;
  panicThreshold: number;
  tint: number;
  scale: number;
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
      },
      blue: {
        maxHp: 4,
        moveSpeed: 60,
        panicThreshold: 0.25,
        tint: 0x1d3557,
        scale: 1.2,
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
    baiHui:   { range: 200, slowFactor: 0.3, durationMs: 4000, throwDistance: 170, uses: 1 },
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

