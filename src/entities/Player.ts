import Phaser from 'phaser';

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
  // --- 新增：面向與攻擊按鍵 ---
  public facingDirection = 1; // 1: 右, -1: 左
  private spaceKey!: Phaser.Input.Keyboard.Key;
  // --- 新增：放置陷阱按鍵 ---
  private eKey!: Phaser.Input.Keyboard.Key;
  
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player_texture');
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    
    if (scene.input.keyboard) {
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.wasd = scene.input.keyboard.addKeys('W,A,S,D') as any;
        this.spaceKey = scene.input.keyboard.addKey('SPACE');
        // --- 綁定 E 鍵 ---
        this.eKey = scene.input.keyboard.addKey('E');
    }
    
  }
  // --- 新增：提供給場景偵測是否剛按下攻擊 ---
  public isJustAttacking(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.spaceKey);
  }
  // --- 新增：提供給場景偵測是否剛按下放置陷阱 ---
  public isJustPlacingTrap(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.eKey);
  }
  // 接收 scene 傳來的 delta (兩幀之間相差的毫秒數)
  update(delta: number): void {
    if (!this.body) return;

    // 處理左右移動與更新面向
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.setVelocityX(-this.speed);
      this.facingDirection = -1; // 記錄面朝左
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.setVelocityX(this.speed);
      this.facingDirection = 1;  // 記錄面朝右
    } else {
      this.setVelocityX(0);
    }

    // ==========================================
    // 處理土狼時間 (Coyote Time) 邏輯
    // ==========================================
    if (this.body.touching.down) {
      // 如果腳踩在地上，計時器保持滿的
      this.coyoteCounter = this.coyoteTime;
    } else {
      // 離開地面後，開始扣減時間
      this.coyoteCounter -= delta;
    }

    // 偵測「按下跳躍鍵的瞬間」
    const isJumpJustDown = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W);

    // 只要剛按下跳躍，而且計時器還沒歸零（代表剛離開邊緣不久），就允許起跳
    if (isJumpJustDown && this.coyoteCounter > 0) {
      this.setVelocityY(this.jumpForce);
      // 起跳後立刻把計時器歸零，防止在空中連續按出二次跳躍
      this.coyoteCounter = 0;
    }
  }
}