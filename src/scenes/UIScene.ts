import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { defaultHudState, HudState } from '../ui/hud';

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
    const hud: HudState = {
      score: Number(this.registry.get('reputationScore') ?? defaultHudState.score),
      kills: Number(this.registry.get('ratKills') ?? defaultHudState.kills),
      scaredHumans: Number(this.registry.get('scaredHumans') ?? defaultHudState.scaredHumans),
      timeLeft: Number(this.registry.get('levelTimeLeft') ?? defaultHudState.timeLeft),
      bossActive: Boolean(this.registry.get('bossActive') ?? defaultHudState.bossActive),
    };

    this.topLeftText?.setText(`評分: ${hud.score}\n擊殺: ${hud.kills}\n嚇跑人數: ${hud.scaredHumans}\n倒數: ${hud.timeLeft}s`);
    this.bossText?.setText(hud.bossActive ? '⚠ 大BOSS 驅趕鼠群中 ⚠' : '');
  }
}
