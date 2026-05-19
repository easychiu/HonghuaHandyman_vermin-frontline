import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#111111');
  }

  create(): void {
    this.registry.set('reputationScore', 0);
    this.registry.set('ratKills', 0);
    this.registry.set('levelTimeLeft', 0);
    this.registry.set('bossActive', false);
    this.scene.start(SCENE_KEYS.ready);
  }
}
