import Phaser from 'phaser';

export type TrapType = 'bear_trap' | 'bait_cheese' | 'barricade';

export class Trap extends Phaser.Physics.Arcade.Sprite {
  public trapType: TrapType = 'bear_trap';
  public durability = 1;
  public lastBiteTime?: number;
  private cheeseEmitters?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'trap_texture');
  }

  spawn(x: number, y: number, type: TrapType = 'bear_trap'): void {
    this.trapType = type;
    
    const upgrades = this.scene.registry.get('upgrades') as { cheeseDurability?: number; barricadeDurability?: number } | undefined;
    
    let texture = 'trap_texture';
    if (type === 'bait_cheese') {
      texture = 'trap_cheese';
      const level = upgrades?.cheeseDurability ?? 1;
      const cheeseValues = [3, 4, 6];
      this.durability = cheeseValues[Math.min(Math.max(1, level), cheeseValues.length) - 1];
    } else if (type === 'barricade') {
      texture = 'trap_barricade';
      const level = upgrades?.barricadeDurability ?? 1;
      const barricadeValues = [4, 6, 9];
      this.durability = barricadeValues[Math.min(Math.max(1, level), barricadeValues.length) - 1];
    } else {
      this.durability = 1;
    }

    this.setTexture(texture);
    if (type === 'bait_cheese') {
      this.setDisplaySize(20, 14);
    } else if (type === 'barricade') {
      this.setDisplaySize(32, 28);
    } else {
      this.setDisplaySize(24, 10);
    }

    this.body?.reset(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);

    if (this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.allowGravity = false;
      body.immovable = true;
      body.setSize(this.width, this.height);
    }

    // bait_cheese particle aroma
    if (type === 'bait_cheese') {
      this.createCheeseAroma();
    }
  }

  private createCheeseAroma(): void {
    this.destroyAroma();
    
    // Add small yellow particles rising from cheese
    const particles = this.scene.add.particles(this.x, this.y - 4, 'flame_particle', {
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0xffd166,
      speed: { min: 10, max: 20 },
      angle: { min: 240, max: 300 },
      lifespan: 800,
      frequency: 250,
    }).setDepth(15);
    
    this.cheeseEmitters = particles;
  }

  private destroyAroma(): void {
    if (this.cheeseEmitters) {
      this.cheeseEmitters.destroy();
      this.cheeseEmitters = undefined;
    }
  }

  takeDamage(amount: number): void {
    if (!this.active) return;
    this.durability -= amount;
    
    // Flash white when damaged
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      this.clearTint();
    });

    if (this.durability <= 0) {
      // Fade out and despawn
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.despawn();
        }
      });
    }
  }

  despawn(): void {
    this.destroyAroma();
    this.setActive(false);
    this.setVisible(false);
    this.body?.stop();
  }

  destroy(fromScene?: boolean): void {
    this.destroyAroma();
    super.destroy(fromScene);
  }
}