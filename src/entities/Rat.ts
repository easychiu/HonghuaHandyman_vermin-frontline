import Phaser from 'phaser';
import { GAME_BALANCE, RatFaction } from '../config/gameBalance';
import { RatState } from '../types/ratState';

export class Rat extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed = 100;
  public currentDirection = 1;
  public isPanicking = false;
  public isClimbing = false;
  public faction: RatFaction = 'green';
  public hp = 2;
  private maxHp = 2;
  private panicThreshold = 0.3;
  public state: RatState = 'wander';
  private canTakeDamage = true;
  private edgeCheckTimer = 0;
  private bossTargetPipeX?: number;
  private bossSurfaceY = GAME_BALANCE.world.surfaceY;
  private escapePipeX?: number;
  private surfaceY = GAME_BALANCE.world.surfaceY;
  // External speed multiplier applied by slow zones (1.0 = normal, < 1.0 = slowed)
  public externalSpeedMultiplier = 1.0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'rat');
  }

  spawn(x: number, y: number, velocityX: number, faction: RatFaction = 'green'): void {
    this.body?.reset(x, y);
    this.setActive(true);
    this.setVisible(true);

    this.faction = faction;
    const profile = GAME_BALANCE.rat.profiles[faction];

    this.maxHp = profile.maxHp;
    this.hp = profile.maxHp;
    this.moveSpeed = profile.moveSpeed;
    this.panicThreshold = profile.panicThreshold;
    this.setTint(profile.tint);
    this.setScale(profile.scale);

    this.currentDirection = velocityX >= 0 ? 1 : -1;
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    this.setFlipX(this.currentDirection === -1);
    this.setBounceY(0.2);

    this.isPanicking = false;
    this.isClimbing = false;
    this.state = 'wander';
    this.canTakeDamage = true;
    this.edgeCheckTimer = 0;
    this.bossTargetPipeX = undefined;
    this.bossSurfaceY = GAME_BALANCE.world.surfaceY;
    this.surfaceY = GAME_BALANCE.world.surfaceY;
    this.externalSpeedMultiplier = 1.0;

    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    }
  }

  configureEscapeRoute(pipeX: number, surfaceY: number): void {
    this.escapePipeX = pipeX;
    this.surfaceY = surfaceY;
    this.bossSurfaceY = surfaceY;
  }

  takeDamage(amount: number): void {
    if (!this.active || this.hp <= 0 || !this.canTakeDamage) {
      return;
    }

    this.hp -= amount;
    this.canTakeDamage = false;

    if (this.hp <= 0) {
      this.despawn();
      return;
    }

    const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    if (hpRatio <= this.panicThreshold && !this.isPanicking) {
      this.panic();
    } else {
      this.state = 'brawl';
      this.setVelocityY(-150);
      this.currentDirection *= -1;
      this.setVelocityX(this.moveSpeed * this.currentDirection);
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(100, () => {
        if (!this.active || this.isPanicking) {
          return;
        }

        this.clearTint();
        this.setTint(GAME_BALANCE.rat.profiles[this.faction].tint);
      });
    }

    this.scene.time.delayedCall(350, () => {
      this.canTakeDamage = true;
    });
  }

  // Apply periodic burn damage over time
  applyBurn(damage: number, intervalMs: number, durationMs: number): void {
    if (!this.active) return;
    const ticks = Math.floor(durationMs / intervalMs);
    for (let i = 1; i <= ticks; i++) {
      this.scene.time.delayedCall(i * intervalMs, () => {
        if (!this.active) return;
        this.setTintFill(0xff6600);
        this.scene.time.delayedCall(150, () => {
          if (!this.active) return;
          this.clearTint();
          this.setTint(GAME_BALANCE.rat.profiles[this.faction].tint);
        });
        this.takeDamage(damage);
      });
    }
  }

  // Called each frame by SkillSystem when rat is inside a slow zone
  applySlowField(factor: number): void {
    this.externalSpeedMultiplier = factor;
  }

  // Called each frame by SkillSystem when rat is outside all slow zones
  resetSlowField(): void {
    this.externalSpeedMultiplier = 1.0;
  }

  panic(): void {
    this.isPanicking = true;
    this.state = 'panic';
    this.moveSpeed = Math.max(this.moveSpeed, 250);
    this.setTint(0xff3333);
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    this.setVelocityY(-150);
  }

  applyBossDrive(pipeX: number, surfaceY: number): void {
    if (!this.active) {
      return;
    }

    this.isPanicking = true;
    this.state = 'driven-by-boss';
    this.moveSpeed = Math.max(this.moveSpeed, GAME_BALANCE.rat.bossDriveSpeed);
    this.bossTargetPipeX = pipeX;
    this.bossSurfaceY = surfaceY;

    if (this.x < pipeX) {
      this.currentDirection = 1;
    } else if (this.x > pipeX) {
      this.currentDirection = -1;
    }

    if (this.shouldTriggerPipeClimb(pipeX, surfaceY)) {
      this.climb();
      return;
    }

    this.setVelocityX(this.moveSpeed * this.currentDirection);
  }

  climb(): void {
    if (!this.body || this.isClimbing) {
      return;
    }

    this.isClimbing = true;
    this.state = 'climb';
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.setVelocityX(0);
    this.setVelocityY(-220);
  }

  despawn(): void {
    this.state = 'dead';
    this.setActive(false);
    this.setVisible(false);
    this.body?.stop();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.body) {
      return;
    }

    if (this.body.blocked.right) {
      this.currentDirection = -1;
    } else if (this.body.blocked.left) {
      this.currentDirection = 1;
    }

    if (this.isClimbing) {
      this.setVelocityX(0);
      this.setVelocityY(-220);

      if (this.y < this.surfaceY - 20) {
        this.isClimbing = false;
        this.state = this.isPanicking ? 'panic' : 'wander';
        this.exitPipeToSurface();
      }
      return;
    }

    if (this.shouldSeekPipeEscape()) {
      this.currentDirection = this.x < this.escapePipeX! ? 1 : -1;

      if (this.shouldTriggerPipeClimb(this.escapePipeX!, this.surfaceY)) {
        this.climb();
        return;
      }
    }

    if (this.body.blocked.down && !this.isPanicking) {
      this.edgeCheckTimer += delta;
      if (this.edgeCheckTimer > 100) {
        this.edgeCheckTimer = 0;
        const checkX = this.currentDirection === 1 ? this.body.right + 2 : this.body.left - 2;
        const checkY = this.body.bottom + 2;
        const bodiesUnderFront = this.scene.physics.overlapRect(checkX, checkY, 1, 1, false, true);
        if (bodiesUnderFront.length === 0) {
          this.currentDirection *= -1;
        }
      }
    }

    this.setVelocityX(this.moveSpeed * this.externalSpeedMultiplier * this.currentDirection);
    this.setFlipX(this.currentDirection === -1);

    if (this.y > this.scene.scale.height + 50) {
      this.despawn();
    }
  }

  private exitPipeToSurface(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body || this.escapePipeX === undefined) {
      return;
    }

    const landingY =
      this.surfaceY - GAME_BALANCE.world.surfacePlatformThickness / 2 - this.displayHeight / 2;
    const exitX = this.escapePipeX + this.currentDirection * GAME_BALANCE.rat.pipeExitOffset;

    body.reset(exitX, landingY);
    body.setAllowGravity(true);
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    this.setVelocityY(-60);
  }

  private shouldSeekPipeEscape(): boolean {
    return this.escapePipeX !== undefined && this.y > this.surfaceY && this.isPanicking;
  }

  private shouldTriggerPipeClimb(pipeX: number, surfaceY: number): boolean {
    return this.y > surfaceY && Math.abs(this.x - pipeX) <= GAME_BALANCE.rat.climbTriggerDistance && !this.isClimbing;
  }
}
