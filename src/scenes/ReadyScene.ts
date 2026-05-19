import Phaser from 'phaser';

export class ReadyScene extends Phaser.Scene {
  constructor() {
    super('ReadyScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#1d3557');
    this.add
      .text(width / 2, height / 2, 'Yorozuya Ready', {
        color: '#f1faee',
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.scene.start('MainGameScene');
    });
  }
}
