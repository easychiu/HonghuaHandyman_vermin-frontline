import Phaser from 'phaser';

const REGISTRY_KEYS = {
  score: 'reputationScore',
  kills: 'ratKills',
  scaredHumans: 'scaredHumans',
} as const;

export class ReputationSystem {
  private reputationScore: number;
  private kills = 0;
  private scaredHumans = 0;

  constructor(private readonly scene: Phaser.Scene, initialScore: number) {
    this.reputationScore = initialScore;
    this.syncRegistry();
  }

  recordRatKill(points: number): void {
    this.kills += 1;
    this.reputationScore += points;
    this.syncRegistry();
  }

  recordScaredHuman(points: number): void {
    this.reputationScore = Math.max(0, this.reputationScore - points);
    this.scaredHumans += 1;
    this.syncRegistry();
  }

  private syncRegistry(): void {
    this.scene.registry.set(REGISTRY_KEYS.score, this.reputationScore);
    this.scene.registry.set(REGISTRY_KEYS.kills, this.kills);
    this.scene.registry.set(REGISTRY_KEYS.scaredHumans, this.scaredHumans);
  }
}
