import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { HONGHUA_TEXTURE_KEY, FRAME_WIDTH, FRAME_HEIGHT } from '../animations/honghuaAnimations';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#111111');
    this.load.spritesheet(HONGHUA_TEXTURE_KEY, 'assets/honghua.png', {
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    });
  }

  create(): void {
    this.registry.set('reputationScore', 0);
    this.registry.set('ratKills', 0);
    this.registry.set('scaredHumans', 0);
    this.registry.set('levelTimeLeft', 0);
    this.registry.set('bossActive', false);
    this.scene.start(SCENE_KEYS.ready);
  }
}
