import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Rat } from './Rat';

export class AnzoAgent {
  private scene: Phaser.Scene;
  private yLevel: number;
  private getActiveRats: () => Rat[];
  private onRatKilled: () => void;

  private policeCarRight?: Phaser.Physics.Arcade.Sprite;
  private policeCarLeft?: Phaser.Physics.Arcade.Sprite;
  private agentSprite?: Phaser.Physics.Arcade.Sprite;
  private flameZone?: Phaser.GameObjects.Zone;
  private flameParticles?: Phaser.GameObjects.Particles.ParticleEmitterManager | Phaser.GameObjects.Particles.ParticleEmitter;
  
  private isFlameActive = false;
  private active = true;

  constructor(scene: Phaser.Scene, yLevel: number, getActiveRats: () => Rat[], onRatKilled: () => void) {
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
    this.policeCarRight = this.scene.physics.add.sprite(width + 120, carY, 'police_car');
    this.policeCarRight.setDepth(15);
    if (this.policeCarRight.body) {
      (this.policeCarRight.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    // 警車閃爍燈光效果
    const sirenTimer = this.scene.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!this.policeCarRight?.active) return;
        this.policeCarRight.setTint(this.policeCarRight.tintTopLeft === 0xffffff ? 0xff3333 : 0xffffff);
      }
    });

    this.scene.tweens.add({
      targets: this.policeCarRight,
      x: width - 80,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        sirenTimer.remove();
        this.policeCarRight?.clearTint();
        
        // 2. 特工下車，向左奔跑
        this.spawnAgent();
      }
    });
  }

  private spawnAgent(): void {
    const width = this.scene.scale.width;
    // 特工從警車位置下車，往左跑
    this.agentSprite = this.scene.physics.add.sprite(width - 100, this.yLevel, 'anzo_agent');
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
        
        // 更新火焰判定區與粒子發射器的位置
        this.flameZone.x = this.agentSprite.x - 60;
        this.flameZone.y = this.agentSprite.y;

        // 如果是舊版 Phaser 3 粒子發射器
        if (this.flameParticles) {
          const emitter = (this.flameParticles as any).emitters ? (this.flameParticles as any).emitters.first : this.flameParticles;
          if (emitter) {
            emitter.setPosition(this.agentSprite.x - 25, this.agentSprite.y - 5);
          }
        }

        // 火焰傷害判定
        this.checkFlameDamage();
      },
      onComplete: () => {
        this.isFlameActive = false;
        if (this.flameParticles) {
          (this.flameParticles as any).destroy ? (this.flameParticles as any).destroy() : (this.flameParticles as any).stop();
        }
        this.flameZone?.destroy();

        // 3. 另一輛警車從左側開入接走特工
        this.pickupAgentAndLeave();
      }
    });
  }

  private createFlameParticles(): void {
    if (!this.agentSprite) return;

    // 建立粒子系統
    // Phaser 3.60+ 使用 add.particles(key) 獲取 Emitter, 3.50- 使用 ParticleManager
    const particles = this.scene.add.particles('flame_particle').setDepth(18);
    
    // 設定發射器參數
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

    // 相容不同版本的 Phaser 粒子建立 API
    if ((particles as any).createEmitter) {
      this.flameParticles = (particles as any).createEmitter(emitterConfig);
    } else {
      // Phaser 3.60 之後直接返回 emitter
      this.flameParticles = particles as any;
    }
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
            rat.setTint(GAME_BALANCE.rat.profiles[rat.faction].tint);
          }
        });

        if (wasActive && !rat.active) {
          this.onRatKilled();
        }
      }
    });
  }

  private pickupAgentAndLeave(): void {
    const carY = this.yLevel - 15;
    // 警車從左側外開入到 x = 80 處
    this.policeCarLeft = this.scene.physics.add.sprite(-120, carY, 'police_car');
    this.policeCarLeft.setDepth(15);
    this.policeCarLeft.setFlipX(true); // 面向右邊開進來
    if (this.policeCarLeft.body) {
      (this.policeCarLeft.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    const sirenTimer = this.scene.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!this.policeCarLeft?.active) return;
        this.policeCarLeft.setTint(this.policeCarLeft.tintTopLeft === 0xffffff ? 0x3333ff : 0xffffff);
      }
    });

    this.scene.tweens.add({
      targets: this.policeCarLeft,
      x: 80,
      duration: 800,
      ease: 'Quad.easeOut',
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
          onComplete: () => {
            sirenTimer.remove();
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
            onComplete: () => {
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
    this.policeCarLeft?.destroy();
    this.policeCarRight?.destroy();
    this.agentSprite?.destroy();
    this.flameZone?.destroy();
    if (this.flameParticles) {
      (this.flameParticles as any).destroy ? (this.flameParticles as any).destroy() : (this.flameParticles as any).stop();
    }
  }

  private ensureTextures(): void {
    // 1. 警車材質
    if (!this.scene.textures.exists('police_car')) {
      const g = this.scene.add.graphics();
      // 車身 (藍白相間)
      g.fillStyle(0x1d3557);
      g.fillRect(0, 10, 80, 25);
      g.fillStyle(0xffffff);
      g.fillRect(20, 10, 40, 25);
      // 車頂
      g.fillStyle(0x1d3557);
      g.fillRect(25, 0, 30, 10);
      // 車輪
      g.fillStyle(0x111111);
      g.fillCircle(18, 35, 8);
      g.fillCircle(62, 35, 8);
      // 警車紅藍警燈
      g.fillStyle(0xff3333);
      g.fillRect(35, -3, 5, 3);
      g.fillStyle(0x3333ff);
      g.fillRect(40, -3, 5, 3);

      g.generateTexture('police_car', 80, 45);
      g.destroy();
    }

    // 2. 特工材質 (帶黃色防護服的特工)
    if (!this.scene.textures.exists('anzo_agent')) {
      const g = this.scene.add.graphics();
      // 身體 (黑色衣服 + 黃色背心)
      g.fillStyle(0x222222);
      g.fillRect(6, 12, 16, 28);
      g.fillStyle(0xffd166);
      g.fillRect(6, 14, 16, 12);
      // 頭部
      g.fillStyle(0xffd166);
      g.fillRect(8, 2, 12, 10);
      // 面罩
      g.fillStyle(0x111111);
      g.fillRect(10, 4, 8, 4);
      // 火焰槍 (灰色)
      g.fillStyle(0x777777);
      g.fillRect(0, 20, 14, 5); // 槍管
      g.fillStyle(0x444444);
      g.fillRect(16, 16, 8, 14); // 氣瓶

      g.generateTexture('anzo_agent', 26, 40);
      g.destroy();
    }

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
