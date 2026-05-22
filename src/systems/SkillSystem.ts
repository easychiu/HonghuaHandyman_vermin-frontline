import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import { AnzoAgent } from '../entities/AnzoAgent';

export type SkillType = 'qingZai' | 'shuangZi' | 'hongHui' | 'shiHui' | 'baoYe' | 'anzo';

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
    private readonly onRatKilled: (_combo: number) => void,
  ) {
    this.uses = {
      qingZai:  GAME_BALANCE.skills.qingZai.uses,
      shuangZi: GAME_BALANCE.skills.shuangZi.uses,
      hongHui:  GAME_BALANCE.skills.hongHui.uses,
      shiHui:   (GAME_BALANCE.skills as any).shiHui?.uses ?? 1,
      baoYe:    GAME_BALANCE.skills.baoYe.uses,
      anzo:     GAME_BALANCE.skills.anzo.uses,
    };
  }

  getRemainingUses(): Readonly<Record<SkillType, number>> {
    return this.uses;
  }

  private throwProjectile(
    type: 'qingZai' | 'shuangZi' | 'hongHui' | 'shiHui',
    throwDistance: number,
    onImpact: (impactX: number, impactY: number) => void
  ): void {
    this.player.playThrowAnimation(type);
    const impact = this.getThrowImpactPosition(throwDistance);

    let tint = 0xffffff;
    if (type === 'qingZai') tint = 0x88ff44;
    else if (type === 'shuangZi') tint = 0xffcc44;
    else if (type === 'hongHui') tint = 0xff6600;
    else if (type === 'shiHui') tint = 0x4cc9f0;

    // Lock projectile height to standard ground level corresponding to player layer
    let targetGroundY = GAME_BALANCE.world.surfaceY - 10;
    if (this.player.y > GAME_BALANCE.world.surfaceY + 20) {
      targetGroundY = this.scene.scale.height - 40;
    }
    const projectileStartY = targetGroundY - 20;

    const projectile = this.scene.add.sprite(this.player.x, projectileStartY, 'betel_nut').setDepth(30);
    projectile.setTint(tint);
    projectile.setScale(0.5);

    // Particle emitter for smoke trail trailing behind
    const trailParticles = this.scene.add.particles(0, 0, 'flame_particle', {
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.5, end: 0 },
      tint: tint,
      speed: { min: 5, max: 15 },
      lifespan: 300,
      frequency: 20,
    }).setDepth(29);
    
    trailParticles.startFollow(projectile);

    const flightTime = 400; // 400ms flight
    this.scene.tweens.add({
      targets: projectile,
      x: impact.x,
      duration: flightTime,
      ease: 'Linear',
    });

    this.scene.tweens.add({
      targets: projectile,
      y: projectileStartY - 48,
      duration: flightTime / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        projectile.destroy();
        trailParticles.destroy();
        onImpact(impact.x, targetGroundY);
      }
    });
  }

  // A. 青仔檳榔 - 中範圍傷害
  useQingZai(): boolean {
    if (this.uses.qingZai <= 0) return false;
    this.uses.qingZai--;
    const { range, damage, throwDistance } = GAME_BALANCE.skills.qingZai;
    this.throwProjectile('qingZai', throwDistance, (x, y) => {
      this.doAoEDamage(x, y, range, damage);
      this.showShockwaveExplosion(x, y, range, 0x88ff44, 0x44cc00, 2);
    });
    return true;
  }

  // B. 雙生檳榔 - 大範圍傷害
  useShuangZi(): boolean {
    if (this.uses.shuangZi <= 0) return false;
    this.uses.shuangZi--;
    const { range, damage, throwDistance } = GAME_BALANCE.skills.shuangZi;
    this.throwProjectile('shuangZi', throwDistance, (x, y) => {
      this.doAoEDamage(x, y, range, damage);
      // Twin explosions
      this.showShockwaveExplosion(x, y, range, 0xffcc44, 0xff8800, 3);
      this.scene.time.delayedCall(120, () => {
        this.showShockwaveExplosion(x, y, range * 0.6, 0xffffff, 0xffcc44, 2);
      });
    });
    return true;
  }

  // C. 紅灰檳榔 - 中範圍傷害 + 燃燒效果
  useHongHui(): boolean {
    if (this.uses.hongHui <= 0) return false;
    this.uses.hongHui--;
    const { range, damage, burnDamage, burnIntervalMs, burnDurationMs, throwDistance } = GAME_BALANCE.skills.hongHui;
    this.throwProjectile('hongHui', throwDistance, (x, y) => {
      const rats = this.getActiveRats();
      rats.forEach((rat) => {
        if (Phaser.Math.Distance.Between(x, y, rat.x, rat.y) <= range) {
          const wasActive = rat.active;
          rat.takeDamage(damage);
          if (wasActive && !rat.active) {
            this.onRatKilled(0);
          } else if (rat.active) {
            rat.applyBurn(burnDamage, burnIntervalMs, burnDurationMs);
          }
        }
      });
      this.showShockwaveExplosion(x, y, range, 0xff6600, 0xff2200, 3);
      // Linger fire ring
      const fireRing = this.scene.add.graphics().setDepth(12);
      fireRing.lineStyle(3, 0xff4400, 0.7);
      fireRing.strokeCircle(x, y, range * 0.7);
      this.scene.tweens.add({
        targets: fireRing,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => fireRing.destroy(),
      });
    });
    return true;
  }

  // D. 石灰檳榔 - 大範圍減速持續區域
  useShiHui(): boolean {
    const usesLeft = (this.uses as any).shiHui ?? 0;
    if (usesLeft <= 0) return false;
    (this.uses as any).shiHui--;
    const skillConfig = (GAME_BALANCE.skills as any).shiHui;
    const { range, slowFactor, durationMs, throwDistance } = skillConfig;
    this.throwProjectile('shiHui', throwDistance, (x, y) => {
      const g = this.scene.add.graphics().setDepth(10);
      g.fillStyle(0xaaddff, 0.25);
      g.fillCircle(x, y, range);
      g.lineStyle(2, 0x88bbff, 0.9);
      g.strokeCircle(x, y, range);

      // Create ice-blue blizzard/snow particle effect in the slow zone
      const iceParticles = this.scene.add.particles(x, y, 'flame_particle', {
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xa8dadc, // ice blue tint
        speed: { min: 20, max: 50 },
        angle: { min: 0, max: 360 },
        lifespan: 1000,
        frequency: 150,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Circle(0, 0, range)
        }
      }).setDepth(9);

      const zone: SlowZone = {
        x,
        y,
        radius: range,
        slowFactor,
        active: true,
        graphics: g,
      };
      this.slowZones.push(zone);

      this.scene.time.delayedCall(durationMs, () => {
        zone.active = false;
        g.destroy();
        iceParticles.destroy();
      });
    });
    return true;
  }

  // E. 包葉檳榔 - 在紅花身旁產生保護罩，可抵擋3次傷害
  useBaoYe(): boolean {
    if (this.uses.baoYe <= 0) return false;
    this.uses.baoYe--;
    this.player.playThrowAnimation('baoYe');

    const upgrades = this.scene.registry.get('upgrades') as { baoYeShield?: number } | undefined;
    const level = upgrades?.baoYeShield ?? 1;
    const shieldValues = [3, 5, 8];
    const shieldHits = shieldValues[Math.min(Math.max(1, level), shieldValues.length) - 1];

    this.player.activateShield(shieldHits, GAME_BALANCE.skills.baoYe.radius);
    return true;
  }

  // F. 庵左特工召喚
  useAnzo(): boolean {
    if (this.uses.anzo <= 0) return false;
    this.uses.anzo--;
    
    const yLevel = this.player.y > GAME_BALANCE.world.surfaceY + 20 
      ? this.scene.scale.height - 60 
      : GAME_BALANCE.world.surfaceY - 20; 

    new AnzoAgent(this.scene, yLevel, this.getActiveRats, this.onRatKilled);
    return true;
  }

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

  private showShockwaveExplosion(
    x: number, y: number, radius: number,
    fillColor: number, strokeColor: number,
    rings: number,
  ): void {
    for (let i = 0; i < rings; i++) {
      const delay = i * 80;
      const g = this.scene.add.graphics().setDepth(20);
      this.scene.time.delayedCall(delay, () => {
        const scale = 1 + i * 0.3;
        g.fillStyle(fillColor, 0.5 / (i + 1));
        g.fillCircle(x, y, radius);
        g.lineStyle(3 - i, strokeColor, 0.9);
        g.strokeCircle(x, y, radius);
        this.scene.tweens.add({
          targets: g,
          scaleX: scale,
          scaleY: scale,
          alpha: 0,
          duration: 350,
          ease: 'Power2',
          onComplete: () => g.destroy(),
        });
      });
    }
    // Central flash
    const flash = this.scene.add.graphics().setDepth(25);
    flash.fillStyle(0xffffff, 0.7);
    flash.fillCircle(x, y, radius * 0.3);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  /** @deprecated kept for compatibility; use showShockwaveExplosion instead */
  private showExplosion(x: number, y: number, radius: number, fillColor: number, strokeColor: number): void {
    this.showShockwaveExplosion(x, y, radius, fillColor, strokeColor, 2);
  }

  private getThrowImpactPosition(distance: number): { x: number; y: number } {
    const direction = this.player.facingDirection >= 0 ? 1 : -1;
    const worldBounds = this.scene.physics.world.bounds;
    const minX = worldBounds.x;
    const maxX = worldBounds.right;
    return {
      x: Phaser.Math.Clamp(this.player.x + direction * distance, minX, maxX),
      y: this.player.y,
    };
  }
}
