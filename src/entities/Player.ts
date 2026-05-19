import Phaser from 'phaser';
import {
  getHonghuaThrowAnimationKey,
  getHonghuaWalkAnimationKey,
  HONGHUA_IDLE_FRAMES,
  HONGHUA_TEXTURE_KEY,
} from '../animations/honghuaAnimations';
import { GAME_BALANCE } from '../config/gameBalance';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  
  private speed = 250; 
  private jumpForce = -500;

  // --- Coyote Time 相關變數 ---
  private coyoteTime = 150; // 允許離開平台後還能起跳的寬容時間 (毫秒)
  private coyoteCounter = 0; // 當前的倒數計時器
  // --- 面向與攻擊按鍵 ---
  public facingDirection = 1; // 1: 右, -1: 左
  private spaceKey!: Phaser.Input.Keyboard.Key;
  // --- 放置陷阱按鍵 ---
  private eKey!: Phaser.Input.Keyboard.Key;
  // --- 技能按鍵 1-5 ---
  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private key4!: Phaser.Input.Keyboard.Key;
  private key5!: Phaser.Input.Keyboard.Key;

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
  private lastFacing: 'left' | 'right' = 'right';
  
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, HONGHUA_TEXTURE_KEY, HONGHUA_IDLE_FRAMES.right);
    
    this.maxHp = GAME_BALANCE.player.maxHp;
    this.hp = this.maxHp;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    
    if (scene.input.keyboard) {
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.wasd = scene.input.keyboard.addKeys('W,A,S,D') as any;
        this.spaceKey = scene.input.keyboard.addKey('SPACE');
        this.eKey = scene.input.keyboard.addKey('E');
        this.key1 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.key2 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.key3 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
        this.key4 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
        this.key5 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);
    }

    this.healthBarGraphics = scene.add.graphics().setDepth(50);
  }

  // --- 攻擊偵測 ---
  public isJustAttacking(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.spaceKey);
  }
  // --- 放置陷阱偵測 ---
  public isJustPlacingTrap(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.eKey);
  }
  // --- 技能按鍵偵測 ---
  public isJustUsingSkill(n: 1 | 2 | 3 | 4 | 5): boolean {
    const keyMap = { 1: this.key1, 2: this.key2, 3: this.key3, 4: this.key4, 5: this.key5 };
    return Phaser.Input.Keyboard.JustDown(keyMap[n]);
  }

  public isTryingClimbUp(): boolean {
    return this.cursors.up.isDown || this.wasd.W.isDown;
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
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.setVelocityX(-this.speed);
      this.facingDirection = -1;
      this.lastFacing = 'left';
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.setVelocityX(this.speed);
      this.facingDirection = 1;
      this.lastFacing = 'right';
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

    const isJumpJustDown = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W);

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

    if (this.scene.time.now < this.animationLockUntil) {
      return;
    }

    if (Math.abs(this.body.velocity.x) > 1) {
      this.play(getHonghuaWalkAnimationKey(this.lastFacing), true);
      return;
    }

    this.anims.stop();
    this.setFrame(HONGHUA_IDLE_FRAMES[this.lastFacing]);
  }
}
