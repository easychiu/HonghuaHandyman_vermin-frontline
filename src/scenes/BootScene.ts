import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#111111');
  }

  create(): void {
    this.scene.start('ReadyScene');
  }
}
