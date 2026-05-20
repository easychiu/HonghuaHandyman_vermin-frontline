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
      .text(
        width / 2,
        height / 2 + 20,
        '桌機：WASD/方向鍵移動・空白攻擊・E 放置陷阱・1~5 技能\n手機：左下虛擬搖桿（上推可跳躍/爬管）・右下觸控按鈕\n壓力測試加鼠僅限 debugSpawn=1 模式',
        {
        color: '#f1faee',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        align: 'center',
        },
      )
      .setOrigin(0.5);

    let started = false;
    const startGame = () => {
      if (started) {
        return;
      }
      started = true;
      this.input.off('pointerdown', startGame);
      this.input.keyboard?.off('keydown', onKeyboardStart);
      this.scene.start(SCENE_KEYS.mainGame);
    };
    const onKeyboardStart = (event: KeyboardEvent) => {
      const startKeys = new Set([
        'Space',
        'Enter',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ]);
      if (startKeys.has(event.code)) {
        startGame();
      }
    };
    this.input.once('pointerdown', startGame);
    this.input.keyboard?.on('keydown', onKeyboardStart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onKeyboardStart);
    });
  }
}
