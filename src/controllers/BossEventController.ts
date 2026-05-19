import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Rat } from '../entities/Rat';

interface BossEventControllerConfig {
  scene: Phaser.Scene;
  pipeX: number;
  surfaceY: number;
  onStateChange: (active: boolean) => void;
}

export class BossEventController {
  private bossSprite?: Phaser.GameObjects.Image;
  private driveTimer?: Phaser.Time.TimerEvent;
  private endTimer?: Phaser.Time.TimerEvent;
  private active = false;

  constructor(private readonly config: BossEventControllerConfig) {}

  trigger(getActiveRats: () => Rat[]): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.config.onStateChange(true);
    this.ensureBossTexture();

    this.bossSprite = this.config.scene
      .add.image(GAME_BALANCE.level.bossSpriteStartX, GAME_BALANCE.level.bossSpriteY, 'boss_texture')
      .setDepth(GAME_BALANCE.level.bossSpriteDepth);
    this.bossSprite.setScale(1.1);

    this.config.scene.tweens.add({
      targets: this.bossSprite,
      x: this.config.scene.scale.width - 120,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.driveTimer = this.config.scene.time.addEvent({
      delay: GAME_BALANCE.rat.bossDrivePulseMs,
      loop: true,
      callback: () => {
        getActiveRats().forEach((rat) => rat.applyBossDrive(this.config.pipeX, this.config.surfaceY));
      },
    });

    this.endTimer = this.config.scene.time.delayedCall(GAME_BALANCE.level.bossDriveDurationMs, () => {
      this.stop();
    });
  }

  stop(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.config.onStateChange(false);
    this.driveTimer?.remove(false);
    this.endTimer?.remove(false);
    this.driveTimer = undefined;
    this.endTimer = undefined;
    this.bossSprite?.destroy();
    this.bossSprite = undefined;
  }

  isActive(): boolean {
    return this.active;
  }

  getBossPosition(): { x: number; y: number } | null {
    if (!this.active || !this.bossSprite) return null;
    return { x: this.bossSprite.x, y: this.bossSprite.y };
  }

  private ensureBossTexture(): void {
    if (this.config.scene.textures.exists('boss_texture')) {
      return;
    }

    const g = this.config.scene.add.graphics();
    g.fillStyle(0x5f0f40);
    g.fillRoundedRect(0, 0, 120, 70, 12);
    g.fillStyle(0xffffff);
    g.fillCircle(35, 30, 10);
    g.fillCircle(85, 30, 10);
    g.fillStyle(0x9a031e);
    g.fillRect(20, 48, 80, 10);
    g.generateTexture('boss_texture', 120, 70);
    g.destroy();
  }
}
