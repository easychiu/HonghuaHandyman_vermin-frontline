import Phaser from 'phaser';

export class Rat extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed = 100;
  public currentDirection = 1; 
  public isPanicking = false;
  
  // --- 新增：陣營與血量 ---
  public faction: 'green' | 'blue' = 'green';
  public hp = 2; 
  // --- 新增：受傷冷卻鎖 (Debounce/I-Frames) ---
  private canTakeDamage = true;
  // --- 新增：邊緣偵測計時器 ---
  private edgeCheckTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'rat');
  }

  // 生成時，可以指定要生綠鼠還是藍鼠
  spawn(x: number, y: number, velocityX: number, faction: 'green' | 'blue' = 'green'): void {
    this.body?.reset(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    this.faction = faction;
    this.isPanicking = false;
    
    // 根據陣營設定數值 (藍鼠血厚、走得慢、體型大)
    if (this.faction === 'blue') {
      this.hp = 4;
      this.moveSpeed = 60;
      this.setTint(0x1d3557); // 深藍色
      this.setScale(1.2);     // 體型放大 1.2 倍
    } else {
      this.hp = 2;
      this.moveSpeed = 100;
      this.setTint(0x38b000); // 綠色
      this.setScale(1);       // 恢復預設大小
    }
    
    this.currentDirection = velocityX > 0 ? 1 : -1;
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    this.setBounceY(0.2);
    this.faction = faction;
    this.isPanicking = false;
    this.canTakeDamage = true; // --- 新增：每次生成時都要解鎖 ---
  }

  // --- 修改：受傷與殘血邏輯 ---
  public takeDamage(amount: number): void {
    // --- 修改：如果處於冷卻鎖定狀態，就直接 return 忽略傷害 ---
    if (!this.active || this.hp <= 0 || !this.canTakeDamage) return;
    
    this.hp -= amount;
    
    // --- 鎖上受傷判定，進入無敵時間 ---
    this.canTakeDamage = false;

    if (this.hp <= 0) {
      this.despawn();
    } else if (this.hp === 1 && !this.isPanicking) {
      this.panic();
    } else {
      // 還有血量，產生物理反饋
      this.setVelocityY(-150);
      this.currentDirection *= -1; 
      this.setVelocityX(this.moveSpeed * this.currentDirection);
      
      // 受傷閃爍視覺特效 (變成白色)
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(100, () => {
        if (this.active && !this.isPanicking) {
           // 閃爍結束，恢復原本的顏色
           this.clearTint();
           this.setTint(this.faction === 'blue' ? 0x1d3557 : 0x38b000);
        }
      });
    }

    // --- 設定 0.4 秒的冷卻時間，時間到才解鎖 ---
    this.scene.time.delayedCall(400, () => {
      this.canTakeDamage = true;
    });
  }

  // 把恐慌邏輯獨立出來，讓程式碼更乾淨
  public panic(): void {
    this.isPanicking = true;
    this.moveSpeed = 250; 
    this.setTint(0xff3333); // 嚇到變成狂暴紅色
    this.setVelocityX(this.moveSpeed * this.currentDirection);
    this.setVelocityY(-150);
  }

  despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    this.body?.stop();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.body) return;

    if (this.body.blocked.right) {
      this.currentDirection = -1;
    } else if (this.body.blocked.left) {
      this.currentDirection = 1; 
    }

    // ==========================================
    // 效能優化：降低邊緣偵測頻率 (Throttle)
    // ==========================================
    if (this.body.blocked.down && !this.isPanicking) {
      this.edgeCheckTimer += delta;
      
      // 每 100 毫秒才發射一次探測，大幅節省效能
      if (this.edgeCheckTimer > 100) {
        this.edgeCheckTimer = 0; // 重置計時器
        
        const checkX = this.currentDirection === 1 ? this.body.right + 2 : this.body.left - 2;
        const checkY = this.body.bottom + 2;
        const bodiesUnderFront = this.scene.physics.overlapRect(checkX, checkY, 1, 1, false, true);
        if (bodiesUnderFront.length === 0) {
          this.currentDirection *= -1;
        }
      }
    }

    this.setVelocityX(this.moveSpeed * this.currentDirection);

    if (this.y > this.scene.scale.height + 50) {
      this.despawn();
    }
  }
}