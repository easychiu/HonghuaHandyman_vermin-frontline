import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';

export class UIScene extends Phaser.Scene {
  private topLeftText?: Phaser.GameObjects.Text;
  private bossText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(): void {
    this.topLeftText = this.add.text(16, 12, '', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    }).setDepth(1000);

    this.bossText = this.add.text(this.scale.width / 2, 14, '', {
      color: '#ff6b6b',
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setDepth(1000).setOrigin(0.5, 0);
  }

  update(): void {
    const score = Number(this.registry.get('reputationScore') ?? 0);
    const kills = Number(this.registry.get('ratKills') ?? 0);
    const scaredHumans = Number(this.registry.get('scaredHumans') ?? 0);
    const timeLeft = Number(this.registry.get('levelTimeLeft') ?? 0);
    const bossActive = Boolean(this.registry.get('bossActive'));

    this.topLeftText?.setText(`評分: ${score}\n擊殺: ${kills}\n嚇跑人數: ${scaredHumans}\n倒數: ${timeLeft}s`);
    this.bossText?.setText(bossActive ? '⚠ 大BOSS 驅趕鼠群中 ⚠' : '');
  }
}
