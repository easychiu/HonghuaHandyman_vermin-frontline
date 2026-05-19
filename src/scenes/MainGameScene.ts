import Phaser from 'phaser';

export class MainGameScene extends Phaser.Scene {
  constructor() {
    super('MainGameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#2a9d8f');
    this.add
      .text(width / 2, height / 2, 'Battle Start', {
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
      })
      .setOrigin(0.5);
  }
}
