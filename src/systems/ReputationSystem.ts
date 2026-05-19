import Phaser from 'phaser';

const REGISTRY_KEYS = {
  score: 'reputationScore',
  kills: 'ratKills',
} as const;

export class ReputationSystem {
  private score: number;
  private kills = 0;

  constructor(private readonly scene: Phaser.Scene, initialScore: number) {
    this.score = initialScore;
    this.syncRegistry();
  }

  recordRatKill(points: number): void {
    this.kills += 1;
    this.score += points;
    this.syncRegistry();
  }

  penalizeHumanSight(points: number): void {
    this.score = Math.max(0, this.score - points);
    this.syncRegistry();
  }

  private syncRegistry(): void {
    this.scene.registry.set(REGISTRY_KEYS.score, this.score);
    this.scene.registry.set(REGISTRY_KEYS.kills, this.kills);
  }
}
