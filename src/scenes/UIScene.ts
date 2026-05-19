import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { defaultHudState, HudState } from '../ui/hud';

export class UIScene extends Phaser.Scene {
  private topLeftText?: Phaser.GameObjects.Text;
  private bossText?: Phaser.GameObjects.Text;
  private skillText?: Phaser.GameObjects.Text;

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

    this.skillText = this.add.text(16, this.scale.height - 100, '', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      lineSpacing: 4,
    }).setDepth(1000);
  }

  update(): void {
    const hud: HudState = {
      score:       Number(this.registry.get('reputationScore') ?? defaultHudState.score),
      kills:       Number(this.registry.get('ratKills')        ?? defaultHudState.kills),
      scaredHumans: Number(this.registry.get('scaredHumans')  ?? defaultHudState.scaredHumans),
      timeLeft:    Number(this.registry.get('levelTimeLeft')   ?? defaultHudState.timeLeft),
      bossActive:  Boolean(this.registry.get('bossActive')     ?? defaultHudState.bossActive),
      playerHp:    Number(this.registry.get('playerHp')        ?? defaultHudState.playerHp),
      playerMaxHp: Number(this.registry.get('playerMaxHp')     ?? defaultHudState.playerMaxHp),
      skillUses:   (this.registry.get('skillUses')             ?? defaultHudState.skillUses),
    };

    // HP 顯示
    const hearts = '❤'.repeat(hud.playerHp) + '🖤'.repeat(Math.max(0, hud.playerMaxHp - hud.playerHp));
    this.topLeftText?.setText(
      `HP: ${hud.playerHp}/${hud.playerMaxHp}  ${hearts}\n評分: ${hud.score}\n擊殺: ${hud.kills}\n嚇跑人數: ${hud.scaredHumans}\n倒數: ${hud.timeLeft}s`,
    );

    this.bossText?.setText(hud.bossActive ? '⚠ 大BOSS 驅趕鼠群中 ⚠' : '');

    // 技能欄顯示
    const s = hud.skillUses;
    this.skillText?.setText(
      `[1] A.青仔檳榔  ${s.qingZai}x\n` +
      `[2] B.雙子檳榔  ${s.shuangZi}x\n` +
      `[3] C.紅灰檳榔  ${s.hongHui}x  🔥燃燒\n` +
      `[4] D.白灰檳榔  ${s.baiHui}x  ❄減速\n` +
      `[5] E.包葉檳榔  ${s.baoYe}x  🛡護盾(3次)`,
    );
  }
}
