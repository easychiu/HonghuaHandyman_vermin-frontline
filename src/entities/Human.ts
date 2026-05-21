import Phaser from 'phaser';

export class Human extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed = 50; // 人類平常散步速度很慢
  private currentDirection = 1; 
  public isPanicking = false; // 開放給外部讀取的狀態

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'human_texture');
  }

  spawn(x: number, y: number): void {
    this.body?.reset(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    // 重置狀態
    this.isPanicking = false;
    this.moveSpeed = 50;
    this.setTint(0x457b9d); // 預設為寧靜的藍色
    
    // 隨機決定一開始的散步方向
    this.currentDirection = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;
    this.setVelocityX(this.moveSpeed * this.currentDirection);
  }

  // --- 新增：驚嚇處理邏輯 ---
  public panic(): void {
    if (this.isPanicking) return; // 如果已經在害怕了就不重複觸發
    
    this.isPanicking = true;
    this.moveSpeed = 200; // 嚇到拔腿狂奔
    this.setTint(0xf4a261); // 變成驚恐的橘黃色
    
    // 嚇到時隨機往左或往右跑
    this.currentDirection = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    
    // 嚇到整個人跳起來
    this.setVelocityY(-200);
    
    console.warn('人類受到驚嚇！國王聲望 -1');

    const excl = this.scene.add.text(this.x, this.y - 30, '❗', {
      fontSize: '20px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: excl,
      y: this.y - 55,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => excl.destroy(),
    });
  }

  despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    this.body?.stop();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.body) return;

    // 撞牆轉向
    if (this.body.blocked.right) {
      this.currentDirection = -1;
    } else if (this.body.blocked.left) {
      this.currentDirection = 1; 
    }

    // 邊緣偵測 (人類知道那是水溝，不會自己跳下去)
    if (this.body.blocked.down) {
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