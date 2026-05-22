import Phaser from 'phaser';

/**
 * ComboSystem: 連擊計數器
 * - 連殺 2+ 隻老鼠時在畫面顯示 COMBO 提示
 * - COMBO 3+ 時加評分倍率
 * - 2秒內未再擊殺則重置
 */
export class ComboSystem {
  private count = 0;
  private timer?: Phaser.Time.TimerEvent;
  private displayText?: Phaser.GameObjects.Text;
  private readonly COMBO_TIMEOUT_MS = 2000;

  constructor(private readonly scene: Phaser.Scene) {
    this.createDisplay();
  }

  private createDisplay(): void {
    const { width } = this.scene.scale;
    this.displayText = this.scene.add
      .text(width / 2, 80, '', {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: '38px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 6,
        shadow: { color: '#ff6b35', fill: true, offsetX: 0, offsetY: 0, blur: 20 },
      })
      .setOrigin(0.5)
      .setDepth(500)
      .setAlpha(0);
  }

  /** Call every time a rat is killed. Returns combo bonus multiplier (1.0 if no bonus) */
  registerKill(): number {
    this.count++;

    // Reset the 2-second timeout
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(this.COMBO_TIMEOUT_MS, () => {
      this.reset();
    });

    this.showComboFeedback();
    return this.getBonusMultiplier();
  }

  private getBonusMultiplier(): number {
    if (this.count >= 8) return 2.0;
    if (this.count >= 5) return 1.5;
    if (this.count >= 3) return 1.2;
    return 1.0;
  }

  private showComboFeedback(): void {
    if (this.count < 2) return;
    if (!this.displayText) return;

    let label = '';
    let color = '#ffd166';
    let scale = 1.0;

    if (this.count >= 8) {
      label = `🔥 FEVER!! ×${this.count}`;
      color = '#ff3333';
      scale = 1.3;
    } else if (this.count >= 5) {
      label = `⚡ HOT!! ×${this.count}`;
      color = '#ff9f1c';
      scale = 1.15;
    } else if (this.count >= 3) {
      label = `✨ COMBO ×${this.count}`;
      color = '#ffd166';
      scale = 1.0;
    } else {
      label = `COMBO ×${this.count}`;
      color = '#ffffff';
      scale = 0.85;
    }

    this.scene.tweens.killTweensOf(this.displayText);
    this.displayText.setText(label).setColor(color).setAlpha(1).setScale(scale * 1.4);

    this.scene.tweens.add({
      targets: this.displayText,
      scale: scale,
      duration: 200,
      ease: 'Back.Out',
    });

    // Fade out after 1.2s
    this.scene.tweens.add({
      targets: this.displayText,
      alpha: 0,
      delay: 1200,
      duration: 400,
      ease: 'Power2',
    });
  }

  private reset(): void {
    this.count = 0;
    if (this.displayText) {
      this.scene.tweens.killTweensOf(this.displayText);
      this.displayText.setAlpha(0);
    }
  }

  getCount(): number {
    return this.count;
  }

  destroy(): void {
    this.timer?.remove();
    this.displayText?.destroy();
  }
}
