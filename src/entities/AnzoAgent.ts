import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Rat } from './Rat';

export class AnzoAgent {
  private scene: Phaser.Scene;
  private yLevel: number;
  private getActiveRats: () => Rat[];
  private onRatKilled: (rat: Rat, comboCount: number) => void;

  private policeCarRight?: Phaser.Physics.Arcade.Sprite;
  private policeCarLeft?: Phaser.Physics.Arcade.Sprite;
  private agentSprite?: Phaser.Physics.Arcade.Sprite;
  private flameZone?: Phaser.GameObjects.Zone;
  private flameParticles?: Phaser.GameObjects.Particles.ParticleEmitterManager | Phaser.GameObjects.Particles.ParticleEmitter;
  
  private isFlameActive = false;
  private active = true;

  private glowRight?: Phaser.GameObjects.Arc;
  private glowLeft?: Phaser.GameObjects.Arc;
  private sirenTimerRight?: Phaser.Time.TimerEvent;
  private sirenTimerLeft?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, yLevel: number, getActiveRats: () => Rat[], onRatKilled: (rat: Rat, comboCount: number) => void) {
    this.scene = scene;
    this.yLevel = yLevel;
    this.getActiveRats = getActiveRats;
    this.onRatKilled = onRatKilled;

    this.ensureTextures();
    this.startSequence();
  }

  private startSequence(): void {
    const width = this.scene.scale.width;
    
    // 1. 警車從右側開入
    // 警車起點為螢幕右側外，停在 width - 80 處
    const carY = this.yLevel - 15; // 警車稍微往上一點貼齊地面
    this.policeCarRight = this.scene.physics.add.sprite(width + 120, carY, 'police_car').setDisplaySize(80, 45);
    this.policeCarRight.setDepth(15);
    if (this.policeCarRight.body) {
      (this.policeCarRight.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    this.glowRight = this.scene.add.circle(this.policeCarRight.x, this.policeCarRight.y - 25, 30, 0xff0000, 0.3)
      .setDepth(14);

    let colorIdx = 0;
    const colors = [0xff0000, 0x0000ff];
    this.sirenTimerRight = this.scene.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!this.policeCarRight?.active || !this.glowRight) return;
        colorIdx = 1 - colorIdx;
        const currentGlowColor = colors[colorIdx];
        this.glowRight.setFillStyle(currentGlowColor, 0.45);
        this.glowRight.setScale(1.2);
        this.scene.tweens.add({
          targets: this.glowRight,
          scale: 0.8,
          alpha: 0.15,
          duration: 140,
        });
        this.policeCarRight.setTint(currentGlowColor === 0xff0000 ? 0xffaaaa : 0xaaaaff);
      }
    });

    this.scene.tweens.add({
      targets: this.policeCarRight,
      x: width - 80,
      duration: 1000,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        if (this.policeCarRight && this.glowRight) {
          this.glowRight.x = this.policeCarRight.x;
          this.glowRight.y = this.policeCarRight.y - 25;
        }
      },
      onComplete: () => {
        // 2. 特工下車，向左奔跑
        this.spawnAgent();
      }
    });
  }

  private spawnAgent(): void {
    const width = this.scene.scale.width;
    // 特工從警車位置下車，往左跑
    this.agentSprite = this.scene.physics.add.sprite(width - 100, this.yLevel, 'anzo_agent').setDisplaySize(26, 40);
    this.agentSprite.setDepth(20);
    this.agentSprite.setFlipX(true); // 面向左邊
    if (this.agentSprite.body) {
      (this.agentSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    // 建立火焰噴射粒子效果
    this.createFlameParticles();

    // 建立火焰傷害判定區 (Zone)
    // 判定區位於特工左側
    this.flameZone = this.scene.add.zone(this.agentSprite.x - 60, this.yLevel, 100, 60);
    this.scene.physics.add.existing(this.flameZone);
    if (this.flameZone.body) {
      (this.flameZone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    this.isFlameActive = true;

    // 特工奔跑向左的 Tween
    this.scene.tweens.add({
      targets: this.agentSprite,
      x: 100,
      duration: 3500,
      onUpdate: () => {
        if (!this.agentSprite || !this.flameZone) return;
        
        // Shake camera slightly on each update during fire spraying
        this.scene.cameras.main.shake(50, 0.0015, false);

        // 更新火焰判定區與粒子發射器的位置
        this.flameZone.x = this.agentSprite.x - 60;
        this.flameZone.y = this.agentSprite.y;

        if (this.flameParticles) {
          this.flameParticles.setPosition(this.agentSprite.x - 25, this.agentSprite.y - 5);
        }

        // 火焰傷害判定
        this.checkFlameDamage();
      },
      onComplete: () => {
        this.isFlameActive = false;
        if (this.flameParticles) {
          this.flameParticles.destroy();
          this.flameParticles = undefined;
        }
        this.flameZone?.destroy();

        // 3. 另一輛警車從左側開入接走特工
        this.pickupAgentAndLeave();
      }
    });
  }

  private createFlameParticles(): void {
    if (!this.agentSprite) return;

    const emitterConfig = {
      x: this.agentSprite.x - 25,
      y: this.agentSprite.y - 5,
      speed: { min: 180, max: 280 },
      angle: { min: 160, max: 200 }, // 向左噴射
      scale: { start: 1.5, end: 0.2 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      blendMode: 'ADD',
      frequency: 20
    };

    // Use Phaser 3.60+ compatible direct particle configuration
    this.flameParticles = this.scene.add.particles(0, 0, 'flame_particle', emitterConfig).setDepth(18);
  }

  private checkFlameDamage(): void {
    if (!this.isFlameActive || !this.flameZone) return;

    const rats = this.getActiveRats();
    const zoneBounds = this.flameZone.getBounds();

    rats.forEach((rat) => {
      if (!rat.active || rat.hp <= 0) return;

      const ratBounds = rat.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(zoneBounds, ratBounds)) {
        const wasActive = rat.active;
        // 火焰造成極高傷害 (10 點，直接秒殺或重創)
        rat.takeDamage(GAME_BALANCE.skills.anzo.damage);
        
        // 點燃老鼠特效
        rat.setTintFill(0xff3300);
        this.scene.time.delayedCall(200, () => {
          if (rat.active) {
            rat.clearTint();
          }
        });

        if (wasActive && !rat.active) {
          this.onRatKilled(rat, 0);
        }
      }
    });
  }

  private pickupAgentAndLeave(): void {
    const carY = this.yLevel - 15;
    // 警車從左側外開入到 x = 80 處
    this.policeCarLeft = this.scene.physics.add.sprite(-120, carY, 'police_car').setDisplaySize(80, 45);
    this.policeCarLeft.setDepth(15);
    this.policeCarLeft.setFlipX(true); // 面向右邊開進來
    if (this.policeCarLeft.body) {
      (this.policeCarLeft.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    this.glowLeft = this.scene.add.circle(this.policeCarLeft.x, this.policeCarLeft.y - 25, 30, 0x0000ff, 0.3)
      .setDepth(14);

    let colorIdx = 0;
    const colors = [0xff0000, 0x0000ff];
    this.sirenTimerLeft = this.scene.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!this.policeCarLeft?.active || !this.glowLeft) return;
        colorIdx = 1 - colorIdx;
        const currentGlowColor = colors[colorIdx];
        this.glowLeft.setFillStyle(currentGlowColor, 0.45);
        this.glowLeft.setScale(1.2);
        this.scene.tweens.add({
          targets: this.glowLeft,
          scale: 0.8,
          alpha: 0.15,
          duration: 140,
        });
        this.policeCarLeft.setTint(currentGlowColor === 0xff0000 ? 0xffaaaa : 0xaaaaff);
      }
    });

    this.scene.tweens.add({
      targets: this.policeCarLeft,
      x: 80,
      duration: 800,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        if (this.policeCarLeft && this.glowLeft) {
          this.glowLeft.x = this.policeCarLeft.x;
          this.glowLeft.y = this.policeCarLeft.y - 25;
        }
      },
      onComplete: () => {
        // 特工上車消失
        this.agentSprite?.destroy();
        this.agentSprite = undefined;

        // 警車向左駛離
        this.scene.tweens.add({
          targets: this.policeCarLeft,
          x: -200,
          duration: 1200,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            if (this.policeCarLeft && this.glowLeft) {
              this.glowLeft.x = this.policeCarLeft.x;
              this.glowLeft.y = this.policeCarLeft.y - 25;
            }
          },
          onComplete: () => {
            this.sirenTimerLeft?.remove();
            this.glowLeft?.destroy();
            this.glowLeft = undefined;
            this.destroy();
          }
        });

        // 右側的警車此時也駛離畫面
        if (this.policeCarRight) {
          this.scene.tweens.add({
            targets: this.policeCarRight,
            x: this.scene.scale.width + 200,
            duration: 1200,
            ease: 'Quad.easeIn',
            onUpdate: () => {
              if (this.policeCarRight && this.glowRight) {
                this.glowRight.x = this.policeCarRight.x;
                this.glowRight.y = this.policeCarRight.y - 25;
              }
            },
            onComplete: () => {
              this.sirenTimerRight?.remove();
              this.glowRight?.destroy();
              this.glowRight = undefined;
              this.policeCarRight?.destroy();
              this.policeCarRight = undefined;
            }
          });
        }
      }
    });
  }

  private destroy(): void {
    this.active = false;
    this.sirenTimerRight?.remove();
    this.sirenTimerLeft?.remove();
    this.glowRight?.destroy();
    this.glowLeft?.destroy();
    this.policeCarLeft?.destroy();
    this.policeCarRight?.destroy();
    this.agentSprite?.destroy();
    this.flameZone?.destroy();
    if (this.flameParticles) {
      this.flameParticles.destroy();
      this.flameParticles = undefined;
    }
  }

  private ensureTextures(): void {
    // 3. 火焰粒子材質
    if (!this.scene.textures.exists('flame_particle')) {
      const g = this.scene.add.graphics();
      // 漸層黃橙色小圓點
      g.fillStyle(0xff9f1c, 0.8);
      g.fillCircle(4, 4, 4);
      g.generateTexture('flame_particle', 8, 8);
      g.destroy();
    }
  }
}
