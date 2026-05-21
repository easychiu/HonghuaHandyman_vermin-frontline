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
    this.bossSprite = this.config.scene
      .add.image(GAME_BALANCE.level.bossSpriteStartX, GAME_BALANCE.level.bossSpriteY, 'boss_texture')
      .setDepth(GAME_BALANCE.level.bossSpriteDepth)
      .setDisplaySize(120 * 1.1, 70 * 1.1);

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
    // Boss texture is pre-loaded in BootScene.ts
  }
}
