import Phaser from 'phaser';
import {
  getHonghuaIdleAnimationKey,
  getHonghuaThrowAnimationKey,
  getHonghuaWalkAnimationKey,
  HONGHUA_INITIAL_FRAME,
  HONGHUA_TEXTURE_KEY,
} from '../animations/honghuaAnimations';
import { GAME_BALANCE } from '../config/gameBalance';
import { GameInputController } from '../input/GameInputController';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private static readonly IDLE_FALLBACK_IDLE_MS = 2000;

  private readonly inputController: GameInputController;
  
  private speed = 250; 
  private jumpForce = -500;

  // --- Coyote Time 相關變數 ---
  private coyoteTime = 150; // 允許離開平台後還能起跳的寬容時間 (毫秒)
  private coyoteCounter = 0; // 當前的倒數計時器
  // --- 面向 ---
  public facingDirection = 1; // 1: 右, -1: 左

  // --- 血量系統 ---
  public hp: number;
  public readonly maxHp: number;
  public isInvincible = false;
  private invincibilityTimer?: Phaser.Time.TimerEvent;
  private flashTimer?: Phaser.Time.TimerEvent;

  // --- 護盾系統 ---
  public shieldHitsLeft = 0;
  private shieldGraphics?: Phaser.GameObjects.Graphics;

  // --- 血條 Graphics ---
  private healthBarGraphics!: Phaser.GameObjects.Graphics;
  private animationLockUntil = 0;
  private lastInteractionAt = 0;
  private lastFacing: 'left' | 'right' = 'right';
  
  constructor(scene: Phaser.Scene, x: number, y: number, inputController: GameInputController) {
    super(scene, x, y, HONGHUA_TEXTURE_KEY, HONGHUA_INITIAL_FRAME);
    this.inputController = inputController;
    
    this.maxHp = GAME_BALANCE.player.maxHp;
    this.hp = this.maxHp;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    this.setCollideWorldBounds(true);
    this.setFlipX(false);
    this.lastInteractionAt = scene.time.now;
    this.play(getHonghuaIdleAnimationKey(), true);

    this.healthBarGraphics = scene.add.graphics().setDepth(50);
  }

  // --- 受傷處理 ---
  public receiveRatDamage(amount: number): void {
    if (this.isInvincible || !this.active) return;

    if (this.shieldHitsLeft > 0) {
      this.shieldHitsLeft--;
      if (this.shieldHitsLeft <= 0) {
        this.destroyShield();
      } else {
        // 護盾被打中閃爍
        this.shieldGraphics?.setAlpha(0.3);
        this.scene.time.delayedCall(150, () => this.shieldGraphics?.setAlpha(1));
      }
      this.playHurtAnimation();
      this.startInvincibility();
      return;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.playHurtAnimation();
    this.startInvincibility();
  }

  private startInvincibility(): void {
    this.isInvincible = true;
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.addEvent({
      delay: GAME_BALANCE.player.flashIntervalMs,
      loop: true,
      callback: () => { this.setAlpha(this.alpha > 0.5 ? 0.2 : 1); },
    });
    this.invincibilityTimer?.remove();
    this.invincibilityTimer = this.scene.time.delayedCall(GAME_BALANCE.player.invincibilityMs, () => {
      this.isInvincible = false;
      this.flashTimer?.remove();
      this.setAlpha(1);
    });
  }

  // --- 護盾 ---
  public activateShield(hits: number, radius: number): void {
    this.destroyShield();
    this.shieldHitsLeft = hits;
    this.shieldGraphics = this.scene.add.graphics().setDepth(49);
    this.shieldGraphics.lineStyle(4, 0x00ffaa, 0.9);
    this.shieldGraphics.fillStyle(0x00ffaa, 0.15);
    this._drawShield(radius);
  }

  private _drawShield(radius: number): void {
    if (!this.shieldGraphics) return;
    this.shieldGraphics.clear();
    this.shieldGraphics.lineStyle(4, 0x00ffaa, 0.9);
    this.shieldGraphics.fillStyle(0x00ffaa, 0.15);
    this.shieldGraphics.fillCircle(this.x, this.y, radius);
    this.shieldGraphics.strokeCircle(this.x, this.y, radius);
  }

  public destroyShield(): void {
    this.shieldGraphics?.destroy();
    this.shieldGraphics = undefined;
    this.shieldHitsLeft = 0;
  }

  public isAlive(): boolean {
    return this.hp > 0;
  }

  // 接收 scene 傳來的 delta (兩幀之間相差的毫秒數)
  update(delta: number): void {
    if (!this.body) return;

    // 處理左右移動與更新面向
    const moveAxisX = this.inputController.getMoveAxisX();
    const hasInteractionThisFrame =
      Math.abs(moveAxisX) > 0.1 ||
      this.inputController.isClimbUpHeld() ||
      this.inputController.isJumpJustPressed() ||
      this.inputController.isAttackJustPressed() ||
      this.inputController.isTrapJustPressed() ||
      this.inputController.isSkillJustPressed(1) ||
      this.inputController.isSkillJustPressed(2) ||
      this.inputController.isSkillJustPressed(3) ||
      this.inputController.isSkillJustPressed(4) ||
      this.inputController.isSkillJustPressed(5);
    if (hasInteractionThisFrame) {
      this.lastInteractionAt = this.scene.time.now;
    }
    if (moveAxisX < -0.1) {
      this.setVelocityX(-this.speed);
      this.facingDirection = -1;
      this.lastFacing = 'left';
      this.setFlipX(true);
    } else if (moveAxisX > 0.1) {
      this.setVelocityX(this.speed);
      this.facingDirection = 1;
      this.lastFacing = 'right';
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    // ==========================================
    // 土狼時間 (Coyote Time) 邏輯
    // ==========================================
    if (this.body.touching.down) {
      this.coyoteCounter = this.coyoteTime;
    } else {
      this.coyoteCounter -= delta;
    }

    const isJumpJustDown = this.inputController.isJumpJustPressed();

    if (isJumpJustDown && this.coyoteCounter > 0) {
      this.setVelocityY(this.jumpForce);
      this.coyoteCounter = 0;
    }

    // 更新護盾位置
    if (this.shieldGraphics && this.shieldHitsLeft > 0) {
      this._drawShield(GAME_BALANCE.skills.baoYe.radius);
    }

    // 更新血條
    this._drawHealthBar();
    this.updateAnimationState();
  }

  private _drawHealthBar(): void {
    const barW = 40;
    const barH = 6;
    const barX = this.x - barW / 2;
    const barY = this.y - this.displayHeight / 2 - 12;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;

    this.healthBarGraphics.clear();
    // 背景
    this.healthBarGraphics.fillStyle(0x000000, 0.6);
    this.healthBarGraphics.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    // HP 條
    const hpColor = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff3333;
    this.healthBarGraphics.fillStyle(hpColor, 1);
    this.healthBarGraphics.fillRect(barX, barY, barW * ratio, barH);
  }

  destroy(fromScene?: boolean): void {
    this.invincibilityTimer?.remove();
    this.flashTimer?.remove();
    this.healthBarGraphics?.destroy();
    this.shieldGraphics?.destroy();
    super.destroy(fromScene);
  }

  public playAttackAnimation(): void {
    this.playLockedAnimation('honghua-attack', 320);
  }

  public playClimbAnimation(): void {
    this.playLockedAnimation('honghua-climb', 260);
  }

  public playThrowAnimation(type: 'qingZai' | 'shuangZi' | 'hongHui' | 'baiHui' | 'baoYe'): void {
    this.playLockedAnimation(getHonghuaThrowAnimationKey(type), 320);
  }

  private playHurtAnimation(): void {
    this.playLockedAnimation('honghua-hurt', 360);
  }

  private playLockedAnimation(key: string, durationMs: number): void {
    this.animationLockUntil = this.scene.time.now + durationMs;
    this.play(key, true);
  }

  private updateAnimationState(): void {
    if (!this.active || !this.body) {
      return;
    }

    if (this.scene.time.now - this.lastInteractionAt >= Player.IDLE_FALLBACK_IDLE_MS) {
      this.animationLockUntil = 0;
      this.play(getHonghuaIdleAnimationKey(), true);
      return;
    }

    if (this.scene.time.now < this.animationLockUntil) {
      return;
    }

    if (Math.abs(this.body.velocity.x) > 1) {
      this.play(getHonghuaWalkAnimationKey(), true);
      return;
    }

    this.play(getHonghuaIdleAnimationKey(), true);
  }
}
