import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';

export class ReadyScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.ready);
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#1d3557');
    this.add
      .text(width / 2, height / 2 - 40, 'Yorozuya Ready', {
        color: '#f1faee',
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, 'WASD/方向鍵移動・空白攻擊・E 放置陷阱\n點擊畫面可追加老鼠壓力測試', {
        color: '#f1faee',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        align: 'center',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.scene.start(SCENE_KEYS.mainGame);
    });
  }
}
