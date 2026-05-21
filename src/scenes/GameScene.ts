import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // 之後在這裡 preload 圖片、音效
    // this.load.image('rat', 'assets/rat.png');
  }

  create() {
    // 暫時顯示測試文字
    this.add.text(480, 320, '紅花萬事屋：滅鼠行動', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // TODO: 之後在這裡建立陷阱、老鼠等物件
  }

  update() {
    // 遊戲主迴圈
  }
}