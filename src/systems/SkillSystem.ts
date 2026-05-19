import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';

export type SkillType = 'qingZai' | 'shuangZi' | 'hongHui' | 'baiHui' | 'baoYe';

interface SlowZone {
  x: number;
  y: number;
  radius: number;
  slowFactor: number;
  active: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

export class SkillSystem {
  private uses: Record<SkillType, number>;
  private slowZones: SlowZone[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly getActiveRats: () => Rat[],
    private readonly onRatKilled: () => void,
  ) {
    this.uses = {
      qingZai:  GAME_BALANCE.skills.qingZai.uses,
      shuangZi: GAME_BALANCE.skills.shuangZi.uses,
      hongHui:  GAME_BALANCE.skills.hongHui.uses,
      baiHui:   GAME_BALANCE.skills.baiHui.uses,
      baoYe:    GAME_BALANCE.skills.baoYe.uses,
    };
  }

  getRemainingUses(): Readonly<Record<SkillType, number>> {
    return this.uses;
  }

  // A. 青仔檳榔 - 中範圍傷害
  useQingZai(): boolean {
    if (this.uses.qingZai <= 0) return false;
    this.uses.qingZai--;
    const { range, damage } = GAME_BALANCE.skills.qingZai;
    this.doAoEDamage(this.player.x, this.player.y, range, damage);
    this.showExplosion(this.player.x, this.player.y, range, 0x88ff44, 0x44cc00);
    return true;
  }

  // B. 雙子檳榔 - 大範圍傷害
  useShuangZi(): boolean {
    if (this.uses.shuangZi <= 0) return false;
    this.uses.shuangZi--;
    const { range, damage } = GAME_BALANCE.skills.shuangZi;
    this.doAoEDamage(this.player.x, this.player.y, range, damage);
    this.showExplosion(this.player.x, this.player.y, range, 0xffcc44, 0xff8800);
    return true;
  }

  // C. 紅灰檳榔 - 中範圍傷害 + 燃燒效果
  useHongHui(): boolean {
    if (this.uses.hongHui <= 0) return false;
    this.uses.hongHui--;
    const { range, damage, burnDamage, burnIntervalMs, burnDurationMs } = GAME_BALANCE.skills.hongHui;
    const rats = this.getActiveRats();
    rats.forEach((rat) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, rat.x, rat.y) <= range) {
        const wasActive = rat.active;
        rat.takeDamage(damage);
        if (wasActive && !rat.active) {
          this.onRatKilled();
        } else if (rat.active) {
          rat.applyBurn(burnDamage, burnIntervalMs, burnDurationMs);
        }
      }
    });
    this.showExplosion(this.player.x, this.player.y, range, 0xff6600, 0xff2200);
    return true;
  }

  // D. 白灰檳榔 - 大範圍減速持續區域
  useBaiHui(): boolean {
    if (this.uses.baiHui <= 0) return false;
    this.uses.baiHui--;
    const { range, slowFactor, durationMs } = GAME_BALANCE.skills.baiHui;
    const g = this.scene.add.graphics().setDepth(10);
    g.fillStyle(0xaaddff, 0.25);
    g.fillCircle(this.player.x, this.player.y, range);
    g.lineStyle(2, 0x88bbff, 0.9);
    g.strokeCircle(this.player.x, this.player.y, range);

    const zone: SlowZone = {
      x: this.player.x,
      y: this.player.y,
      radius: range,
      slowFactor,
      active: true,
      graphics: g,
    };
    this.slowZones.push(zone);

    this.scene.time.delayedCall(durationMs, () => {
      zone.active = false;
      g.destroy();
    });
    return true;
  }

  // E. 包葉檳榔 - 在紅花身旁產生保護罩，可抵擋3次傷害
  useBaoYe(): boolean {
    if (this.uses.baoYe <= 0) return false;
    this.uses.baoYe--;
    this.player.activateShield(GAME_BALANCE.skills.baoYe.shieldHits, GAME_BALANCE.skills.baoYe.radius);
    return true;
  }

  // 每幀呼叫，處理減速區域邏輯
  update(): void {
    this.slowZones = this.slowZones.filter((z) => z.active);

    const rats = this.getActiveRats();
    rats.forEach((rat) => {
      const zone = this.slowZones.find(
        (z) => Phaser.Math.Distance.Between(z.x, z.y, rat.x, rat.y) <= z.radius,
      );
      if (zone) {
        rat.applySlowField(zone.slowFactor);
      } else {
        rat.resetSlowField();
      }
    });
  }

  private doAoEDamage(x: number, y: number, range: number, damage: number): void {
    this.getActiveRats().forEach((rat) => {
      if (Phaser.Math.Distance.Between(x, y, rat.x, rat.y) <= range) {
        const wasActive = rat.active;
        rat.takeDamage(damage);
        if (wasActive && !rat.active) {
          this.onRatKilled();
        }
      }
    });
  }

  private showExplosion(x: number, y: number, radius: number, fillColor: number, strokeColor: number): void {
    const g = this.scene.add.graphics().setDepth(20);
    g.fillStyle(fillColor, 0.55);
    g.fillCircle(x, y, radius);
    g.lineStyle(3, strokeColor, 0.9);
    g.strokeCircle(x, y, radius);

    // 爆炸動畫：快速淡出
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 250,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }
}
