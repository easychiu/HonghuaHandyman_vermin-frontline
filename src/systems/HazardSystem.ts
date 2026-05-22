import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import { AudioSystem } from './AudioSystem';

interface SteamPipe {
  x: number;
  y: number;
  direction: 'up';
  isActive: boolean;
  graphics: Phaser.GameObjects.Graphics;
  particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  nextBlastTime: number;
  blastEndTime: number;
}

interface NeonSign {
  sprite: Phaser.GameObjects.Text;
  dropped: boolean;
  landed: boolean;
  body: Phaser.Physics.Arcade.Body;
}

export class HazardSystem {
  private steamPipes: SteamPipe[] = [];
  private neonSigns: NeonSign[] = [];
  private activeShockFields: { 
    x: number; 
    y: number; 
    radius: number; 
    endTime: number; 
    graphics: Phaser.GameObjects.Graphics; 
    particles: Phaser.GameObjects.Particles.ParticleEmitter 
  }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly missionId: string,
    private readonly player: Player,
    private readonly getActiveRats: () => Rat[],
    private readonly platforms: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.initHazards();
  }

  private initHazards(): void {
    const { width, height } = this.scene.scale;

    // 1. Steam Pipes (Sewers: C, D, and also A since A is the default sewer disturbance map)
    if (this.missionId === 'A' || this.missionId === 'C' || this.missionId === 'D') {
      const pipeCoords = [
        { x: 220, y: height - 60 },
        { x: 740, y: height - 60 }
      ];

      pipeCoords.forEach(c => {
        // Draw a tiny pipe valve/outlet
        const pg = this.scene.add.graphics().setDepth(15);
        pg.fillStyle(0x7f8c8d, 1);
        pg.fillRect(c.x - 10, c.y, 20, 15);
        pg.lineStyle(2, 0xbdc3c7, 1);
        pg.strokeRect(c.x - 10, c.y, 20, 15);

        this.steamPipes.push({
          x: c.x,
          y: c.y,
          direction: 'up',
          isActive: false,
          graphics: this.scene.add.graphics().setDepth(16),
          nextBlastTime: this.scene.time.now + Phaser.Math.Between(2000, 5000),
          blastEndTime: 0
        });
      });
    }

    // 2. Hanging Neon Signs (Surface: A, B)
    if (this.missionId === 'A' || this.missionId === 'B') {
      const signCoords = [
        { x: 280, y: 70 },
        { x: 680, y: 70 }
      ];

      signCoords.forEach((c, idx) => {
        const colors = ['#ff0055', '#00ffcc'];
        const text = this.scene.add.text(c.x, c.y, idx === 0 ? '★ 紅花萬事屋 ★' : '霓虹夜市 🍜', {
          fontFamily: '"Microsoft JhengHei", sans-serif',
          fontSize: '18px',
          color: colors[idx % colors.length],
          backgroundColor: '#111111',
          padding: { x: 8, y: 4 },
          stroke: colors[idx % colors.length],
          strokeThickness: 2,
          shadow: { color: colors[idx % colors.length], fill: true, offsetX: 0, offsetY: 0, blur: 8 }
        }).setOrigin(0.5).setDepth(20);

        this.scene.physics.add.existing(text);
        const body = text.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setAllowGravity(false);
          body.setImmovable(true);
          body.setSize(text.width, text.height);
          
          this.scene.physics.add.collider(text, this.platforms, () => {
            this.handleSignLanded(neonSign);
          }, undefined, this);
        }

        const neonSign: NeonSign = {
          sprite: text,
          dropped: false,
          landed: false,
          body
        };
        this.neonSigns.push(neonSign);

        const wires = this.scene.add.graphics().setDepth(19);
        wires.lineStyle(1.5, 0x333333, 1);
        wires.lineBetween(c.x - 30, 0, c.x - 30, c.y - 12);
        wires.lineBetween(c.x + 30, 0, c.x + 30, c.y - 12);
        
        text.setData('wires', wires);
      });
    }
  }

  private handleSignLanded(sign: NeonSign): void {
    if (sign.landed) return;
    sign.landed = true;
    
    AudioSystem.playElectricBuzz();
    
    this.scene.cameras.main.shake(200, 0.008);
    
    const sparks = this.scene.add.particles(sign.sprite.x, sign.sprite.y + 10, 'flame_particle', {
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 1, end: 0 },
      tint: 0x00ffff,
      speed: { min: 80, max: 180 },
      angle: { min: 180, max: 360 },
      gravityY: 400,
      lifespan: 600,
      count: 20
    }).setDepth(21);
    
    this.scene.time.delayedCall(800, () => sparks.destroy());

    const shockFieldX = sign.sprite.x;
    const shockFieldY = sign.sprite.y + 10;
    const radius = 100;
    
    const fieldG = this.scene.add.graphics().setDepth(10);
    fieldG.lineStyle(3, 0x00ffcc, 0.8);
    fieldG.fillStyle(0x00ffcc, 0.15);
    fieldG.fillCircle(shockFieldX, shockFieldY, radius);
    fieldG.strokeCircle(shockFieldX, shockFieldY, radius);

    const shockParticles = this.scene.add.particles(shockFieldX, shockFieldY, 'flame_particle', {
      scale: { start: 0.3, end: 0.05 },
      alpha: { start: 0.7, end: 0 },
      tint: 0x00ffcc,
      speed: { min: 10, max: 40 },
      lifespan: 400,
      frequency: 80,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Circle(0, 0, radius)
      }
    }).setDepth(9);

    this.activeShockFields.push({
      x: shockFieldX,
      y: shockFieldY,
      radius,
      endTime: this.scene.time.now + 2000,
      graphics: fieldG,
      particles: shockParticles
    });

    this.scene.tweens.add({
      targets: sign.sprite,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => {
        sign.sprite.destroy();
      }
    });
  }

  public update(delta: number): void {
    const now = this.scene.time.now;

    // --- Steam Pipes Update ---
    this.steamPipes.forEach(p => {
      if (!p.isActive && now >= p.nextBlastTime) {
        p.isActive = true;
        p.blastEndTime = now + 1500;
        p.nextBlastTime = now + Phaser.Math.Between(4000, 7000);
        
        AudioSystem.playSteamHiss();

        p.particles = this.scene.add.particles(p.x, p.y, 'flame_particle', {
          scale: { start: 0.5, end: 1.5 },
          alpha: { start: 0.6, end: 0 },
          tint: 0xdddddd,
          speedY: { min: -180, max: -280 },
          speedX: { min: -30, max: 30 },
          lifespan: 600,
          frequency: 30
        }).setDepth(20);
      }

      if (p.isActive) {
        p.graphics.clear();
        p.graphics.fillStyle(0xffffff, 0.2);
        p.graphics.fillRect(p.x - 15, p.y - 150, 30, 150);
        
        const area = new Phaser.Geom.Rectangle(p.x - 15, p.y - 150, 30, 150);
        
        if (this.player.active && Phaser.Geom.Rectangle.Contains(area, this.player.x, this.player.y)) {
          this.player.receiveRatDamage(0.2 * (delta / 1000) * 60);
          this.scene.registry.set('playerHp', this.player.hp);
        }

        const rats = this.getActiveRats();
        rats.forEach(rat => {
          if (rat.active && Phaser.Geom.Rectangle.Contains(area, rat.x, rat.y)) {
            rat.takeDamage(0.5 * (delta / 1000) * 60);
          }
        });

        if (now >= p.blastEndTime) {
          p.isActive = false;
          p.graphics.clear();
          if (p.particles) {
            p.particles.destroy();
            p.particles = undefined;
          }
        }
      }
    });

    // --- Hanging Neon Signs Update ---
    this.neonSigns.forEach(sign => {
      if (!sign.dropped && sign.sprite.active) {
        const distToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, sign.sprite.x, sign.sprite.y);
        const isBroomHitting = distToPlayer < 75 && this.player.anims.currentAnim?.key === 'honghua-attack';

        if (isBroomHitting) {
          this.dropNeonSign(sign);
        }
      }
    });

    // --- Active Shock Fields Update ---
    this.activeShockFields = this.activeShockFields.filter(f => {
      if (now >= f.endTime) {
        f.graphics.destroy();
        f.particles.destroy();
        return false;
      }

      const rats = this.getActiveRats();
      rats.forEach(rat => {
        if (rat.active && Phaser.Math.Distance.Between(f.x, f.y, rat.x, rat.y) <= f.radius) {
          rat.takeDamage(1.5 * (delta / 1000) * 60);
          rat.applySlowField(0.0);
          
          rat.setTint(0x00ffff);
          this.scene.time.delayedCall(200, () => {
            if (rat.active) {
              rat.clearTint();
            }
          });
        }
      });

      return true;
    });
  }

  public checkExplosionTrigger(x: number, y: number, radius: number): void {
    this.neonSigns.forEach(sign => {
      if (!sign.dropped && sign.sprite.active) {
        const dist = Phaser.Math.Distance.Between(x, y, sign.sprite.x, sign.sprite.y);
        if (dist <= radius + 40) {
          this.dropNeonSign(sign);
        }
      }
    });
  }

  private dropNeonSign(sign: NeonSign): void {
    sign.dropped = true;
    
    const wires = sign.sprite.getData('wires') as Phaser.GameObjects.Graphics | undefined;
    if (wires) {
      wires.destroy();
    }

    if (sign.body) {
      sign.body.setAllowGravity(true);
      sign.body.setImmovable(false);
      sign.body.setVelocityY(200);
    }
  }

  public destroy(): void {
    this.steamPipes.forEach(p => {
      p.graphics.destroy();
      p.particles?.destroy();
    });
    this.neonSigns.forEach(s => {
      s.sprite.destroy();
      const wires = s.sprite.getData('wires') as Phaser.GameObjects.Graphics | undefined;
      wires?.destroy();
    });
    this.activeShockFields.forEach(f => {
      f.graphics.destroy();
      f.particles.destroy();
    });
  }
}
