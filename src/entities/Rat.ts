import Phaser from 'phaser';

export class Rat extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed = 100;
  private currentDirection = 1; 
  private isPanicking = false;
  // --- 新增：血量變數 ---
  private hp = 2; 

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'rat');
  }

  spawn(x: number, y: number, velocityX: number): void {
    this.body?.reset(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    this.currentDirection = velocityX > 0 ? 1 : -1;
    
    // --- 每次生成時重置狀態 ---
    this.hp = 2;
    this.isPanicking = false;
    this.moveSpeed = 100;
    this.setTint(0x38b000); // 染成正常的綠色
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    this.setBounceY(0.2);
  }

  // --- 新增：受傷處理邏輯 ---
  public takeDamage(amount: number): void {
    if (!this.active || this.hp <= 0) return; // 已死亡或未啟用則忽略
    
    this.hp -= amount;

    if (this.hp <= 0) {
      this.despawn(); // 血量歸零，回收老鼠
    } else {
      // 受傷但未死：進入恐慌狀態！
      this.isPanicking = true;
      this.moveSpeed = 250; // 速度暴增
      this.setTint(0xff3333); // 變成狂暴的紅色
      
      // 重新賦予更高的逃竄速度
      this.setVelocityX(this.moveSpeed * this.currentDirection);
      
      // 稍微給個往上的彈跳力，增加被打到的打擊感
      this.setVelocityY(-150);
    }
  }

  despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    this.body?.stop();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.body) return;

    // 撞牆偵測
    if (this.body.blocked.right) {
      this.currentDirection = -1;
    } else if (this.body.blocked.left) {
      this.currentDirection = 1; 
    }

    // 邊緣偵測 (恐慌狀態下會被無視，直接衝下懸崖！)
    if (this.body.blocked.down && !this.isPanicking) {
      const checkX = this.currentDirection === 1 ? this.body.right + 2 : this.body.left - 2;
      const checkY = this.body.bottom + 2;
      const bodiesUnderFront = this.scene.physics.overlapRect(checkX, checkY, 1, 1, false, true);
      if (bodiesUnderFront.length === 0) {
        this.currentDirection *= -1;
      }
    }

    this.setVelocityX(this.moveSpeed * this.currentDirection);

    if (this.y > this.scene.scale.height + 50) {
      this.despawn();
    }
  }
}