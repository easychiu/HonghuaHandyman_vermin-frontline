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
  },
  level: {
    durationSeconds: 90,
    bossDriveDurationMs: 9000,
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
    bossDriveSpeed: 320,
    bossDrivePulseMs: 450,
    climbTriggerDistance: 28,
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
} as const;
